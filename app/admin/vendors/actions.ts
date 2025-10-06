'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteVendor } from '@/lib/data/vendors';
import { requireAuthContext, assertAdmin } from '@/lib/auth';

const BASE_PATH = '/admin/vendors';

export async function deleteVendorAction(formData: FormData) {
  const vendorId = Number(formData.get('vendorId'));

  if (!Number.isInteger(vendorId) || vendorId <= 0) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('ベンダーIDが不正です。')}`);
  }

  const auth = await requireAuthContext();
  assertAdmin(auth);

  try {
    await deleteVendor(vendorId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'ベンダーの削除に失敗しました。時間を空けて再度お試しください。';

    revalidatePath(BASE_PATH);
    redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(BASE_PATH);
  revalidatePath('/admin');
  redirect(`${BASE_PATH}?status=deleted`);
}
