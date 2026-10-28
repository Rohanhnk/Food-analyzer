# Four-person implementation plan

## Working agreement

Build four independently testable subsystems. Everyone starts from the shared TypeScript contracts in `src/lib/contracts.ts` and the wire contract in `docs/API_CONTRACT.md`. No developer needs another developer's running service to begin or finish subsystem tests. Integration still needs coordination: mock success alone never proves the integrated application works.

The repository was empty when frontend implementation began. Person 1 has created the Next.js/TypeScript/Tailwind scaffold, lockfile, demo adapter, screen routes and tests. The scaffold is now available to all four owners. Development in this cloud environment uses the existing isolated checkout; do not create another worktree unless explicitly requested.

| Owner | Files owned | Dependencies replaced locally | First independent deliverable |
|---|---|---|---|
| Person 1 — Frontend | `src/features/`, `src/components/`, `src/app/globals.css`, page/layout files, browser tests | Demo identity, demo API adapter, illustrative foods, local storage | Usable meal entry → review → save → dashboard flow |
| Person 2 — Backend/platform | `src/app/api/`, `convex/`, `src/server/`, `src/lib/http-client.ts`, auth integration, deployment | Stub recognition and nutrition interfaces | Authenticated CRUD and daily summary against seeded database |
| Person 3 — Nutrition | `packages/nutrition/`, verified catalog data and importers | Local catalog repository; no Clerk, Convex or AI | Tested matching, grams conversion and nutrient calculation |
| Person 4 — Recognition | `packages/recognition/`, evaluation datasets | Fake model provider and recorded structured responses | Validated text interpretation with uncertainty handling |

Person 1 initially maintains shared contract/schema changes and package manifests. Once the scaffold is merged, assign one maintainer per integration change; avoid concurrent edits to the lockfile and shared contracts. Each owner can propose a compatible addition while continuing against the existing contract. Keep recognition independent of nutrition.

## Person 1 — Frontend and user experience

### Scope and implementation sequence

1. **Application shell and navigation.** Create responsive Next.js routes for overview, add meal, history, goals, recipes and insights. Establish consistent colors, spacing, typography, controls, focus treatment, labels and mobile navigation. Support direct navigation and reloads on every route.
2. **Data boundary.** Define `TrackerClient`. All screens call that boundary rather than Clerk, Convex or model APIs directly. Use asynchronous local demo methods so loading, success and failure states are real. Seed illustrative meals once; persist subsequent edits in local storage. Never silently fall back to demo data in live mode.
3. **Dashboard.** Display consumed calories, current target and remaining/over-target amount; show protein/carbohydrate/fat progress, the day's meals, date selection and a seven-day chart. Sum saved meal snapshots. Missing dates mean no logged intake, not proof the user ate nothing.
4. **Manual meal logging.** Search food names/aliases; add multiple foods; set grams, meal type, date and title. Validate finite positive quantities. Show an editable review with item and total nutrients. Require explicit portion confirmation before saving. Clear that confirmation whenever foods or quantities change.
5. **Text input.** Provide a description box and interpretation state. Turn recognized food candidates into review items. Keep unmatched foods and ambiguous amounts visible as warnings. In this demo, quantities in pieces/bowls use illustrative defaults which must be reviewed. Production must consume the server's food matches and portion-resolution response.
6. **Image input.** Validate type/size, preview a local file, remove it and release object URLs. Keep image handling separate from recognition results. The current UI does not upload, recognize or persist images; Person 2's upload and Person 4's recognition complete this path.
7. **Diary.** Browse by date, edit a meal, confirm deletion, and persist all changes after reload. Preserve nutrition/source snapshots rather than silently recalculating historic meals when the catalog changes.
8. **Goals.** Let users choose cutting/maintenance/bulking and explicitly enter calorie/macro targets. Do not imply that selecting a mode calculates a personalized diet. Store the current target in demo mode. Later render effective-dated goal records supplied by Person 2.
9. **Recipes.** Add named ingredient lists, editable ingredient grams and cooked yield. Save/edit/delete local recipes and preview nutrients per 100 g. Wire recipe portion logging to Person 3's server-backed calculation later.
10. **Insights and accessibility.** Show seven days of logged intake and average across days with entries. Provide readable chart text, keyboard-operable forms, loading/empty/error states and responsive layout. Weight trends are deferred until weight records exist.
11. **Integration.** Replace `getClient()`'s demo binding with Person 2's authenticated HTTP client. Replace fixture calculations with server results; do not use client-supplied nutrient values as authoritative. Add Clerk sign-in/account components only when the auth boundary is available.

