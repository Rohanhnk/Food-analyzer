# Nourish · Food Analyzer

A personal food diary for tracking protein, carbohydrates, fat and calories from weighed food portions and homemade recipes.

**Start here: [Personal-use setup](docs/PERSONAL_USE.md).** The code supports private Clerk sign-in and Convex storage. Live service credentials and deployment still need to be configured. AI is optional and disabled by default.

## Daily workflow

1. Add your regular foods in **My foods** using packaging labels or reliable references. Enter the label's serving weight and corresponding nutrients; the app converts them to per 100 g.
2. Log a weighed portion, check its raw/cooked basis, review server-calculated totals and confirm the meal.
3. Save homemade recipes with ingredient weights and finished cooked yield, then log a weighed cooked portion.
4. View daily totals and history, edit/delete entries, adjust targets and export meal records as CSV.

Unedited saved meals retain their nutrition snapshots when food data changes. Live records are kept in Convex, not browser storage. The demo remains a separate, clearly marked local workspace with illustrative sample records; demo data does not migrate automatically.

## Run locally

Node.js 22+ and npm are required (validated here with Node 24).

```bash
npm ci
npm run dev
```

The default is demo mode on port 3000. For private live use, follow `docs/PERSONAL_USE.md`, fill `.env.local` securely, then run:

```bash
npm run doctor
npm run dev
```

The setup checker prints names/status only, never secret values. It does not verify live credentials or connectivity. Public environment settings require a rebuild when changed.

## Validation

```bash
npm run check
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright uses the installed system Chromium in this cloud environment. On other machines, install its browser with `npx playwright install chromium` or provide the executable path. The suite starts a production server when no server is running; build first and use a clean port.

Tests cover label normalization, macro calculations, frozen historical records, private-account authorization, Convex function behavior, API contracts, server review, recipe portions, export safety, and desktop/mobile workflows. Auth/model/Convex tests include fixtures and local test harnesses; they do not certify a hosted deployment or nutrition-source accuracy.

## Project references

- [Personal-use setup](docs/PERSONAL_USE.md)
- [Four-person implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [API contract](docs/API_CONTRACT.md)
- [Backend deployment](docs/DEPLOYMENT.md)
- [Nutrition package](packages/nutrition/README.md)
- [Recognition package and evaluation](packages/recognition/README.md)

## AI and reference data

Manual logging needs no AI key. Optional text/photo recognition uses server-only credentials, strict output validation and manual review. Real provider accuracy and measured-photo evaluation remain unverified. The bundled reference nutrition dataset is provisional and is not automatically imported into live storage. Start with your own package labels and source references.

CSV export contains meal records and their saved macros. It is not an automatic full-database restore; keep database backups for your foods, recipes and goals as well.
