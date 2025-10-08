'use server';

import { revalidatePath } from 'next/cache';
import { approveVendorApplication, rejectVendorApplication } from '@/lib/data/vendors';
import { requireAuthContext, assertAdmin } from '@/lib/auth';
import type { AdminActionState } from './state';

export async function approveApplicationAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const applicationId = Number(formData.get('applicationId'));
  const vendorCodeRaw = (formData.get('vendorCode') as string | null)?.trim() ?? null;
  const notes = (formData.get('notes') as string | null)?.trim() ?? null;

  if (!Number.isFinite(applicationId) || applicationId <= 0) {
    return { status: 'error', message: '申請IDが無効です', details: null };
}

if (vendorCodeRaw && !/^\d{4}$/.test(vendorCodeRaw)) {
    return {
      status: 'error',
      message: 'ベンダーコードは4桁の数字で入力してください',
      details: null
    };
}

  const auth = await requireAuthContext();
  assertAdmin(auth);

  try {
    const result = await approveVendorApplication({
      applicationId,
      reviewerId: auth.user.id,
      reviewerEmail: auth.user.email ?? null,
      vendorCode: vendorCodeRaw,
      notes
    });

    revalidatePath('/admin/applications');

    return {
      status: 'success',
      message: '申請を承認しました。',
      details: {
        vendorCode: result.vendorCode
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : '申請の承認中にエラーが発生しました',
      details: null
    };
  }
}

export async function rejectApplicationAction(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const applicationId = Number(formData.get('applicationId'));
  const reason = (formData.get('reason') as string | null)?.trim() ?? null;

  if (!Number.isFinite(applicationId) || applicationId <= 0) {
    return { status: 'error', message: '申請IDが無効です', details: null };
  }

  const auth = await requireAuthContext();
  assertAdmin(auth);

  try {
    await rejectVendorApplication({
      applicationId,
      reviewerId: auth.user.id,
      reviewerEmail: auth.user.email ?? null,
      reason
    });

    revalidatePath('/admin/applications');

    return {
      status: 'success',
      message: '申請を却下しました',
      details: null
    };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : '申請の却下中にエラーが発生しました',
      details: null
    };
  }
}