### Inputs and outputs

- Inputs: food search results, structured recognition candidates, server-calculated review items, saved meals, recipes, goals and daily summaries.
- Outputs: user-entered text/images, selected food IDs, reviewed weights, dates, meal categories and explicit confirmation.
- Authentication and API keys stay outside frontend business logic. No provider secret receives a `NEXT_PUBLIC_` prefix.

### Independent validation

Run `npm run check`, `npm run build` and `npm run test:e2e` using Chromium. Test desktop and mobile. Cover text → review → save → reload, meal edit/delete, goal changes, recipe creation/edit/delete, invalid weights, empty search, photo validation and corrupted browser storage. Nutrition fixtures are explicitly illustrative.

### Completion boundary

The standalone demo is delivered in this change. Live authentication, authoritative nutrition, external AI, real storage and deployment are integration work. The UI must not describe those capabilities as connected before their checks pass.

## Person 2 — Backend, authentication, persistence and deployment

### Scope and implementation sequence

1. **Server foundations.** Configure Next.js Route Handlers, Clerk server authentication and Convex. Provide `.env.example` names and deployment instructions, never values. Pin supported SDK versions. Implement a common schema-validation and error-response layer.
2. **Database model.** Create users/profiles, foods, recipes, meals, mealItems, effective-dated goals and image metadata. Add indexes for authenticated owner + local date, owner + recipe and normalized food aliases. Store nutrition source/version, raw/cooked basis, confirmed grams and immutable macro snapshots with meals.
3. **Authorization.** Derive owner identity on the server from Clerk. Verify ownership on every read, edit, delete and image access. Do not accept a client `userId` as authorization. Exercise cross-user access with two independent test identities.
4. **Meal write path.** Validate IDs, dates and quantities. Resolve authoritative food/recipe records through a nutrition interface, calculate on the server, and atomically persist meal plus item snapshots. On edit, replace only the authorized meal. Make repeated submissions safe with an idempotency key or equivalent request deduplication.
5. **Read and summary paths.** List meals for an explicit local date; return pagination for history. Sum immutable item snapshots for daily summaries. Return the goal effective on that date. Define timezone behavior explicitly rather than grouping solely by UTC timestamps.
6. **Goals and recipes.** Persist new goals with effective dates. CRUD recipes with ingredient IDs/measurement bases and cooked yield. Validate referenced foods and owner-scoped private recipes. Ask the nutrition adapter to calculate recipe portions.
7. **Food catalog access.** Implement `FoodRepository` against Convex. Import Person 3's versioned catalog as a controlled operation. Until available, seed a clearly labeled fixture catalog and keep it out of production data.
8. **Analysis orchestration.** Call Person 4's interpreter, then Person 3's matching and quantity resolution. Return uncertain/unmatched items to the user for correction. Interpretation alone must never save a meal. Keep API keys and prompts server-side.
9. **Photo pipeline.** Authenticate uploads, validate size and decoded media type, issue storage references, authorize reads and deletions, and enforce retention rules. Rate-limit recognition and cap costs per user. Delete orphaned uploads and ensure failed analysis does not leave unbounded files.
10. **Frontend adapter.** Implement `src/lib/http-client.ts` satisfying `TrackerClient`; compose wire endpoints into the frontend view model. Include the user's local date/timezone in relevant requests. Surface server errors without fabricating a successful save.
11. **Operational readiness.** Configure CI, environment variables and Vercel/Convex deployment. Add request IDs and sanitized logging. Test production build, service health, data persistence and rollback steps. Production publication is a separate explicit action.

