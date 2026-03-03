# Playwright E2E

## Required env

- `E2E_BASE_URL`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_PENDING_VENDOR_EMAIL`
- `E2E_PENDING_VENDOR_PASSWORD`
- `E2E_VENDOR_A_EMAIL`
- `E2E_VENDOR_A_PASSWORD`
- `E2E_VENDOR_B_EMAIL`
- `E2E_VENDOR_B_PASSWORD`

## Optional seeded data env

- `E2E_VENDOR_A_ORDER_NUMBER`
- `E2E_VENDOR_B_ORDER_NUMBER`
- `E2E_MIXED_ORDER_NUMBER`

## Commands

```bash
npm run test:e2e:list
npm run test:e2e
npm run test:e2e:headed
```

## Notes

- Read-only and guard tests are written to run once the app is up.
- Mutation-heavy flows use the live app UI plus Supabase service-role cleanup helpers, so `SUPABASE_SERVICE_ROLE_KEY` must be available in `.env.local`.
- Realtime and Shopify-dependent flows are tracked as hybrid tests and need helper scripts or seeded events.
