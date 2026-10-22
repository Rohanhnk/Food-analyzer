import { describe, expect, it } from "vitest";
import { demoItem, mealTotal, shiftDate, validGrams, validateGoals } from "../src/lib/model";
import { demoFoods } from "../src/lib/demo-foods";
describe("demo nutrition display", () => {
  it("scales a fixture by grams and retains provenance", () => {
    const item = demoItem(demoFoods[0], 80, "roti-item");
    expect(item.nutrients.kcal).toBeCloseTo(237.6);
    expect(item.sourceVersion).toBe("demo-v1");
    expect(item.confirmed).toBe(false);
  });
  it("totals stored snapshots without looking up mutable catalog values", () => {
    const item = demoItem(demoFoods[0], 80, "roti-item");
    item.nutrients.kcal = 300;
    expect(mealTotal({ items: [item, demoItem(demoFoods[1], 100, "paneer-item")] }).kcal).toBe(565);
  });
  it.each([0, -2, NaN, Infinity, 10001])("rejects invalid portion %s", grams => {
    expect(validGrams(grams)).toBe(false);
    expect(() => demoItem(demoFoods[0], grams)).toThrow();
  });
  it("rejects non-finite or non-positive calorie goals", () => {
    expect(() => validateGoals({ mode: "cut", kcal: NaN, protein: 100, carbs: 100, fat: 50 })).toThrow();
    expect(() => validateGoals({ mode: "cut", kcal: 0, protein: 100, carbs: 100, fat: 50 })).toThrow();
  });
  it("moves across calendar boundaries", () => { expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28"); });
});
