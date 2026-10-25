import type { MealItem, Nutrients } from "@/lib/contracts";
import type { StorageRepository } from "./storage/interface";
import { badRequest, notFound } from "./errors";
import {
  calculateFood,
  calculateMeal,
  calculateRecipe,
  formatNutrientsForDisplay,
  type RecipeIngredientInput,
} from "@nourish/nutrition";
import { validateWeightGrams } from "./validation";

export type MealItemInput = {
  foodId?: string;
  recipeId?: string;
  grams: number;
  confirmed?: boolean;
};

export type CalculatedMealResult = {
  items: MealItem[];
  totals: Nutrients;
  warnings: string[];
};

export class NutritionService {
  constructor(private readonly storage: StorageRepository) {}

  async calculateMealItems(
    ownerId: string,
    inputs: MealItemInput[]
  ): Promise<CalculatedMealResult> {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw badRequest("Meal must contain at least one food or recipe item.", "items");
    }

    const calculatedItems = [];
    const mealItems: MealItem[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const grams = validateWeightGrams(input.grams, `items.${i}.grams`);
      const confirmed = Boolean(input.confirmed);

      if (!input.foodId && !input.recipeId) {
        throw badRequest(`Item at index ${i} must specify either foodId or recipeId.`, `items.${i}`);
      }

      if (input.foodId) {
        const food = await this.storage.findFoodById(input.foodId);
        if (!food) {
          throw notFound(`Food item with ID "${input.foodId}" not found in authoritative catalog.`);
        }

        // Convert contracts FoodRecord to nutrition package FoodRecord
        const nutritionFood = {
          id: food.id,
          name: food.name,
          aliases: food.aliases,
          category: food.category,
          per100g: food.per100g,
          basis: food.basis,
          source: food.source,
          sourceVersion: food.sourceVersion,
          attribution: "Authoritative Reference",
        };

        const calc = calculateFood(nutritionFood, grams, { confirmed });
        calculatedItems.push(calc);

        const itemNutrients = formatNutrientsForDisplay(calc.nutrients, { kcalDecimals: 1, macroDecimals: 1 });

        mealItems.push({
          id: crypto.randomUUID(),
          foodId: food.id,
          name: food.name,
          grams,
          nutrients: {
            kcal: itemNutrients.kcal,
            protein: itemNutrients.protein,
            carbs: itemNutrients.carbs,
            fat: itemNutrients.fat,
          },
          basis: food.basis,
          source: food.source,
          sourceVersion: food.sourceVersion,
          confirmed,
        });

        if (calc.snapshot.uncertaintyWarnings?.length) {
          warnings.push(...calc.snapshot.uncertaintyWarnings);
        }
      } else if (input.recipeId) {
        const recipe = await this.storage.findRecipeById(ownerId, input.recipeId);
        if (!recipe) {
          throw notFound(`Recipe with ID "${input.recipeId}" not found or unauthorized.`);
        }

        const ingredients: RecipeIngredientInput[] = recipe.ingredients.map(ing => ({
          foodId: ing.foodId,
          foodName: ing.name,
          rawGrams: ing.grams,
          nutrientsPer100g: {
            kcal: (ing.nutrients.kcal / ing.grams) * 100,
            protein: (ing.nutrients.protein / ing.grams) * 100,
            carbs: (ing.nutrients.carbs / ing.grams) * 100,
            fat: (ing.nutrients.fat / ing.grams) * 100,
          },
          basis: ing.basis,
          source: ing.source,
          sourceVersion: ing.sourceVersion,
        }));

        const recipeRecord = {
          id: recipe.id,
          name: recipe.name,
          cookedYieldGrams: recipe.cookedYieldGrams,
        };

        const calc = calculateRecipe(recipeRecord, ingredients, grams, { confirmed });
        calculatedItems.push(calc);

        const itemNutrients = formatNutrientsForDisplay(calc.nutrients, { kcalDecimals: 1, macroDecimals: 1 });

        mealItems.push({
          id: crypto.randomUUID(),
          foodId: recipe.id,
          name: recipe.name,
          grams,
          nutrients: {
            kcal: itemNutrients.kcal,
            protein: itemNutrients.protein,
            carbs: itemNutrients.carbs,
            fat: itemNutrients.fat,
          },
          basis: "cooked",
          source: "Recipe Calculation Engine",
          sourceVersion: "1.0",
          confirmed,
        });

        if (calc.snapshot.uncertaintyWarnings?.length) {
          warnings.push(...calc.snapshot.uncertaintyWarnings);
        }
      }
    }

    const calculatedMeal = calculateMeal(calculatedItems);
    const roundedTotals = formatNutrientsForDisplay(calculatedMeal.totalNutrients, { kcalDecimals: 1, macroDecimals: 1 });

    return {
      items: mealItems,
      totals: {
        kcal: roundedTotals.kcal,
        protein: roundedTotals.protein,
        carbs: roundedTotals.carbs,
        fat: roundedTotals.fat,
      },
      warnings: Array.from(new Set([...warnings, ...calculatedMeal.warnings])),
    };
  }
}
