/**
 * Core domain types for @nourish/nutrition.
 * All input and output types are strictly immutable (readonly).
 */

/** Energy and macronutrient distribution. Units: kcal for energy, grams for macros. */
export type Nutrients = {
  readonly kcal: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
  readonly fiber?: number;
  readonly sugar?: number;
  readonly sodium?: number;
};

/** Measurement basis of food composition. */
export type FoodBasis = "raw" | "cooked" | "as-served";

/** Standardized serving definition with mass in grams. */
export type ServingDefinition = {
  readonly unit: "piece" | "bowl" | "katori" | "serving" | "cup" | "tbsp" | "tsp" | "slice" | "glass" | "plate" | string;
  readonly grams: number;
  readonly description?: string;
};

/** Authoritative food record from verified composition tables (IFCT/USDA). */
export type FoodRecord = {
  readonly id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly category: string;
  readonly per100g: Readonly<Nutrients>;
  readonly basis: FoodBasis;
  readonly standardServing?: Readonly<ServingDefinition>;
  readonly alternateServings?: readonly Readonly<ServingDefinition>[];
  readonly source: string;
  readonly sourceVersion: string;
  readonly sourceId?: string;
  readonly attribution: string;
  readonly notes?: string;
};

/** Recipe definition specifying yield and raw total mass. */
export type RecipeRecord = {
  readonly id: string;
  readonly name: string;
  readonly cookedYieldGrams: number;
  readonly rawTotalGrams?: number;
  readonly notes?: string;
  readonly version?: string;
};

/** Individual ingredient input when calculating a recipe. */
export type RecipeIngredientInput = {
  readonly foodId: string;
  readonly foodName: string;
  readonly rawGrams: number;
  readonly nutrientsPer100g: Readonly<Nutrients>;
  readonly basis: FoodBasis;
  readonly source: string;
  readonly sourceVersion: string;
};

/** Immutable provenance snapshot saved with meal items for auditing. */
export type ProvenanceSnapshot = {
  readonly catalogId: string;
  readonly catalogVersion: string;
  readonly source: string;
  readonly sourceVersion: string;
  readonly sourceId?: string;
  readonly basis: FoodBasis;
  readonly grams: number;
  readonly per100gSnapshot: Readonly<Nutrients>;
  readonly calculatedAt: string;
  readonly method: "food_per100g" | "recipe_cooked_yield";
  readonly uncertaintyWarnings?: readonly string[];
  readonly recipeMetadata?: {
    readonly rawTotalGrams: number;
    readonly cookedYieldGrams: number;
    readonly allocationRatio: number;
    readonly ingredientCount: number;
    readonly ingredients: readonly Readonly<RecipeIngredientInput>[];
  };
};

/** Calculated item result from food or recipe calculation. */
export type CalculatedItem = {
  readonly id: string;
  readonly targetId: string;
  readonly name: string;
  readonly itemType: "food" | "recipe";
  readonly grams: number;
  readonly nutrients: Readonly<Nutrients>;
  readonly per100g: Readonly<Nutrients>;
  readonly basis: FoodBasis;
  readonly source: string;
  readonly sourceVersion: string;
  readonly snapshot: Readonly<ProvenanceSnapshot>;
  readonly confirmed: boolean;
};

/** Aggregated calculated meal containing multiple items and warnings. */
export type CalculatedMeal = {
  readonly items: readonly Readonly<CalculatedItem>[];
  readonly totalGrams: number;
  readonly totalNutrients: Readonly<Nutrients>;
  readonly warnings: readonly string[];
};

/** Scored match result for food search. */
export type FoodMatch = {
  readonly food: Readonly<FoodRecord>;
  readonly score: number; // 0.0 to 1.0
  readonly matchType: "exact_name" | "exact_alias" | "prefix" | "token_match" | "partial";
  readonly isAmbiguous: boolean;
  readonly matchedTerm: string;
};

/** Candidate portion received from text/AI interpretation or user selection. */
export type QuantityCandidate = {
  readonly quantity: number | null | undefined;
  readonly unit: string | null | undefined;
  readonly foodId?: string;
  readonly foodName?: string;
  readonly userConfirmed?: boolean;
};

/** Successful portion resolution to exact grams. */
export type ResolvedQuantity = {
  readonly status: "resolved";
  readonly grams: number;
  readonly unit: string;
  readonly originalQuantity: number;
  readonly source: "direct_grams" | "serving_definition" | "user_confirmed";
  readonly needsConfirmation: boolean;
  readonly servingDefinition?: Readonly<ServingDefinition>;
};

/** Quantity resolution requiring explicit user confirmation. */
export type NeedsConfirmation = {
  readonly status: "needs_confirmation";
  readonly reason:
    | "unit_requires_serving_definition"
    | "bowl_volume_uncertain"
    | "missing_quantity"
    | "missing_unit"
    | "unrecognized_unit";
  readonly message: string;
  readonly candidate: Readonly<QuantityCandidate>;
  readonly suggestedServing?: Readonly<ServingDefinition>;
};

/** Result of quantity resolution union. */
export type QuantityResolutionResult = ResolvedQuantity | NeedsConfirmation;

/** Error classes for deterministic engine. */
export class NutritionEngineError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "NutritionEngineError";
  }
}

export class InvalidQuantityError extends NutritionEngineError {
  constructor(message: string, code: string, public readonly value?: unknown) {
    super(message, code);
    this.name = "InvalidQuantityError";
  }
}

export class MissingFoodError extends NutritionEngineError {
  constructor(message: string, public readonly foodId: string) {
    super(message, "FOOD_NOT_FOUND");
    this.name = "MissingFoodError";
  }
}
