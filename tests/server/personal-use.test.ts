import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as createFood } from "@/app/api/foods/route";
import { PATCH as editFood } from "@/app/api/foods/[id]/route";
import { GET as searchFood } from "@/app/api/foods/search/route";
import { POST as preview } from "@/app/api/meals/preview/route";
import { POST as saveMeal, GET as getMeals } from "@/app/api/meals/route";
import { GET as getSummary } from "@/app/api/summary/route";
import { POST as saveRecipe } from "@/app/api/recipes/route";
import { defaultStorage } from "@/server/storage/in-memory";
import { requirePersonalAccount } from "@/server/personal-access";
import { foodFromLabel } from "@/lib/food-input";
import { mealsToCsv } from "@/lib/export";
const user = "test-user-personal";
const label = { name: 'Whey, "vanilla"', aliases: ["whey"], basis: "as-served", source: "My whey package", referenceGrams: 30, nutrients: { kcal: 120, protein: 24, carbs: 3, fat: 2 } };
function req(path: string, body?: unknown, token = user) {
  return new NextRequest(`http://localhost${path}`, { method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
beforeEach(() => { defaultStorage.clearAll(); vi.stubEnv("PERSONAL_USER_ID", user); });
afterEach(() => vi.unstubAllEnvs());
it("rejects any signed-in account except the configured owner", async () => {
  expect(() => requirePersonalAccount("someone", undefined)).toThrow();
  const denied = await createFood(req("/api/foods", label, "test-user-intruder"));
  expect(denied.status).toBe(403);
  expect((await searchFood(req("/api/foods/search?q=whey", undefined, "test-user-intruder"))).status).toBe(403);
});
it("requires configuration instead of making the first account an owner", () => {
  expect(() => requirePersonalAccount(user, "")).toThrow("not configured");
  expect(() => requirePersonalAccount(user, user)).not.toThrow();
});
it("normalizes label values, previews, saves and preserves historical macros after label edits", async () => {
  const created = await createFood(req("/api/foods", label)); expect(created.status).toBe(201);
  const { food } = await created.json();
  expect(food.per100g.protein).toBe(80);
  expect((await searchFood(req("/api/foods/search?q="))).status).toBe(200);
  const items = [{ foodId: food.id, grams: 45, confirmed: true }];
  const response = await preview(req("/api/meals/preview", { items })); expect(response.status).toBe(200);
  const reviewed = await response.json(); expect(reviewed.totals.protein).toBe(36); expect(reviewed.totals.carbs).toBe(4.5);
  const saved = await saveMeal(req("/api/meals", { date: "2026-10-26", timezone: "Asia/Kolkata", type: "Breakfast", title: "My shake", inputType: "manual", items }));
  expect(saved.status).toBe(201); const { meal } = await saved.json(); expect(meal.items[0].nutrients).toEqual(reviewed.items[0].nutrients);
  const edited = await editFood(req(`/api/foods/${food.id}`, { ...label, nutrients: { ...label.nutrients, protein: 21 } }), { params: Promise.resolve({ id: food.id }) }); expect(edited.status).toBe(200);
  const history = await (await getMeals(req("/api/meals?date=2026-10-26"))).json(); expect(history.meals[0].items[0].nutrients.protein).toBe(36);
  const current = await (await preview(req("/api/meals/preview", { items }))).json(); expect(current.totals.protein).toBe(31.5);
  const summary = await (await getSummary(req("/api/summary?date=2026-10-26"))).json(); expect(summary.consumed.protein).toBe(36);
  const csv = mealsToCsv(history.meals); expect(csv).toContain('"36"'); expect(csv).toContain('"Whey, ""vanilla"""');
});
it("logs a cooked portion of a custom recipe using its measured yield", async () => {
  const { food } = await (await createFood(req("/api/foods", label))).json();
  const { recipe } = await (await saveRecipe(req("/api/recipes", { name: "Protein bowl", cookedYieldGrams: 200, ingredients: [{ foodId: food.id, grams: 30 }] }))).json();
  const response = await preview(req("/api/meals/preview", { items: [{ recipeId: recipe.id, grams: 100, confirmed: true }] }));
  expect(response.status).toBe(200); const result = await response.json();
  expect(result.totals.protein).toBe(12); expect(result.totals.carbs).toBe(1.5); expect(result.items[0].recipeId).toBe(recipe.id);
});
it("rejects invalid label measurements and unconfirmed meal writes", async () => {
  for (const body of [{ ...label, referenceGrams: 0 }, { ...label, nutrients: { ...label.nutrients, protein: -1 } }, { ...label, source: "" }]) {
    expect((await createFood(req("/api/foods", body))).status).toBe(400);
  }
  expect(() => foodFromLabel({ ...label, basis: "raw", nutrients: { ...label.nutrients, protein: NaN } }, "test")).toThrow();
  const { food } = await (await createFood(req("/api/foods", label))).json();
  const response = await saveMeal(req("/api/meals", { date: "2026-10-26", timezone: "Asia/Kolkata", type: "Lunch", title: "Unchecked", inputType: "manual", items: [{ foodId: food.id, grams: 30, confirmed: false }] }));
  expect(response.status).toBe(400);
});
it("exports spreadsheet-safe quoted text and a header for empty history", () => {
  const food = foodFromLabel({ ...label, basis: "as-served" }, "food");
  const csv = mealsToCsv([{ id: "m", title: '=HYPERLINK("bad")', date: "2026-10-26", type: "Lunch", inputType: "manual", createdAt: "", items: [{ id: "i", foodId: "food", name: "test\nfood", grams: 100, nutrients: food.per100g, basis: "as-served", source: "+formula", sourceVersion: "1", confirmed: true }] }]);
  expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain("'+formula"); expect(csv).toContain('"test\nfood"');
  expect(mealsToCsv([])).toContain('"protein_g"');
});

it("deduplicates simultaneous retries of a new meal", async () => {
  const { food } = await (await createFood(req("/api/foods", label))).json();
  const body = { date: "2026-10-26", timezone: "Asia/Kolkata", type: "Lunch", title: "One record", inputType: "manual", items: [{ foodId: food.id, grams: 30, confirmed: true }] };
  function request() { const request = req("/api/meals", body); request.headers.set("idempotency-key", "one-personal-meal"); return request; }
  const responses = await Promise.all([saveMeal(request()), saveMeal(request())]);
  expect(responses.map(r => r.status)).toEqual([201, 201]);
  expect(await defaultStorage.listMealsByDate(user, "2026-10-26")).toHaveLength(1);
});
