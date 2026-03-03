import { expect, getOrderReference, missingCredentialEnv, signInAs, test } from './fixtures';
import {
  buildE2EMarker,
  deleteShipmentAdjustmentRequest,
  seedShipmentAdjustmentRequestForRole
} from './supabase-admin';

const DEFAULT_BASE_URL =
  process.env.E2E_BASE_URL ?? process.env.APP_BASE_URL ?? 'http://127.0.0.1:3000';

test.describe('admin shipment adjustment requests', () => {
  test('[ASR-01] @smoke @admin admin can open shipment request board', async ({ page }) => {
    const missing = missingCredentialEnv('admin');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'admin', '/admin/shipment-requests');
    await expect(page.getByRole('heading', { name: '発送修正申請 — 対応中' })).toBeVisible();
  });

  test('[ASR-02] @admin admin can add a reply comment', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('admin'),
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const request = await seedShipmentAdjustmentRequestForRole({
      role: 'vendorA',
      orderNumber: getOrderReference('vendorAOrderNumber') as string
    });
    const comment = `${buildE2EMarker('admin-comment')} admin reply`;

    try {
      await signInAs(page, 'admin', '/admin/shipment-requests');
      const form = page.locator(`form:has(input[name="requestId"][value="${request.requestId}"])`);

      await form.locator('textarea[name="commentBody"]').fill(comment);
      await form.getByRole('button', { name: '更新する' }).click();

      await expect(page.getByText('申請を更新しました。')).toBeVisible();
      await page.reload();
      const requestCard = page.locator('div').filter({ hasText: request.issueSummary }).first();
      await expect(requestCard.getByText(comment)).toBeVisible();
    } finally {
      await deleteShipmentAdjustmentRequest(request.requestId);
    }
  });

  test('[ASR-03] @admin admin can transition request status', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('admin'),
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const request = await seedShipmentAdjustmentRequestForRole({
      role: 'vendorA',
      orderNumber: getOrderReference('vendorAOrderNumber') as string
    });
    const resolution = `${buildE2EMarker('admin-resolution')} resolved by admin`;

    try {
      await signInAs(page, 'admin', '/admin/shipment-requests');
      const form = page.locator(`form:has(input[name="requestId"][value="${request.requestId}"])`);

      await form.locator('select[name="nextStatus"]').selectOption('resolved');
      await form.locator('textarea[name="resolutionSummary"]').fill(resolution);
      await form.getByRole('button', { name: '更新する' }).click();

      await expect(page.getByText('申請を更新しました。')).toBeVisible();
      await page.reload();
      const requestCard = page.locator('div').filter({ hasText: request.issueSummary }).first();
      await expect(requestCard.getByText('完了')).toBeVisible();
      await expect(requestCard.getByText(resolution)).toBeVisible();
    } finally {
      await deleteShipmentAdjustmentRequest(request.requestId);
    }
  });

  test('[ASR-04] @admin @hybrid vendor-facing history reflects admin updates', async ({ browser, page }) => {
    const missing = [
      ...missingCredentialEnv('admin'),
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const request = await seedShipmentAdjustmentRequestForRole({
      role: 'vendorA',
      orderNumber: getOrderReference('vendorAOrderNumber') as string
    });
    const vendorComment = `${buildE2EMarker('vendor-visible-comment')} visible to vendor`;
    const resolution = `${buildE2EMarker('vendor-visible-resolution')} admin resolved`;
    const vendorContext = await browser.newContext({ baseURL: DEFAULT_BASE_URL });
    const vendorPage = await vendorContext.newPage();

    try {
      await signInAs(page, 'admin', '/admin/shipment-requests');
      const form = page.locator(`form:has(input[name="requestId"][value="${request.requestId}"])`);

      await form.locator('textarea[name="commentBody"]').fill(vendorComment);
      await form.locator('select[name="visibility"]').selectOption('vendor');
      await form.locator('select[name="nextStatus"]').selectOption('resolved');
      await form.locator('textarea[name="resolutionSummary"]').fill(resolution);
      await form.getByRole('button', { name: '更新する' }).click();
      await expect(page.getByText('申請を更新しました。')).toBeVisible();

      await signInAs(vendorPage, 'vendorA', '/support/shipment-adjustment');
      await expect(vendorPage.getByText(request.issueSummary)).toBeVisible();
      await expect(vendorPage.getByText(vendorComment)).toBeVisible();
      await expect(vendorPage.getByText(resolution)).toBeVisible();
    } finally {
      await vendorContext.close();
      await deleteShipmentAdjustmentRequest(request.requestId);
    }
  });
});
