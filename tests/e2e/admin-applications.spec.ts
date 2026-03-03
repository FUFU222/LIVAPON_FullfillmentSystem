import { expect, missingCredentialEnv, signInAs, signInWithCredentials, test } from './fixtures';
import {
  cleanupVendorApplicationFixture,
  createPendingVendorApplicationFixture,
  getVendorApplicationById
} from './supabase-admin';

test.describe('admin applications', () => {
  test('[AA-01] @smoke @admin admin can open the applications page', async ({ page }) => {
    const missing = missingCredentialEnv('admin');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'admin', '/admin/applications');
    await expect(page.getByRole('heading', { name: '利用申請の審査' })).toBeVisible();
  });

  test('[AA-02] @admin approval flow promotes a pending application to vendor', async ({ page }) => {
    const missing = missingCredentialEnv('admin');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    const fixture = await createPendingVendorApplicationFixture();
    let vendorId: number | null = null;

    try {
      await signInAs(page, 'admin', '/admin/applications');
      const card = page.locator('div').filter({ hasText: fixture.companyName }).first();

      await card.getByRole('button', { name: '承認する' }).click();
      await page.getByRole('button', { name: 'この内容で承認' }).click();
      await expect(page.getByRole('heading', { name: '承認しました' })).toBeVisible();

      const application = await getVendorApplicationById(fixture.applicationId);
      vendorId = application?.vendor_id ?? null;

      expect(application?.status).toBe('approved');
      expect(vendorId).not.toBeNull();
      await page.getByRole('button', { name: '閉じる' }).click();
      await page.reload();
      await expect(page.getByText(fixture.companyName)).toBeVisible();
    } finally {
      await cleanupVendorApplicationFixture({
        applicationId: fixture.applicationId,
        userId: fixture.userId,
        vendorId
      });
    }
  });

  test('[AA-03] @admin rejection flow records the reason', async ({ page }) => {
    const missing = missingCredentialEnv('admin');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    const fixture = await createPendingVendorApplicationFixture();
    const reason = `E2E rejection reason ${Date.now()}`;

    try {
      await signInAs(page, 'admin', '/admin/applications');
      const card = page.locator('div').filter({ hasText: fixture.companyName }).first();

      await card.locator('textarea[name="reason"]').fill(reason);
      await card.getByRole('button', { name: '却下する' }).click();
      await expect(page.getByText('申請を却下しました')).toBeVisible();

      const application = await getVendorApplicationById(fixture.applicationId);
      expect(application?.status).toBe('rejected');
      expect(application?.notes).toBe(reason);
    } finally {
      await cleanupVendorApplicationFixture({
        applicationId: fixture.applicationId,
        userId: fixture.userId
      });
    }
  });

  test('[AA-04] @admin @hybrid approved users can enter vendor routes after re-login', async ({ browser, page }) => {
    const missing = missingCredentialEnv('admin');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    const fixture = await createPendingVendorApplicationFixture();
    let vendorId: number | null = null;
    const vendorContext = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL ?? process.env.APP_BASE_URL ?? 'http://127.0.0.1:3000'
    });
    const vendorPage = await vendorContext.newPage();

    try {
      await signInAs(page, 'admin', '/admin/applications');
      const card = page.locator('div').filter({ hasText: fixture.companyName }).first();

      await card.getByRole('button', { name: '承認する' }).click();
      await page.getByRole('button', { name: 'この内容で承認' }).click();
      await expect(page.getByRole('heading', { name: '承認しました' })).toBeVisible();

      const application = await getVendorApplicationById(fixture.applicationId);
      vendorId = application?.vendor_id ?? null;
      expect(application?.status).toBe('approved');
      expect(vendorId).not.toBeNull();

      await signInWithCredentials(vendorPage, { email: fixture.email, password: fixture.password }, '/orders');
      await expect(vendorPage.getByRole('heading', { name: '注文一覧' })).toBeVisible();
    } finally {
      await vendorContext.close();
      await cleanupVendorApplicationFixture({
        applicationId: fixture.applicationId,
        userId: fixture.userId,
        vendorId
      });
    }
  });
});
