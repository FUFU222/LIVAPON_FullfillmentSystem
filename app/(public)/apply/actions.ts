'use server';

import { revalidatePath } from 'next/cache';
import { createVendorApplication } from '@/lib/data/vendors';

export type ApplyFormState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  errors: Record<string, string>;
};

const initialState: ApplyFormState = {
  status: 'idle',
  message: null,
  errors: {}
};

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

  if (Object.keys(errors).length > 0) {
    return {
      status: 'error',
      message: '入力内容を確認してください',
      errors
    };
  }

  try {
    await createVendorApplication({
      vendorCode,
      companyName,
      contactName,
      contactEmail,
      message
    });

    revalidatePath('/admin/applications');

    return {
      status: 'success',
      message: '利用申請を受け付けました。審査完了までお待ちください。',
      errors: {}
    };
  } catch (error) {
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

export { initialState as initialApplyFormState };
