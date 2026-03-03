# SQL Injection Focused Review (with XSS/CSRF pass)

Date: 2026-03-03

## Executive Summary

- Scope: this review covered the codebase's user-facing forms, custom JSON endpoints, Shopify webhook/callback endpoints, and internal job endpoints, with primary focus on SQL injection. A secondary pass covered XSS and CSRF.
- SQL injection: no exploitable SQL injection path was identified in the application code reviewed. User and third-party input consistently flows into Supabase's typed query builder (`.from(...).select/insert/update/delete/upsert/eq/in/rpc`) or into static PL/pgSQL functions, not into dynamically constructed SQL strings.
- XSS: no concrete browser-side XSS sink was found in the reviewed paths, but the site-wide CSP is materially too permissive and weakens blast-radius reduction if an XSS bug is introduced elsewhere.
- CSRF: no concrete CSRF vulnerability was found in the custom mutation routes reviewed. Cookie-authenticated JSON endpoints use same-origin checks, Shopify endpoints use HMAC verification, and internal job endpoints use bearer secrets. Server Actions appear to rely on framework/browser protections rather than an app-level CSRF token, which is acceptable today but should be re-verified if deployment topology changes.

## Findings

### Medium

#### XSS-01: Production CSP is too permissive to serve as strong XSS containment

- Severity: Medium
- Impact: if any XSS primitive is introduced elsewhere, the current CSP allows inline script/style execution and `unsafe-eval`, substantially reducing containment value.
- Evidence:
  - `middleware.ts:12` allows `style-src 'unsafe-inline'`
  - `middleware.ts:13` allows `script-src 'unsafe-inline' 'unsafe-eval'`
  - `middleware.ts:14` allows `connect-src` to `http:` / `ws:`
- References:
  - `middleware.ts:4-15`
  - `middleware.ts:17-37`
- Notes:
  - This is not a proof of current XSS exploitability by itself.
  - It is a hardening gap, and it matters because the app stores and re-renders user-generated/admin-generated text in several places.

### No SQL Injection Findings

I did not find an exploitable SQL injection path in the reviewed code. The reasons are concrete:

1. There is no repo-visible use of runtime raw SQL string construction in application TypeScript/JavaScript.
2. All reviewed write paths use Supabase query-builder methods with values passed as arguments rather than concatenated into SQL text.
3. The reviewed RPC functions are static PL/pgSQL, with no dynamic `EXECUTE`, `format()`, `quote_literal()`, or identifier interpolation.
4. The only `.or(...)` PostgREST filter string found is server-generated from `new Date().toISOString()`, not from user input.

Important nuance: SQLi prevention here comes from parameterized/structured DB APIs, not from "escaping" or "sanitizing" strings. Input validation exists in multiple entrypoints, but even untrusted free-text fields would not become SQLi unless they were later reinterpreted as SQL syntax.

### No Concrete CSRF Findings

I did not identify a concrete CSRF bug in the custom routes reviewed.

- Same-origin checks are present on cookie-authenticated JSON mutation endpoints:
  - `app/api/shopify/orders/shipments/route.ts:25-28`
  - `app/api/shipment-jobs/[id]/route.ts:34-37`
  - `lib/security/csrf.ts:13-27`
- Shopify third-party endpoints are protected by HMAC verification before payload processing:
  - `app/api/shopify/orders/ingest/route.ts:24-29`
  - `app/api/shopify/fulfillment/callback/route.ts:18-24`
- Internal job endpoints use bearer-secret authorization and clamp numeric query params:
  - `app/api/internal/webhook-jobs/process/route.ts:6-18`
  - `app/api/internal/shipment-jobs/process/route.ts:8-18`

Residual gap: Server Actions do not add an app-level CSRF token in this repo; they appear to rely on Next.js/Supabase/browser behavior. That is not a finding today, but it is a point to re-check if you introduce cross-site embedding, custom proxying, or non-default cookie behavior.

## Input Surface Inventory

### Public / User-facing forms

| Surface | Entrypoint | DB / auth path | SQLi verdict | Notes |
| --- | --- | --- | --- | --- |
| Sign-in form | `components/auth/sign-in-form.tsx:24-32` | `supabase.auth.signInWithPassword(...)` | No SQLi path | Goes to Supabase Auth API, not app SQL. |
| Vendor application form | `components/apply/vendor-application-form.tsx:50-169` -> `app/(public)/apply/actions.ts:39-123` | `lib/data/vendors.ts:369-420` | No SQLi path | Input trimmed/validated, then inserted with `.insert(insertPayload)`. |
| Vendor profile form | `components/vendor/profile-form.tsx:85-220` -> `app/vendor/profile/actions.ts:29-160` | `app/vendor/profile/actions.ts:94-112` | No SQLi path | Uses `.update({...}).eq('id', auth.vendorId)`. |
| Shipment adjustment request form | `components/support/shipment-adjustment-form.tsx:72-182` -> `app/support/shipment-adjustment/actions.ts:25-169` | `app/support/shipment-adjustment/actions.ts:114-149` | No SQLi path | Order lookup uses `.in('order_number', candidates)`; request creation uses `.insert({...})`. |
| CSV upload form | `app/import/upload-form.tsx:16-37` -> `app/import/actions.ts:66-115` | `lib/data/imports.ts:20-39` | No SQLi path | File contents are parsed in memory; only import log is written via `.insert(payload)`. |
| Order filter form | `components/orders/order-filters.tsx:63` -> `app/orders/page.tsx:49-54,85-99` | None | No SQLi path | Search params are applied in memory after loading orders, not interpolated into DB conditions. |

