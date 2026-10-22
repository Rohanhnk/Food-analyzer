/** Shared transport contracts. Dates are local YYYY-MM-DD; amounts are grams. */
export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type FoodRecord = {
  id: string; name: string; aliases: string[]; category: string;
  per100g: Nutrients; servingGrams: number; servingLabel: string;
  basis: "raw" | "cooked" | "as-served"; source: string; sourceVersion: string;
};
export type MealItem = {
  id: string; foodId: string; name: string; grams: number; nutrients: Nutrients;
  source: string; sourceVersion: string; basis: FoodRecord["basis"]; confirmed: boolean;
};
export type Meal = {
  id: string; date: string; type: MealType; title: string; items: MealItem[];
  inputType: "manual" | "text" | "image"; createdAt: string;
};
export type Goal = Nutrients & { mode: "cut" | "maintain" | "bulk" };
export type Recipe = {
  id: string; name: string; ingredients: MealItem[]; cookedYieldGrams: number;
};
export type DetectedFood = {
  name: string; quantity: number | null; unit: "g" | "piece" | "bowl" | null;
  warnings: string[];
};
export type AnalysisResult = { foods: DetectedFood[]; warnings: string[] };
export type AppData = { schemaVersion: 1; meals: Meal[]; goals: Goal; recipes: Recipe[] };
export type ApiError = { error: { code: string; message: string; field?: string } };
/** Frontend boundary. A backend adapter can replace the demo without changing screens. */
export interface TrackerClient {
  load(): Promise<AppData>;
  searchFoods(query: string): Promise<FoodRecord[]>;
  analyzeText(text: string): Promise<AnalysisResult>;
  saveMeal(meal: Meal): Promise<AppData>;
  deleteMeal(id: string): Promise<AppData>;
  saveGoals(goals: Goal): Promise<AppData>;
  saveRecipe(recipe: Recipe): Promise<AppData>;
  deleteRecipe(id: string): Promise<AppData>;
}
