import type { FoodRecord, Nutrients } from "./contracts";
export type FoodInput = { name: string; aliases: string[]; basis: FoodRecord["basis"]; source: string; referenceGrams: number; nutrients: Nutrients };
/** Label amounts are normalized to 100g once, and stored without display rounding. */
export function foodFromLabel(input: FoodInput, id: string, version = new Date().toISOString()): FoodRecord {
  if (!input || typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) throw new Error("Enter a food name of 1–120 characters.");
  if (!["raw", "cooked", "as-served"].includes(input.basis)) throw new Error("Choose the raw, cooked or as-served basis.");
  if (typeof input.source !== "string" || !input.source.trim() || input.source.length > 500) throw new Error("Record the packaging label or nutrition reference used.");
  if (!Array.isArray(input.aliases) || input.aliases.length > 10 || input.aliases.some(a => typeof a !== "string" || a.length > 80)) throw new Error("Use at most 10 short aliases.");
  if (typeof input.referenceGrams !== "number" || !Number.isFinite(input.referenceGrams) || input.referenceGrams <= 0 || input.referenceGrams > 10000) throw new Error("Enter the weight in grams that the label values describe.");
  const nutrients = input.nutrients;
  if (!nutrients || ["kcal", "protein", "carbs", "fat"].some(k => typeof nutrients[k as keyof Nutrients] !== "number" || !Number.isFinite(nutrients[k as keyof Nutrients]) || nutrients[k as keyof Nutrients] < 0)) throw new Error("Enter non-negative numbers for every nutrient.");
  const per100g = Object.fromEntries(Object.entries(nutrients).filter(([k]) => ["kcal", "protein", "carbs", "fat"].includes(k)).map(([k, n]) => [k, n / input.referenceGrams * 100])) as Nutrients;
  if (per100g.kcal > 1000 || per100g.protein + per100g.carbs + per100g.fat > 102) throw new Error("These values exceed plausible amounts per 100 g. Check the label serving weight and units.");
  return { id, name: input.name.trim(), aliases: input.aliases.map(a => a.trim()).filter(Boolean), category: "My foods", per100g, servingGrams: input.referenceGrams, servingLabel: `${input.referenceGrams} g`, basis: input.basis, source: input.source.trim(), sourceVersion: version };
}
