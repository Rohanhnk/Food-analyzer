import { foodFromLabel } from "./food-input";
import type { AppData, AnalysisResult, Goal, Meal, Recipe, TrackerClient } from "./contracts";
import { demoFoods } from "./demo-foods";
import { demoItem, localDate, shiftDate, validGrams, validateGoals } from "./model";
export const STORAGE_KEY = "nourish-demo-v1";
const pause = () => new Promise(resolve => setTimeout(resolve, 180));
function seed(): AppData {
  const today = localDate();
  const meal = (date: string, type: Meal["type"], title: string, foods: [string, number][]): Meal => ({
    id: crypto.randomUUID(), date, type, title, inputType: "manual", createdAt: new Date().toISOString(),
    items: foods.map(([id, grams]) => ({ ...demoItem(demoFoods.find(f => f.id === id)!, grams), confirmed: true })),
  });
  return { schemaVersion: 1, goals: { mode: "maintain", kcal: 2200, protein: 120, carbs: 260, fat: 70 }, recipes: [], meals: [
    meal(today, "Breakfast", "A slow morning", [["oats", 40], ["banana", 120], ["almonds", 15]]),
    meal(today, "Lunch", "The everyday thali", [["roti", 80], ["dal", 180], ["curd", 100]]),
    ...Array.from({ length: 6 }, (_, i) => meal(shiftDate(today, -i - 1), "Lunch", "Sample daily meal", [["rice", 150 + i * 20], ["chicken", 150], ["sabzi", 100]])),
  ] };
}
function read(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { const data = seed(); write(data); return data; }
  try {
    const data = JSON.parse(raw);
    if (data.schemaVersion !== 1 || !Array.isArray(data.meals) || !Array.isArray(data.recipes) || !data.goals) throw new Error();
    validateGoals(data.goals);
    for (const meal of data.meals) {
      if (!meal.id || !meal.date || !Array.isArray(meal.items)) throw new Error();
      for (const item of meal.items) if (!validGrams(item.grams) || !item.nutrients || !Object.values(item.nutrients).every(n => typeof n === "number" && Number.isFinite(n))) throw new Error();
    }
    return data;
  } catch { throw new Error("Saved demo data could not be read. Clear the site’s local storage to start a fresh demo."); }
}
function write(data: AppData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { throw new Error("This browser cannot save demo data. Enable site storage or free some browser space and retry."); }
}
async function change(update: (data: AppData) => AppData) { await pause(); const data = update(read()); write(data); return data; }
export const demoClient: TrackerClient = {
  mode: "demo",
  async saveFood(input, id) {
    const food = foodFromLabel(input, id ?? `personal_${crypto.randomUUID()}`);
    await change(d => ({ ...d, foods: [...(d.foods ?? []).filter(f => f.id !== food.id), food] })); return food;
  },
  async load() { await pause(); return read(); },
  async searchFoods(query) { await pause(); const q = query.trim().toLowerCase(); return [...demoFoods, ...(read().foods ?? [])].filter(f => `${f.name} ${f.aliases.join(" ")}`.toLowerCase().includes(q)); },
  async analyzeText(text): Promise<AnalysisResult> {
    await pause();
    // Deterministic demo parser, not an AI call. Unknown phrases are returned for manual resolution.
    const chunks = text.toLowerCase().split(/,|\band\b/).map(x => x.trim()).filter(Boolean);
    return { foods: chunks.map(chunk => {
      const match = demoFoods.find(f => f.aliases.some(a => new RegExp(`\\b${a}\\b`).test(chunk)));
      const amount = chunk.match(/(\d+(?:\.\d+)?)\s*(g\b|grams?\b|pieces?\b|bowls?\b)?/);
      const quantity = amount ? Number(amount[1]) : null;
      const unit = !amount ? null : amount[2]?.startsWith("g") ? "g" : amount[2]?.startsWith("bowl") ? "bowl" : "piece";
      return { name: match?.name ?? chunk, quantity, unit, warnings: match ? ["Demo interpretation. Confirm food and weight."] : ["No demo catalog match. Search and add the food manually."] };
    }), warnings: ["Demo text interpretation only. Serving weights and nutrition are illustrative; confirm every amount."] };
  },
  async saveMeal(meal) {
    if (!meal.items.length || meal.items.some(i => !validGrams(i.grams) || !i.confirmed)) throw new Error("Confirm at least one food and all portion weights before saving.");
    return change(d => ({ ...d, meals: d.meals.some(m => m.id === meal.id) ? d.meals.map(m => m.id === meal.id ? meal : m) : [...d.meals, meal] }));
  },
  async deleteMeal(id) { return change(d => ({ ...d, meals: d.meals.filter(m => m.id !== id) })); },
  async saveGoals(goals: Goal) { validateGoals(goals); return change(d => ({ ...d, goals })); },
  async saveRecipe(recipe: Recipe) {
    if (!recipe.name.trim() || !validGrams(recipe.cookedYieldGrams) || !recipe.ingredients.length || recipe.ingredients.some(i => !validGrams(i.grams))) throw new Error("Add a recipe name, ingredients and a valid cooked yield.");
    return change(d => ({ ...d, recipes: d.recipes.some(r => r.id === recipe.id) ? d.recipes.map(r => r.id === recipe.id ? recipe : r) : [...d.recipes, recipe] }));
  },
  async deleteRecipe(id) { return change(d => ({ ...d, recipes: d.recipes.filter(r => r.id !== id) })); },
};
