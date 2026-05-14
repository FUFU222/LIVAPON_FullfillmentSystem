# Security and Operational Readiness Review

Date: 2026-05-13

## Scope

Reviewed the current shipping workflow, packing slip additions, internal job runners, Supabase posture, dependency exposure, and operational risks if usage increases or warehouse staff use the system in daily dispatch work.

## Current Findings

- Dependency vulnerability checks are clean: `npm audit --omit=dev --audit-level=moderate`, `npm audit --audit-level=moderate`, and OSV source scan found no known vulnerabilities at review time.
- Internal worker routes were callable via both `GET` and `POST`; GitHub Actions already use `POST`, so `GET` should stay closed.
- Internal worker routes previously allowed missing worker secrets outside production by default. This is convenient locally but too easy to misconfigure in previews or staging.
- Supabase security advisor previously reported mutable `search_path` on application-owned functions. Migration `20260513152000_harden_function_search_path.sql` has been applied to the linked remote database.
- Supabase security advisor reports leaked password protection is disabled. This is a Supabase Auth setting, not an application migration.
- Supabase performance advisor reports multiple permissive RLS policies on several tables. This is mainly a query-planning/performance concern today, but it should be consolidated before order volume grows.
- `/orders` loads all vendor orders and filters/paginates in the app layer. This is acceptable while order volume is small, but it will become the first obvious performance issue at scale.
- Shipment history also loads all vendor shipments without server-side pagination.
- Public application and shipment-adjustment forms are validated, but they do not have abuse throttling or CAPTCHA/Turnstile protection.
- CSP exists, but still allows `unsafe-inline` and `unsafe-eval`. Tightening this requires a staged Next.js-compatible nonce/report-only rollout.

## Changes Made In This Pass

- Internal job routes now reject missing secrets by default in all environments.
- Local insecure bypass now requires `ALLOW_INSECURE_INTERNAL_ROUTES=true` and still cannot apply in production.
- Internal job route bearer token comparisons now use constant-time comparison.
- Internal job routes now return `405 Method Not Allowed` for `GET`; only `POST` performs work.
- Added and applied a Supabase migration to pin `search_path` for the functions reported by the security advisor.

## Recommended Next Work

1. Enable Supabase Auth leaked password protection in the Supabase dashboard.
2. Add abuse protection to public application and support forms: Turnstile/CAPTCHA or per-IP/per-email rate limiting.
3. Move `/orders` filtering and pagination into Supabase queries instead of loading all vendor orders first.
4. Add server-side pagination/search to shipment history.
5. Add job/backlog observability: webhook pending count, shipment job pending count, failed job count, and alert thresholds.
6. Consider disabling inline webhook processing in production once scheduled workers are confirmed reliable, so Shopify webhook responses stay fast under bursts.
7. Consolidate overlapping RLS policies reported by the performance advisor.
8. Stage CSP hardening with report-only first, then remove `unsafe-eval` and reduce `unsafe-inline` where Next.js compatibility allows.
9. For warehouse use, add scan-focused flow improvements: persistent tracking input focus, duplicate tracking warning, carrier auto-selection when possible, clearer async job status, and a large-touch mobile layout for dispatch confirmation.
