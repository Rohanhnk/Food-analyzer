/**
 * Curated Indian food alias groups and umbrella generic terms.
 */

/** Canonical alias clusters where any term in the cluster points to common preparation synonyms. */
export const ALIAS_SYNONYM_GROUPS: readonly (readonly string[])[] = Object.freeze([
  ["roti", "chapati", "chappathi", "phulka", "fulka", "rotli"],
  ["curd", "dahi", "yogurt", "plain yogurt", "thayir", "mosaru"],
  ["dal", "daal", "dhal", "lentils", "lentil stew"],
  ["rice", "chawal", "bhat", "steamed rice", "boiled rice"],
  ["ghee", "desi ghee", "clarified butter", "neyyi", "tuppa"],
  ["paneer", "cottage cheese", "indian cottage cheese", "chenna"],
  ["sabzi", "subji", "bhaji", "tarkari", "vegetable curry"],
  ["egg", "anda", "boiled egg", "boiled anda"],
  ["tea", "chai", "masala chai", "indian tea"],
]);

/**
 * Umbrella terms that describe an entire broad culinary category rather than a specific dish.
 * When searched alone, these MUST be flagged as ambiguous rather than silently auto-matching a single dish.
 */
export const GENERIC_CATEGORY_TERMS: ReadonlySet<string> = new Set([
  "dal",
  "daal",
  "dhal",
  "sabzi",
  "subji",
  "bhaji",
  "curry",
  "rice",
  "chawal",
  "bhat",
  "bread",
  "vegetable",
  "gravy",
  "soup",
  "oil",
  "milk",
]);

/** Check if a normalized query represents a broad category term. */
export function isGenericCategoryQuery(query: string): boolean {
  return GENERIC_CATEGORY_TERMS.has(query.trim().toLowerCase());
}
