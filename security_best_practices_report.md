# Security Best Practices Audit Report

Date: 2026-02-19
Target: LIVAPON_FullfillmentSystem
Auditor: Codex (`$security-best-practices` workflow)

## Executive Summary

The audit found **6 security issues**: **2 Critical, 2 High, 1 Medium, 1 Low**.

The most urgent risks are:

1. **Privilege escalation via trusted user metadata** in server-side authorization logic.
2. **Overly permissive RLS policy on `orders` (`FOR ALL USING (true)`)**, which can expose/allow tampering of order data when accessed through Supabase client credentials.

These two findings can allow unauthorized data access and role escalation across vendor/admin boundaries and should be remediated first.

## Critical Findings

### [F-001] Critical - Role/Vendor authorization trusts mutable user metadata
- Rule ID: `NEXT-AUTH-001`
- Severity: Critical
- Location:
  - `lib/auth.ts:30`
  - `lib/auth.ts:35`
  - `lib/auth.ts:54`
  - `lib/auth.ts:59`
  - `lib/auth.ts:61`
  - `app/(public)/apply/actions.ts:46`
  - `app/(public)/apply/actions.ts:47`
- Evidence:
  - `lib/auth.ts` resolves `vendor_id`/`role` from merged `user_metadata` and `app_metadata`.
  - Signup stores `role: 'pending_vendor'` in user metadata (`app/(public)/apply/actions.ts:46-50`).
- Impact:
  - If a user can mutate own `user_metadata` (common in Supabase via `auth.updateUser({ data: ... })`), they can attempt to escalate role/vendor context and access admin/vendor-protected flows.
- Fix:
  - Treat **only server-controlled claims** as authorization source (e.g., `app_metadata` only, or DB-backed role table joined server-side by `auth.user.id`).
  - Ignore `user_metadata` for `role` and `vendor_id` in all authz decisions.
- Mitigation:
  - Add DB-backed authorization checks in sensitive actions/routes (`assertAdmin`, vendor ownership checks) even after session resolution.
- False positive notes:
  - If Supabase project explicitly blocks user metadata updates for all users, risk is reduced; verify policy/hook config before downgrading.

### [F-002] Critical - `orders` RLS allows unrestricted operations (`FOR ALL USING (true)`)
- Rule ID: `NEXT-AUTH-001`
- Severity: Critical
- Location:
  - `supabase/migrations/20251114194444_enable_orders_realtime_security.sql:17`
  - `supabase/migrations/20251114194444_enable_orders_realtime_security.sql:19`
  - `schema.sql:283`
  - `schema.sql:285`
  - `lib/supabase/client.ts:11`
  - `lib/supabase/client.ts:18`
- Evidence:
  - Policy definition: `CREATE POLICY "OrdersInsertUpdate" ... FOR ALL USING (true) WITH CHECK (true)`.
  - Browser Supabase client is instantiated from public env (`NEXT_PUBLIC_SUPABASE_*`) and used on client side.
- Impact:
  - Authenticated/anon API consumers can potentially read/modify/delete `orders` rows beyond tenant scope (depending on grants), bypassing vendor boundary logic.
- Fix:
  - Replace `FOR ALL USING (true)` with least-privilege policies per command:
    - `SELECT`: vendor/admin scope only.
    - `INSERT/UPDATE/DELETE`: service role only (or tightly constrained server role).
  - Explicitly deny write paths for `anon`/`authenticated` where not required.
- Mitigation:
  - Keep all order mutations server-side using service role only.
  - Add integration tests that attempt cross-vendor read/write with user JWT and assert denial.
- False positive notes:
  - If grants for `authenticated`/`anon` on `orders` are revoked in production, exposure is reduced; validate grants directly in DB before closing.

## High Findings

### [F-003] High - Sensitive tables lack explicit RLS enablement/policies
- Rule ID: `NEXT-AUTH-001`
- Severity: High
- Location:
  - `schema.sql:6` (`vendors`)
  - `schema.sql:18` (`vendor_applications`)
  - `schema.sql:137` (`shopify_connections`)
  - `schema.sql:223` (`import_logs`)
  - `schema.sql:498` (`fulfillment_requests`)
  - `schema.sql:533` (`webhook_jobs`)
  - `schema.sql:263`-`schema.sql:270` (RLS enabled only for a subset of tables)
