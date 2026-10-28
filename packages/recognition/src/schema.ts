import { LIMITS, RecognitionError, UNITS, type RecognitionResult } from "./types";
// Strict JSON schema passed to the provider; runtime validation applies the same limits.
export const RESULT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["foods", "warnings"],
  properties: {
    foods: { type: "array", maxItems: LIMITS.foods, items: {
      type: "object", additionalProperties: false, required: ["name", "quantity", "unit", "basis", "warnings"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 160 },
        quantity: { type: ["number", "null"], exclusiveMinimum: 0, maximum: 10000 },
        unit: { enum: [...UNITS, null] }, basis: { enum: ["raw", "cooked", "as-served", null] },
        warnings: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 400 } },
      },
    } },
    warnings: { type: "array", maxItems: 10, items: { type: "string", minLength: 1, maxLength: 400 } },
  },
} as const;
function invalid(): never { throw new RecognitionError("INVALID_OUTPUT", "The recognition service returned an invalid result. Please try again or log manually."); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some(k => !Object.hasOwn(record, k))) return invalid();
  return record;
}
function warnings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10 || value.some(v => typeof v !== "string" || !v.trim() || v.length > 400)) return invalid();
  return value.map(v => v.trim());
}
export function validateResult(value: unknown): RecognitionResult {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return invalid(); } }
  const result = object(value, ["foods", "warnings"]);
  if (!Array.isArray(result.foods) || result.foods.length > LIMITS.foods) return invalid();
  const foods = result.foods.map(value => {
    const food = object(value, ["name", "quantity", "unit", "basis", "warnings"]);
    if (typeof food.name !== "string" || !food.name.trim() || food.name.length > 160) return invalid();
    if (food.quantity !== null && (typeof food.quantity !== "number" || !Number.isFinite(food.quantity) || food.quantity <= 0 || food.quantity > 10000)) return invalid();
    if (food.unit !== null && !UNITS.includes(food.unit as typeof UNITS[number])) return invalid();
    if (!["raw", "cooked", "as-served", null].includes(food.basis as string | null)) return invalid();
    if ((food.quantity === null) !== (food.unit === null)) return invalid();
    return { name: food.name.trim(), quantity: food.quantity, unit: food.unit, basis: food.basis, warnings: warnings(food.warnings) };
  });
  return { foods, warnings: warnings(result.warnings) } as RecognitionResult;
}
