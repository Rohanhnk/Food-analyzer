import type { FoodRecord, Nutrients, ProvenanceSnapshot } from "../types";

/** Returns an immutable zeroed Nutrients object. */
export function emptyNutrients(): Nutrients {
  return Object.freeze({
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });
}

/**
 * Computes exact nutrients for given grams: (grams / 100) * per100g.
 * Retains high precision internally without premature rounding.
 * Authoritative kcal is preserved and scaled directly.
 */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const factor = grams / 100;
  return Object.freeze({
    kcal: per100g.kcal * factor,
    protein: per100g.protein * factor,
    carbs: per100g.carbs * factor,
    fat: per100g.fat * factor,
    fiber: per100g.fiber !== undefined ? per100g.fiber * factor : undefined,
    sugar: per100g.sugar !== undefined ? per100g.sugar * factor : undefined,
    sodium: per100g.sodium !== undefined ? per100g.sodium * factor : undefined,
  });
}

/** Sums an array of Nutrients objects retaining full internal precision. */
export function sumNutrientsList(list: readonly Nutrients[]): Nutrients {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sugar = 0;
  let sodium = 0;

  for (const n of list) {
    kcal += n.kcal;
    protein += n.protein;
    carbs += n.carbs;
    fat += n.fat;
    if (n.fiber) fiber += n.fiber;
    if (n.sugar) sugar += n.sugar;
    if (n.sodium) sodium += n.sodium;
  }

  return Object.freeze({
    kcal,
    protein,
    carbs,
    fat,
    fiber: fiber > 0 ? fiber : undefined,
    sugar: sugar > 0 ? sugar : undefined,
    sodium: sodium > 0 ? sodium : undefined,
  });
}

/**
 * Rounds nutrients for UI display only.
 * Internal calculations MUST NOT use this helper.
 */
export function formatNutrientsForDisplay(
  nutrients: Nutrients,
  options?: { kcalDecimals?: number; macroDecimals?: number }
): Nutrients {
  const kcalDec = options?.kcalDecimals ?? 0;
  const macroDec = options?.macroDecimals ?? 1;

  const round = (val: number, dec: number) => {
    const p = Math.pow(10, dec);
    return Math.round((val + Number.EPSILON) * p) / p;
  };

  return Object.freeze({
    kcal: round(nutrients.kcal, kcalDec),
    protein: round(nutrients.protein, macroDec),
    carbs: round(nutrients.carbs, macroDec),
    fat: round(nutrients.fat, macroDec),
    fiber: nutrients.fiber !== undefined ? round(nutrients.fiber, macroDec) : undefined,
    sugar: nutrients.sugar !== undefined ? round(nutrients.sugar, macroDec) : undefined,
    sodium: nutrients.sodium !== undefined ? round(nutrients.sodium, 0) : undefined,
  });
}

/** Snapshot comparison result to audit version changes without mutating historical entries. */
export type SnapshotComparison = {
  readonly catalogId: string;
  readonly historicalVersion: string;
  readonly currentVersion: string;
  readonly isVersionChanged: boolean;
  readonly historicalPer100g: Nutrients;
  readonly currentPer100g: Nutrients;
  readonly deltaPer100g: Nutrients;
};

/**
 * Compares a historical meal snapshot with the current catalog record.
 * Enables auditing catalog upgrades without rewriting historical meals.
 */
export function diffCatalogSnapshot(
  snapshot: ProvenanceSnapshot,
  currentRecord: FoodRecord
): SnapshotComparison {
  const isVersionChanged = snapshot.sourceVersion !== currentRecord.sourceVersion;
  const delta: Nutrients = Object.freeze({
    kcal: currentRecord.per100g.kcal - snapshot.per100gSnapshot.kcal,
    protein: currentRecord.per100g.protein - snapshot.per100gSnapshot.protein,
    carbs: currentRecord.per100g.carbs - snapshot.per100gSnapshot.carbs,
    fat: currentRecord.per100g.fat - snapshot.per100gSnapshot.fat,
  });

  return Object.freeze({
    catalogId: snapshot.catalogId,
    historicalVersion: snapshot.sourceVersion,
    currentVersion: currentRecord.sourceVersion,
    isVersionChanged,
    historicalPer100g: snapshot.per100gSnapshot,
    currentPer100g: currentRecord.per100g,
    deltaPer100g: delta,
  });
}
