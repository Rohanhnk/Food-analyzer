import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HttpClient } from "@/lib/http-client";
import { GET as searchFoodsRoute } from "@/app/api/foods/search/route";
import { POST as analyzeTextRoute } from "@/app/api/analyze/text/route";
import { GET as mealsRoute, POST as createMealRoute } from "@/app/api/meals/route";
import { DELETE as deleteMealRoute, PATCH as updateMealRoute } from "@/app/api/meals/[id]/route";
import { GET as goalsRoute, PUT as saveGoalsRoute } from "@/app/api/goals/route";
import { GET as recipesRoute, POST as createRecipeRoute } from "@/app/api/recipes/route";
import { DELETE as deleteRecipeRoute } from "@/app/api/recipes/[id]/route";
import { defaultStorage } from "@/server/storage/in-memory";
import { NextRequest } from "next/server";

describe("Frontend Adapter Contract (HttpClient satisfying TrackerClient)", () => {
  const originalFetch = globalThis.fetch;
  const testUser = "test-user-http-client";

  beforeEach(() => {
    defaultStorage.clearAll();

    // Mock fetch to dispatch directly into our Next.js Route Handlers in memory
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(urlStr, "http://localhost:3000");
      const pathname = url.pathname;
      const method = (init?.method || "GET").toUpperCase();

      const req = new NextRequest(url.toString(), {
        method,
        headers: init?.headers as HeadersInit,
        body: init?.body as BodyInit,
      });

      if (pathname === "/api/foods/search") {
        return searchFoodsRoute(req);
      }
      if (pathname === "/api/analyze/text") {
        return analyzeTextRoute(req);
      }
      if (pathname === "/api/meals") {
        if (method === "GET") return mealsRoute(req);
        if (method === "POST") return createMealRoute(req);
      }
      if (pathname.startsWith("/api/meals/")) {
        const id = pathname.replace("/api/meals/", "");
        if (method === "PATCH") return updateMealRoute(req, { params: Promise.resolve({ id }) });
        if (method === "DELETE") return deleteMealRoute(req, { params: Promise.resolve({ id }) });
      }
      if (pathname === "/api/goals") {
        if (method === "GET") return goalsRoute(req);
        if (method === "PUT") return saveGoalsRoute(req);
      }
      if (pathname === "/api/recipes") {
        if (method === "GET") return recipesRoute(req);
        if (method === "POST") return createRecipeRoute(req);
      }
      if (pathname.startsWith("/api/recipes/")) {
        const id = pathname.replace("/api/recipes/", "");
        if (method === "DELETE") return deleteRecipeRoute(req, { params: Promise.resolve({ id }) });
      }

      return new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found" } }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const client = new HttpClient({
    getToken: () => testUser,
    getTimezone: () => "Asia/Kolkata",
  });

  it("satisfies TrackerClient.load() returning AppData view model", async () => {
    const data = await client.load();

    expect(data.schemaVersion).toBe(1);
    expect(Array.isArray(data.meals)).toBe(true);
    expect(data.goals).toBeDefined();
    expect(data.goals.kcal).toBeGreaterThan(0);
    expect(Array.isArray(data.recipes)).toBe(true);
  });

  it("satisfies TrackerClient.searchFoods()", async () => {
    const foods = await client.searchFoods("roti");

    expect(Array.isArray(foods)).toBe(true);
    expect(foods.length).toBeGreaterThan(0);
    expect(foods[0].name.toLowerCase()).toContain("roti");
  });

  it("satisfies TrackerClient.analyzeText()", async () => {
    const result = await client.analyzeText("2 rotis and 100g paneer");

    expect(result.foods.length).toBe(2);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("satisfies TrackerClient.saveMeal() and returns updated AppData", async () => {
    const initialData = await client.load();
    expect(initialData.meals.length).toBe(0);

    const updatedData = await client.saveMeal({
      id: "temp_new_meal",
      date: "2026-10-25",
      type: "Dinner",
      title: "Client Saved Meal",
      inputType: "manual",
      items: [
        {
          id: "item_1",
          foodId: "roti-chapati-cooked",
          name: "Roti",
          grams: 70,
          nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
          source: "IFCT",
          sourceVersion: "1.0",
          basis: "cooked",
          confirmed: true,
        },
      ],
      createdAt: new Date().toISOString(),
    });

    expect(updatedData.meals.length).toBe(1);
    expect(updatedData.meals[0].title).toBe("Client Saved Meal");
    // Server recomputes nutrients
    expect(updatedData.meals[0].items[0].nutrients.kcal).toBeCloseTo(207.9, 1);
  });

  it("satisfies TrackerClient.deleteMeal()", async () => {
    // 1. Save meal
    const dataWithMeal = await client.saveMeal({
      id: "temp_to_delete",
      date: "2026-10-25",
      type: "Breakfast",
      title: "To Delete",
      inputType: "manual",
      items: [{ id: "i1", foodId: "cow-milk-boiled", name: "Milk", grams: 200, nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, source: "IFCT", sourceVersion: "1.0", basis: "as-served", confirmed: true }],
      createdAt: new Date().toISOString(),
    });
    const mealId = dataWithMeal.meals[0].id;

    // 2. Delete meal
    const dataAfterDelete = await client.deleteMeal(mealId);
    expect(dataAfterDelete.meals.some(m => m.id === mealId)).toBe(false);
  });

  it("satisfies TrackerClient.saveGoals()", async () => {
    const updatedData = await client.saveGoals({
      mode: "cut",
      kcal: 1750,
      protein: 150,
      carbs: 150,
      fat: 45,
    });

    expect(updatedData.goals.mode).toBe("cut");
    expect(updatedData.goals.kcal).toBe(1750);
  });

  it("satisfies TrackerClient.saveRecipe() and deleteRecipe()", async () => {
    // 1. Save recipe
    const dataWithRecipe = await client.saveRecipe({
      id: "temp_recipe",
      name: "Client Recipe",
      cookedYieldGrams: 250,
      ingredients: [
        { id: "i1", foodId: "raw-toor-dal", name: "Dal", grams: 100, nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, source: "IFCT", sourceVersion: "1.0", basis: "raw", confirmed: true },
      ],
    });

    expect(dataWithRecipe.recipes.length).toBe(1);
    const recipeId = dataWithRecipe.recipes[0].id;
    expect(dataWithRecipe.recipes[0].name).toBe("Client Recipe");

    // 2. Delete recipe
    const dataAfterDelete = await client.deleteRecipe(recipeId);
    expect(dataAfterDelete.recipes.some(r => r.id === recipeId)).toBe(false);
  });

  it("surfaces server errors cleanly without fabricating a successful save", async () => {
    // Try to save an invalid meal with negative weight
    await expect(
      client.saveMeal({
        id: "temp_bad",
        date: "2026-10-25",
        type: "Lunch",
        title: "Bad Meal",
        inputType: "manual",
        items: [{ id: "i1", foodId: "roti-chapati-cooked", name: "Roti", grams: -100, nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, source: "IFCT", sourceVersion: "1.0", basis: "cooked", confirmed: true }],
        createdAt: new Date().toISOString(),
      })
    ).rejects.toThrow();
  });
});
