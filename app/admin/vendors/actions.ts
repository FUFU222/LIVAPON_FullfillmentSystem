'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteVendor, getVendorDetailForAdmin } from '@/lib/data/vendors';
import type { VendorDetail } from '@/lib/data/vendors';
import { requireAuthContext, assertAdmin, getAuthContext, isAdmin } from '@/lib/auth';

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

export async function bulkDeleteVendorsAction(formData: FormData) {
  const ids = formData.getAll('vendorIds').map((value) => Number(value));

  if (ids.length === 0) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('削除するベンダーを選択してください。')}`);
  }

  const auth = await requireAuthContext();
  assertAdmin(auth);

  const successes: number[] = [];
  const failures: Array<{ id: number; message: string }> = [];

  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) {
      failures.push({ id, message: 'ベンダーIDが不正です' });
      continue;
    }
    try {
      await deleteVendor(id);
      successes.push(id);
    } catch (error) {
      failures.push({
        id,
        message:
          error instanceof Error
            ? error.message
            : '削除に失敗しました。時間を空けて再度お試しください。'
      });
    }
  }

  revalidatePath(BASE_PATH);
  revalidatePath('/admin');

  if (failures.length > 0) {
    const message = failures
      .map((entry) => `ID ${entry.id}: ${entry.message}`)
      .join(' / ');
    redirect(`${BASE_PATH}?error=${encodeURIComponent(message)}`);
  }

  if (successes.length > 0) {
    redirect(`${BASE_PATH}?status=deleted`);
  }

  redirect(`${BASE_PATH}`);
}

export type LoadAdminVendorDetailResult =
  | { status: 'success'; detail: VendorDetail }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function loadAdminVendorDetailAction(vendorId: number): Promise<LoadAdminVendorDetailResult> {
  if (!Number.isInteger(vendorId) || vendorId <= 0) {
    return { status: 'error', message: '有効なベンダーIDではありません。' };
  }

  const auth = await getAuthContext();

  if (!auth || !isAdmin(auth)) {
    return { status: 'error', message: '権限がありません。' };
  }

  try {
    const detail = await getVendorDetailForAdmin(vendorId);

    if (!detail) {
      return { status: 'not_found' };
    }

    return { status: 'success', detail };
  } catch (error) {
    console.error('Failed to load vendor detail for admin', error);
    return { status: 'error', message: 'ベンダー詳細の取得に失敗しました。' };
  }
}