- Evidence:
  - Multiple sensitive tables are created without corresponding `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or restrictive policies.
- Impact:
  - If exposed via PostgREST grants, attackers can enumerate PII, internal job payloads, and operational secrets metadata.
- Fix:
  - Enable RLS on all sensitive tables and define explicit least-privilege policies.
  - Keep `shopify_connections` and job tables service-role only.
- Mitigation:
  - Immediately verify and tighten table grants for `anon` / `authenticated` roles.
- False positive notes:
  - If production grants already deny these roles on all tables, practical exposure is lower; still a defense-in-depth gap in schema.

### [F-004] High - Shopify OAuth callback lacks local admin authorization and strict shop pinning
- Rule ID: `NEXT-AUTH-001` / `NEXT-REDIRECT-001`
- Severity: High
- Location:
  - `app/api/shopify/auth/callback/route.ts:16`
  - `app/api/shopify/auth/callback/route.ts:26`
  - `app/api/shopify/auth/callback/route.ts:39`
  - `lib/shopify/oauth.ts:73`
  - `lib/shopify/oauth.ts:87`
  - `lib/shopify/shop-domains.ts:10`
- Evidence:
  - Callback processes and stores OAuth tokens without checking local admin session.
  - `shop` from callback is persisted as trusted connection via upsert, then used by domain trust checks.
- Impact:
  - Unauthorized connection registration or trust-scope expansion can occur if OAuth flow is completed outside intended admin control.
- Fix:
  - Require local admin-authenticated session (or signed one-time admin initiation token) before accepting callback.
  - Enforce `shop === SHOPIFY_STORE_DOMAIN` (or strict allowlist) during callback.
- Mitigation:
  - Alert/log when new shop domains are added; require manual approval workflow.
- False positive notes:
  - Risk is lower if app distribution is technically limited to one store and callback URL is tightly controlled, but explicit in-app enforcement is still recommended.

## Medium Findings

### [F-005] Medium - State-changing API routes lack explicit CSRF defenses and one uses GET side effects
- Rule ID: `NEXT-CSRF-001`
- Severity: Medium
- Location:
  - `app/api/shopify/orders/shipments/route.ts:21`
  - `app/api/shopify/orders/shipments/route.ts:25`
  - `app/api/shipment-jobs/[id]/route.ts:9`
  - `app/api/shipment-jobs/[id]/route.ts:28`
  - `app/api/shipment-jobs/[id]/route.ts:37`
- Evidence:
  - Cookie-authenticated POST route does not validate `Origin`/CSRF token.
  - `GET /api/shipment-jobs/[id]` triggers processing side effects.
- Impact:
  - Cross-site request triggering and accidental crawler/prefetch execution risk for state transitions.
- Fix:
  - Add CSRF validation (`Origin` allowlist + token) for cookie-auth POSTs.
  - Make side-effect endpoints POST-only; keep GET read-only.
- Mitigation:
  - Ensure auth cookies are `SameSite=Lax/Strict` and add idempotency controls.
- False positive notes:
  - If same-site cookie behavior blocks all cross-site contexts in your deployment, exploitability is lower but not eliminated for GET/navigation paths.

## Low Findings

### [F-006] Low - Missing global Content Security Policy header
- Rule ID: `NEXT-XSS-001`
- Severity: Low
- Location:
  - `middleware.ts:4`
  - `middleware.ts:8`
- Evidence:
  - Security headers are set, but no `Content-Security-Policy` is configured.
- Impact:
  - Reduced browser-side defense-in-depth against XSS/script injection.
- Fix:
  - Add a strict CSP (start in report-only mode, then enforce).
- Mitigation:
  - Keep escaping/sanitization discipline and avoid dangerous sinks.
- False positive notes:
  - CSP may be enforced at CDN/proxy; verify runtime response headers before closing.

## Recommended Remediation Order

1. Fix `[F-001]` authorization source hardening (metadata trust removal).
2. Fix `[F-002]` `orders` RLS policy (`FOR ALL USING (true)` removal).
3. Fix `[F-003]` by enabling RLS + least-privilege policies for sensitive tables.
4. Fix `[F-004]` OAuth callback admin gating + shop allowlist.
5. Fix `[F-005]` CSRF and HTTP method semantics.
6. Fix `[F-006]` CSP hardening.

## Notes

- This audit is evidence-based on repository code/schema only; runtime infra controls (WAF/CDN/DB grants) were not directly validated here.
- A focused follow-up should include DB grant verification and live authorization tests with real JWT roles.