### Independent development

Inject two adapters: `RecognitionService` returning fixture candidates, and `NutritionService` returning deterministic test calculations. Use seeded database fixtures and test identities. No browser UI or real model calls are necessary to test CRUD, ownership, idempotency or summary correctness.

### Acceptance criteria

- Unauthorized calls fail; user A cannot read/mutate user B's records or files.
- Create/edit/delete updates daily summaries correctly and survives restart.
- Historic snapshots do not change when source nutrition values are updated.
- Date/timezone boundaries and historical goal selection are tested.
- Invalid quantities, malformed JSON, unknown IDs, duplicate writes and model failures return stable error codes.
- Authenticated upload restrictions and deletion/retention behavior are exercised.
- Contract tests demonstrate the HTTP adapter satisfies `TrackerClient`.

## Person 3 — Nutrition catalog and deterministic calculation engine

### Scope and implementation sequence

1. **Standalone package.** Create `packages/nutrition` as TypeScript with no dependency on Next.js, Clerk or Convex. Define repository injection for food/recipe lookup. Use immutable input/output types and a unit-tested public API.
2. **Verified reference data.** Prepare 20–30 common Indian foods using authorized IFCT/INDB/USDA references. Record original source, version, attribution, measurement basis and units. Check redistribution terms before including source tables. Never promote the frontend's demo numbers into production facts.
3. **Alias normalization and matching.** Normalize case/spacing and aliases such as chapati/roti, dahi/curd and sabzi/bhaji. Return a ranked list or explicit no-match result; ambiguous dish names must not become silent exact matches. Keep provider access behind the repository interface.
4. **Quantity resolution.** Accept grams directly. Convert pieces/servings/bowls only with a specific serving definition or user-confirmed default. Return `needs_confirmation` when grams cannot be established. Reject zero, negative, NaN, infinite and unreasonable weights.
5. **Food calculations.** Compute each nutrient as `grams / 100 × nutrientsPer100g`. Retain precision internally and round only for display. Keep kcal from the authoritative source instead of assuming it always equals 4P + 4C + 9F.
6. **Recipes.** Sum ingredient contributions using each ingredient's correct measurement basis. Allocate by `servingGrams / cookedYieldGrams`. Include measurable oil/ghee and use the finished cooked weight; do not assume raw ingredient total equals cooked yield.
7. **Source snapshots.** Return calculation output with food/recipe ID, source/version, basis, grams and uncertainty/provenance. The backend persists this object. Define how catalog upgrades create new versions without rewriting historical meals.
8. **Catalog ingestion.** Deliver a validated dataset and repeatable importer interface to Person 2. Include duplicate-ID/alias checks, missing-nutrient handling, source attribution and validation reports. Do not require Convex to test the source dataset.
9. **Evaluation.** Build measured cases for individual foods, mixed meals and homemade recipes. Test raw/cooked mismatches, serving ambiguity, recipe yield, aliases, missing references and fractional quantities. Report numeric errors separately from AI recognition errors.

### Public interfaces to agree on

- `searchFoods(query, repository): FoodMatch[]`
- `resolveQuantity(candidate, servingDefinition?): ResolvedQuantity | NeedsConfirmation`
- `calculateFood(food, grams): CalculatedItem`
- `calculateRecipe(recipe, ingredients, servingGrams): CalculatedItem`
- `calculateMeal(items): CalculatedMeal`

### Independent development

Use a small licensed reference dataset and an in-memory repository. Tests run entirely offline. AI-generated food names are fixture strings; no model output is required. Backend uses a stub package while this package is under development.

### Acceptance criteria

- Known ingredient/recipe calculations match independently prepared expected values within stated numeric tolerances.
- Alias matches work without conflating different prepared dishes.
- Unknown portions and raw/cooked mismatches are surfaced, not invented.
- Source/version and confirmation status survive every calculation.
- Catalog licensing and attribution are documented.

## Person 4 — AI interpretation and evaluation

