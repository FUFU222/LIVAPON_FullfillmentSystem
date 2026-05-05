'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext, isAdmin, requireAuthContext } from '@/lib/auth';
import {
  getOrderDetailForAdmin,
  linkShopifyFulfillmentToShipment,
  markShipmentManualResolved,
  resyncShipmentByAdmin
} from '@/lib/data/orders';
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

export type AdminShipmentSyncActionResult = {
  status: 'success' | 'error';
  message: string;
};

async function requireAdminActor() {
  const auth = await requireAuthContext();

  if (!isAdmin(auth)) {
    throw new Error('管理者権限が必要です。');
  }

  return auth;
}

function shouldLogAdminActionError(error: unknown) {
  return !(error instanceof Error && error.message === '管理者権限が必要です。');
}

export async function resyncShipmentByAdminAction(shipmentId: number): Promise<AdminShipmentSyncActionResult> {
  try {
    if (!Number.isInteger(shipmentId)) {
      return { status: 'error', message: '配送IDが不正です。' };
    }

    const auth = await requireAdminActor();
    const result = await resyncShipmentByAdmin(shipmentId, {
      actorUserId: auth.user.id
    });

    revalidatePath('/admin/orders');

    return {
      status: result.syncStatus === 'synced' ? 'success' : 'error',
      message:
        result.syncStatus === 'synced'
          ? 'Shopifyへ再同期しました。'
          : result.syncError ?? 'Shopifyへの再同期に失敗しました。'
    };
  } catch (error) {
    if (shouldLogAdminActionError(error)) {
      console.error('Failed to resync shipment by admin', error);
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Shopifyへの再同期に失敗しました。'
    };
  }
}

export async function markShipmentManualResolvedAction(shipmentId: number): Promise<AdminShipmentSyncActionResult> {
  try {
    if (!Number.isInteger(shipmentId)) {
      return { status: 'error', message: '配送IDが不正です。' };
    }

    const auth = await requireAdminActor();
    await markShipmentManualResolved(shipmentId, {
      actorUserId: auth.user.id
    });

    revalidatePath('/admin/orders');

    return {
      status: 'success',
      message: '手動対応済みにしました。'
    };
  } catch (error) {
    if (shouldLogAdminActionError(error)) {
      console.error('Failed to mark shipment manual resolved', error);
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '手動対応済みへの更新に失敗しました。'
    };
  }
}

export async function linkShopifyFulfillmentAction(
  shipmentId: number,
  rawFulfillmentId: string
): Promise<AdminShipmentSyncActionResult> {
  try {
    if (!Number.isInteger(shipmentId)) {
      return { status: 'error', message: '配送IDが不正です。' };
    }

    const fulfillmentId = Number(rawFulfillmentId);
    if (!Number.isInteger(fulfillmentId) || fulfillmentId <= 0) {
      return { status: 'error', message: 'Shopify Fulfillment IDが不正です。' };
    }

    const auth = await requireAdminActor();
    await linkShopifyFulfillmentToShipment(shipmentId, fulfillmentId, {
      actorUserId: auth.user.id
    });

    revalidatePath('/admin/orders');

    return {
      status: 'success',
      message: 'Shopify Fulfillment IDを紐付けました。'
    };
  } catch (error) {
    if (shouldLogAdminActionError(error)) {
      console.error('Failed to link Shopify fulfillment id', error);
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Shopify Fulfillment IDの紐付けに失敗しました。'
    };
  }
}
