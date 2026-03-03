import { expect, getOrderReference, missingCredentialEnv, signInAs, test } from './fixtures';

test.describe('vendor orders', () => {
  test('[VO-01] @smoke @vendor vendor A can open the orders page', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/orders');
    await expect(page.getByRole('heading', { name: '注文一覧' })).toBeVisible();
  });

  test('[VO-02] @auth @vendor vendor A does not see vendor B order numbers', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorBOrderNumber') ? [] : ['E2E_VENDOR_B_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/orders');
    await expect(page.getByText(getOrderReference('vendorBOrderNumber') as string)).toHaveCount(0);
  });

  test('[VO-03] @vendor search filters orders by order number', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const orderNumber = getOrderReference('vendorAOrderNumber') as string;
    await signInAs(page, 'vendorA', '/orders');
    await page.getByPlaceholder('注文番号・顧客名で検索').fill(orderNumber);
    await page.getByRole('button', { name: '検索' }).click();
    await expect(page.getByText(orderNumber)).toBeVisible();
  });

  test.skip('[VO-04] @vendor status filters narrow the order list', async () => {
    // TODO: seed known statuses and assert row counts after switching the select.
  });

  test.skip('[VO-05] @vendor pagination moves between result pages', async () => {
    // TODO: seed enough orders to cross page boundaries and assert the pager text.
  });

  test.skip('[VO-06] @vendor @hybrid mixed orders only expose the current vendor line items', async () => {
    // TODO: seed a mixed-vendor order and assert the expanded row contents per vendor.
  });
});
