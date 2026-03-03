import { expect, getOrderReference, missingCredentialEnv, signInAs, test } from './fixtures';

test.describe('cross-tenant rls', () => {
  test('[CT-01] @auth @vendor vendor A does not see vendor B order data in the orders list', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorBOrderNumber') ? [] : ['E2E_VENDOR_B_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/orders');
    await expect(page.getByText(getOrderReference('vendorBOrderNumber') as string)).toHaveCount(0);
  });

  test('[CT-02] @auth @vendor vendor B does not see vendor A order data in the orders list', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorB'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    await signInAs(page, 'vendorB', '/orders');
    await expect(page.getByText(getOrderReference('vendorAOrderNumber') as string)).toHaveCount(0);
  });

  test.skip('[CT-03] @auth @vendor vendors only see their own shipment history', async () => {
    // TODO: seed vendor-specific shipment history entries and assert they remain isolated.
  });

  test('[CT-04] @auth @vendor vendors cannot access admin-only shipment request routes', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/admin/shipment-requests');
    await expect(page).toHaveURL(/\/orders$/);
  });
});
