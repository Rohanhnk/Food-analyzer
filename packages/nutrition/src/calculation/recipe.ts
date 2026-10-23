import type { CalculatedItem, Nutrients, ProvenanceSnapshot, RecipeIngredientInput, RecipeRecord } from "../types";
import { NutritionEngineError } from "../types";
import { validateGrams } from "../quantity/validation";
import { scaleNutrients, sumNutrientsList } from "./precision";

export type CalculateRecipeOptions = {
  readonly confirmed?: boolean;
  readonly id?: string;
  readonly calculatedAt?: string;
};

/**
 * Calculates deterministic nutrition for a recipe portion based on raw ingredient batch
 * and finished cooked yield.
 *
 * Rules:
 * - Sum ingredient contributions using each ingredient's measurement basis.
 * - Cooking fat / oil / ghee is 100% accounted for in the batch.
 * - Allocation formula: servingGrams / cookedYieldGrams.
 * - Do NOT assume raw ingredient total equals cooked yield!
 */
export function calculateRecipe(
  recipe: RecipeRecord,
  ingredients: readonly RecipeIngredientInput[],
  servingGrams: number,
  options?: CalculateRecipeOptions
): CalculatedItem {
  if (!ingredients.length) {
    throw new NutritionEngineError(
      `Cannot calculate recipe "${recipe.name}": ingredients list cannot be empty.`,
      "EMPTY_RECIPE_INGREDIENTS"
    );
  }

  // Validate cooked yield
  validateGrams(recipe.cookedYieldGrams, "cooked yield");

  // Validate portion serving weight
  validateGrams(servingGrams, "serving portion");

  // Sum ingredient contributions
  let rawTotalGrams = 0;
  const ingredientNutrients: Nutrients[] = [];
  const warnings: string[] = [];

  for (const ing of ingredients) {
    validateGrams(ing.rawGrams, `ingredient "${ing.foodName}" weight`);
    rawTotalGrams += ing.rawGrams;

    const scaled = scaleNutrients(ing.nutrientsPer100g, ing.rawGrams);
    ingredientNutrients.push(scaled);
  }

  const batchNutrients = sumNutrientsList(ingredientNutrients);

  // Compute per 100g of finished cooked recipe
  const yieldRatio100g = 100 / recipe.cookedYieldGrams;
  const per100gCooked: Nutrients = Object.freeze({
    kcal: batchNutrients.kcal * yieldRatio100g,
    protein: batchNutrients.protein * yieldRatio100g,
    carbs: batchNutrients.carbs * yieldRatio100g,
    fat: batchNutrients.fat * yieldRatio100g,
    fiber: batchNutrients.fiber !== undefined ? batchNutrients.fiber * yieldRatio100g : undefined,
    sugar: batchNutrients.sugar !== undefined ? batchNutrients.sugar * yieldRatio100g : undefined,
    sodium: batchNutrients.sodium !== undefined ? batchNutrients.sodium * yieldRatio100g : undefined,
  });

  // Portion allocation ratio = servingGrams / cookedYieldGrams
  const allocationRatio = servingGrams / recipe.cookedYieldGrams;
  const portionNutrients: Nutrients = Object.freeze({
    kcal: batchNutrients.kcal * allocationRatio,
    protein: batchNutrients.protein * allocationRatio,
    carbs: batchNutrients.carbs * allocationRatio,
    fat: batchNutrients.fat * allocationRatio,
    fiber: batchNutrients.fiber !== undefined ? batchNutrients.fiber * allocationRatio : undefined,
    sugar: batchNutrients.sugar !== undefined ? batchNutrients.sugar * allocationRatio : undefined,
    sodium: batchNutrients.sodium !== undefined ? batchNutrients.sodium * allocationRatio : undefined,
  });

  if (Math.abs(recipe.cookedYieldGrams - rawTotalGrams) < 0.001) {
    warnings.push("Cooked yield is exactly equal to raw total weight. Ensure finished cooked mass was measured on scale.");
  }

  const now = options?.calculatedAt ?? new Date().toISOString();
  const snapshot: ProvenanceSnapshot = Object.freeze({
    catalogId: recipe.id,
    catalogVersion: recipe.version ?? "1.0",
    source: "Recipe Calculation Engine",
    sourceVersion: "1.0",
    basis: "cooked",
    grams: servingGrams,
    per100gSnapshot: per100gCooked,
    calculatedAt: now,
    method: "recipe_cooked_yield",
    uncertaintyWarnings: warnings.length ? Object.freeze(warnings) : undefined,
    recipeMetadata: Object.freeze({
      rawTotalGrams,
      cookedYieldGrams: recipe.cookedYieldGrams,
      allocationRatio,
      ingredientCount: ingredients.length,
    }),
  });

  return Object.freeze({
    id: options?.id ?? `calc_recipe_${recipe.id}_${Math.round(servingGrams)}g_${Date.now()}`,
    targetId: recipe.id,
    name: recipe.name,
    itemType: "recipe",
    grams: servingGrams,
    nutrients: portionNutrients,
    per100g: per100gCooked,
    basis: "cooked",
    source: "Homemade Recipe",
    sourceVersion: recipe.version ?? "1.0",
    snapshot,
    confirmed: options?.confirmed ?? false,
  });
}
