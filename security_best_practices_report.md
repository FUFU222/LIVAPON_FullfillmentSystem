# Security Best Practices Audit Report

Date: 2026-03-02
Target: LIVAPON_FullfillmentSystem
Auditor: Codex (`$security-best-practices` workflow)

## Executive Summary

This review found **2 concrete issues** in the repository-visible implementation: **1 Medium** and **1 Low**.

The good news is that the core trust boundaries are materially better than the previous snapshot of this codebase:

- `AuthContext` is derived from Supabase server session data and admin checks now rely on `app_metadata`-first claims.
- Sensitive Supabase tables have explicit RLS hardening migrations, including helper functions for `app_metadata`-based role and vendor scoping.
- Cookie-authenticated state-changing route handlers include same-origin CSRF checks.
- Public `.env*` files are ignored by git, and no committed secret file was found in tracked paths.
- Shopify webhooks and OAuth callback paths perform HMAC verification and shop-domain pinning.

The remaining gaps are mostly in **browser/operational defense-in-depth**, not in the main authorization model.

## Findings

### [F-001] Medium - Production CSP is too permissive to provide strong XSS containment

- Rule ID: `NEXT-CSP-001`
- Severity: Medium
- Location:
  - `middleware.ts:4`
  - `middleware.ts:12`
  - `middleware.ts:13`
  - `middleware.ts:14`
- Evidence:
  - The global CSP currently allows:
    - `style-src 'self' 'unsafe-inline' https:`
    - `script-src 'self' 'unsafe-inline' 'unsafe-eval' https:`
    - `connect-src 'self' https: http: wss: ws:`
- Impact:
  - This weakens CSP as a browser-side mitigation against XSS and script gadget abuse.
  - `unsafe-inline` and `unsafe-eval` remove much of the value of an otherwise good CSP baseline.
  - Allowing `http:` and `ws:` in `connect-src` also broadens downgrade and data-exfiltration surface beyond what a production-only policy should normally permit.
- Fix:
  - Split development and production CSP behavior.
  - Remove `unsafe-eval`, `unsafe-inline`, `http:`, and `ws:` from the production policy unless there is a documented hard requirement.
  - Prefer nonce-based allowances for any unavoidable inline scripts.
- Mitigation:
  - Keep React's default escaping and continue avoiding dangerous DOM sinks.
  - If tightening CSP immediately is risky, start with a report-only production policy and iterate from runtime violations.
- False positive notes:
  - If an upstream CDN or proxy injects a stricter CSP at runtime, effective risk is lower. That stricter policy is not visible in this repo.

### [F-002] Low - Internal worker endpoints fail open outside production when secrets are missing

- Rule ID: `NEXT-AUTHZ-OPS-001`
- Severity: Low
- Location:
  - `app/api/internal/webhook-jobs/process/route.ts:8`
  - `app/api/internal/shipment-jobs/process/route.ts:8`
  - `app/api/internal/shipments/resync/route.ts:6`
- Evidence:
  - `webhook-jobs` route:
    - `return process.env.NODE_ENV !== 'production';`
  - `shipment-jobs` route:
    - `return process.env.NODE_ENV !== 'production';`
  - `shipments/resync` route:
    - allows requests in non-production when `CRON_SECRET` is unset
- Impact:
  - Any internet-reachable dev/staging environment that is not running as `production` and is missing these secrets can have internal job processing triggered without authentication.
  - The result is unauthorized job execution and background mutation rather than direct privilege escalation.
- Fix:
  - Default to deny when the secret is missing in all environments.
  - If local convenience is required, guard it behind an explicit opt-in env such as `ALLOW_INSECURE_INTERNAL_ROUTES=true`.
- Mitigation:
  - Ensure preview, staging, and shared dev environments are not publicly reachable unless the bearer secret is configured.
- False positive notes:
  - If these routes are only ever reachable on localhost, practical exposure is low. The repo itself does not prove that network boundary.

## Metric Scores

| Metric | Score | Notes |
| --- | --- | --- |
| Authentication & Session Management | 7.5 / 10 | Server-side auth flow is sound, but repo-local Supabase auth defaults are not fully hardened for production parity. |
| Authorization & Tenant Isolation | 8.8 / 10 | Strong improvement: app-metadata-based role resolution and recent RLS hardening materially reduce cross-tenant risk. |
| API & Webhook Protection | 8.2 / 10 | Shopify HMAC checks, domain validation, and same-origin CSRF checks are solid; internal worker routes still have a non-prod fail-open path. |
| Browser / XSS Hardening | 6.4 / 10 | No dangerous DOM sinks were found, but the current CSP is too permissive to be a strong containment layer. |
| Secrets & Configuration Hygiene | 7.2 / 10 | `.env*` is ignored and secret-bearing code stays server-side, but runtime config hardening still needs verification. |
| Admin Tooling & Data Handling | 7.5 / 10 | No active admin-side export surface requiring spreadsheet hardening remains in the current code. |

**Overall score: 7.7 / 10**

## Additional Observations

- No use of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or similar browser-side high-risk sinks was found in `app/`, `lib/`, or `components/`.
- The sign-in redirect flow is correctly constrained to relative paths:
  - `app/(auth)/sign-in/page.tsx:8`
- CSRF checks are present on the cookie-authenticated JSON POST routes that mutate vendor shipment state:
  - `app/api/shopify/orders/shipments/route.ts:25`
  - `app/api/shipment-jobs/[id]/route.ts:34`
- Recent Supabase migrations show meaningful authorization hardening:
  - `supabase/migrations/20260219154000_enable_rls_for_sensitive_tables.sql`
  - `supabase/migrations/20260228123000_align_rls_with_app_metadata_claims.sql`
  - `supabase/migrations/20260228124500_reenable_orders_rls.sql`

## Runtime Verification Items

These were not directly verifiable from repository code alone and should be checked in the deployed environment before calling the system "production-hardened":

1. Confirm the deployed Supabase project does not mirror the weaker local auth defaults in `supabase/config.toml`, especially:
   - `minimum_password_length = 6`
   - `enable_confirmations = false`
   - `secure_password_change = false`
   - CAPTCHA disabled
2. Verify whether an upstream edge layer injects a stricter production CSP than the one defined in `middleware.ts`.
3. Verify that internal worker endpoints are not reachable from shared/public environments without bearer secrets configured.

## Recommended Remediation Order

1. Tighten `[F-001]` by separating development CSP from production CSP.
2. Remove the `[F-002]` fail-open behavior from internal worker routes.
