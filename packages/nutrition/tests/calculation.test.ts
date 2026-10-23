import { describe, expect, it } from "vitest";
import {
  calculateFood,
  calculateMeal,
  calculateRecipe,
  diffCatalogSnapshot,
  formatNutrientsForDisplay,
  InvalidQuantityError,
  NutritionEngineError,
  REFERENCE_FOODS_BY_ID,
} from "../src";
import type { FoodRecord, RecipeIngredientInput, RecipeRecord } from "../src";

describe("Food and Macro Arithmetic Engine", () => {
  const roti = REFERENCE_FOODS_BY_ID.get("roti-chapati-cooked")!;
  const paneer = REFERENCE_FOODS_BY_ID.get("paneer-fresh")!;
  const rawDal = REFERENCE_FOODS_BY_ID.get("raw-toor-dal")!;

  it("calculates nutrients scaling strictly by grams / 100", () => {
    // Roti: per 100g: 297 kcal, 9.4 protein, 58.7 carbs, 1.7 fat
    const result = calculateFood(roti, 70); // 2 rotis (70g)

    expect(result.grams).toBe(70);
    expect(result.targetId).toBe("roti-chapati-cooked");
    expect(result.itemType).toBe("food");

    // Exact scaling
    expect(result.nutrients.kcal).toBeCloseTo((70 / 100) * 297, 6);
    expect(result.nutrients.protein).toBeCloseTo((70 / 100) * 9.4, 6);
    expect(result.nutrients.carbs).toBeCloseTo((70 / 100) * 58.7, 6);
    expect(result.nutrients.fat).toBeCloseTo((70 / 100) * 1.7, 6);
  });

  it("preserves authoritative kcal instead of synthesizing 4P + 4C + 9F", () => {
    // Paneer per 100g: 289 kcal, 18.3 P, 3.4 C, 22.4 F
    // Note: 4*18.3 + 4*3.4 + 9*22.4 = 73.2 + 13.6 + 201.6 = 288.4 kcal != 289 kcal
    const calc = calculateFood(paneer, 100);

    // Engine must retain authoritative 289 kcal from IFCT table
    expect(calc.nutrients.kcal).toBe(289);
    expect(calc.nutrients.kcal).not.toBe(4 * paneer.per100g.protein + 4 * paneer.per100g.carbs + 9 * paneer.per100g.fat);
  });

  it("preserves internal floating point precision without premature display rounding", () => {
    const calc = calculateFood(paneer, 33.333333);
    const expectedProtein = (33.333333 / 100) * 18.3;

    expect(calc.nutrients.protein).toBe(expectedProtein);
    // Not pre-rounded to 1 decimal place
    expect(calc.nutrients.protein.toString().split(".")[1]?.length).toBeGreaterThan(4);

    // Display formatter can round for presentation
    const display = formatNutrientsForDisplay(calc.nutrients, { kcalDecimals: 0, macroDecimals: 1 });
    expect(display.protein).toBe(6.1);
  });

  it("surfaces raw basis warning for raw food items logged directly", () => {
    const calc = calculateFood(rawDal, 100);
    expect(calc.snapshot.basis).toBe("raw");
    expect(calc.snapshot.uncertaintyWarnings).toBeDefined();
    expect(calc.snapshot.uncertaintyWarnings?.[0]).toContain("Food basis is raw");
  });

  it("attaches immutable provenance snapshot with every calculation", () => {
    const calc = calculateFood(roti, 35, { confirmed: true });
    expect(calc.confirmed).toBe(true);
    expect(calc.snapshot.catalogId).toBe("roti-chapati-cooked");
    expect(calc.snapshot.source).toBe("IFCT 2017, ICMR-NIN");
    expect(calc.snapshot.sourceVersion).toBe("2017.1");
    expect(calc.snapshot.basis).toBe("cooked");
    expect(calc.snapshot.method).toBe("food_per100g");
    expect(calc.snapshot.per100gSnapshot.kcal).toBe(297);
  });

  it("rejects invalid, negative, zero, or unreasonable gram weights", () => {
    expect(() => calculateFood(roti, 0)).toThrow(InvalidQuantityError);
    expect(() => calculateFood(roti, -50)).toThrow(InvalidQuantityError);
    expect(() => calculateFood(roti, NaN)).toThrow(InvalidQuantityError);
    expect(() => calculateFood(roti, Infinity)).toThrow(InvalidQuantityError);
    expect(() => calculateFood(roti, 15000)).toThrow(InvalidQuantityError);
  });
});

