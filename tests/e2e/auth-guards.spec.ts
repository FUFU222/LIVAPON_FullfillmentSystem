import { expectRedirectToSignIn, expectPathname, missingCredentialEnv, signInAs, test } from './fixtures';

test.describe('auth guards', () => {
  test('[AG-01] @smoke @auth redirects anonymous users from /orders to /sign-in', async ({ page }) => {
    await page.goto('/orders');
    await expectRedirectToSignIn(page, '/orders');
  });

  test('[AG-02] @smoke @auth redirects anonymous users from /vendor/profile to /sign-in', async ({ page }) => {
    await page.goto('/vendor/profile');
    await expectRedirectToSignIn(page, '/vendor/profile');
  });

  test('[AG-03] @smoke @auth redirects anonymous users from shipment adjustment to /sign-in', async ({ page }) => {
    await page.goto('/support/shipment-adjustment');
    await expectRedirectToSignIn(page, '/support/shipment-adjustment');
  });

  test('[AG-04] @smoke @auth redirects anonymous users from /admin to /sign-in', async ({ page }) => {
    await page.goto('/admin');
    await expectRedirectToSignIn(page, '/admin');
  });

  test('[AG-05] @smoke @auth pending vendors are redirected from /orders to /pending', async ({ page }) => {
    const missing = missingCredentialEnv('pendingVendor');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'pendingVendor', '/orders');
    await expectPathname(page, '/pending');
  });

  test('[AG-06] @auth pending vendors are redirected from /vendor/profile to /pending', async ({ page }) => {
    const missing = missingCredentialEnv('pendingVendor');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'pendingVendor', '/vendor/profile');
    await expectPathname(page, '/pending');
  });

  test('[AG-06b] @auth pending vendors are redirected from shipment adjustment to /pending', async ({ page }) => {
    const missing = missingCredentialEnv('pendingVendor');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'pendingVendor', '/support/shipment-adjustment');
    await expectPathname(page, '/pending');
  });

  test('[AG-07] @smoke @auth vendors cannot enter /admin', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/admin');
    await expectPathname(page, '/orders');
  });

  test('[AG-08] @smoke @auth admins are redirected from /orders to /admin', async ({ page }) => {
    const missing = missingCredentialEnv('admin');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'admin', '/orders');
    await expectPathname(page, '/admin');
  });

  test('[AG-09] @auth vendors cannot enter /admin/shipment-requests', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/admin/shipment-requests');
    await expectPathname(page, '/orders');
  });
});
