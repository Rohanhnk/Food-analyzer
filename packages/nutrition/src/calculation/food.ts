import type { CalculatedItem, FoodRecord, ProvenanceSnapshot } from "../types";
import { validateGrams } from "../quantity/validation";
import { scaleNutrients } from "./precision";

export type CalculateFoodOptions = {
  readonly confirmed?: boolean;
  readonly id?: string;
  readonly calculatedAt?: string;
};

/**
 * Calculates deterministic nutrition for an authoritative food item.
 *
 * Requirements:
 * - Compute each nutrient as grams / 100 × nutrientsPer100g.
 * - Retain precision internally without display rounding.
 * - Keep kcal from authoritative source directly.
 * - Return immutable CalculatedItem with full ProvenanceSnapshot.
 */
export function calculateFood(
  food: FoodRecord,
  grams: number,
  options?: CalculateFoodOptions
): CalculatedItem {
  validateGrams(grams, "food portion");

  const calculatedNutrients = scaleNutrients(food.per100g, grams);
  const per100gSnapshot = Object.freeze({ ...food.per100g });
  const now = options?.calculatedAt ?? new Date().toISOString();
  const warnings: string[] = [];

  if (food.basis === "raw" && food.category !== "Fruits" && food.category !== "Dairy Products") {
    warnings.push(`Food basis is raw (${food.name}). Ensure raw ingredient weight was intended rather than cooked.`);
  }

  const snapshot: ProvenanceSnapshot = Object.freeze({
    catalogId: food.id,
    catalogVersion: food.sourceVersion,
    source: food.source,
    sourceVersion: food.sourceVersion,
    sourceId: food.sourceId,
    basis: food.basis,
    grams,
    per100gSnapshot,
    calculatedAt: now,
    method: "food_per100g",
    uncertaintyWarnings: warnings.length ? Object.freeze(warnings) : undefined,
  });

  return Object.freeze({
    id: options?.id ?? `calc_${food.id}_${Math.round(grams)}g_${Date.now()}`,
    targetId: food.id,
    name: food.name,
    itemType: "food",
    grams,
    nutrients: calculatedNutrients,
    per100g: per100gSnapshot,
    basis: food.basis,
    source: food.source,
    sourceVersion: food.sourceVersion,
    snapshot,
    confirmed: options?.confirmed ?? false,
  });
}
