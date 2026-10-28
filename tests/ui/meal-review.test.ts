// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MealEditor } from "@/features/meal-editor";
import { demoClient } from "@/lib/demo-client";
import type { FoodRecord, MealItem, TrackerClient } from "@/lib/contracts";
afterEach(cleanup);
const food: FoodRecord = { id: "personal_test", name: "My food", aliases: [], category: "My foods", per100g: { kcal: 100, protein: 10, carbs: 12, fat: 2 }, servingGrams: 100, servingLabel: "100 g", source: "label", sourceVersion: "v1", basis: "as-served" };
it("blocks confirmation until server review arrives and saves the reviewed nutrients", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  let resolve!: (result: { items: MealItem[]; totals: FoodRecord["per100g"]; warnings: string[] }) => void;
  const previewMeal = vi.fn(() => new Promise<{ items: MealItem[]; totals: FoodRecord["per100g"]; warnings: string[] }>(r => { resolve = r; }));
  const client: TrackerClient = { ...demoClient, mode: "live", searchFoods: async () => [food], previewMeal };
  render(React.createElement(MealEditor, { client, onSave }));
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Add My food" }));
  await waitFor(() => expect(previewMeal).toHaveBeenCalled());
  expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Save meal" }) as HTMLButtonElement).disabled).toBe(true);
  const calculated: MealItem = { id: "server-item", foodId: food.id, name: food.name, grams: 100, nutrients: { kcal: 200, protein: 22, carbs: 15, fat: 4 }, source: "label", sourceVersion: "v2", basis: "as-served", confirmed: false };
  resolve({ items: [calculated], totals: calculated.nutrients, warnings: [] });
  await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false));
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Save meal" }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].items[0]).toMatchObject({ nutrients: { protein: 22 }, confirmed: true, sourceVersion: "v2" });
  expect(screen.queryByRole("button", { name: "Describe it" })).toBeNull();
});
it("keeps saving disabled when server calculation fails", async () => {
  const client: TrackerClient = { ...demoClient, mode: "live", searchFoods: async () => [food], previewMeal: async () => { throw new Error("Database offline"); } };
  render(React.createElement(MealEditor, { client, onSave: vi.fn() }));
  await userEvent.setup().click(await screen.findByRole("button", { name: "Add My food" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Database offline");
  expect((screen.getByRole("button", { name: "Save meal" }) as HTMLButtonElement).disabled).toBe(true);
});
