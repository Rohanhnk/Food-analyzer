# Use Nourish as your private protein and carbohydrate tracker

The personal workflow is manual by default: save your food labels, weigh a portion, review calculated macros, and save the meal. Recipe portions use the finished cooked yield. No OpenAI account or API key is required.

## What is implemented

- Clerk sign-in and a server-enforced allowlist for one user (`PERSONAL_USER_ID`). Other signed-in users are rejected, including direct API requests. There is no automatic first-user enrollment.
- Convex storage for personal foods, meals, recipes and dated goals. A server-only capability protects the database functions. Browser storage is used only by the explicitly marked demo.
- My foods: enter a label's serving weight and kcal/protein/carbs/fat for that weight. Values are normalized to 100 g. Record the raw/cooked/as-served basis and label/reference source. Add and edit foods; historic meal snapshots do not change when a food is updated.
- Manual food and saved-recipe portions, weighed in grams. Live review asks the server to calculate and prevents confirmation/saving until that request succeeds.
- Daily totals, history, edit/delete, goals and seven-day insights. Historical dashboard targets are fetched for the selected date.
- Export all loaded meal records as CSV, including individual food quantities, macros, source and date. This is a meal-record export, not an automatic restore of the entire database. Keep regular database backups for foods/recipes/goals too.
- AI disabled by default. Enable it later only if desired.

## One-time setup

### 1. Create your Clerk account/application

Create a Clerk application and enable the sign-in method you want. Obtain its publishable and secret keys. Create or invite **your own user** in Clerk Dashboard → Users and copy its `user_...` ID. Set that ID as `PERSONAL_USER_ID` on the app server. Keep the secret key in environment settings, never in source code or chat. You can restrict public sign-ups in Clerk as well; the app enforces the single-user restriction regardless.

Use Clerk development keys for local testing. Follow Clerk's production-domain setup for a hosted production deployment. Use the matching key pair for the same Clerk application.

### 2. Create/deploy Convex

Use a Convex development project locally and a production deployment for your hosted diary. Run `npx convex dev` for local development or `npx convex deploy` for production after authenticating with Convex. Follow the CLI's project-selection instructions. This deploys the schema and functions; it does not import any provisional food catalog.

Set `NEXT_PUBLIC_CONVEX_URL` on the Next.js server to the exact deployment URL. Generate a random secret of at least 32 characters with your password manager and store the same `NOURISH_BACKEND_SECRET` in:

1. Your app server environment (`.env.local` for local development; hosting environment settings online).
2. Convex Dashboard → the matching deployment → Settings → Environment Variables.

Never prefix this secret with `NEXT_PUBLIC_`. It authorizes the trusted Next.js backend, not the browser. Do not expose it in client requests or terminal command history.

Convex access goes through this server gateway. The personal app uses Clerk verification in Next.js; direct browser calls to Convex are intentionally not supported.

### 3. Set the app environment

Copy `.env.example` to `.env.local` locally, then fill these settings securely:

| Name | Value/purpose |
|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `live` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk application's publishable key |
| `CLERK_SECRET_KEY` | Matching server secret key |
| `PERSONAL_USER_ID` | Your exact Clerk user ID |
| `NEXT_PUBLIC_CONVEX_URL` | URL of your selected Convex deployment |
| `NOURISH_BACKEND_SECRET` | Same random capability configured in Convex |
| `APP_ORIGIN` | `http://localhost:3000` locally; your exact HTTPS origin online, without trailing slash |
| `ENABLE_AI` | `false` |
| `NEXT_PUBLIC_ENABLE_AI` | `false` |

The optional recognition key can remain empty. The two public build-time flags require a rebuild after changes.

Run:

```bash
npm ci
npm run doctor
npm run dev
```

`doctor` prints requirement names and status, never secret values. It checks local configuration shape, not credential validity or service connectivity. Missing live settings produce a setup/access error rather than falling back to sample records.

### 4. Optional hosting

Deploy the Next.js app to Vercel (or another compatible Node.js host). Set the same app environment variables there, pointing at **production** Convex and the appropriate Clerk application. Update `APP_ORIGIN` to the hosted origin and configure that origin in Clerk. Rebuild after setting public variables. Do not deploy a preview branch against your personal production database unless intentionally testing there.

This implementation has been validated locally with mocked authentication and Convex's local function test harness. Real sign-in, deployment and cross-device persistence must be checked after your settings are supplied. No external services were configured or deployed by this code change.

## Your first real meal

1. Sign in with your configured account.
2. Open **My foods**. Add a food from its package. If the label says 24 g protein per 30 g serving, enter serving weight `30` and protein `24`; don't enter `24` as the per-100 g value.
3. Enter all four nutrients and a source. The app does not certify label accuracy. Avoid copying demonstration/provisional food values as facts.
4. Open **Log a meal**, select the food and enter the weighed grams. Wait for server review, confirm the amounts, and save.
5. Check the diary and daily totals, refresh, then sign in from another device. The same record should remain present.
6. For homemade recipes, add every ingredient on the correct raw/cooked basis, including oil/ghee. Enter the total finished cooked weight. Select the saved recipe when logging and enter your serving's cooked grams.
7. Use **Food diary → Export all meals (CSV)** regularly. The file contains private meal data, so store it somewhere you control.

Editing a saved meal recalculates the edited portion using current referenced food/recipe values; review the updated totals before confirming. Unedited historical records keep their saved snapshots. Demo records do not migrate automatically into your live account.

## Checks before relying on it

- Compare one food and one recipe calculation to the label/manual arithmetic.
- Confirm records survive refresh, sign-out/sign-in and a server restart.
- Verify a different Clerk user is denied access.
- Download a CSV and check that dates, grams, protein and carbs match your saved diary.
- Verify the target Convex deployment is the one you intended before entering real records.
