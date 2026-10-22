# Proposed API and handoff contract — v1

This is a shared implementation contract for the four owners. Route handlers do not exist yet. `src/lib/contracts.ts` contains the current frontend view-model types; `TrackerClient` is the replacement boundary. The demo client is one implementation, not the production API.

## Conventions

- Dates: local `YYYY-MM-DD`, accompanied by an IANA timezone when server-side date grouping is required. `createdAt`: UTC ISO timestamp.
- Nutrients: `kcal`, `protein`, `carbs`, `fat`; macros in grams. Portion mass in grams. Preserve precision and round for display only.
- Food basis: `raw`, `cooked`, `as-served`. Include `source` and `sourceVersion`.
- Identity: derive from server Clerk authentication. Never trust request-supplied owner/user IDs.
- Responses: JSON. Errors: `{ "error": { "code": "INVALID_INPUT", "message": "...", "field": "items.0.grams" } }`.
- Status codes: 400 invalid input, 401 unauthenticated, 403 forbidden, 404 absent/inaccessible resource, 409 conflict, 413 too large, 429 rate limited, 502 provider failure, 503 temporarily unavailable.
- Do not trust client nutrient snapshots on writes. Recompute from authoritative IDs/weights and return the stored snapshot.

## Endpoints

| Method/route | Request | Success response |
|---|---|---|
| GET `/api/foods/search?q=...` | Search term | `{ foods: FoodRecord[] }` |
| POST `/api/analyze/text` | `{ text }` | `{ foods: DetectedFood[], warnings: string[] }` |
| POST `/api/uploads` | Validated authenticated multipart image | `{ imageId }` |
| POST `/api/analyze/image` | `{ imageId }` owned by caller | Same analysis response as text |
| DELETE `/api/uploads/:id` | Owner authorization | 204 |
| POST `/api/meals/preview` | `{ items: [{ foodId?, recipeId?, grams, confirmed }] }` | `{ items: MealItem[], totals: Nutrients, warnings: string[] }` |
| POST `/api/meals` | `{ date, timezone, type, title, inputType, imageId?, items: [{ foodId?, recipeId?, grams, confirmed }] }`, idempotency header | 201 `{ meal: Meal }` |
| GET `/api/meals?date=YYYY-MM-DD&timezone=...` | Local day | `{ meals: Meal[] }` |
| GET `/api/meals?from=...&to=...&cursor=...` | Bounded range, optional cursor | `{ meals: Meal[], nextCursor: string \| null }` |
| PATCH `/api/meals/:id` | Full editable fields + reviewed items | `{ meal: Meal }` |
| DELETE `/api/meals/:id` | Owner authorization | 204 |
| GET `/api/summary?date=...&timezone=...` | Local day | `{ date, consumed: Nutrients, target: Goal, remaining: Nutrients, mealCount }` |
| GET `/api/goals?date=...` | Effective local day | `{ goal: Goal, effectiveDate }` |
| PUT `/api/goals` | `{ goal: Goal, effectiveDate }` | `{ goal: Goal, effectiveDate }` |
| GET `/api/recipes` | Authenticated owner | `{ recipes: Recipe[] }` |
| POST `/api/recipes` | Name, ingredient IDs/weights/bases, cooked yield | 201 `{ recipe: Recipe }` |
| PATCH `/api/recipes/:id` | Editable recipe fields | `{ recipe: Recipe }` |
| DELETE `/api/recipes/:id` | Owner authorization | 204 |

`DetectedFood` must not contain authoritative macros. An unknown quantity/unit is null; warning strings explain uncertainty. Production matching should extend candidates with explicit match options and resolution state through a compatible contract update.

## Frontend adapter

Person 2 implements `TrackerClient` in `src/lib/http-client.ts`. It composes date/range queries, goals and recipes into `AppData`, and returns an updated view model after mutations. Replace `getClient()` only when contract tests pass. For scale, evolve `load()` into scoped/paginated screen queries with Person 1; do not fetch unlimited lifetime history.

`Meal` IDs and timestamps supplied by the demo are local implementation details. Production create requests omit local IDs/timestamps; the server generates them. Updates send only editable fields. The server recomputes nutrition and attaches provenance/confirmation snapshots. Recipe logging requires extending the current `MealItem.foodId` reference to a discriminated food/recipe reference; agree on that addition before integration.

## Required fixtures for every owner

- Confirmable meal: roti/chapati plus paneer with explicit gram weights.
- Unknown dish with no match.
- Bowl or piece with no known gram conversion.
- Mixed raw/cooked recipe ingredients and known cooked yield.
- Zero/negative/non-finite quantity, invalid date and oversized image.
- Expired authentication, provider failure, rate limit and storage failure.
- A meal whose historical nutrition differs from the current catalog version.

Use illustrative nutrition only for UI fixtures. Production data and numeric nutrition regression tests need independently verified sources.
