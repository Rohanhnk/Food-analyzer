import { describe, expect, it } from "vitest";
import {
  calculateFood,
  calculateMeal,
  calculateRecipe,
  DAL_TADKA_EXPECTED_PORTION,
  DAL_TADKA_INGREDIENTS,
  DAL_TADKA_RECIPE,
  REFERENCE_FOODS_BY_ID,
  runNutritionEvaluation,
} from "../src";

describe("Deterministic Nutrition Evaluation Suite", () => {
  it("passes all independently verified reference evaluation cases within numeric tolerance", () => {
    const report = runNutritionEvaluation();

    expect(report.allPassed).toBe(true);
    expect(report.failedCases).toBe(0);
    expect(report.totalCases).toBeGreaterThanOrEqual(6);
    expect(report.maxObservedError).toBeLessThan(0.0001);
  });

  it("surfaces raw vs cooked basis mismatches and calculates divergent nutrition accurately", () => {
    const rawRice = REFERENCE_FOODS_BY_ID.get("raw-basmati-rice")!;
    const cookedRice = REFERENCE_FOODS_BY_ID.get("white-rice-cooked")!;

    const rawCalc = calculateFood(rawRice, 100);
    const cookedCalc = calculateFood(cookedRice, 100);

    // Raw grain has ~2.7x more energy per 100g due to water absorption during cooking
    expect(rawCalc.nutrients.kcal).toBe(356);
    expect(cookedCalc.nutrients.kcal).toBe(130);

    expect(rawCalc.basis).toBe("raw");
    expect(cookedCalc.basis).toBe("cooked");

    // Engine flags raw cereal when logged directly without recipe yield
    expect(rawCalc.snapshot.uncertaintyWarnings?.some(w => w.includes("Food basis is raw"))).toBe(true);
    expect(cookedCalc.snapshot.uncertaintyWarnings).toBeUndefined();
  });

  it("evaluates homemade recipe yield with measurable ghee and accurate portion allocation", () => {
    // 350g cooked yield from 100g toor dal + 15g ghee + water
    const portion175g = calculateRecipe(DAL_TADKA_RECIPE, DAL_TADKA_INGREDIENTS, 175);

    expect(portion175g.grams).toBe(175);
    expect(portion175g.nutrients.kcal).toBeCloseTo(DAL_TADKA_EXPECTED_PORTION.kcal, 6);
    expect(portion175g.nutrients.protein).toBeCloseTo(DAL_TADKA_EXPECTED_PORTION.protein, 6);
    expect(portion175g.nutrients.carbs).toBeCloseTo(DAL_TADKA_EXPECTED_PORTION.carbs, 6);
    expect(portion175g.nutrients.fat).toBeCloseTo(DAL_TADKA_EXPECTED_PORTION.fat, 6);
  });

  it("evaluates mixed everyday Indian thali meal calculation", () => {
    const roti = REFERENCE_FOODS_BY_ID.get("roti-chapati-cooked")!;
    const dal = REFERENCE_FOODS_BY_ID.get("toor-dal-cooked")!;
    const curd = REFERENCE_FOODS_BY_ID.get("curd-dahi-whole-milk")!;
    const alooGobi = REFERENCE_FOODS_BY_ID.get("aloo-gobi-cooked")!;

    const itemRoti = calculateFood(roti, 70, { confirmed: true }); // 2 rotis (70g)
    const itemDal = calculateFood(dal, 150, { confirmed: true }); // 1 katori (150g)
    const itemCurd = calculateFood(curd, 100, { confirmed: true }); // 1 katori (100g)
    const itemSabzi = calculateFood(alooGobi, 120, { confirmed: true }); // 1 katori (120g)

    const meal = calculateMeal([itemRoti, itemDal, itemCurd, itemSabzi]);

    // Expected totals:
    // Total grams = 70 + 150 + 100 + 120 = 440g
    expect(meal.totalGrams).toBe(440);

    // Kcal: (0.7*297) + (1.5*104) + (1.0*61) + (1.2*110) = 207.9 + 156.0 + 61.0 + 132.0 = 556.9 kcal
    expect(meal.totalNutrients.kcal).toBeCloseTo(556.9, 4);

    // Protein: (0.7*9.4) + (1.5*6.8) + (1.0*3.1) + (1.2*2.3) = 6.58 + 10.2 + 3.1 + 2.76 = 22.64 g
    expect(meal.totalNutrients.protein).toBeCloseTo(22.64, 4);

    // Carbs: (0.7*58.7) + (1.5*15.6) + (1.0*4.4) + (1.2*14.2) = 41.09 + 23.4 + 4.4 + 17.04 = 85.93 g
    expect(meal.totalNutrients.carbs).toBeCloseTo(85.93, 4);

    // Fat: (0.7*1.7) + (1.5*1.6) + (1.0*3.4) + (1.2*4.9) = 1.19 + 2.4 + 3.4 + 5.88 = 12.87 g
    expect(meal.totalNutrients.fat).toBeCloseTo(12.87, 4);
  });
});
