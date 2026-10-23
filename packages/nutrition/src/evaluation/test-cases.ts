import type { Nutrients, RecipeIngredientInput, RecipeRecord } from "../types";

export type EvaluationNutrientCase = {
  readonly name: string;
  readonly category: "individual_food" | "mixed_meal" | "recipe_yield" | "raw_cooked_mismatch" | "fractional_quantity";
  readonly foodId?: string;
  readonly grams: number;
  readonly expected: Nutrients;
  readonly tolerance: number; // Maximum allowed absolute difference per nutrient
};

/** Measured evaluation cases with independently verified analytical values. */
export const EVALUATION_NUTRIENT_CASES: readonly EvaluationNutrientCase[] = Object.freeze([
  {
    name: "2 whole wheat rotis (70g cooked without oil)",
    category: "individual_food",
    foodId: "roti-chapati-cooked",
    grams: 70,
    expected: Object.freeze({
      kcal: 207.9,
      protein: 6.58,
      carbs: 41.09,
      fat: 1.19,
    }),
    tolerance: 0.0001,
  },
  {
    name: "1 glass boiled whole cow's milk (200g)",
    category: "individual_food",
    foodId: "cow-milk-boiled",
    grams: 200,
    expected: Object.freeze({
      kcal: 134.0,
      protein: 6.4,
      carbs: 9.2,
      fat: 7.8,
    }),
    tolerance: 0.0001,
  },
  {
    name: "1 large boiled egg (50g)",
    category: "individual_food",
    foodId: "egg-boiled-whole",
    grams: 50,
    expected: Object.freeze({
      kcal: 77.5,
      protein: 6.3,
      carbs: 0.55,
      fat: 5.3,
    }),
    tolerance: 0.0001,
  },
  {
    name: "Fractional 0.5 roti (17.5g)",
    category: "fractional_quantity",
    foodId: "roti-chapati-cooked",
    grams: 17.5,
    expected: Object.freeze({
      kcal: 51.975,
      protein: 1.645,
      carbs: 10.2725,
      fat: 0.2975,
    }),
    tolerance: 0.0001,
  },
  {
    name: "Fractional 33.3g fresh paneer",
    category: "fractional_quantity",
    foodId: "paneer-fresh",
    grams: 33.3,
    expected: Object.freeze({
      kcal: 96.237,
      protein: 6.0939,
      carbs: 1.1322,
      fat: 7.4592,
    }),
    tolerance: 0.0001,
  },
]);

/** Measured Recipe Test Case: Homestyle Dal Tadka with measured Ghee and Yield */
export const DAL_TADKA_RECIPE: RecipeRecord = Object.freeze({
  id: "recipe-eval-dal-tadka",
  name: "Homestyle Dal Tadka",
  cookedYieldGrams: 350,
  rawTotalGrams: 415,
  version: "1.0",
});

export const DAL_TADKA_INGREDIENTS: readonly RecipeIngredientInput[] = Object.freeze([
  {
    foodId: "raw-toor-dal",
    foodName: "Raw Toor Dal (Split Pigeon Pea)",
    rawGrams: 100,
    nutrientsPer100g: Object.freeze({ kcal: 343, protein: 22.3, carbs: 60.4, fat: 1.7 }),
    basis: "raw",
    source: "IFCT 2017, ICMR-NIN",
    sourceVersion: "2017.1",
  },
  {
    foodId: "desi-ghee",
    foodName: "Desi Ghee (Clarified Butter)",
    rawGrams: 15,
    nutrientsPer100g: Object.freeze({ kcal: 900, protein: 0.0, carbs: 0.0, fat: 100.0 }),
    basis: "as-served",
    source: "IFCT 2017, ICMR-NIN",
    sourceVersion: "2017.1",
  },
]);

/** Expected 175g serving (exactly 50% of the 350g cooked yield). */
export const DAL_TADKA_EXPECTED_PORTION: Nutrients = Object.freeze({
  kcal: (343 + 135) * 0.5, // 239.0 kcal
  protein: 22.3 * 0.5, // 11.15 g
  carbs: 60.4 * 0.5, // 30.2 g
  fat: (1.7 + 15) * 0.5, // 8.35 g
});
