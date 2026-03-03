import { expect, missingCredentialEnv, signInAs, test } from './fixtures';
import { snapshotVendorProfile, restoreVendorProfile, buildE2EMarker } from './supabase-admin';

test.describe('vendor profile', () => {
  test('[VP-01] @smoke @vendor vendor profile page renders required fields', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/vendor/profile');
    await expect(page.getByLabel('会社名')).toBeVisible();
    await expect(page.getByLabel('担当者名')).toBeVisible();
    await expect(page.getByLabel('発送担当者の電話番号')).toBeVisible();
    await expect(page.getByRole('button', { name: '保存する' })).toBeVisible();
  });

  test('[VP-02] @vendor vendor can update contact details', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    const snapshot = await snapshotVendorProfile('vendorA');
    const marker = buildE2EMarker('vendor-profile');
    const nextContactName = marker;
    const nextContactPhone = '03-5555-1212';

    try {
      await signInAs(page, 'vendorA', '/vendor/profile');
      await page.getByLabel('担当者名').fill(nextContactName);
      await page.getByLabel('発送担当者の電話番号').fill(nextContactPhone);
      await page.getByRole('button', { name: '保存する' }).click();

      await expect(page.getByText('セラー情報を保存しました。最新の内容が反映されています。')).toBeVisible();
      await expect.poll(async () => page.getByLabel('担当者名').inputValue()).toBe(nextContactName);
      await expect.poll(async () => page.getByLabel('発送担当者の電話番号').inputValue()).toBe(nextContactPhone);
    } finally {
      await restoreVendorProfile(snapshot);
    }
  });

  test('[VP-03] @vendor vendor can toggle new-order notification settings', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    const snapshot = await snapshotVendorProfile('vendorA');
    const nextChecked = !Boolean(snapshot.vendor.notify_new_orders ?? true);

    try {
      await signInAs(page, 'vendorA', '/vendor/profile');
      const checkbox = page.getByLabel('新規注文メール通知');

      if ((await checkbox.isChecked()) !== nextChecked) {
        await checkbox.click();
      }

      await page.getByRole('button', { name: '保存する' }).click();
      await expect(page.getByText('セラー情報を保存しました。最新の内容が反映されています。')).toBeVisible();
      await expect.poll(async () => page.getByLabel('新規注文メール通知').isChecked()).toBe(nextChecked);
    } finally {
      await restoreVendorProfile(snapshot);
    }
  });

  test('[VP-04] @vendor invalid profile values show validation errors', async ({ page }) => {
    const missing = missingCredentialEnv('vendorA');
    test.skip(missing.length > 0, `Missing E2E credentials: ${missing.join(', ')}`);

    await signInAs(page, 'vendorA', '/vendor/profile');
    await page.getByLabel('発送担当者の電話番号').fill('123');
    await page.getByLabel('新しいパスワード（任意）').fill('short');
    await page.getByRole('button', { name: '保存する' }).click();

    await expect(page.getByText('電話番号の形式が正しくありません。')).toBeVisible();
    await expect(page.getByText('パスワードは8文字以上で設定してください。')).toBeVisible();
    await expect(page.getByText('現在のパスワードを入力してください。')).toBeVisible();
  });
});
