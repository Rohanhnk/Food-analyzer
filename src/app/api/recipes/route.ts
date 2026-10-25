import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { storage } from "@/server";
import { badRequest, handleRouteError, notFound } from "@/server/errors";
import { validateWeightGrams } from "@/server/validation";
import type { MealItem, Recipe } from "@/lib/contracts";
import { calculateFood, formatNutrientsForDisplay } from "@nourish/nutrition";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const recipes = await storage.listRecipes(user.userId);
    return NextResponse.json({ recipes });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();

    if (!body || typeof body !== "object") {
      throw badRequest("Request body must be a valid JSON object.");
    }

    if (typeof body.name !== "string" || !body.name.trim()) {
      throw badRequest("Field 'name' is required.", "name");
    }
    const name = body.name.trim();

    const cookedYieldGrams = validateWeightGrams(body.cookedYieldGrams, "cookedYieldGrams");

    if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
      throw badRequest("Field 'ingredients' must be a non-empty array.", "ingredients");
    }

    const ingredients: MealItem[] = [];

    for (let i = 0; i < body.ingredients.length; i++) {
      const ing = body.ingredients[i];
      if (!ing || typeof ing !== "object" || typeof ing.foodId !== "string") {
        throw badRequest(`Ingredient at index ${i} must specify 'foodId'.`, `ingredients.${i}.foodId`);
      }

      const grams = validateWeightGrams(ing.grams, `ingredients.${i}.grams`);
      const food = await storage.findFoodById(ing.foodId);
      if (!food) {
        throw notFound(`Referenced food "${ing.foodId}" was not found.`);
      }

      const calc = calculateFood(
        {
          id: food.id,
          name: food.name,
          aliases: food.aliases,
          category: food.category,
          per100g: food.per100g,
          basis: food.basis,
          source: food.source,
          sourceVersion: food.sourceVersion,
          attribution: "Authoritative Reference",
        },
        grams,
        { confirmed: true }
      );

      const display = formatNutrientsForDisplay(calc.nutrients, { kcalDecimals: 1, macroDecimals: 1 });

      ingredients.push({
        id: crypto.randomUUID(),
        foodId: food.id,
        name: food.name,
        grams,
        nutrients: {
          kcal: display.kcal,
          protein: display.protein,
          carbs: display.carbs,
          fat: display.fat,
        },
        basis: food.basis,
        source: food.source,
        sourceVersion: food.sourceVersion,
        confirmed: true,
      });
    }

    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name,
      ingredients,
      cookedYieldGrams,
    };

    const saved = await storage.saveRecipe(user.userId, recipe);
    return NextResponse.json({ recipe: saved }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
