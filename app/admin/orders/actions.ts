'use server';

import { getAuthContext, isAdmin } from '@/lib/auth';
import { getOrderDetailForAdmin } from '@/lib/data/orders';
import type { OrderDetail } from '@/lib/data/orders';

export type LoadAdminOrderDetailResult =
  | { status: 'success'; detail: OrderDetail }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export async function loadAdminOrderDetailAction(orderId: number): Promise<LoadAdminOrderDetailResult> {
  if (!Number.isInteger(orderId)) {
    return { status: 'error', message: '有効な注文IDではありません。' };
  }

  const auth = await getAuthContext();

  if (!auth || !isAdmin(auth)) {
    return { status: 'error', message: '権限がありません。' };
  }

  try {
    const detail = await getOrderDetailForAdmin(orderId);

    if (!detail) {
      return { status: 'not_found' };
    }

    return { status: 'success', detail };
  } catch (error) {
    console.error('Failed to load admin order detail', error);
    return { status: 'error', message: '注文詳細の取得に失敗しました。' };
  }
}
