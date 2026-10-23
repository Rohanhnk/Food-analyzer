/**
 * @nourish/nutrition — Public API
 * Standalone deterministic nutrition catalog and calculation engine.
 */

// Domain Types
export type {
  Nutrients,
  FoodBasis,
  ServingDefinition,
  FoodRecord,
  RecipeRecord,
  RecipeIngredientInput,
  ProvenanceSnapshot,
  CalculatedItem,
  CalculatedMeal,
  FoodMatch,
  QuantityCandidate,
  ResolvedQuantity,
  NeedsConfirmation,
  QuantityResolutionResult,
} from "./types";

export {
  NutritionEngineError,
  InvalidQuantityError,
  MissingFoodError,
} from "./types";

// Repositories
export type {
  FoodRepository,
  RecipeRepository,
  FoodSearchOptions,
} from "./repository/interface";

export {
  InMemoryFoodRepository,
  InMemoryRecipeRepository,
} from "./repository/in-memory";

// Core Public Calculation Functions
export { calculateFood } from "./calculation/food";
export type { CalculateFoodOptions } from "./calculation/food";

export { calculateRecipe } from "./calculation/recipe";
export type { CalculateRecipeOptions } from "./calculation/recipe";

export { calculateMeal } from "./calculation/meal";

export {
  emptyNutrients,
  scaleNutrients,
  sumNutrientsList,
  formatNutrientsForDisplay,
  diffCatalogSnapshot,
} from "./calculation/precision";
export type { SnapshotComparison } from "./calculation/precision";

// Quantity Resolution and Validation
export { resolveQuantity } from "./quantity/resolve";
export { validateGrams, isValidGrams, MAX_REASONABLE_GRAMS } from "./quantity/validation";
export {
  isGramUnit,
  isPieceUnit,
  isBowlUnit,
  isSpoonUnit,
  GRAM_SYNONYMS,
  PIECE_SYNONYMS,
  BOWL_SYNONYMS,
  SPOON_SYNONYMS,
} from "./quantity/units";

// Alias Normalization and Matching
export { searchFoods } from "./matching/search";
export { normalizeText, tokenize, tokenOverlapRatio } from "./matching/normalize";
export {
  ALIAS_SYNONYM_GROUPS,
  GENERIC_CATEGORY_TERMS,
  isGenericCategoryQuery,
} from "./matching/aliases";

// Verified Reference Data
export {
  VERIFIED_REFERENCE_FOODS,
  REFERENCE_FOODS_BY_ID,
} from "./data/reference-catalog";

// Ingestion and Validation
export {
  validateFoodRecord,
  validateCatalog,
  CatalogImporter,
} from "./ingestion";
export type {
  ValidationIssue,
  FoodValidationResult,
  CatalogValidationReport,
  CatalogImportResult,
  ImportOptions,
} from "./ingestion";

// Evaluation Suite
export {
  runNutritionEvaluation,
  EVALUATION_NUTRIENT_CASES,
  DAL_TADKA_RECIPE,
  DAL_TADKA_INGREDIENTS,
  DAL_TADKA_EXPECTED_PORTION,
} from "./evaluation";
export type {
  EvaluationReport,
  CaseResult,
  EvaluationNutrientCase,
} from "./evaluation";
