import type { FoodRecord, RecipeRecord } from "../types";

export type FoodSearchOptions = {
  readonly limit?: number;
  readonly threshold?: number;
};

/** Abstract repository interface for Food catalog access. */
export interface FoodRepository {
  findById(id: string): Promise<FoodRecord | null>;
  findByNameOrAlias(term: string): Promise<readonly FoodRecord[]>;
  search(query: string, options?: FoodSearchOptions): Promise<readonly FoodRecord[]>;
  listAll(): Promise<readonly FoodRecord[]>;
  addFood?(food: FoodRecord): Promise<void>;
}

/** Abstract repository interface for Recipe catalog access. */
export interface RecipeRepository {
  findById(id: string): Promise<RecipeRecord | null>;
  listAll?(): Promise<readonly RecipeRecord[]>;
  save?(recipe: RecipeRecord): Promise<void>;
}
