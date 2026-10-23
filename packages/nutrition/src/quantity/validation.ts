import { InvalidQuantityError } from "../types";

export const MAX_REASONABLE_GRAMS = 10000; // 10 kg upper limit for single meal/recipe portion

/**
 * Validates portion weight in grams according to strict deterministic rules.
 * Rejects zero, negative, NaN, infinite and unreasonable (>10,000g) weights.
 */
export function validateGrams(grams: number, context = "weight"): void {
  if (typeof grams !== "number" || !Number.isFinite(grams)) {
    throw new InvalidQuantityError(
      `Invalid ${context}: value must be a finite number, received ${grams}`,
      "WEIGHT_NOT_FINITE",
      grams
    );
  }

  if (grams <= 0) {
    throw new InvalidQuantityError(
      `Invalid ${context}: weight must be strictly greater than 0 g, received ${grams}`,
      "WEIGHT_ZERO_OR_NEGATIVE",
      grams
    );
  }

  if (grams > MAX_REASONABLE_GRAMS) {
    throw new InvalidQuantityError(
      `Invalid ${context}: weight ${grams} g exceeds the maximum reasonable limit of ${MAX_REASONABLE_GRAMS} g`,
      "WEIGHT_UNREASONABLE",
      grams
    );
  }
}

/** Returns true if grams value is strictly valid, false otherwise without throwing. */
export function isValidGrams(grams: number): boolean {
  return typeof grams === "number" && Number.isFinite(grams) && grams > 0 && grams <= MAX_REASONABLE_GRAMS;
}