Implementation status: standalone recognition package, provider adapter, API orchestration, live photo UI and offline regression tests are implemented. See `packages/recognition/README.md`. Live provider validation and independently measured photo evaluation remain outstanding.

### Scope and implementation sequence

1. **Provider-independent package.** Create `packages/recognition` with a `ModelProvider` interface. Public functions accept text or an authorized image reference and return structured `DetectedFood[]`. Use mock provider outputs by default in unit tests.
2. **Structured schema.** Return food name, quantity/unit when known and uncertainty warnings. Unknown amounts remain null. Do not emit final calorie/macronutrient facts; Person 3 owns those calculations.
3. **Text interpretation.** Handle mixed Indian meal descriptions, aliases, compound dishes, approximate servings and multiple items. Preserve distinctions such as “100 g cooked rice” vs “100 g raw rice.” Mark unsupported or conflicting information for confirmation.
4. **Validation.** Validate model output against a strict runtime schema, including allowed units, numeric ranges and maximum item count. Normalize only unambiguous values. Treat model output and uploaded text as untrusted data.
5. **Provider adapter.** Keep API credentials server-side; set timeouts, output/token limits and a bounded retry policy for transient errors. Handle refusal, malformed output, truncation, rate limits and unavailable models as explicit typed results/errors.
6. **Image interpretation.** Accept Person 2's authorized image input. Identify visible candidate foods and unresolved quantities. Flag hidden ingredients, oil/ghee, uncertain scale and mixed dishes. Do not claim photo-only grams are exact. Reuse the same output schema and review path as text.
7. **Evaluation set.** Prepare 50–100 diverse text/photo meal cases with measured portions and reference nutrition where available. Include regional dishes, multiple foods, low-light/occluded images and unknown dishes. Keep test media authorized and remove unnecessary metadata.
8. **Separate metrics.** Report food recognition precision/recall, portion error and downstream nutrient error separately. Numeric nutrient comparisons consume reference calculations from Person 3 only during integration; recognition tests run independently.
9. **Integration handoff.** Provide provider setup instructions, typed failure codes, cost/latency observations, evaluation results and representative fixtures. Person 2 owns HTTP routes, authentication, per-user rate limits and storage; this package does not duplicate those responsibilities.

### Independent development

Use fixed text samples, authorized test images and mocked provider responses. Optional live smoke tests require a configured key; missing credentials should skip only those explicitly labeled tests. The full parser/schema/error-handling suite runs without a paid API or another person's package.

### Acceptance criteria

- Outputs pass the schema or return a typed failure.
- Common meal descriptions retain correct item counts and explicit quantities.
- Unknown foods and uncertain portions reach the review flow.
- Tests cover provider failures, malformed output, empty input and oversized input.
- Image results never imply measured mass without evidence.
- A versioned evaluation report exposes known limitations and reproducible inputs.

## Parallel milestones and integration

| Milestone | Person 1 | Person 2 | Person 3 | Person 4 |
|---|---|---|---|---|
| 1: local foundations | Shell, contracts, demo client | Auth/db + test fixtures | Package + reference fixtures | Package + fake provider |
| 2: independent core | Manual entry/review/diary/goals | Meal CRUD + summary | Food arithmetic + aliases | Structured text parsing |
| 3: extensions | Recipes, image preview, insights | Recipe/image/goal routes | Recipe yield + serving resolution | Image candidates + evaluation |
| 4: integration | HTTP client binding and live states | Connect domain adapters | Replace nutrition stub | Replace interpretation stub |
| 5: release checks | Browser flows/accessibility | Ownership/persistence/deployment | Numeric regression suite | Live smoke/evaluation report |

Integrate each completed contract incrementally; do not wait for every extension. First real milestone: authenticated user enters “2 rotis and 100g paneer”, confirms actual weights, reviews source-backed calculated totals, saves, and sees the same meal/summary after refresh. Then connect images to that same pipeline.

The frontend's completed demo is not proof that live authentication, recognition or authoritative nutrition work. Keep separate status for mock tests, service tests, integrated tests and deployed checks.