### Admin forms

| Surface | Entrypoint | DB path | SQLi verdict | Notes |
| --- | --- | --- | --- | --- |
| Application approve/reject | `components/admin/vendor-application-card.tsx:254-304` -> `app/admin/applications/actions.ts:16-152` | `lib/data/vendors.ts:456-599` | No SQLi path | `applicationId` numeric, `vendorCode` regex-checked, writes via `.update(...)` / `.insert(...)`. |
| Shipment adjustment admin update | `components/admin/shipment-adjustment-request-card.tsx:133-173` -> `app/admin/shipment-requests/actions.ts:34-88` | `lib/data/shipment-adjustments.ts:117-186` | No SQLi path | Comment and status updates use typed insert/update payloads. |
| Vendor delete | `components/admin/vendor-delete-button.tsx:55-58` -> `app/admin/vendors/actions.ts:11-35` | `lib/data/vendors.ts:749-872` | No SQLi path | `vendorId` is coerced to integer and all DB operations use `.eq(...)` / `.in(...)`. |
| Vendor bulk delete | `components/admin/vendor-bulk-delete-form.tsx:269-272` -> `app/admin/vendors/actions.ts:38-85` | `lib/data/vendors.ts:749-872` | No SQLi path | Array of IDs is numericized before any DB operation. |

### JSON endpoints / third-party reachable endpoints

| Surface | Entrypoint | DB path | SQLi verdict | Notes |
| --- | --- | --- | --- | --- |
| Vendor shipment registration API | `app/api/shopify/orders/shipments/route.ts:25-91` | `lib/data/shipment-import-jobs.ts:129-166`, `lib/data/shipment-import-jobs.ts:92-126` | No SQLi path | JSON body validated; selection authorization enforced before writes. |
| Shipment job status / process API | `app/api/shipment-jobs/[id]/route.ts:12-98` | `lib/data/shipment-import-jobs.ts:168-223` | No SQLi path | `id` coerced to number; read/update flows use typed filters. |
| Shopify order webhook ingest | `app/api/shopify/orders/ingest/route.ts:17-137` | `lib/data/webhook-jobs.ts:19-60` | No SQLi path | HMAC verified, payload stored as JSONB, not executed as SQL. |
| Shopify fulfillment callback | `app/api/shopify/fulfillment/callback/route.ts:18-117` | `lib/data/fulfillment-requests.ts:182-265`, `lib/data/fulfillment-requests.ts:332-454` | No SQLi path | HMAC verified, payload normalized, persisted via `.upsert/.insert/.delete/.eq/.in`. |
| Internal webhook worker endpoint | `app/api/internal/webhook-jobs/process/route.ts:20-38` | `lib/data/webhook-jobs.ts:63-74` | No SQLi path | `limit` parsed as number; RPC arg is numeric only. |
| Internal shipment worker endpoint | `app/api/internal/shipment-jobs/process/route.ts:31-52` | `lib/data/shipment-import-jobs.ts:225-237` | No SQLi path | `jobs/items` query params are clamped numerics. |
| Internal shipment resync endpoint | `app/api/internal/shipments/resync/route.ts:24-49` | `lib/data/orders/shipments.ts:39-52` | No SQLi path | Only numeric `limit`; `.or(...)` filter string is generated from server time. |

## SQLi Evidence and Reasoning

### 1. No application-layer raw SQL construction found

Across `app/`, `lib/`, and the reviewed runtime code, DB access is consistently through Supabase methods such as:

- `.from(...).select(...)`
- `.insert(...)`
- `.update(...)`
- `.delete(...)`
- `.upsert(...)`
- `.eq(...)`
- `.in(...)`
- `.rpc(...)`

Representative examples:

- `lib/data/vendors.ts:384-414`
- `app/vendor/profile/actions.ts:94-112`
- `app/support/shipment-adjustment/actions.ts:114-149`
- `lib/data/shipment-adjustments.ts:148-181`
- `lib/data/webhook-jobs.ts:40-44`
- `lib/data/fulfillment-requests.ts:212-253`

These patterns pass values as data, not as SQL syntax.

