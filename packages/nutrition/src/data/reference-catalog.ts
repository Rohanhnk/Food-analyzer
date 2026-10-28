import type { FoodRecord } from "../types";
import rawData from "./indian-foods-reference.json";

/** Provisional reference fixtures. Legacy export name is not verification; see DATA_ATTRIBUTION.md. */
export const VERIFIED_REFERENCE_FOODS: readonly FoodRecord[] = Object.freeze(
  (rawData as FoodRecord[]).map(food =>
    Object.freeze({
      ...food,
      aliases: Object.freeze([...food.aliases]),
      per100g: Object.freeze({ ...food.per100g }),
      standardServing: food.standardServing ? Object.freeze({ ...food.standardServing }) : undefined,
      alternateServings: food.alternateServings ? Object.freeze(food.alternateServings.map(s => Object.freeze({ ...s }))) : undefined,
    })
  )
);

/** Lookup map by unique food ID. */
export const REFERENCE_FOODS_BY_ID: ReadonlyMap<string, FoodRecord> = new Map(
  VERIFIED_REFERENCE_FOODS.map(f => [f.id, f])
);
