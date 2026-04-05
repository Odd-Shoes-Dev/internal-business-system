# Provider Abstraction (Phase 3)

This document defines how API code should stay provider-agnostic so future migrations (Neon -> Convex or others) are much easier.

## Current pattern

- API routes must depend on `src/lib/provider/*`.
- Provider-specific SDK/client calls must stay inside adapter files.
- Current adapter: `NeonDbProvider`.

## Files

- Provider contracts: `src/lib/provider/types.ts`
- Provider factory: `src/lib/provider/index.ts`
- Neon adapter: `src/lib/provider/neon-provider.ts`
- API guards/helpers: `src/lib/provider/route-guards.ts`

## Rules for new routes

1. Do not import provider SDKs directly in routes.
2. Use `requireSessionUser()` for auth checks.
3. Use `requireCompanyAccess()` for tenant checks.
4. Use `getDbProvider().query(...)` (or transaction) for data access.
5. Keep route handlers thin and move domain logic to service functions where possible.

## Automated guardrail

- Run `npm run check:provider-boundaries` before commits.
- This blocks provider-specific imports in `src/app/api/**` such as:
	- `@/lib/db/neon`
	- `@/lib/provider/neon-provider`
	- `pg`
	- `@supabase/*`

Why this matters: API code stays adapter-driven, so switching from Neon to another provider later needs mostly adapter/factory updates instead of route rewrites.

## How to add another provider later

1. Create adapter file implementing `DbProvider` (for example: `convex-provider.ts`).
2. Add provider selection branch in `src/lib/provider/index.ts`.
3. Ensure auth/session integration is implemented in the new adapter.
4. Keep route code unchanged; only adapter and factory should change.

## Recommended next step

Gradually refactor remaining Supabase-dependent APIs to the same provider layer before introducing provider-specific features.
