import { expect, getOrderReference, missingCredentialEnv, signInAs, test } from './fixtures';
import {
  buildE2EMarker,
  findLineItemForRole,
  findShipmentForRole,
  touchLineItemSource,
  touchShipmentSource
} from './supabase-admin';

test.describe('realtime', () => {
  test('[RT-01] @realtime @vendor realtime probe subscribes with a vendor session', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/dev/realtime-vendor');
    await expect(page.getByRole('heading', { name: 'Vendor Realtime Probe' })).toBeVisible();
  });

  test('[RT-02] @realtime @hybrid vendor line-item updates increment the pending notification count', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const fixture = await findLineItemForRole({
      role: 'vendorA',
      orderNumber: getOrderReference('vendorAOrderNumber')
    });
    test.skip(!fixture, 'No vendor A line item fixture available for realtime test');

    const originalSource = fixture?.last_updated_source ?? 'console';
    const marker = buildE2EMarker('rt-line-item');

    try {
      await signInAs(page, 'vendorA', '/orders');
      await touchLineItemSource({ lineItemId: fixture!.id, source: marker });
      await expect(page.getByText('新しい注文が届きました')).toBeVisible();
    } finally {
      await touchLineItemSource({ lineItemId: fixture!.id, source: originalSource });
    }
  });

  test('[RT-03] @realtime @hybrid shipment updates trigger the pending notification UI', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    const fixture = await findShipmentForRole({ role: 'vendorA' });
    test.skip(!fixture, 'No vendor A shipment fixture available for realtime test');

    const originalSource = fixture?.last_updated_source ?? 'console';
    const marker = buildE2EMarker('rt-shipment');

    try {
      await signInAs(page, 'vendorA', '/orders');
      await touchShipmentSource({ shipmentId: fixture!.id, source: marker });
      await expect(page.getByText('新しい注文が届きました')).toBeVisible();
    } finally {
      await touchShipmentSource({ shipmentId: fixture!.id, source: originalSource });
    }
  });

  test('[RT-04] @realtime @hybrid other-vendor events do not notify the current vendor', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...missingCredentialEnv('vendorB'),
      ...(getOrderReference('vendorBOrderNumber') ? [] : ['E2E_VENDOR_B_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const fixture = await findLineItemForRole({
      role: 'vendorB',
      orderNumber: getOrderReference('vendorBOrderNumber')
    });
    test.skip(!fixture, 'No vendor B line item fixture available for realtime test');

    const originalSource = fixture?.last_updated_source ?? 'console';
    const marker = buildE2EMarker('rt-other-vendor');

    try {
      await signInAs(page, 'vendorA', '/orders');
      await touchLineItemSource({ lineItemId: fixture!.id, source: marker });
      await expect(page.getByText('新しい注文が届きました')).toHaveCount(0);
    } finally {
      await touchLineItemSource({ lineItemId: fixture!.id, source: originalSource });
    }
  });

  test('[RT-05] @realtime clicking the refresh CTA clears the pending state', async ({ page }) => {
    const missing = [
      ...missingCredentialEnv('vendorA'),
      ...(getOrderReference('vendorAOrderNumber') ? [] : ['E2E_VENDOR_A_ORDER_NUMBER'])
    ];
    test.skip(missing.length > 0, `Missing E2E config: ${missing.join(', ')}`);

    const fixture = await findLineItemForRole({
      role: 'vendorA',
      orderNumber: getOrderReference('vendorAOrderNumber')
    });
    test.skip(!fixture, 'No vendor A line item fixture available for realtime refresh test');

    const originalSource = fixture?.last_updated_source ?? 'console';
    const marker = buildE2EMarker('rt-refresh');

    try {
      await signInAs(page, 'vendorA', '/orders');
      await touchLineItemSource({ lineItemId: fixture!.id, source: marker });
      await expect(page.getByText('新しい注文が届きました')).toBeVisible();
      await page.getByRole('button', { name: '最新を反映' }).click();
      await expect(page.getByText('注文一覧を最新の状態にしました')).toBeVisible();
    } finally {
      await touchLineItemSource({ lineItemId: fixture!.id, source: originalSource });
    }
  });
});
