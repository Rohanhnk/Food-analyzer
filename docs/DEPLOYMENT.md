# Current implementation and required configuration

Next.js is the only public application API. It verifies Clerk sessions before deriving an owner ID. Convex functions accept calls only from this trusted backend, using a server-only capability (`NOURISH_BACKEND_SECRET`). They are not client APIs: browsers must never receive this key or call these functions directly. This restriction also protects catalog imports and prevents callers from bypassing server nutrient recomputation. Test identities are injected exclusively by Vitest setup, never by the runtime verifier.

Set a cryptographically random `NOURISH_BACKEND_SECRET` of at least 32 characters in **both** the Next.js server environment and the target Convex deployment. Set `NEXT_PUBLIC_CONVEX_URL` to that deployment. Keep `CLERK_SECRET_KEY` on Next.js only. Rotate the backend capability in both places together. Do not log it or enter its value in chat. Convex Clerk JWT configuration is not the authorization mechanism for this server gateway.

All non-test API storage now uses Convex, including meals, recipes, goals, image bytes and idempotency records. Missing configuration returns an explicit service error; there is no in-memory fallback. The browser demo remains independent and stores its own data locally. Deploy the Convex functions/schema before enabling live mode. Import only audited catalog records via the guarded `foods:importCatalog` maintenance function; never automatically seed the provisional reference catalog into production.

Validation uses `convex-test` to execute the actual Convex functions/schema and exercise persistence across adapter instances, access restrictions, ownership and historical goals. These are local integration tests, not evidence of deployment to a real Convex instance. Live Clerk/Convex smoke testing still requires configured credentials and deployment. Verify create/read/edit/delete across server restarts and separate instances before release. Frontend live login/session UI remains separate integration work.

The existing rate limiter and idempotency flow are not yet distributed, atomic request coordination; load/concurrency testing remains a production follow-up. Health responses alone do not prove database access.

---

# Deployment and Operations Guide — Person 2

This guide outlines deployment procedures, operational readiness, health checks, data persistence, and rollback steps for Nourish.

---

## 1. Environment Architecture

| Environment | Purpose | Auth Provider | Database | Notes |
|---|---|---|---|---|
| **Local Demo** | Frontend isolation | In-browser demo client | Browser LocalStorage | `NEXT_PUBLIC_DATA_MODE=demo` |
| **Local Live** | End-to-end integration | Clerk Test Instance | Convex Dev Deployment | `NEXT_PUBLIC_DATA_MODE=live` |
| **Preview** | CI/PR verification | Clerk Staging Instance | Convex Preview Deployment | Ephemeral preview DB |
| **Production** | Live user service | Clerk Production Instance | Convex Production Deployment | Immutable meal snapshots |

---

## 2. Pinned SDK Versions

The lockfile pins installed versions; package.json declares compatible version ranges:
- Next.js: `^16.2.0` (Turbopack support)
- React / React DOM: `^19.2.0`
- Convex: `1.48.0`
- `@clerk/backend`: `3.26.2`
- TypeScript: `^5.9.0`
- Vitest: `^3.2.0`

---

## 3. Initial Convex & Clerk Deployment Setup

### Step A: Convex Configuration
1. Initialize Convex project (first-time setup):
   ```bash
   npx convex dev
   ```
2. Link your production deployment in Vercel/CI:
   - In Convex dashboard, generate a deploy key: `Settings -> Deploy Keys`.
   - Set `CONVEX_DEPLOY_KEY` in your CI / hosting environment.
3. Deploy Convex schema and functions:
   ```bash
   npx convex deploy
   ```
4. Controlled food catalog ingestion:
   - Audit food values, source identifiers and redistribution permissions first. The bundled catalog is provisional. Import approved records through `foods:importCatalog` with the server capability using a secure maintenance script; do not place the capability in shell history or client code.

### Step B: Clerk Authentication Configuration
1. In Clerk Dashboard:
   - Create JWT Template named `convex`.
   - Set Issuer URL to match `CLERK_JWT_ISSUER_DOMAIN`.
2. Configure environment variables in hosting provider:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `CLERK_JWT_ISSUER_DOMAIN`

---

## 4. Health Verification & Service Monitoring

1. **Liveness & Readiness Check**:
   - `GET /api/health`
   - Returns:
     ```json
     {
       "status": "healthy",
       "timestamp": "2026-10-25T12:00:00.000Z",
       "service": "food-analyzer-api",
       "version": "1.0.0"
     }
     ```
2. **Request IDs**:
   - Every request is tagged with an `x-request-id` header (or auto-assigned UUID if missing).
   - All server logs include `requestId`, `path`, and `method`.
3. **Sanitized Logging**:
   - `src/server/logger.ts` redacts authorization headers, session cookies, secret keys, and passwords before outputting JSON log entries.

---

## 5. Rollback and Disaster Recovery

### Application Rollback
- If a bad web deployment occurs on Vercel:
  1. Open Vercel Dashboard -> Deployments.
  2. Select the previous stable deployment and click **Instant Rollback**.
  3. Verify `GET /api/health` returns status `healthy`.

### Database Schema Compatibility
- Convex migrations are strictly additive:
  - Table schemas store immutable nutrition snapshots with historical meals.
  - Upgrading food composition catalogs does not modify existing `meals` or `mealItems` rows.
  - If a rollback of database functions is required:
    ```bash
    git checkout <previous-stable-tag>
    npx convex deploy
    ```
