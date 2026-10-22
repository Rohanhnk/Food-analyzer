import type { FoodRecord, Goal, Meal, MealItem, Nutrients } from "./contracts";
export const emptyNutrients = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
export function sumNutrients(values: Nutrients[]): Nutrients {
  return values.reduce((sum, n) => ({ kcal: sum.kcal + n.kcal, protein: sum.protein + n.protein, carbs: sum.carbs + n.carbs, fat: sum.fat + n.fat }), emptyNutrients());
}
export function mealTotal(meal: Pick<Meal, "items">) { return sumNutrients(meal.items.map(i => i.nutrients)); }
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return localDate(d);
}
export function prettyDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" }); }
export function validGrams(grams: number) { return Number.isFinite(grams) && grams > 0 && grams <= 10000; }
/** Demo-only arithmetic. Production calculations must be recomputed by Person 3 on the server. */
export function demoItem(food: FoodRecord, grams: number, id = crypto.randomUUID()): MealItem {
  if (!validGrams(grams)) throw new Error("Enter a weight greater than 0 and no more than 10,000 g.");
  return { id, foodId: food.id, name: food.name, grams,
    nutrients: Object.fromEntries(Object.entries(food.per100g).map(([k, v]) => [k, v * grams / 100])) as Nutrients,
    basis: food.basis, source: food.source, sourceVersion: food.sourceVersion, confirmed: false };
}
export function validateGoals(goals: Goal) {
  if (![goals.kcal, goals.protein, goals.carbs, goals.fat].every(n => Number.isFinite(n) && n >= 0) || goals.kcal <= 0)
    throw new Error("Enter a positive calorie target and non-negative macro targets.");
}
