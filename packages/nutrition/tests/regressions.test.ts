import { describe, expect, it } from "vitest";
import { calculateFood } from "../src/calculation/food";
import { calculateRecipe } from "../src/calculation/recipe";
import { resolveQuantity } from "../src/quantity/resolve";
import type { FoodRecord, RecipeIngredientInput } from "../src/types";

describe("snapshot and serving regressions", () => {
  it("owns the snapshot even when the caller mutates the source record", () => {
    const nutrients = { kcal: 100, protein: 5, carbs: 10, fat: 3 };
    const food: FoodRecord = { id: "food", name: "Food", aliases: [], category: "test", basis: "cooked", source: "fixture", sourceVersion: "1", attribution: "fixture", per100g: nutrients };
    const result = calculateFood(food, 100);
    nutrients.kcal = 999;
    expect(result.snapshot.per100gSnapshot.kcal).toBe(100);
    expect(result.per100g.kcal).toBe(100);
    expect(Object.isFrozen(result.snapshot.per100gSnapshot)).toBe(true);
  });
  it.each([["tbsp", "bowl"], ["tsp", "tablespoon"], ["cup", "bowl"], ["piece", "slice"]])("does not resolve %s using %s", (unit, definition) => {
    expect(resolveQuantity({ quantity: 1, unit, userConfirmed: true }, { unit: definition, grams: 150 }).status).toBe("needs_confirmation");
  });
  it("still accepts true unit aliases", () => {
    expect(resolveQuantity({ quantity: 2, unit: "tablespoons", userConfirmed: true }, { unit: "tbsp", grams: 15 })).toMatchObject({ status: "resolved", grams: 30 });
  });
  it("captures every recipe ingredient's source, basis, amount and version", () => {
    const nutrients = { kcal: 120, protein: 8, carbs: 20, fat: 1 };
    const ingredient: RecipeIngredientInput = { foodId: "dal", foodName: "Dal", rawGrams: 50, basis: "raw", source: "fixture", sourceVersion: "v2", nutrientsPer100g: nutrients };
    const result = calculateRecipe({ id: "r", name: "Recipe", cookedYieldGrams: 200 }, [ingredient], 100);
    nutrients.kcal = 999;
    expect(result.snapshot.recipeMetadata?.ingredients[0]).toMatchObject({ foodId: "dal", rawGrams: 50, sourceVersion: "v2", basis: "raw", nutrientsPer100g: { kcal: 120 } });
    expect(Object.isFrozen(result.snapshot.recipeMetadata?.ingredients[0].nutrientsPer100g)).toBe(true);
  });
});
