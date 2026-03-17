jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  requireAuthContext: jest.fn(),
  assertAuthorizedVendor: jest.fn()
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerActionClient: jest.fn()
}));

import { revalidatePath } from 'next/cache';
import { requireAuthContext, assertAuthorizedVendor } from '@/lib/auth';
import { getServerActionClient } from '@/lib/supabase/server';
import { updateVendorProfileAction } from '@/app/vendor/profile/actions';

function buildValidFormData(overrides?: {
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notificationEmails?: Array<string | undefined>;
  password?: string;
  currentPassword?: string;
  notifyNewOrders?: boolean;
}) {
  const formData = new FormData();
  formData.set('companyName', overrides?.companyName ?? 'テスト商店');
  formData.set('contactName', overrides?.contactName ?? '山田花子');
  formData.set('contactEmail', overrides?.contactEmail ?? 'ops@example.com');
  formData.set('contactPhone', overrides?.contactPhone ?? '03-1234-5678');
  overrides?.notificationEmails?.forEach((value, index) => {
    if (typeof value === 'string') {
      formData.set(`notificationEmail${index + 1}`, value);
    }
  });
  if (typeof overrides?.password === 'string') {
    formData.set('password', overrides.password);
  }
  if (typeof overrides?.currentPassword === 'string') {
    formData.set('currentPassword', overrides.currentPassword);
  }
  if (overrides?.notifyNewOrders ?? true) {
    formData.set('notifyNewOrders', 'on');
  }
  return formData;
}

function buildSupabaseClient(options?: {
  vendorUpdateError?: unknown;
  authUpdateError?: unknown;
}) {
  const single = jest.fn().mockResolvedValue({ error: options?.vendorUpdateError ?? null });
  const select = jest.fn(() => ({ single }));
  const eq = jest.fn(() => ({ select }));
  const update = jest.fn(() => ({ eq }));
  const from = jest.fn((table: string) => {
    if (table === 'vendors') {
      return { update };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
  const updateUser = jest.fn().mockResolvedValue({ error: options?.authUpdateError ?? null });

  return {
    client: {
      from,
      auth: {
        updateUser
      }
    },
    spies: {
      from,
      update,
      eq,
      select,
      single,
      updateUser
    }
  };
}

describe('updateVendorProfileAction', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (requireAuthContext as jest.Mock).mockResolvedValue({
      vendorId: 12,
      session: {
        user: {
          email: 'current@example.com',
          user_metadata: { locale: 'ja' }
        }
      }
    });
  });

  it('returns field errors before loading server dependencies when input is invalid', async () => {
    const result = await updateVendorProfileAction(
      { status: 'idle', message: null },
      buildValidFormData({
        companyName: '',
        contactEmail: 'invalid',
        contactPhone: '123',
        notificationEmails: ['ops@example.com', 'invalid-email'],
        password: 'short'
      })
    );

    expect(result.status).toBe('error');
    expect(result.message).toBe('入力内容を確認してください。');
    expect(result.fieldErrors).toMatchObject({
      companyName: '会社名を入力してください。',
      contactEmail: 'メールアドレスの形式が正しくありません。',
      contactPhone: '電話番号の形式が正しくありません。',
      notificationEmail2: 'メールアドレスの形式が正しくありません。',
      password: 'パスワードは8文字以上で設定してください。',
      currentPassword: '現在のパスワードを入力してください。'
    });
    expect(requireAuthContext).not.toHaveBeenCalled();
    expect(getServerActionClient).not.toHaveBeenCalled();
  });

  it('updates vendor and auth metadata without resending the same email', async () => {
    const { client, spies } = buildSupabaseClient();
    (getServerActionClient as jest.Mock).mockResolvedValue(client);

    const result = await updateVendorProfileAction(
      { status: 'idle', message: null },
      buildValidFormData()
    );

    expect(assertAuthorizedVendor).toHaveBeenCalledWith(12);
    expect(spies.update).toHaveBeenCalledWith({
      name: 'テスト商店',
      contact_email: 'ops@example.com',
      notification_emails: [],
      contact_name: '山田花子',
      contact_phone: '03-1234-5678',
      notify_new_orders: true
    });
    expect(spies.eq).toHaveBeenCalledWith('id', 12);
    expect(spies.updateUser).toHaveBeenCalledWith({
      data: {
        locale: 'ja',
        contact_name: '山田花子',
        contact_phone: '03-1234-5678',
        vendor_id: 12,
        vendorId: 12
      }
    });
    expect(revalidatePath).toHaveBeenCalledWith('/vendor/profile');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(result.status).toBe('success');
    expect(result.message).toBe('プロフィールを更新しました。');
    expect(result.submissionId).toEqual(expect.any(String));
  });

  it('stores contact and additional notification emails while only updating auth password', async () => {
    const { client, spies } = buildSupabaseClient();
    (getServerActionClient as jest.Mock).mockResolvedValue(client);

    const result = await updateVendorProfileAction(
      { status: 'idle', message: null },
      buildValidFormData({
        contactEmail: 'contact@example.com',
        notificationEmails: ['contact@example.com', 'warehouse@example.com'],
        password: 'new-password-123',
        currentPassword: 'current-password',
        notifyNewOrders: false
      })
    );

    expect(spies.update).toHaveBeenCalledWith({
      name: 'テスト商店',
      contact_email: 'contact@example.com',
      notification_emails: ['warehouse@example.com'],
      contact_name: '山田花子',
      contact_phone: '03-1234-5678',
      notify_new_orders: false
    });
    expect(spies.updateUser).toHaveBeenCalledWith({
      data: {
        locale: 'ja',
        contact_name: '山田花子',
        contact_phone: '03-1234-5678',
        vendor_id: 12,
        vendorId: 12
      },
      password: 'new-password-123'
    });
    expect(result.status).toBe('success');
  });

  it('returns an error when the vendor profile update fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client, spies } = buildSupabaseClient({
      vendorUpdateError: new Error('vendor update failed')
    });
    (getServerActionClient as jest.Mock).mockResolvedValue(client);

    const result = await updateVendorProfileAction(
      { status: 'idle', message: null },
      buildValidFormData()
    );

    expect(result.status).toBe('error');
    expect(result.message).toBe('セラー情報の更新に失敗しました。時間を置いて再度お試しください。');
    expect(result.submissionId).toEqual(expect.any(String));
    expect(spies.updateUser).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update vendor profile',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('returns an error when the auth profile update fails after the vendor update succeeds', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = buildSupabaseClient({
      authUpdateError: new Error('auth update failed')
    });
    (getServerActionClient as jest.Mock).mockResolvedValue(client);

    const result = await updateVendorProfileAction(
      { status: 'idle', message: null },
      buildValidFormData({ contactEmail: 'contact@example.com' })
    );

    expect(result.status).toBe('error');
    expect(result.message).toBe('認証情報の更新に失敗しました。時間を置いて再度お試しください。');
    expect(result.submissionId).toEqual(expect.any(String));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update auth profile',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
