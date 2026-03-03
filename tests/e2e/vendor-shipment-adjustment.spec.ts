import { expect, getOrderReference, missingCredentialEnv, signInAs, test } from './fixtures';
import {
  addShipmentAdjustmentComment,
  buildE2EMarker,
  deleteShipmentAdjustmentRequest,
  findShipmentAdjustmentRequestByIssueSummary,
  seedShipmentAdjustmentRequestForRole
} from './supabase-admin';

test.describe('vendor shipment adjustment', () => {
  test('[VSA-01] @smoke @vendor shipment adjustment page renders form and history', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/support/shipment-adjustment');
    await expect(page.getByText('発送修正申請', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/注文番号/)).toBeVisible();
    await expect(page.getByRole('button', { name: '送信' })).toBeVisible();
  });

  test('[VSA-02] @vendor vendor can create a shipment adjustment request', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const orderNumber = getOrderReference('vendorAOrderNumber') as string;
    const issueSummary = `${buildE2EMarker('shipment-adjustment')} vendor created request`;
    let requestId: number | null = null;

    try {
      await signInAs(page, 'vendorA', '/support/shipment-adjustment');
      await page.getByLabel(/注文番号/).fill(orderNumber);
      await page.getByLabel('発生している状況').fill(issueSummary);
      await page.getByLabel('希望する対応').fill('E2E mutation test. Cleanup runs after assertion.');
      await page.getByRole('button', { name: '送信' }).click();

      await expect(page.getByText('申請を受け付けました。管理者が確認次第ご連絡します。')).toBeVisible();
      await page.reload();
      await expect(page.getByText(issueSummary)).toBeVisible();

      const created = await findShipmentAdjustmentRequestByIssueSummary({
        role: 'vendorA',
        issueSummary
      });
      requestId = created?.id ?? null;
      expect(requestId).not.toBeNull();
    } finally {
      if (requestId) {
        await deleteShipmentAdjustmentRequest(requestId);
      }
    }
  });

  test('[VSA-03] @vendor @hybrid internal admin comments stay hidden from vendors', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const request = await seedShipmentAdjustmentRequestForRole({
      role: 'vendorA',
      orderNumber: getOrderReference('vendorAOrderNumber') as string,
      issueSummary: `${buildE2EMarker('internal-hidden')} internal comment visibility request`
    });
    const vendorVisibleComment = `${buildE2EMarker('vendor-visible')} vendor visible comment`;
    const internalComment = `${buildE2EMarker('internal-only')} internal-only comment`;

    try {
      await addShipmentAdjustmentComment({
        requestId: request.requestId,
        vendorId: request.vendorId,
        body: vendorVisibleComment,
        visibility: 'vendor'
      });
      await addShipmentAdjustmentComment({
        requestId: request.requestId,
        vendorId: request.vendorId,
        body: internalComment,
        visibility: 'internal'
      });

      await signInAs(page, 'vendorA', '/support/shipment-adjustment');
      await expect(page.getByText(request.issueSummary)).toBeVisible();
      await expect(page.getByText(vendorVisibleComment)).toBeVisible();
      await expect(page.getByText(internalComment)).toHaveCount(0);
    } finally {
      await deleteShipmentAdjustmentRequest(request.requestId);
    }
  });

  test('[VSA-04] @auth vendors only see their own shipment adjustment history', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...missingCredentialEnv('vendorB'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER']),
      ...(getOrderReference('vendorBOrderNumber') ? [] : ['E2E_VENDOR_B_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const vendorARequest = await seedShipmentAdjustmentRequestForRole({
      role: 'vendorA',
      orderNumber: getOrderReference('vendorAOrderNumber') as string,
      issueSummary: `${buildE2EMarker('history-a')} vendor A history request`
    });
    const vendorBRequest = await seedShipmentAdjustmentRequestForRole({
      role: 'vendorB',
      orderNumber: getOrderReference('vendorBOrderNumber') as string,
      issueSummary: `${buildE2EMarker('history-b')} vendor B history request`
    });

    try {
      await signInAs(page, 'vendorA', '/support/shipment-adjustment');
      await expect(page.getByText(vendorARequest.issueSummary)).toBeVisible();
      await expect(page.getByText(vendorBRequest.issueSummary)).toHaveCount(0);
    } finally {
      await deleteShipmentAdjustmentRequest(vendorARequest.requestId);
      await deleteShipmentAdjustmentRequest(vendorBRequest.requestId);
    }
  });

  test('[VSA-05] @vendor short shipment-adjustment fields show validation errors', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/support/shipment-adjustment');
    await page.getByLabel(/注文番号/).fill('#1079');
    await page.getByLabel('発生している状況').fill('短い');
    await page.getByLabel('希望する対応').fill('短');
    await page.getByRole('button', { name: '送信' }).click();

    await expect(page.getByText('状況を10文字以上で具体的に記載してください。')).toBeVisible();
    await expect(page.getByText('希望する対応内容を記入してください。')).toBeVisible();
  });
});
