import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoClient, STORAGE_KEY } from "../src/lib/demo-client";
import { demoFoods } from "../src/lib/demo-foods";
import { demoItem, localDate } from "../src/lib/model";
import type { Meal } from "../src/lib/contracts";
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
});
const meal = (): Meal => ({ id: "test-meal", title: "My test meal", date: localDate(), type: "Dinner", inputType: "manual", createdAt: new Date().toISOString(), items: [{ ...demoItem(demoFoods[0], 80, "item"), confirmed: true }] });
describe("demo persistence boundary", () => {
  it("saves, edits, reloads and deletes meals without duplicates", async () => {
    await demoClient.saveMeal(meal());
    await demoClient.saveMeal({ ...meal(), title: "Edited" });
    let data = await demoClient.load();
    expect(data.meals.filter(m => m.id === "test-meal")).toHaveLength(1);
    expect(data.meals.find(m => m.id === "test-meal")?.title).toBe("Edited");
    await demoClient.deleteMeal("test-meal"); data = await demoClient.load();
    expect(data.meals.some(m => m.id === "test-meal")).toBe(false);
  });
  it("requires portion confirmation", async () => {
    const draft = meal(); draft.items[0].confirmed = false;
    await expect(demoClient.saveMeal(draft)).rejects.toThrow("Confirm");
  });
  it("preserves existing meals when saving goals", async () => {
    await demoClient.saveMeal(meal());
    await demoClient.saveGoals({ mode: "bulk", kcal: 2600, protein: 140, carbs: 300, fat: 80 });
    const data = await demoClient.load();
    expect(data.goals.kcal).toBe(2600);
    expect(data.meals.some(m => m.id === "test-meal")).toBe(true);
  });
  it("parses known aliases and retains unknown food warnings", async () => {
    const result = await demoClient.analyzeText("2 chapatis and 100g paneer, mystery stew");
    expect(result.foods[0]).toMatchObject({ name: "Roti / chapati", quantity: 2, unit: "piece" });
    expect(result.foods[1]).toMatchObject({ quantity: 100, unit: "g" });
    expect(result.foods[2].warnings[0]).toContain("No demo catalog match");
  });
  it("does not overwrite corrupt data with seed records", async () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    await expect(demoClient.load()).rejects.toThrow("could not be read");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{broken");
  });
  it("reports unavailable storage", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("Quota exceeded"); } });
    await expect(demoClient.load()).rejects.toThrow("cannot save demo data");
  });
});