describe("Recipe Calculation Engine", () => {
  const recipe: RecipeRecord = {
    id: "homestyle-dal",
    name: "Homestyle Dal Tadka",
    cookedYieldGrams: 350, // Finished cooked mass measured on kitchen scale
    rawTotalGrams: 415,
  };

  const ingredients: RecipeIngredientInput[] = [
    {
      foodId: "raw-toor-dal",
      foodName: "Raw Toor Dal",
      rawGrams: 100,
      nutrientsPer100g: { kcal: 343, protein: 22.3, carbs: 60.4, fat: 1.7 },
      basis: "raw",
      source: "IFCT 2017",
      sourceVersion: "2017.1",
    },
    {
      foodId: "desi-ghee",
      foodName: "Desi Ghee",
      rawGrams: 15,
      nutrientsPer100g: { kcal: 900, protein: 0, carbs: 0, fat: 100 },
      basis: "as-served",
      source: "IFCT 2017",
      sourceVersion: "2017.1",
    },
  ];

  it("allocates batch nutrients by servingGrams / cookedYieldGrams", () => {
    // Total batch nutrients:
    // Toor dal 100g: 343 kcal, 22.3 P, 60.4 C, 1.7 F
    // Ghee 15g: 135 kcal, 0 P, 0 C, 15 F
    // Batch totals: 478 kcal, 22.3 P, 60.4 C, 16.7 F
    // Finished cooked yield = 350g
    // Portion = 175g (ratio = 0.5)
    const portion = calculateRecipe(recipe, ingredients, 175);

    expect(portion.grams).toBe(175);
    expect(portion.basis).toBe("cooked");
    expect(portion.itemType).toBe("recipe");

    expect(portion.nutrients.kcal).toBeCloseTo(478 * 0.5, 6);
    expect(portion.nutrients.protein).toBeCloseTo(22.3 * 0.5, 6);
    expect(portion.nutrients.carbs).toBeCloseTo(60.4 * 0.5, 6);
    expect(portion.nutrients.fat).toBeCloseTo(16.7 * 0.5, 6);

    // Per 100g cooked
    expect(portion.per100g.kcal).toBeCloseTo((478 / 350) * 100, 6);
    expect(portion.snapshot.recipeMetadata?.allocationRatio).toBe(0.5);
    expect(portion.snapshot.recipeMetadata?.rawTotalGrams).toBe(115);
    expect(portion.snapshot.recipeMetadata?.cookedYieldGrams).toBe(350);
  });

  it("retains 100% of cooking fat / ghee in the finished batch", () => {
    const portion = calculateRecipe(recipe, ingredients, 350); // Entire batch (350g)
    // All 15g fat from ghee + 1.7g from dal = 16.7g fat
    expect(portion.nutrients.fat).toBeCloseTo(16.7, 6);
  });

  it("rejects recipes with empty ingredients or invalid yields", () => {
    expect(() => calculateRecipe(recipe, [], 100)).toThrow(NutritionEngineError);
    expect(() => calculateRecipe({ ...recipe, cookedYieldGrams: 0 }, ingredients, 100)).toThrow(InvalidQuantityError);
    expect(() => calculateRecipe({ ...recipe, cookedYieldGrams: -100 }, ingredients, 100)).toThrow(InvalidQuantityError);
    expect(() => calculateRecipe(recipe, ingredients, 0)).toThrow(InvalidQuantityError);
  });
});

describe("Meal Aggregation Engine", () => {
  const roti = REFERENCE_FOODS_BY_ID.get("roti-chapati-cooked")!;
  const dal = REFERENCE_FOODS_BY_ID.get("toor-dal-cooked")!;
  const rawRice = REFERENCE_FOODS_BY_ID.get("raw-basmati-rice")!;

  it("aggregates meal items and retains full precision", () => {
    const item1 = calculateFood(roti, 70, { confirmed: true });
    const item2 = calculateFood(dal, 150, { confirmed: true });

    const meal = calculateMeal([item1, item2]);

    expect(meal.items.length).toBe(2);
    expect(meal.totalGrams).toBe(220);
    expect(meal.totalNutrients.kcal).toBeCloseTo(item1.nutrients.kcal + item2.nutrients.kcal, 6);
    expect(meal.totalNutrients.protein).toBeCloseTo(item1.nutrients.protein + item2.nutrients.protein, 6);
    expect(meal.warnings.length).toBe(0);
  });

  it("surfaces warnings for unconfirmed items and raw ingredients", () => {
    const unconfirmedRoti = calculateFood(roti, 70, { confirmed: false });
    const rawItem = calculateFood(rawRice, 100, { confirmed: true });

    const meal = calculateMeal([unconfirmedRoti, rawItem]);

    expect(meal.warnings.some(w => w.includes("unconfirmed"))).toBe(true);
    expect(meal.warnings.some(w => w.includes("raw basis"))).toBe(true);
  });

  it("handles empty meals gracefully", () => {
    const meal = calculateMeal([]);
    expect(meal.totalGrams).toBe(0);
    expect(meal.totalNutrients.kcal).toBe(0);
    expect(meal.warnings[0]).toBe("Meal contains no items.");
  });
});

describe("Catalog Version Drift and Historical Immutability", () => {
  const roti = REFERENCE_FOODS_BY_ID.get("roti-chapati-cooked")!;

  it("audits catalog version drift without rewriting historical snapshot", () => {
    // Historical calculation performed under version 2017.1
    const historicItem = calculateFood(roti, 35, { confirmed: true });

    // Suppose catalog is updated in the future to IFCT 2024 with slight nutrient change
    const updatedCatalogRecord: FoodRecord = {
      ...roti,
      sourceVersion: "2024.1",
      per100g: { ...roti.per100g, kcal: 300, protein: 9.8 },
    };

    const diff = diffCatalogSnapshot(historicItem.snapshot, updatedCatalogRecord);

    expect(diff.isVersionChanged).toBe(true);
    expect(diff.historicalVersion).toBe("2017.1");
    expect(diff.currentVersion).toBe("2024.1");
    expect(diff.historicalPer100g.kcal).toBe(297);
    expect(diff.currentPer100g.kcal).toBe(300);
    expect(diff.deltaPer100g.kcal).toBe(3);
    expect(diff.deltaPer100g.protein).toBeCloseTo(0.4, 6);

    // Historic snapshot remains immutably intact
    expect(historicItem.nutrients.kcal).toBeCloseTo((35 / 100) * 297, 6);
  });
});
