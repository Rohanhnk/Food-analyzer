import type { FoodRecord, RecipeRecord } from "../types";
import type { FoodRepository, FoodSearchOptions, RecipeRepository } from "./interface";
import { VERIFIED_REFERENCE_FOODS } from "../data/reference-catalog";

/**
 * In-memory implementation of FoodRepository.
 * Safe for offline tests and decoupled execution without external databases.
 */
export class InMemoryFoodRepository implements FoodRepository {
  private readonly foods = new Map<string, FoodRecord>();

  constructor(initialFoods: readonly FoodRecord[] = VERIFIED_REFERENCE_FOODS) {
    for (const food of initialFoods) {
      this.foods.set(food.id, food);
    }
  }

  async findById(id: string): Promise<FoodRecord | null> {
    return this.foods.get(id) ?? null;
  }

  async findByNameOrAlias(term: string): Promise<readonly FoodRecord[]> {
    const clean = term.trim().toLowerCase();
    const results: FoodRecord[] = [];
    for (const food of this.foods.values()) {
      if (
        food.name.toLowerCase() === clean ||
        food.aliases.some(a => a.toLowerCase() === clean)
      ) {
        results.push(food);
      }
    }
    return Object.freeze(results);
  }

  async search(query: string, options?: FoodSearchOptions): Promise<readonly FoodRecord[]> {
    const clean = query.trim().toLowerCase();
    if (!clean) return Object.freeze([]);

    const limit = options?.limit ?? 20;
    const matches: FoodRecord[] = [];

    for (const food of this.foods.values()) {
      const name = food.name.toLowerCase();
      const aliasMatch = food.aliases.some(a => a.toLowerCase().includes(clean));
      if (name.includes(clean) || aliasMatch) {
        matches.push(food);
        if (matches.length >= limit) break;
      }
    }

    return Object.freeze(matches);
  }

  async listAll(): Promise<readonly FoodRecord[]> {
    return Object.freeze(Array.from(this.foods.values()));
  }

  async addFood(food: FoodRecord): Promise<void> {
    this.foods.set(food.id, Object.freeze({ ...food }));
  }
}

/**
 * In-memory implementation of RecipeRepository.
 */
export class InMemoryRecipeRepository implements RecipeRepository {
  private readonly recipes = new Map<string, RecipeRecord>();

  constructor(initialRecipes: readonly RecipeRecord[] = []) {
    for (const recipe of initialRecipes) {
      this.recipes.set(recipe.id, recipe);
    }
  }

  async findById(id: string): Promise<RecipeRecord | null> {
    return this.recipes.get(id) ?? null;
  }

  async listAll(): Promise<readonly RecipeRecord[]> {
    return Object.freeze(Array.from(this.recipes.values()));
  }

  async save(recipe: RecipeRecord): Promise<void> {
    this.recipes.set(recipe.id, Object.freeze({ ...recipe }));
  }
}
