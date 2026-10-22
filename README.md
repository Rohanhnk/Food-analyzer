# Nourish · Food Analyzer

An Indian-food-aware calorie and macro tracker. **Person 1's standalone frontend is implemented.** It runs without credentials using an asynchronous demo adapter and browser storage. Demo nutrition is illustrative and must not be used as authoritative food data.

## Start development

Requirements: Node.js 22+ (tested on Node 24), npm, and a browser with local storage enabled.

```bash
cd /workspace/Food-analyzer
npm ci
npm run dev
```

The server listens on port 3000. `NEXT_PUBLIC_DATA_MODE` defaults to `demo`; `.env.example` documents it. Live mode is deliberately not enabled until an authenticated backend adapter exists.

## Implemented screens

| Route | Functionality |
|---|---|
| `/` | Daily calorie/macro balance, date selection, meals, seven-day chart |
| `/add` | Food search, manual grams, demo text interpretation, photo preview, review/confirmation and save |
| `/history` | Dated diary, edit/delete confirmation and persistent snapshots |
| `/goals` | Cut/maintain/bulk selection and editable calorie/macro targets |
| `/recipes` | Ingredient lists, weight edits, cooked yield, per-100g preview, recipe CRUD |
| `/insights` | Seven-day logged intake, logged-day averages and meal counts |

A fresh browser is seeded with sample meals. Changes are stored under `nourish-demo-v1` in local storage. Clear that site storage entry to reset the demo. Uploaded photos stay in memory, are not sent to a server, and are not retained with saved meals.

## Validation

```bash
npm run check       # TypeScript, ESLint, Vitest
npm run build       # production compilation and static route generation
npm run test:e2e    # Playwright desktop + mobile; starts the production server
```

Playwright needs Chromium. This cloud environment already provides `/usr/bin/chromium`:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

On other machines, run `npx playwright install chromium` first, or supply an installed Chromium executable using that variable. The cloud network policy blocks `cdn.playwright.dev`; the installed system browser avoids a download. Do not disable TLS or artifact verification.

Browser tests cover the main meal lifecycle, reload persistence, goals, recipe CRUD, invalid quantities, search empty states, photo handling and storage errors. They exercise the demo implementation, not live AI/auth/database integrations.

## Team handoff

- [Detailed four-person implementation plan](docs/IMPLEMENTATION_PLAN.md): steps, ownership, independent workflows, acceptance criteria and integration milestones.
- [API and integration contract](docs/API_CONTRACT.md): proposed routes, request/response conventions and replacement strategy.
- `src/lib/contracts.ts`: shared TypeScript view models and `TrackerClient` interface.
- `src/lib/demo-client.ts`: async local implementation with illustrative seed data.
- `src/lib/client.ts`: single adapter selection point.
- `src/lib/model.ts`: demo display arithmetic and date helpers. Production calculations move to Person 3's server-used package.

Person 2 owns server authentication, Convex, API routes, storage, authoritative writes and deployment. Person 3 owns verified nutrition and deterministic calculations. Person 4 owns text/image interpretation. Everyone can develop using fixed interfaces and fixtures before the other implementations are complete.

## Current limits

- No live Clerk account, Convex database, external AI calls or deployed service yet.
- Text interpretation is a small deterministic demo parser; unknown phrases require manual correction.
- Image input supports preview/type/size validation only.
- Recipe portion logging and effective-dated goal history await backend/nutrition integration.
- Goals are explicit user inputs; personalized energy prescriptions and body-weight trends are not implemented.
- Browser storage is local to the device and is not a secure multi-user database. Production must recompute meal nutrients on the server and enforce ownership.
