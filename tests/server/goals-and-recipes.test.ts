import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getGoals, PUT as updateGoals } from "@/app/api/goals/route";
import { POST as createRecipe, GET as getRecipes } from "@/app/api/recipes/route";
import { PATCH as updateRecipe, DELETE as deleteRecipe } from "@/app/api/recipes/[id]/route";
import { POST as createMeal } from "@/app/api/meals/route";
import { defaultStorage } from "@/server/storage/in-memory";

describe("Goals (Effective Dating) and Recipe CRUD", () => {
  const user = "test-user-goals-recipes";

  beforeEach(() => {
    defaultStorage.clearAll();
  });

  describe("Effective-Dated Goals", () => {
    it("selects the correct goal effective on the requested local date", async () => {
      // 1. Goal 1 effective Jan 1, 2026: Cutting phase (1800 kcal)
      await updateGoals(
        new NextRequest("http://localhost:3000/api/goals", {
          method: "PUT",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({
            effectiveDate: "2026-01-01",
            goal: { mode: "cut", kcal: 1800, protein: 140, carbs: 180, fat: 50 },
          }),
        })
      );

      // 2. Goal 2 effective June 1, 2026: Bulking phase (2600 kcal)
      await updateGoals(
        new NextRequest("http://localhost:3000/api/goals", {
          method: "PUT",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({
            effectiveDate: "2026-06-01",
            goal: { mode: "bulk", kcal: 2600, protein: 160, carbs: 320, fat: 75 },
          }),
        })
      );

      // Querying March 15, 2026 should return Goal 1 (cut, 1800 kcal)
      const marchRes = await getGoals(
        new NextRequest("http://localhost:3000/api/goals?date=2026-03-15", {
          method: "GET",
          headers: { authorization: `Bearer ${user}` },
        })
      );
      const march = await marchRes.json();
      expect(march.goal.mode).toBe("cut");
      expect(march.goal.kcal).toBe(1800);
      expect(march.effectiveDate).toBe("2026-01-01");

      // Querying July 20, 2026 should return Goal 2 (bulk, 2600 kcal)
      const julyRes = await getGoals(
        new NextRequest("http://localhost:3000/api/goals?date=2026-07-20", {
          method: "GET",
          headers: { authorization: `Bearer ${user}` },
        })
      );
      const july = await julyRes.json();
      expect(july.goal.mode).toBe("bulk");
      expect(july.goal.kcal).toBe(2600);
      expect(july.effectiveDate).toBe("2026-06-01");
    });
  });

  describe("Recipe CRUD and Recipe Portion Logging", () => {
    it("creates recipes with ingredients and calculates portion allocation when logged in a meal", async () => {
      // 1. Create a recipe: "Dal Tadka"
      // Ingredients:
      // - 100g raw toor dal (343 kcal, 22.3 P, 60.4 C, 1.7 F)
      // - 15g desi ghee (135 kcal, 0 P, 0 C, 15 F)
      // Batch total = 478 kcal
      // Cooked yield = 350g
      const createReq = new NextRequest("http://localhost:3000/api/recipes", {
        method: "POST",
        headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
        body: JSON.stringify({
          name: "Homemade Dal Tadka",
          cookedYieldGrams: 350,
          ingredients: [
            { foodId: "raw-toor-dal", grams: 100 },
            { foodId: "desi-ghee", grams: 15 },
          ],
        }),
      });

      const createRes = await createRecipe(createReq);
      expect(createRes.status).toBe(201);
      const { recipe } = await createRes.json();
      expect(recipe.id).toBeDefined();
      expect(recipe.cookedYieldGrams).toBe(350);
      expect(recipe.ingredients.length).toBe(2);

      // 2. Log a meal using recipeId for a 175g portion (exactly 50% of the cooked yield)
      const mealReq = new NextRequest("http://localhost:3000/api/meals", {
        method: "POST",
        headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
        body: JSON.stringify({
          date: "2026-10-25",
          timezone: "Asia/Kolkata",
          type: "Dinner",
          title: "Dinner with Recipe",
          inputType: "manual",
          items: [
            {
              recipeId: recipe.id,
              grams: 175,
              confirmed: true,
            },
          ],
        }),
      });

      const mealRes = await createMeal(mealReq);
      expect(mealRes.status).toBe(201);
      const { meal } = await mealRes.json();

      // Exactly 50% of 478 kcal = 239.0 kcal
      expect(meal.items[0].nutrients.kcal).toBeCloseTo(239.0, 1);
      expect(meal.items[0].nutrients.fat).toBeCloseTo(8.4, 1);
    });

    it("rejects recipe creation with non-existent foods or invalid yield", async () => {
      // Non-existent food
      const res1 = await createRecipe(
        new NextRequest("http://localhost:3000/api/recipes", {
          method: "POST",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({
            name: "Bad Recipe",
            cookedYieldGrams: 200,
            ingredients: [{ foodId: "non-existent-food-xyz", grams: 50 }],
          }),
        })
      );
      expect(res1.status).toBe(404);

      // Invalid yield (0 grams)
      const res2 = await createRecipe(
        new NextRequest("http://localhost:3000/api/recipes", {
          method: "POST",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({
            name: "Bad Yield",
            cookedYieldGrams: 0,
            ingredients: [{ foodId: "desi-ghee", grams: 10 }],
          }),
        })
      );
      expect(res2.status).toBe(400);
    });

    it("supports PATCH and DELETE for recipes", async () => {
      // Create recipe
      const createRes = await createRecipe(
        new NextRequest("http://localhost:3000/api/recipes", {
          method: "POST",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({
            name: "Original Name",
            cookedYieldGrams: 300,
            ingredients: [{ foodId: "desi-ghee", grams: 10 }],
          }),
        })
      );
      const { recipe } = await createRes.json();

      // PATCH name
      const patchRes = await updateRecipe(
        new NextRequest(`http://localhost:3000/api/recipes/${recipe.id}`, {
          method: "PATCH",
          headers: { authorization: `Bearer ${user}`, "content-type": "application/json" },
          body: JSON.stringify({ name: "Updated Name", cookedYieldGrams: 320 }),
        }),
        { params: Promise.resolve({ id: recipe.id }) }
      );
      expect(patchRes.status).toBe(200);
      const { recipe: updated } = await patchRes.json();
      expect(updated.name).toBe("Updated Name");
      expect(updated.cookedYieldGrams).toBe(320);

      // DELETE
      const deleteRes = await deleteRecipe(
        new NextRequest(`http://localhost:3000/api/recipes/${recipe.id}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${user}` },
        }),
        { params: Promise.resolve({ id: recipe.id }) }
      );
      expect(deleteRes.status).toBe(204);

      // Verify no longer in list
      const listRes = await getRecipes(
        new NextRequest("http://localhost:3000/api/recipes", {
          method: "GET",
          headers: { authorization: `Bearer ${user}` },
        })
      );
      const { recipes } = await listRes.json();
      expect(recipes.some((r: { id: string }) => r.id === recipe.id)).toBe(false);
    });
  });
});
