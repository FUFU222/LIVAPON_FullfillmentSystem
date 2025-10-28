'use server';

import { revalidatePath } from 'next/cache';
import { getServerActionClient } from '@/lib/supabase/server';
import { assertAuthorizedVendor, requireAuthContext } from '@/lib/auth';

export type VendorProfileActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  fieldErrors?: Partial<Record<'companyName' | 'email' | 'password', string>>;
};

export const INITIAL_VENDOR_PROFILE_STATE: VendorProfileActionState = {
  status: 'idle',
  message: null
};

function validateEmail(email: string) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

export async function updateVendorProfileAction(
  _prevState: VendorProfileActionState,
  formData: FormData
): Promise<VendorProfileActionState> {
  const rawCompanyName = formData.get('companyName');
  const rawContactName = formData.get('contactName');
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');

  const companyName = typeof rawCompanyName === 'string' ? rawCompanyName.trim() : '';
  const contactName = typeof rawContactName === 'string' ? rawContactName.trim() : '';
  const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  const fieldErrors: VendorProfileActionState['fieldErrors'] = {};

  if (!companyName) {
    fieldErrors.companyName = '会社名を入力してください。';
  }

  if (!email) {
    fieldErrors.email = 'メールアドレスを入力してください。';
  } else if (!validateEmail(email)) {
    fieldErrors.email = 'メールアドレスの形式が正しくありません。';
  }

  if (password && password.length < 8) {
    fieldErrors.password = 'パスワードは8文字以上で設定してください。';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      message: '入力内容を確認してください。',
      fieldErrors
    };
  }

  const auth = await requireAuthContext();
  assertAuthorizedVendor(auth.vendorId);

  const supabase = getServerActionClient();

  const { error: vendorUpdateError } = await supabase
    .from('vendors')
    .update({
      name: companyName,
      contact_email: email,
      contact_name: contactName || null
    })
    .eq('id', auth.vendorId)
    .select('id')
    .single();

  if (vendorUpdateError) {
    console.error('Failed to update vendor profile', vendorUpdateError);
    return {
      status: 'error',
      message: 'ベンダー情報の更新に失敗しました。時間を置いて再度お試しください。'
    };
  }

  const currentMetadata = {
    ...(auth.session.user.user_metadata ?? {})
  } as Record<string, unknown>;

  const mergedMetadata = {
    ...currentMetadata,
    contact_name: contactName ? contactName : null,
    vendor_id: auth.vendorId,
    vendorId: auth.vendorId
  };

  const authPayload: Parameters<typeof supabase.auth.updateUser>[0] = {
    data: mergedMetadata
  };

  const currentEmail = auth.session.user.email ?? null;
  if (email && email !== currentEmail) {
    authPayload.email = email;
  }

  if (password) {
    authPayload.password = password;
  }

  const { error: authUpdateError } = await supabase.auth.updateUser(authPayload);

  if (authUpdateError) {
    console.error('Failed to update auth profile', authUpdateError);
    return {
      status: 'error',
      message:
        '認証情報の更新に失敗しました。時間を置いて再度お試しください。メールアドレス変更の場合は再度サインインをお試しください。'
    };
  }

  revalidatePath('/vendor/profile');
  revalidatePath('/', 'layout');

  return {
    status: 'success',
    message: 'プロフィールを更新しました。'
  };
}