### 2. RPC usage resolves to static SQL, not dynamic SQL

Reviewed RPC entrypoints:

- `lib/shopify/order-import.ts:275-279` -> `supabase/migrations/20251113134500_create_sync_order_line_items_function.sql:2-72`
- `lib/data/webhook-jobs.ts:63-67` -> `supabase/migrations/20251113140500_create_webhook_jobs.sql:22-48`
- `lib/data/shipment-import-jobs.ts:225-230` -> `supabase/migrations/20251207134516_add_shipment_import_jobs.sql:85-113`

The SQL functions above:

- use fixed SQL statements,
- cast JSON values into columns,
- do not use dynamic `EXECUTE`,
- do not call `format()`/`quote_literal()`/`quote_ident()`.

That means attacker-controlled values are treated as row values, not as SQL fragments.

### 3. PostgREST raw filter string review

I found one `.or(...)` string filter:

- `lib/data/orders/shipments.ts:46-52`

It uses:

- `.or(\`sync_pending_until.is.null,sync_pending_until.lte.${nowIso}\`)`

This would be a concern if `nowIso` were attacker-controlled. It is not; it comes from `new Date().toISOString()` in the same function (`lib/data/orders/shipments.ts:44`). So this is safe as currently written, but it is the one place to keep an eye on if future refactors start feeding user input into PostgREST filter strings.

### 4. Third-party payload storage review

Shopify-controlled JSON is stored in JSONB rather than executed:

- webhook jobs: `lib/data/webhook-jobs.ts:31-44`
- fulfillment requests: `lib/data/fulfillment-requests.ts:198-216`

This is safe from SQLi because JSON payloads are written as values.

## XSS Pass

### No concrete browser XSS sink found in reviewed code

I did not find use of:

- `dangerouslySetInnerHTML`
- `innerHTML`
- `outerHTML`
- `document.write`
- `eval(...)`
- `new Function(...)`

Reviewed user/admin-generated text is rendered through normal React JSX, which escapes by default:

- vendor request history: `app/support/shipment-adjustment/page.tsx:132-160`
- admin shipment request card: `components/admin/shipment-adjustment-request-card.tsx:102-117`
- admin vendor detail: `components/admin/admin-vendor-detail.tsx:124-139`
- admin application card: `components/admin/vendor-application-card.tsx:306-310`
- query-string error rendering: `app/admin/vendors/page.tsx:36-47`

I also checked HTML email templates. Those templates explicitly HTML-escape dynamic content:

- `lib/notifications/vendor-approval.ts:17-24,40-67`
- `lib/notifications/vendor-new-order.ts:80-121`

### Residual XSS risk

The main XSS hardening issue remains the CSP finding above. If you later introduce a rendering sink, the current policy will not contain it well.

## CSRF Pass

### Confirmed protections

- Same-origin check helper:
  - `lib/security/csrf.ts:13-27`
- Applied to cookie-authenticated JSON POST routes:
  - `app/api/shopify/orders/shipments/route.ts:25-28`
  - `app/api/shipment-jobs/[id]/route.ts:34-37`
- HMAC-protected third-party routes:
  - `app/api/shopify/orders/ingest/route.ts:24-29`
  - `app/api/shopify/fulfillment/callback/route.ts:18-24`
- Bearer-secret internal routes:
  - `app/api/internal/webhook-jobs/process/route.ts:6-18`
  - `app/api/internal/shipment-jobs/process/route.ts:8-18`

### Residual CSRF note

Server Actions do not implement a repo-visible synchronizer token or double-submit token. That is not automatically wrong in Next.js, but it means your CSRF posture depends on:

- framework-side Server Action protections,
- browser origin/referrer behavior,
- session cookie attributes managed by Supabase SSR.

I did not find evidence of an active CSRF exploit in the reviewed code, but if you want high assurance, this is the area to validate with an environment-aware test rather than with static review alone.

## Additional Observations (Not SQLi Findings)

### OBS-01: Shopify vendor-name lookup can broaden matches semantically, but this is not SQL injection

- `lib/shopify/order-import.ts:117-123` uses `.ilike('name', shopifyProductVendor.trim())`.
- Because `%` and `_` have wildcard meaning in SQL LIKE semantics, a malicious or malformed Shopify vendor name could broaden matching behavior.
- This is a data-quality / routing-integrity concern, not a SQL injection issue, because the value is still passed as data through the query builder.

## Conclusion

- SQL injection: no concrete vulnerability found.
- XSS: no concrete sink found, but CSP should be tightened.
- CSRF: no concrete flaw found in custom routes; residual assurance gap remains around Server Action dependence on framework/browser defaults.

If you want, the next step should be a fix-only pass for:

1. tightening CSP in production,
2. adding explicit regression tests for key mutation routes,
3. optionally normalizing/escaping wildcard semantics for `.ilike(...)` vendor-name matching.
