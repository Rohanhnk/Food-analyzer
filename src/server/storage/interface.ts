import type { FoodRecord, Goal, Meal, Recipe } from "@/lib/contracts";

export type ImageRecord = {
  id: string;
  ownerId: string;
  storageId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: "pending" | "analyzed" | "deleted";
  createdAt: string;
  buffer?: Buffer;
};

export type PaginatedMeals = {
  meals: Meal[];
  nextCursor: string | null;
};

export interface StorageRepository {
  // Foods
  findFoodById(id: string): Promise<FoodRecord | null>;
  searchFoods(query: string): Promise<FoodRecord[]>;
  listAllFoods(): Promise<FoodRecord[]>;
  importFoods(foods: FoodRecord[]): Promise<number>;

  // Recipes (owner-scoped)
  findRecipeById(ownerId: string, recipeId: string): Promise<Recipe | null>;
  listRecipes(ownerId: string): Promise<Recipe[]>;
  saveRecipe(ownerId: string, recipe: Recipe): Promise<Recipe>;
  deleteRecipe(ownerId: string, recipeId: string): Promise<boolean>;

  // Meals (owner-scoped)
  findMealById(ownerId: string, mealId: string): Promise<Meal | null>;
  listMealsByDate(ownerId: string, date: string): Promise<Meal[]>;
  listMealsRange(
    ownerId: string,
    from?: string,
    to?: string,
    cursor?: string,
    limit?: number
  ): Promise<PaginatedMeals>;
  saveMeal(ownerId: string, meal: Meal): Promise<Meal>;
  deleteMeal(ownerId: string, mealId: string): Promise<boolean>;

  // Goals (owner-scoped & effective dated)
  getEffectiveGoal(ownerId: string, date: string): Promise<{ goal: Goal; effectiveDate: string }>;
  saveGoal(ownerId: string, goal: Goal, effectiveDate: string): Promise<{ goal: Goal; effectiveDate: string }>;

  // Image Storage & Metadata
  saveImageRecord(record: ImageRecord): Promise<void>;
  findImageById(ownerId: string, imageId: string): Promise<ImageRecord | null>;
  deleteImageRecord(ownerId: string, imageId: string): Promise<boolean>;

  // Idempotency
  getIdempotencyRecord(ownerId: string, key: string): Promise<{ statusCode: number; responseBody: string } | null>;
  saveIdempotencyRecord(ownerId: string, key: string, statusCode: number, responseBody: string): Promise<void>;
}
