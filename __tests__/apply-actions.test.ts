jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('@/lib/data/vendors', () => ({
  createVendorApplication: jest.fn(),
  getVendorApplicationEmailConflict: jest.fn()
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerActionClient: jest.fn()
}));

import { revalidatePath } from 'next/cache';
import {
  createVendorApplication,
  getVendorApplicationEmailConflict
} from '@/lib/data/vendors';
import { getServerActionClient } from '@/lib/supabase/server';
import {
  APPLY_DUPLICATE_EMAIL_MESSAGE,
  APPLY_GENERIC_ERROR_MESSAGE,
  APPLY_PENDING_APPLICATION_MESSAGE
} from '@/lib/apply/submission-errors';
import { submitVendorApplication } from '@/app/(public)/apply/actions';

function buildValidFormData(overrides?: {
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
  password?: string;
  passwordConfirm?: string;
  acceptTerms?: boolean;
}) {
  const formData = new FormData();
  formData.set('companyName', overrides?.companyName ?? 'テスト商店');
  formData.set('contactName', overrides?.contactName ?? '山田花子');
  formData.set('contactEmail', overrides?.contactEmail ?? 'vendor@example.com');
  formData.set('contactPhone', overrides?.contactPhone ?? '03-1234-5678');
  formData.set('message', overrides?.message ?? 'よろしくお願いします');
  formData.set('password', overrides?.password ?? 'password-123');
  formData.set('passwordConfirm', overrides?.passwordConfirm ?? overrides?.password ?? 'password-123');
  if (overrides?.acceptTerms ?? true) {
    formData.set('acceptTerms', 'on');
  }
  return formData;
}

function buildSupabaseClient(signUpResult: {
  data: { user: { id: string } | null };
  error: { message?: string | null; code?: string | null; status?: number | null } | null;
}) {
  const signUp = jest.fn().mockResolvedValue(signUpResult);
  return {
    client: {
      auth: {
        signUp
      }
    },
    spies: {
      signUp
    }
  };
}

describe('submitVendorApplication', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getVendorApplicationEmailConflict as jest.Mock).mockResolvedValue(null);
    (createVendorApplication as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns field errors before touching external dependencies when validation fails', async () => {
    const result = await submitVendorApplication(
      { status: 'idle', message: null, errors: {} },
      buildValidFormData({
        companyName: '',
        contactEmail: 'invalid-email',
        contactPhone: '123',
        password: 'short',
        passwordConfirm: 'different',
        acceptTerms: false
      })
    );

    expect(result.status).toBe('error');
    expect(result.message).toBe('入力内容を確認してください');
    expect(result.errors).toMatchObject({
      companyName: expect.any(String),
      contactEmail: expect.any(String),
      contactPhone: expect.any(String),
      password: expect.any(String),
      passwordConfirm: expect.any(String),
      acceptTerms: expect.any(String)
    });
    expect(getVendorApplicationEmailConflict).not.toHaveBeenCalled();
    expect(getServerActionClient).not.toHaveBeenCalled();
  });

  it('returns the conflict message when the email is already reserved', async () => {
    (getVendorApplicationEmailConflict as jest.Mock).mockResolvedValue('既に申請済みのメールアドレスです。');

    const result = await submitVendorApplication(
      { status: 'idle', message: null, errors: {} },
      buildValidFormData()
    );

    expect(result).toEqual({
      status: 'error',
      message: null,
      errors: { contactEmail: '既に申請済みのメールアドレスです。' }
    });
    expect(getServerActionClient).not.toHaveBeenCalled();
    expect(createVendorApplication).not.toHaveBeenCalled();
  });

  it('maps sign-up auth errors back to field errors', async () => {
    const { client, spies } = buildSupabaseClient({
      data: { user: null },
      error: { message: 'User already registered' }
    });
    (getServerActionClient as jest.Mock).mockResolvedValue(client);

    const result = await submitVendorApplication(
      { status: 'idle', message: null, errors: {} },
      buildValidFormData()
    );

    expect(spies.signUp).toHaveBeenCalledWith({
      email: 'vendor@example.com',
      password: 'password-123',
      options: {
        data: {
          role: 'pending_vendor',
          company_name: 'テスト商店',
          contact_name: '山田花子',
          contact_phone: '03-1234-5678'
        }
      }
    });
    expect(result).toEqual({
      status: 'error',
      message: null,
      errors: { contactEmail: APPLY_DUPLICATE_EMAIL_MESSAGE }
    });
    expect(createVendorApplication).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('creates the vendor application and revalidates admin applications on success', async () => {
    const { client, spies } = buildSupabaseClient({
      data: { user: { id: 'auth-user-1' } },
      error: null
    });
    (getServerActionClient as jest.Mock).mockResolvedValue(client);

    const result = await submitVendorApplication(
      { status: 'idle', message: null, errors: {} },
      buildValidFormData({ message: '審査をお願いします' })
    );

    expect(spies.signUp).toHaveBeenCalledTimes(1);
    expect(createVendorApplication).toHaveBeenCalledWith({
      companyName: 'テスト商店',
      contactName: '山田花子',
      contactEmail: 'vendor@example.com',
      contactPhone: '03-1234-5678',
      message: '審査をお願いします',
      authUserId: 'auth-user-1'
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/applications');
    expect(result).toEqual({
      status: 'success',
      message:
        '利用申請とアカウント登録を受け付けました。確認メールをご確認の上、承認完了までお待ちください。',
      errors: {}
    });
  });

  it('resolves unexpected persistence errors via the submission error mapper', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = buildSupabaseClient({
      data: { user: { id: 'auth-user-2' } },
      error: null
    });
    (getServerActionClient as jest.Mock).mockResolvedValue(client);
    (createVendorApplication as jest.Mock).mockRejectedValue(new Error('database unavailable'));

    const result = await submitVendorApplication(
      { status: 'idle', message: null, errors: {} },
      buildValidFormData()
    );

    expect(result).toEqual({
      status: 'error',
      message: APPLY_GENERIC_ERROR_MESSAGE,
      errors: {}
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to submit vendor application',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('maps pending application unique violations back to the contact email field', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = buildSupabaseClient({
      data: { user: { id: 'auth-user-3' } },
      error: null
    });
    (getServerActionClient as jest.Mock).mockResolvedValue(client);
    (createVendorApplication as jest.Mock).mockRejectedValue(
      new Error('duplicate key value violates unique constraint "idx_vendor_applications_pending_email_unique"')
    );

    const result = await submitVendorApplication(
      { status: 'idle', message: null, errors: {} },
      buildValidFormData()
    );

    expect(result).toEqual({
      status: 'error',
      message: null,
      errors: { contactEmail: APPLY_PENDING_APPLICATION_MESSAGE }
    });

    consoleErrorSpy.mockRestore();
  });
});
