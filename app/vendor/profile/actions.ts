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
      | 'notificationEmail2'
      | 'postal'
      | 'prefecture'
      | 'city'
      | 'address1'
      | 'address2',
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

function validatePostal(postal: string) {
  // 日本の郵便番号: 123-4567 / 1234567 / 全半角混在に許容範囲を持たせる
  const pattern = /^[0-9]{3}-?[0-9]{4}$/;
  return pattern.test(postal);
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
  const rawPostal = formData.get('postal');
  const rawPrefecture = formData.get('prefecture');
  const rawCity = formData.get('city');
  const rawAddress1 = formData.get('address1');
  const rawAddress2 = formData.get('address2');
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
  const postal = typeof rawPostal === 'string' ? rawPostal.trim() : '';
  const prefecture = typeof rawPrefecture === 'string' ? rawPrefecture.trim() : '';
  const city = typeof rawCity === 'string' ? rawCity.trim() : '';
  const address1 = typeof rawAddress1 === 'string' ? rawAddress1.trim() : '';
  const address2 = typeof rawAddress2 === 'string' ? rawAddress2.trim() : '';

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

  // 発送元住所 — 納品書出力に必須。新規登録フローでも必須項目化済み。
  // address2(建物名・部屋番号) のみ任意入力。
  if (!postal) {
    fieldErrors.postal = '郵便番号を入力してください。';
  } else if (!validatePostal(postal)) {
    fieldErrors.postal = '郵便番号は「123-4567」 または「1234567」 で入力してください。';
  }

  if (!prefecture) {
    fieldErrors.prefecture = '都道府県を入力してください。';
  }

  if (!city) {
    fieldErrors.city = '市区町村を入力してください。';
  }

  if (!address1) {
    fieldErrors.address1 = '番地を入力してください。';
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
      notify_new_orders: notifyNewOrders,
      postal: postal || null,
      prefecture: prefecture || null,
      city: city || null,
      address1: address1 || null,
      address2: address2 || null
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
