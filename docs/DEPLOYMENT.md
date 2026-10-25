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

The backend dependencies in `package.json` are explicitly pinned to verified compatible releases:
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
   - Run the controlled import function once during deployment to seed Person 3's verified IFCT catalog:
     ```bash
     npx convex run foods:importCatalog
     ```

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
