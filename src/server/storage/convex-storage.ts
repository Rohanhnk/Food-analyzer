import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { FoodRecord, Goal, Meal, Recipe } from "@/lib/contracts";
import type { ImageRecord, PaginatedMeals, StorageRepository } from "./interface";
import type { FoodRecord as CatalogFood } from "@nourish/nutrition";
import { ApiError } from "../errors";

/** Server-to-server transport; the shared capability never enters frontend bundles. */
export interface ConvexTransport {
  query<T>(name: string, args: Record<string, unknown>): Promise<T>;
  mutation<T>(name: string, args: Record<string, unknown>): Promise<T>;
}
function transport(): ConvexTransport {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.NOURISH_BACKEND_SECRET;
  if (!url || !secret || secret.length < 32) throw new ApiError("SERVICE_UNAVAILABLE", "Live storage requires a Convex URL and a server-only NOURISH_BACKEND_SECRET of at least 32 characters.", 503);
  const client = new ConvexHttpClient(url);
  const args = (value: Record<string, unknown>) => JSON.parse(JSON.stringify({ ...value, backendSecret: secret }));
  return {
    query: async (name, value) => { try { return await client.query(makeFunctionReference<"query">(name), args(value)); } catch { throw new ApiError("SERVICE_UNAVAILABLE", "Persistent storage request failed. Check server configuration.", 503); } },
    mutation: async (name, value) => { try { return await client.mutation(makeFunctionReference<"mutation">(name), args(value)); } catch { throw new ApiError("SERVICE_UNAVAILABLE", "Persistent storage write failed. Check server configuration.", 503); } },
  };
}
export class ConvexStorageRepository implements StorageRepository {
  constructor(private readonly injected?: ConvexTransport) {}
  private get db() { return this.injected ?? transport(); }
  private food(food: CatalogFood): FoodRecord {
    return { ...food, aliases: [...food.aliases], servingGrams: food.standardServing?.grams ?? 100, servingLabel: food.standardServing?.description ?? "100 g" };
  }
  async findFoodById(id: string) { const food = await this.db.query<CatalogFood | null>("foods:getById", { id }); return food ? this.food(food) : null; }
  async searchFoods(query: string) { return (await this.db.query<CatalogFood[]>("foods:search", { query })).map(f => this.food(f)); }
  async listAllFoods() { return (await this.db.query<CatalogFood[]>("foods:listAll", {})).map(f => this.food(f)); }
  async importFoods(foods: FoodRecord[]): Promise<number> {
    const records = foods.map(f => ({ id: f.id, name: f.name, aliases: f.aliases, category: f.category, basis: f.basis, per100g: f.per100g, source: f.source, sourceVersion: f.sourceVersion, attribution: "Personal nutrition entry", standardServing: { unit: "g", grams: f.servingGrams, description: f.servingLabel } }));
    const result = await this.db.mutation<{ count: number }>("foods:importCatalog", { foods: records }); return result.count;
  }
  findRecipeById(ownerId: string, id: string) { return this.db.query<Recipe | null>("recipes:getById", { ownerId, id }); }
  listRecipes(ownerId: string) { return this.db.query<Recipe[]>("recipes:listByOwner", { ownerId }); }
  saveRecipe(ownerId: string, recipe: Recipe) {
    return this.db.mutation<Recipe>("recipes:save", { recipe: { id: recipe.id, name: recipe.name, ingredients: recipe.ingredients, cookedYieldGrams: recipe.cookedYieldGrams, ownerId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
  }
  deleteRecipe(ownerId: string, id: string) { return this.db.mutation<boolean>("recipes:deleteRecipe", { ownerId, id }); }
  findMealById(ownerId: string, id: string) { return this.db.query<Meal | null>("meals:getById", { ownerId, id }); }
  listMealsByDate(ownerId: string, date: string) { return this.db.query<Meal[]>("meals:listByDate", { ownerId, date }); }
  listMealsRange(ownerId: string, from?: string, to?: string, cursor?: string, limit = 50) { return this.db.query<PaginatedMeals>("meals:listRange", { ownerId, from, to, cursor, limit }); }
  saveMeal(ownerId: string, meal: Meal) {
    return this.db.mutation<Meal>("meals:save", { meal: { id: meal.id, ownerId, date: meal.date, timezone: meal.timezone ?? "UTC", type: meal.type, title: meal.title, inputType: meal.inputType, imageId: meal.imageId, items: meal.items, createdAt: meal.createdAt, updatedAt: new Date().toISOString() } });
  }
  deleteMeal(ownerId: string, id: string) { return this.db.mutation<boolean>("meals:deleteMeal", { ownerId, id }); }
  async getEffectiveGoal(ownerId: string, date: string) {
    const value = await this.db.query<(Goal & { effectiveDate: string }) | null>("goals:getEffective", { ownerId, date });
    if (!value) return { goal: { mode: "maintain" as const, kcal: 2000, protein: 120, carbs: 220, fat: 65 }, effectiveDate: date };
    return { goal: { mode: value.mode, kcal: value.kcal, protein: value.protein, carbs: value.carbs, fat: value.fat }, effectiveDate: value.effectiveDate };
  }
  async saveGoal(ownerId: string, goal: Goal, effectiveDate: string) {
    await this.db.mutation("goals:save", { ownerId, ...goal, effectiveDate }); return { goal, effectiveDate };
  }
  async saveImageRecord(record: ImageRecord) {
    if (!record.buffer) throw new Error("Image bytes are required.");
    const url = await this.db.mutation<string>("assets:uploadUrl", {});
    const upload = await fetch(url, { method: "POST", headers: { "Content-Type": record.mimeType }, body: new Uint8Array(record.buffer) });
    if (!upload.ok) throw new Error("Image upload failed.");
    const { storageId } = await upload.json();
    const { buffer: _buffer, ...metadata } = record;
    void _buffer;
    try { await this.db.mutation("assets:save", { record: { ...metadata, storageId } }); }
    catch (error) { await this.db.mutation("assets:removeOrphan", { storageId }); throw error; }
  }
  async findImageById(ownerId: string, id: string): Promise<ImageRecord | null> {
    const image = await this.db.query<(ImageRecord & { url: string | null }) | null>("assets:get", { ownerId, id });
    if (!image) return null;
    if (!image.url) throw new Error("Stored image bytes are missing.");
    const response = await fetch(image.url);
    if (!response.ok) throw new Error("Unable to read stored image.");
    return { ...image, buffer: Buffer.from(await response.arrayBuffer()) };
  }
  deleteImageRecord(ownerId: string, id: string) { return this.db.mutation<boolean>("assets:remove", { ownerId, id }); }
  getIdempotencyRecord(ownerId: string, key: string) { return this.db.query<{ statusCode: number; responseBody: string } | null>("idempotency:get", { ownerId, key }); }
  async saveIdempotencyRecord(ownerId: string, key: string, statusCode: number, responseBody: string) { await this.db.mutation("idempotency:save", { ownerId, key, statusCode, responseBody }); }
}
