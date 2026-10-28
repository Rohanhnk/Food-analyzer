import type { FoodRecord, Goal, Meal, Recipe } from "@/lib/contracts";
import type { ImageRecord, PaginatedMeals, StorageRepository } from "./interface";
import { VERIFIED_REFERENCE_FOODS } from "@nourish/nutrition";

export class InMemoryStorageRepository implements StorageRepository {
  private readonly foods = new Map<string, FoodRecord>();
  private readonly recipes = new Map<string, Recipe & { ownerId: string }>();
  private readonly meals = new Map<string, Meal & { ownerId: string }>();
  private readonly goals = new Map<string, Array<{ goal: Goal; effectiveDate: string; createdAt: string }>>();
  private readonly images = new Map<string, ImageRecord>();
  private readonly idempotency = new Map<string, { statusCode: number; responseBody: string }>();

  constructor() {
    this.seedDefaultFoods();
  }

  seedDefaultFoods(): void {
    for (const food of VERIFIED_REFERENCE_FOODS) {
      this.foods.set(food.id, {
        id: food.id,
        name: food.name,
        aliases: [...food.aliases],
        category: food.category,
        per100g: { ...food.per100g },
        servingGrams: food.standardServing?.grams ?? 100,
        servingLabel: food.standardServing?.description ?? "1 serving",
        basis: food.basis,
        source: food.source,
        sourceVersion: food.sourceVersion,
      });
    }
  }

  clearAll(): void {
    this.foods.clear();
    this.recipes.clear();
    this.meals.clear();
    this.goals.clear();
    this.images.clear();
    this.idempotency.clear();
    this.seedDefaultFoods();
  }

  // Foods
  async findFoodById(id: string): Promise<FoodRecord | null> {
    const f = this.foods.get(id);
    return f ? { ...f } : null;
  }

  async searchFoods(query: string): Promise<FoodRecord[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: FoodRecord[] = [];
    for (const food of this.foods.values()) {
      const matchName = food.name.toLowerCase().includes(q);
      const matchAlias = food.aliases.some(a => a.toLowerCase().includes(q));
      if (matchName || matchAlias) {
        results.push({ ...food });
      }
    }
    return results;
  }

  async listAllFoods(): Promise<FoodRecord[]> {
    return Array.from(this.foods.values()).map(f => ({ ...f }));
  }

  async importFoods(foods: FoodRecord[]): Promise<number> {
    for (const food of foods) {
      this.foods.set(food.id, { ...food });
    }
    return foods.length;
  }

  // Recipes (owner-scoped)
  async findRecipeById(ownerId: string, recipeId: string): Promise<Recipe | null> {
    const r = this.recipes.get(recipeId);
    if (!r || r.ownerId !== ownerId) return null;
    return {
      id: r.id,
      name: r.name,
      cookedYieldGrams: r.cookedYieldGrams,
      ingredients: r.ingredients,
    };
  }

  async listRecipes(ownerId: string): Promise<Recipe[]> {
    const list: Recipe[] = [];
    for (const r of this.recipes.values()) {
      if (r.ownerId === ownerId) {
        list.push({
          id: r.id,
          name: r.name,
          cookedYieldGrams: r.cookedYieldGrams,
          ingredients: r.ingredients,
        });
      }
    }
    return list;
  }

  async saveRecipe(ownerId: string, recipe: Recipe): Promise<Recipe> {
    this.recipes.set(recipe.id, { ...recipe, ownerId });
    return { ...recipe };
  }

  async deleteRecipe(ownerId: string, recipeId: string): Promise<boolean> {
    const r = this.recipes.get(recipeId);
    if (!r || r.ownerId !== ownerId) return false;
    return this.recipes.delete(recipeId);
  }

  // Meals (owner-scoped)
  async findMealById(ownerId: string, mealId: string): Promise<Meal | null> {
    const m = this.meals.get(mealId);
    if (!m || m.ownerId !== ownerId) return null;
    return {
      id: m.id,
      date: m.date,
      timezone: m.timezone,
      type: m.type,
      title: m.title,
      inputType: m.inputType,
      imageId: m.imageId,
      items: m.items,
      createdAt: m.createdAt,
    };
  }

