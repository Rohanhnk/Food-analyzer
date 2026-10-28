import type { Meal } from "./contracts";
function cell(value: unknown): string {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
/** One row per item; nutrition comes from saved snapshots, never today's catalog. */
export function mealsToCsv(meals: Meal[]): string {
  const header = ["meal_id", "date", "timezone", "meal_type", "meal_name", "food", "food_id", "recipe_id", "grams", "kcal", "protein_g", "carbs_g", "fat_g", "basis", "source", "source_version", "confirmed"];
  const rows = meals.flatMap(meal => meal.items.map(item => [meal.id, meal.date, meal.timezone ?? "", meal.type, meal.title, item.name, item.foodId, item.recipeId ?? "", item.grams, item.nutrients.kcal, item.nutrients.protein, item.nutrients.carbs, item.nutrients.fat, item.basis, item.source, item.sourceVersion, item.confirmed]));
  return "\uFEFF" + [header, ...rows].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
export function downloadMealsCsv(meals: Meal[]) {
  const url = URL.createObjectURL(new Blob([mealsToCsv(meals)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "nourish-meals.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
