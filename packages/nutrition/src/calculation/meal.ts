import type { CalculatedItem, CalculatedMeal, Nutrients } from "../types";
import { emptyNutrients, sumNutrientsList } from "./precision";

/**
 * Aggregates individual calculated food and recipe items into a combined meal total.
 * Retains high internal precision and surfaces provenance warnings.
 */
export function calculateMeal(items: readonly CalculatedItem[]): CalculatedMeal {
  if (!items.length) {
    return Object.freeze({
      items: Object.freeze([]),
      totalGrams: 0,
      totalNutrients: emptyNutrients(),
      warnings: Object.freeze(["Meal contains no items."]),
    });
  }

  let totalGrams = 0;
  const nutrientsList: Nutrients[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    totalGrams += item.grams;
    nutrientsList.push(item.nutrients);

    if (!item.confirmed) {
      warnings.push(`Portion for "${item.name}" (${item.grams} g) is unconfirmed.`);
    }

    if (item.basis === "raw") {
      warnings.push(`Item "${item.name}" is logged with raw basis; confirm if cooked weight was intended.`);
    }

    if (item.snapshot.uncertaintyWarnings?.length) {
      for (const w of item.snapshot.uncertaintyWarnings) {
        if (!warnings.includes(w)) {
          warnings.push(w);
        }
      }
    }
  }

  const totalNutrients = sumNutrientsList(nutrientsList);

  return Object.freeze({
    items: Object.freeze([...items]),
    totalGrams,
    totalNutrients,
    warnings: Object.freeze(warnings),
  });
}
