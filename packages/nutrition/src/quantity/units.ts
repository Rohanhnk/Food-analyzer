/**
 * Unit classifications for portion parsing and resolution.
 */

export const GRAM_SYNONYMS: ReadonlySet<string> = new Set([
  "g",
  "gram",
  "grams",
  "gm",
  "gms",
]);

export const PIECE_SYNONYMS: ReadonlySet<string> = new Set([
  "piece",
  "pieces",
  "pc",
  "pcs",
  "slice",
  "slices",
  "roti",
  "rotis",
  "chapati",
  "chapatis",
  "phulka",
  "egg",
  "eggs",
]);

export const BOWL_SYNONYMS: ReadonlySet<string> = new Set([
  "bowl",
  "bowls",
  "katori",
  "katoris",
  "cup",
  "cups",
  "serving",
  "servings",
  "plate",
  "plates",
  "portion",
  "portions",
]);

export const SPOON_SYNONYMS: ReadonlySet<string> = new Set([
  "tbsp",
  "tablespoon",
  "tablespoons",
  "tsp",
  "teaspoon",
  "teaspoons",
]);

export function isGramUnit(unit: string): boolean {
  return GRAM_SYNONYMS.has(unit.toLowerCase().trim());
}

export function isPieceUnit(unit: string): boolean {
  return PIECE_SYNONYMS.has(unit.toLowerCase().trim());
}

export function isBowlUnit(unit: string): boolean {
  return BOWL_SYNONYMS.has(unit.toLowerCase().trim());
}

export function isSpoonUnit(unit: string): boolean {
  return SPOON_SYNONYMS.has(unit.toLowerCase().trim());
}