  async listMealsByDate(ownerId: string, date: string): Promise<Meal[]> {
    const list: Meal[] = [];
    for (const m of this.meals.values()) {
      if (m.ownerId === ownerId && m.date === date) {
        list.push({
          id: m.id,
          date: m.date,
          timezone: m.timezone,
          type: m.type,
          title: m.title,
          inputType: m.inputType,
          imageId: m.imageId,
          items: m.items,
          createdAt: m.createdAt,
        });
      }
    }
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listMealsRange(
    ownerId: string,
    from?: string,
    to?: string,
    cursor?: string,
    limit = 50
  ): Promise<PaginatedMeals> {
    const list: Meal[] = [];
    for (const m of this.meals.values()) {
      if (m.ownerId === ownerId) {
        if (from && m.date < from) continue;
        if (to && m.date > to) continue;
        list.push({
          id: m.id,
          date: m.date,
          timezone: m.timezone,
          type: m.type,
          title: m.title,
          inputType: m.inputType,
          imageId: m.imageId,
          items: m.items,
          createdAt: m.createdAt,
        });
      }
    }

    list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    let startIndex = 0;
    if (cursor) {
      const idx = list.findIndex(m => m.id === cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const paged = list.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < list.length && paged.length > 0 ? paged[paged.length - 1].id : null;

    return {
      meals: paged,
      nextCursor,
    };
  }

  async saveMeal(ownerId: string, meal: Meal): Promise<Meal> {
    this.meals.set(meal.id, { ...meal, ownerId });
    return { ...meal };
  }

  async deleteMeal(ownerId: string, mealId: string): Promise<boolean> {
    const m = this.meals.get(mealId);
    if (!m || m.ownerId !== ownerId) return false;
    return this.meals.delete(mealId);
  }

  // Goals (owner-scoped & effective dated)
  async getEffectiveGoal(ownerId: string, date: string): Promise<{ goal: Goal; effectiveDate: string }> {
    const userGoals = this.goals.get(ownerId) ?? [];
    // Filter goals with effectiveDate <= date, sorted descending by effectiveDate
    const eligible = userGoals
      .filter(g => g.effectiveDate <= date)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.createdAt.localeCompare(a.createdAt));

    if (eligible.length > 0) {
      return { goal: { ...eligible[0].goal }, effectiveDate: eligible[0].effectiveDate };
    }

    // Default system goal
    return {
      goal: { mode: "maintain", kcal: 2000, protein: 120, carbs: 220, fat: 65 },
      effectiveDate: date,
    };
  }

  async saveGoal(ownerId: string, goal: Goal, effectiveDate: string): Promise<{ goal: Goal; effectiveDate: string }> {
    const list = this.goals.get(ownerId) ?? [];
    const entry = { goal: { ...goal }, effectiveDate, createdAt: new Date().toISOString() };
    const filtered = list.filter(g => g.effectiveDate !== effectiveDate);
    filtered.push(entry);
    this.goals.set(ownerId, filtered);
    return { goal: { ...goal }, effectiveDate };
  }

  // Images
  async saveImageRecord(record: ImageRecord): Promise<void> {
    this.images.set(record.id, { ...record });
  }

  async findImageById(ownerId: string, imageId: string): Promise<ImageRecord | null> {
    const img = this.images.get(imageId);
    if (!img || img.ownerId !== ownerId) return null;
    return { ...img };
  }

  async deleteImageRecord(ownerId: string, imageId: string): Promise<boolean> {
    const img = this.images.get(imageId);
    if (!img || img.ownerId !== ownerId) return false;
    img.status = "deleted";
    img.buffer = undefined;
    return true;
  }

  // Idempotency
  async getIdempotencyRecord(ownerId: string, key: string): Promise<{ statusCode: number; responseBody: string } | null> {
    const compositeKey = `${ownerId}:${key}`;
    const rec = this.idempotency.get(compositeKey);
    return rec ? { ...rec } : null;
  }

  async saveIdempotencyRecord(ownerId: string, key: string, statusCode: number, responseBody: string): Promise<void> {
    const compositeKey = `${ownerId}:${key}`;
    this.idempotency.set(compositeKey, { statusCode, responseBody });
  }
}

// Global default storage repository
export const defaultStorage = new InMemoryStorageRepository();
