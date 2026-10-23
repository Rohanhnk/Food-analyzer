# @nourish/nutrition

Deterministic nutrition catalog, portion resolution, and calculation engine for Nourish (Person 3 subsystem).

This package is completely standalone with **zero dependencies** on Next.js, React, Clerk, or Convex. It runs 100% offline and can be injected into Node.js, Route Handlers, background workers, or in-browser engines.

---

## Architecture Overview

```
packages/nutrition/
├── src/
│   ├── types.ts                   # Strictly immutable domain models
│   ├── calculation/               # High-precision food, recipe & meal calculators
│   ├── quantity/                  # Gram validation & portion resolution
│   ├── matching/                  # Alias normalization & ranked search
│   ├── repository/                # FoodRepository interface & in-memory store
│   ├── data/                      # 30 verified Indian food records (IFCT/USDA)
│   ├── ingestion/                 # Repeatable catalog validator & importer
│   └── evaluation/                # Measured test cases & deviation reporting
└── tests/                         # Full offline test suite
```

---

## Public API Contract

### 1. `searchFoods(query, repository, options?): Promise<FoodMatch[]>`
- Normalizes query string (case, spacing, punctuation, diacritics).
- Matches against canonical food names and Indian regional aliases (e.g. `chapati` ↔ `roti`, `dahi` ↔ `curd`, `sabzi` ↔ `bhaji`).
- **Ambiguity Detection**: Returns `isAmbiguous: true` when broad category keywords (`"dal"`, `"sabzi"`, `"curry"`, `"rice"`) are searched or top candidates are closely ranked, preventing silent auto-selection.
- **Explicit No-Match**: Returns an empty array `[]` when no candidates meet the confidence threshold. Never invents or fabricates fallback foods.

### 2. `resolveQuantity(candidate, servingDefinition?): ResolvedQuantity | NeedsConfirmation`
- Accepts grams directly (`150g` → 150 g).
- Converts piece, bowl, or serving units **only** when a valid serving definition is provided or the user has confirmed the default.
- Returns `status: "needs_confirmation"` for uncertain bowl sizes, missing units, or missing quantities.
- **Strict Validation**: Rejects `0`, negative numbers, `NaN`, `Infinity`, and weights `> 10,000 g` with typed `InvalidQuantityError`.

### 3. `calculateFood(food, grams, options?): CalculatedItem`
- Formula: $\text{nutrient} = (\text{grams} / 100) \times \text{per100g}$.
- Retains internal floating-point precision; rounds for display only.
- Authoritative `kcal` is maintained directly from the verified table (never assumes $4P + 4C + 9F$).
- Generates a permanent `ProvenanceSnapshot` recording `catalogId`, `source`, `sourceVersion`, `basis`, and `per100gSnapshot`.

### 4. `calculateRecipe(recipe, ingredients, servingGrams, options?): CalculatedItem`
- Sums individual ingredient contributions using each ingredient's raw mass.
- Accounts for 100% of cooking oil, ghee, and tadka fat.
- Yield Allocation Formula: $\text{portionRatio} = \text{servingGrams} / \text{recipe.cookedYieldGrams}$.
- Does **not** assume raw ingredient weight equals finished cooked yield.

### 5. `calculateMeal(items): CalculatedMeal`
- Aggregates multiple calculated items into a combined meal total.
- Surfaces warnings for unconfirmed items, raw-basis ingredients, or uncertain portions.

---

## Verified Reference Dataset

- **30 Common Indian Staple Foods**: Whole wheat roti, plain paratha, boiled white rice, brown rice, raw basmati rice, toor dal, moong dal, chana dal, chole, rajma, fresh paneer, whole milk curd/dahi, cow's milk, buffalo milk, desi ghee, mustard oil, steamed idli, plain dosa, sambar, palak paneer, aloo gobi, bhindi masala, chicken curry, chicken breast, boiled egg, egg omelette, masala chai, fresh banana, and cooked poha.
- **Authoritative Provenance**: Indian Food Composition Tables (IFCT 2017, ICMR-NIN) and USDA FoodData Central.
- Full licensing and citation terms documented in [DATA_ATTRIBUTION.md](./DATA_ATTRIBUTION.md).

---

## Catalog Upgrades & Immutability

When a user logs a meal, the backend persists the `CalculatedItem.snapshot`. If the food catalog is subsequently upgraded (e.g. IFCT 2017 → IFCT 2024):
- Historical meal logs **remain unchanged**.
- `diffCatalogSnapshot(snapshot, currentFoodRecord)` can be run to inspect version drift and nutrient variances without mutating historical diary records.

---

## Catalog Ingestion for Backend (Person 2)

```typescript
import { CatalogImporter, InMemoryFoodRepository } from "@nourish/nutrition";

const importer = new CatalogImporter();
const repository = new InMemoryFoodRepository(); // or Convex FoodRepository

const result = await importer.importCatalog(rawRecords, repository);
if (!result.success) {
  console.error("Validation failed:", result.report.errors);
} else {
  console.log(`Imported ${result.importedCount} valid records.`);
}
```

The importer validates:
- Unique IDs (detects duplicate IDs).
- Alias collisions across distinct foods.
- Missing nutrient values, negative numbers, or sums exceeding physical bounds (>100.5g/100g).
- Source attribution and copyright citations.

---

## Testing & Evaluation Suite

Run the full nutrition test and evaluation suite:

```bash
npm test
```

Evaluation covers:
1. Measured single food scaling against analytical expected values.
2. Mixed meal aggregation.
3. Recipe cooked yield and ghee/oil retention.
4. Raw vs cooked basis mismatches.
5. Serving definition ambiguity and confirmation flows.
6. Indian regional alias ranking and generic term disambiguation.
7. Fractional and boundary quantities (0.5 roti, negative weights, NaN, unreasonable weights).
