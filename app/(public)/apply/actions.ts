'use server';

import { revalidatePath } from 'next/cache';
import { createVendorApplication } from '@/lib/data/vendors';
import { getServerActionClient } from '@/lib/supabase/server';
import type { ApplyFormState } from './state';

function validateEmail(value: string) {
  return /.+@.+\..+/.test(value);
}

export async function submitVendorApplication(
  _prevState: ApplyFormState,
  formData: FormData
): Promise<ApplyFormState> {
  const vendorCode = (formData.get('vendorCode') as string | null)?.trim() ?? '';
  const companyName = (formData.get('companyName') as string | null)?.trim() ?? '';
  const contactName = (formData.get('contactName') as string | null)?.trim() ?? '';
  const contactEmail = (formData.get('contactEmail') as string | null)?.trim() ?? '';
  const message = (formData.get('message') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const passwordConfirm = (formData.get('passwordConfirm') as string | null) ?? '';
  const acceptTerms = formData.get('acceptTerms') === 'on';

  const errors: ApplyFormState['errors'] = {};

  if (vendorCode && !/^\d{4}$/.test(vendorCode)) {
    errors.vendorCode = 'ベンダーコードは4桁の数字で入力してください';
  }

  if (companyName.length === 0) {
    errors.companyName = '会社名を入力してください';
  }

  if (contactEmail.length === 0 || !validateEmail(contactEmail)) {
    errors.contactEmail = '有効なメールアドレスを入力してください';
  }

  if (password.length < 8) {
    errors.password = 'パスワードは8文字以上で入力してください';
  }

  if (password !== passwordConfirm) {
    errors.passwordConfirm = '確認用パスワードが一致しません';
  }

  if (!acceptTerms) {
    errors.acceptTerms = '利用規約への同意が必要です';
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: 'error',
      message: '入力内容を確認してください',
      errors
    };
  }

  try {
    const supabase = getServerActionClient();

    const signUpResult = await supabase.auth.signUp({
      email: contactEmail,
      password,
      options: {
        data: {
          role: 'pending_vendor',
          company_name: companyName,
          vendor_code: vendorCode || null,
          contact_name: contactName || null
        }
      }
    });

    if (signUpResult.error) {
      return {
        status: 'error',
        message:
          signUpResult.error.message ?? 'アカウントの作成に失敗しました。時間をおいて再度お試しください。',
        errors: {}
      };
    }

    const authUserId = signUpResult.data.user?.id ?? null;

    await createVendorApplication(
      {
        vendorCode,
        companyName,
        contactName,
        contactEmail,
        message,
        authUserId
      },
      supabase
    );

    revalidatePath('/admin/applications');

    return {
      status: 'success',
      message:
        '利用申請とアカウント登録を受け付けました。確認メールをご確認の上、承認完了までお待ちください。',
      errors: {}
    };
  } catch (error) {
    console.error('Failed to submit vendor application', error);
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : '申請の送信中にエラーが発生しました。時間をおいて再度お試しください。',
      errors: {}
    };
  }
}
