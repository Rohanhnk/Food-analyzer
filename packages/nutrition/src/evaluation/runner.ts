import type { Nutrients } from "../types";
import { calculateFood } from "../calculation/food";
import { calculateRecipe } from "../calculation/recipe";
import { REFERENCE_FOODS_BY_ID } from "../data/reference-catalog";
import {
  DAL_TADKA_EXPECTED_PORTION,
  DAL_TADKA_INGREDIENTS,
  DAL_TADKA_RECIPE,
  EVALUATION_NUTRIENT_CASES,
} from "./test-cases";

export type CaseResult = {
  readonly caseName: string;
  readonly category: string;
  readonly passed: boolean;
  readonly maxAbsoluteError: number;
  readonly maxRelativeError: number;
  readonly expected: Nutrients;
  readonly actual: Nutrients;
  readonly details?: string;
};

export type EvaluationReport = {
  readonly totalCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
  readonly allPassed: boolean;
  readonly maxObservedError: number;
  readonly caseResults: readonly CaseResult[];
};

function compareNutrients(actual: Nutrients, expected: Nutrients, tolerance: number): {
  passed: boolean;
  maxAbsErr: number;
  maxRelErr: number;
} {
  const keys: (keyof Nutrients)[] = ["kcal", "protein", "carbs", "fat"];
  let maxAbsErr = 0;
  let maxRelErr = 0;
  let passed = true;

  for (const k of keys) {
    const act = actual[k] ?? 0;
    const exp = expected[k] ?? 0;
    const absErr = Math.abs(act - exp);
    const relErr = exp !== 0 ? absErr / exp : absErr;

    if (absErr > maxAbsErr) maxAbsErr = absErr;
    if (relErr > maxRelErr) maxRelErr = relErr;
    if (absErr > tolerance) {
      passed = false;
    }
  }

  return { passed, maxAbsErr, maxRelErr };
}

/**
 * Runs the deterministic nutrition evaluation suite.
 * Tests individual food scaling, fractional portions, recipe allocation, and oil inclusion.
 * Emits precise numeric deviation metrics.
 */
export function runNutritionEvaluation(): EvaluationReport {
  const caseResults: CaseResult[] = [];
  let totalCases = 0;
  let passedCases = 0;
  let maxObservedError = 0;

  // 1. Food scaling cases
  for (const c of EVALUATION_NUTRIENT_CASES) {
    totalCases++;
    const food = REFERENCE_FOODS_BY_ID.get(c.foodId!);
    if (!food) {
      caseResults.push({
        caseName: c.name,
        category: c.category,
        passed: false,
        maxAbsoluteError: Infinity,
        maxRelativeError: Infinity,
        expected: c.expected,
        actual: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        details: `Food ID "${c.foodId}" not found in reference catalog.`,
      });
      continue;
    }

    const calc = calculateFood(food, c.grams);
    const cmp = compareNutrients(calc.nutrients, c.expected, c.tolerance);

    if (cmp.maxAbsErr > maxObservedError) maxObservedError = cmp.maxAbsErr;
    if (cmp.passed) passedCases++;

    caseResults.push({
      caseName: c.name,
      category: c.category,
      passed: cmp.passed,
      maxAbsoluteError: cmp.maxAbsErr,
      maxRelativeError: cmp.maxRelErr,
      expected: c.expected,
      actual: calc.nutrients,
    });
  }

  // 2. Recipe yield and cooked allocation case
  totalCases++;
  const recipeCalc = calculateRecipe(DAL_TADKA_RECIPE, DAL_TADKA_INGREDIENTS, 175);
  const recipeCmp = compareNutrients(recipeCalc.nutrients, DAL_TADKA_EXPECTED_PORTION, 0.0001);

  if (recipeCmp.maxAbsErr > maxObservedError) maxObservedError = recipeCmp.maxAbsErr;
  if (recipeCmp.passed) passedCases++;

  caseResults.push({
    caseName: "Homemade Dal Tadka (175g serving of 350g cooked yield)",
    category: "recipe_yield",
    passed: recipeCmp.passed,
    maxAbsoluteError: recipeCmp.maxAbsErr,
    maxRelativeError: recipeCmp.maxRelErr,
    expected: DAL_TADKA_EXPECTED_PORTION,
    actual: recipeCalc.nutrients,
    details: "Tests ingredient summation, 100% oil fat retention, cooked yield scaling, and allocation ratio.",
  });

  return Object.freeze({
    totalCases,
    passedCases,
    failedCases: totalCases - passedCases,
    allPassed: passedCases === totalCases,
    maxObservedError,
    caseResults: Object.freeze(caseResults),
  });
}
