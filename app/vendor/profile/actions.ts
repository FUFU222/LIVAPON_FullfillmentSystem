'use server';

import { revalidatePath } from 'next/cache';
import { getServerActionClient } from '@/lib/supabase/server';
import { assertAuthorizedVendor, requireAuthContext } from '@/lib/auth';

export type VendorProfileActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  submissionId?: string | null;
  fieldErrors?: Partial<
    Record<
      | 'companyName'
      | 'contactEmail'
      | 'password'
      | 'currentPassword'
      | 'contactPhone'
      | 'notificationEmail1'
      | 'notificationEmail2',
      string
    >
  >;
};

const INITIAL_VENDOR_PROFILE_STATE: VendorProfileActionState = {
  status: 'idle',
  message: null,
  submissionId: null
};

const NOTIFICATION_EMAIL_FIELDS = [
  'notificationEmail1',
  'notificationEmail2'
] as const;

function validateEmail(email: string) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

function validatePhone(phone: string) {
  const pattern = /^[0-9()+\-\s]{8,}$/;
  return pattern.test(phone);
}

export async function updateVendorProfileAction(
  _prevState: VendorProfileActionState,
  formData: FormData
): Promise<VendorProfileActionState> {
  const rawCompanyName = formData.get('companyName');
  const rawContactName = formData.get('contactName');
  const rawContactEmail = formData.get('contactEmail');
  const rawContactPhone = formData.get('contactPhone');
  const rawPassword = formData.get('password');
  const rawCurrentPassword = formData.get('currentPassword');
  const notifyNewOrdersRaw = formData.get('notifyNewOrders');
  const notificationEmailValues = NOTIFICATION_EMAIL_FIELDS.map((fieldName) => {
    const rawValue = formData.get(fieldName);
    return typeof rawValue === 'string' ? rawValue.trim() : '';
  });

  const companyName = typeof rawCompanyName === 'string' ? rawCompanyName.trim() : '';
  const contactName = typeof rawContactName === 'string' ? rawContactName.trim() : '';
  const contactEmail = typeof rawContactEmail === 'string' ? rawContactEmail.trim() : '';
  const contactPhone = typeof rawContactPhone === 'string' ? rawContactPhone.trim() : '';
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  const currentPassword = typeof rawCurrentPassword === 'string' ? rawCurrentPassword : '';
  const notifyNewOrders = notifyNewOrdersRaw === 'on';

  const fieldErrors: VendorProfileActionState['fieldErrors'] = {};

  if (!companyName) {
    fieldErrors.companyName = '会社名を入力してください。';
  }

  if (!contactEmail) {
    fieldErrors.contactEmail = '連絡先メールアドレスを入力してください。';
  } else if (!validateEmail(contactEmail)) {
    fieldErrors.contactEmail = 'メールアドレスの形式が正しくありません。';
  }

  if (!contactPhone) {
    fieldErrors.contactPhone = '電話番号を入力してください。';
  } else if (!validatePhone(contactPhone)) {
    fieldErrors.contactPhone = '電話番号の形式が正しくありません。';
  }

  if (password) {
    if (password.length < 8) {
      fieldErrors.password = 'パスワードは8文字以上で設定してください。';
    }
    if (!currentPassword) {
      fieldErrors.currentPassword = '現在のパスワードを入力してください。';
    }
  }

  const notificationEmails: string[] = [];
  const seenNotificationEmails = new Set<string>();
  const normalizedContactEmail = contactEmail.toLowerCase();
  notificationEmailValues.forEach((value, index) => {
    if (!value) {
      return;
    }

    const fieldName = NOTIFICATION_EMAIL_FIELDS[index];
    if (!validateEmail(value)) {
      fieldErrors[fieldName] = 'メールアドレスの形式が正しくありません。';
      return;
    }

    const normalizedValue = value.toLowerCase();
    if (normalizedValue === normalizedContactEmail || seenNotificationEmails.has(normalizedValue)) {
      return;
    }

    seenNotificationEmails.add(normalizedValue);
    notificationEmails.push(normalizedValue);
  });

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      message: '入力内容を確認してください。',
      submissionId: Date.now().toString(),
      fieldErrors
    };
  }

  const auth = await requireAuthContext();
  assertAuthorizedVendor(auth.vendorId);

  const supabase = await getServerActionClient();

  const { error: vendorUpdateError } = await supabase
    .from('vendors')
    .update({
      name: companyName,
      contact_email: contactEmail,
      notification_emails: notificationEmails,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      notify_new_orders: notifyNewOrders
    })
    .eq('id', auth.vendorId)
    .select('id')
    .single();

  if (vendorUpdateError) {
    console.error('Failed to update vendor profile', vendorUpdateError);
    return {
      status: 'error',
      message: 'セラー情報の更新に失敗しました。時間を置いて再度お試しください。',
      submissionId: Date.now().toString()
    };
  }

  const currentMetadata = {
    ...(auth.session.user.user_metadata ?? {})
  } as Record<string, unknown>;

  const mergedMetadata = {
    ...currentMetadata,
    contact_name: contactName ? contactName : null,
    contact_phone: contactPhone ? contactPhone : null,
    vendor_id: auth.vendorId,
    vendorId: auth.vendorId
  };

  const authPayload: Parameters<typeof supabase.auth.updateUser>[0] = {
    data: mergedMetadata
  };

  if (password) {
    authPayload.password = password;
  }

  const { error: authUpdateError } = await supabase.auth.updateUser(authPayload);

  if (authUpdateError) {
    console.error('Failed to update auth profile', authUpdateError);
    return {
      status: 'error',
      message: '認証情報の更新に失敗しました。時間を置いて再度お試しください。',
      submissionId: Date.now().toString()
    };
  }

  revalidatePath('/vendor/profile');
  revalidatePath('/', 'layout');

  return {
    status: 'success',
    message: 'プロフィールを更新しました。',
    submissionId: Date.now().toString()
  };
}
