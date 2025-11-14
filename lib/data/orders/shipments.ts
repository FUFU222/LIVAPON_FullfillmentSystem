import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  syncShipmentWithShopify,
  cancelShopifyFulfillment,
  loadShopifyAccessToken,
  upsertShopifyOrderNoteAttribute
} from '@/lib/shopify/fulfillment';
import { syncFulfillmentOrderMetadata } from './fulfillment';
import { assertServiceClient, getOptionalServiceClient } from './clients';

export type ShipmentSelection = {
  orderId: number;
  lineItemId: number;
  quantity?: number | null;
};

export type ShipmentResyncSummary = {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ shipmentId: number; message: string }>;
};

const CLOSED_FO_STATUSES = new Set(['closed', 'canceled', 'cancelled']);

export async function resyncPendingShipments(options?: { limit?: number }): Promise<ShipmentResyncSummary> {
  const rawLimit = options?.limit;
  const normalizedLimit = Number.isFinite(rawLimit ?? NaN) ? (rawLimit as number) : undefined;
  const limit = Math.max(1, Math.min(100, normalizedLimit ?? 10));
  const client = assertServiceClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await client
    .from('shipments')
    .select('id')
    .in('sync_status', ['pending', 'error'])
    .or(`sync_pending_until.is.null,sync_pending_until.lte.${nowIso}`)
    .order('sync_pending_until', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const shipments = data ?? [];
  const summary: ShipmentResyncSummary = {
    total: shipments.length,
    succeeded: 0,
    failed: 0,
    errors: []
  };

  for (const shipment of shipments) {
    try {
      await syncShipmentWithShopify(shipment.id);
      summary.succeeded += 1;
    } catch (err) {
      summary.failed += 1;
      summary.errors.push({
        shipmentId: shipment.id,
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  return summary;
}

export async function registerShipmentsFromSelections(
  selections: ShipmentSelection[],
  vendorId: number,
  options: { trackingNumber: string; carrier: string }
): Promise<number[]> {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error('line item selections are required');
  }

  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to register shipments');
  }

  const client = assertServiceClient();
  const grouped = new Map<number, ShipmentSelection[]>();
  selections.forEach((selection) => {
    if (!Number.isInteger(selection.orderId) || !Number.isInteger(selection.lineItemId)) {
      return;
    }
    const entry = grouped.get(selection.orderId) ?? [];
    entry.push(selection);
    grouped.set(selection.orderId, entry);
  });

  const processedOrders: number[] = [];

  for (const [orderId, orderSelections] of grouped.entries()) {
    const lineItemIds = orderSelections.map((selection) => selection.lineItemId);

    const loadLineItems = async () => {
      const { data, error } = await client
        .from('line_items')
        .select(
          'id, vendor_id, order_id, quantity, fulfilled_quantity, fulfillable_quantity, fulfillment_order_line_item_id, shopify_line_item_id'
        )
        .eq('order_id', orderId)
        .eq('vendor_id', vendorId)
        .in('id', lineItemIds);

      if (error) {
        throw error;
      }

      return data ?? [];
    };

    let lineItems = await loadLineItems();

    if (!lineItems || lineItems.length === 0) {
      continue;
    }

    try {
      lineItems = await ensureFulfillmentOrderIsActive({
        client,
        orderId,
        lineItems,
        loadLineItems
      });
    } catch (error) {
      console.warn('Fulfillment order closed during bulk shipment registration', {
        orderId,
        error
      });
      throw error;
    }

    const metadata = new Map<number, { quantity: number; fulfilled: number; fulfillable: number | null }>();
    lineItems.forEach((item) => {
      metadata.set(item.id, {
        quantity: item.quantity ?? 0,
        fulfilled: item.fulfilled_quantity ?? 0,
        fulfillable: item.fulfillable_quantity ?? null
      });
    });

    const quantityMap: Record<number, number> = {};
    orderSelections.forEach((selection) => {
      const info = metadata.get(selection.lineItemId);
      if (!info) {
        return;
      }
      const available = typeof info.fulfillable === 'number'
        ? Math.max(info.fulfillable, 0)
        : Math.max(info.quantity - info.fulfilled, 0);

      if (available <= 0) {
        return;
      }

      const requested = typeof selection.quantity === 'number' && selection.quantity > 0
        ? Math.floor(selection.quantity)
        : available;

      quantityMap[selection.lineItemId] = Math.max(1, Math.min(available, requested));
    });

    const selectedLineItemIds = Object.keys(quantityMap).map((id) => Number(id));

    if (selectedLineItemIds.length === 0) {
      continue;
    }

    await upsertShipment(
      {
        lineItemIds: selectedLineItemIds,
        lineItemQuantities: quantityMap,
        trackingNumber: options.trackingNumber,
        carrier: options.carrier,
        status: 'shipped'
      },
      vendorId
    );

    processedOrders.push(orderId);
  }

  if (processedOrders.length === 0) {
    throw new Error('発送できる明細が見つかりませんでした');
  }

  return processedOrders;
}

export async function upsertShipment(
  shipment: {
    id?: number;
    lineItemIds: number[];
    trackingNumber: string;
    carrier: string;
    status: string;
    shippedAt?: string | null;
    lineItemQuantities?: Record<number, number | null>;
  },
  vendorId: number
) {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to update shipments');
  }

  const client: SupabaseClient<Database> = assertServiceClient();

  if (!Array.isArray(shipment.lineItemIds) || shipment.lineItemIds.length === 0) {
    throw new Error('lineItemIds must contain at least one item');
  }

  const loadLineItems = async () => {
    const { data, error } = await client
      .from('line_items')
      .select(
        'id, vendor_id, order_id, fulfillable_quantity, fulfillment_order_line_item_id, shopify_line_item_id, quantity'
      )
      .in('id', shipment.lineItemIds);

    if (error) {
      throw error;
    }

    return data ?? [];
  };

  let lineItems = await loadLineItems();

  if (!lineItems || lineItems.length !== shipment.lineItemIds.length) {
    throw new Error('Line items not found');
  }

  const unauthorized = lineItems.some((item) => item.vendor_id !== vendorId);
  if (unauthorized) {
    throw new Error('Unauthorized line items included in shipment');
  }

  const orderId = lineItems[0]?.order_id ?? null;
  if (!orderId || lineItems.some((item) => item.order_id !== orderId)) {
    throw new Error('Line items must belong to the same order');
  }

  lineItems = await ensureFulfillmentOrderIsActive({
    client,
    orderId,
    lineItems,
    loadLineItems
  });

  const unauthorizedAfterSync = lineItems.some((item) => item.vendor_id !== vendorId);
  if (unauthorizedAfterSync) {
    throw new Error('Unauthorized line items included in shipment');
  }

  const nowIso = new Date().toISOString();

  const payload: Database['public']['Tables']['shipments']['Insert'] = {
    tracking_number: shipment.trackingNumber,
    carrier: shipment.carrier,
    status: shipment.status,
    shipped_at: shipment.shippedAt ?? nowIso,
    vendor_id: vendorId,
    order_id: orderId,
    tracking_company: shipment.carrier,
    sync_status: 'pending',
    synced_at: null,
    sync_error: null,
    updated_at: nowIso,
    sync_retry_count: 0,
    last_retry_at: null,
    sync_pending_until: null
  } satisfies Database['public']['Tables']['shipments']['Insert'];

  let shipmentId = shipment.id ?? null;

  if (shipmentId) {
    const { error: updateError } = await client
      .from('shipments')
      .update(payload)
      .eq('id', shipmentId);

    if (updateError) {
      throw updateError;
    }

    const { error: deletePivotError } = await client
      .from('shipment_line_items')
      .delete()
      .eq('shipment_id', shipmentId);

    if (deletePivotError) {
      throw deletePivotError;
    }
  } else {
    const { data: insertData, error: insertError } = await client
      .from('shipments')
      .insert(payload)
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    shipmentId = insertData.id;
  }

  const pivotInserts: Database['public']['Tables']['shipment_line_items']['Insert'][] = shipment.lineItemIds.map((lineItemId) => {
    const matching = lineItems.find((item) => item.id === lineItemId);
    const overrideQuantity = shipment.lineItemQuantities?.[lineItemId] ?? null;
    const baseQuantity = matching?.fulfillable_quantity ?? matching?.quantity ?? null;
    const quantity = overrideQuantity ?? baseQuantity;
    return {
      shipment_id: shipmentId as number,
      line_item_id: lineItemId,
      quantity,
      fulfillment_order_line_item_id: matching?.fulfillment_order_line_item_id ?? null
    };
  });

  const { error: pivotError } = await client
    .from('shipment_line_items')
    .insert(pivotInserts);

  if (pivotError) {
    throw pivotError;
  }

  try {
    await syncShipmentWithShopify(shipmentId as number);
  } catch (error) {
    const now = new Date();
    const nowIso = now.toISOString();
    const rawMessage = error instanceof Error ? error.message : 'Shopify 連携で不明なエラーが発生しました';
    const isFoMissing = rawMessage.includes('No fulfillment order found for Shopify order');

    const updatePayload: Database['public']['Tables']['shipments']['Update'] = {
      sync_status: isFoMissing ? 'pending' : 'error',
      sync_error: rawMessage,
      updated_at: nowIso,
      last_retry_at: nowIso,
      sync_pending_until: null
    };

    if (isFoMissing) {
      const { data: retryInfo } = await client
        .from('shipments')
        .select('sync_retry_count')
        .eq('id', shipmentId as number)
        .maybeSingle();

      const currentRetryCount = retryInfo?.sync_retry_count ?? 0;
      const nextRetryCount = currentRetryCount + 1;
      const baseDelayMinutes = 5;
      const delayMinutes = Math.min(60, baseDelayMinutes * Math.pow(2, currentRetryCount));
      const pendingUntil = new Date(now.getTime() + delayMinutes * 60_000).toISOString();

      updatePayload.sync_retry_count = nextRetryCount;
      updatePayload.sync_pending_until = pendingUntil;
    }

    await client
      .from('shipments')
      .update(updatePayload)
      .eq('id', shipmentId as number);

    if (isFoMissing) {
      throw new Error('Shopify 側の Fulfillment Order がまだ生成されていないため、追跡番号の同期を保留しました。数分後に自動で再試行します。');
    }

    throw error instanceof Error ? error : new Error(rawMessage);
  }
}

export async function markShipmentsCancelledForOrder(orderId: number): Promise<void> {
  if (!Number.isInteger(orderId)) {
    throw new Error('A valid orderId is required to cancel shipments');
  }

  const client = assertServiceClient();
  const nowIso = new Date().toISOString();

  const { data: shipmentIds, error: listError } = await client
    .from('shipments')
    .select('id')
    .eq('order_id', orderId);

  if (listError) {
    throw listError;
  }

  if (!shipmentIds || shipmentIds.length === 0) {
    return;
  }

  await client
    .from('shipments')
    .update({
      status: 'cancelled',
      sync_status: 'cancelled',
      sync_error: null,
      shopify_fulfillment_id: null,
      synced_at: null,
      updated_at: nowIso,
      last_retry_at: nowIso,
      sync_pending_until: null
    })
    .eq('order_id', orderId);
}

export async function updateOrderStatus(orderId: number, status: string, vendorId: number) {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to update order status');
  }

  const client = assertServiceClient();

  const { data: permittedLineItem, error: lineItemError } = await client
    .from('line_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('vendor_id', vendorId)
    .limit(1)
    .maybeSingle();

  if (lineItemError) {
    throw lineItemError;
  }

  if (!permittedLineItem) {
    throw new Error('Unauthorized to update this order');
  }

  const { error } = await client
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    throw error;
  }
}

export async function cancelShipment(
  shipmentId: number,
  vendorId: number,
  options?: { reasonType?: string | null; reasonDetail?: string | null }
) {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to cancel shipments');
  }

  const client: SupabaseClient<Database> = assertServiceClient();

  const { data: shipment, error: shipmentError } = await client
    .from('shipments')
    .select(
      `id, vendor_id, order_id, shopify_fulfillment_id,
       order:orders(id, shop_domain, shopify_order_id),
       line_items:shipment_line_items(line_item_id)`
    )
    .eq('id', shipmentId)
    .maybeSingle();

  if (shipmentError) {
    throw shipmentError;
  }

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  if (shipment.vendor_id !== vendorId) {
    throw new Error('Unauthorized to cancel this shipment');
  }

  const order = shipment.order;
  if (!order) {
    throw new Error('Shipment missing related order');
  }

  const reasonType = options?.reasonType?.trim() || 'unspecified';
  const reasonDetail = options?.reasonDetail?.trim() || null;
  const reasonText = buildCancellationReasonText(reasonType, reasonDetail);

  if (shipment.shopify_fulfillment_id) {
    const accessToken = await loadShopifyAccessToken(client, order.shop_domain ?? '');
    const shopDomain = order.shop_domain ?? '';
    await cancelShopifyFulfillment(shopDomain, accessToken, shipment.shopify_fulfillment_id);

    if (order.shopify_order_id) {
      await upsertShopifyOrderNoteAttribute(shopDomain, accessToken, order.shopify_order_id, {
        name: 'livapon_last_cancellation_reason',
        value: reasonText
      });
    }
  }

  await client.from('shipment_cancellation_logs').insert({
    shipment_id: shipment.id,
    order_id: order.id,
    vendor_id: vendorId,
    reason_type: reasonType,
    reason_detail: reasonDetail
  });

  const { error: deletePivotError } = await client
    .from('shipment_line_items')
    .delete()
    .eq('shipment_id', shipment.id);

  if (deletePivotError) {
    throw deletePivotError;
  }

  const { error: deleteShipmentError } = await client
    .from('shipments')
    .delete()
    .eq('id', shipment.id);

  if (deleteShipmentError) {
    throw deleteShipmentError;
  }

  const { count } = await client
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id);

  if (!count) {
    const { error: updateOrderError } = await client
      .from('orders')
      .update({ status: 'unfulfilled', updated_at: new Date().toISOString() })
      .eq('id', order.id);

    if (updateOrderError) {
      throw updateOrderError;
    }
  }
}

type ShipmentLineItemRow = {
  id: number;
  vendor_id: number | null;
  order_id: number | null;
  fulfillable_quantity: number | null;
  fulfillment_order_line_item_id: number | null;
  shopify_line_item_id: number;
  quantity: number;
  fulfilled_quantity: number | null;
};

type OrderMetaRecord = {
  shop_domain: string | null;
  shopify_order_id: number | null;
  shopify_fo_status: string | null;
};

async function fetchOrderMetaRecord(client: SupabaseClient<Database>, orderId: number) {
  const { data, error } = await client
    .from('orders')
    .select('shop_domain, shopify_order_id, shopify_fo_status')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as OrderMetaRecord | null;
}

function isFulfillmentOrderClosed(status: string | null | undefined) {
  if (!status) {
    return false;
  }
  const normalized = status.toLowerCase();
  return CLOSED_FO_STATUSES.has(normalized);
}

async function ensureFulfillmentOrderIsActive(options: {
  client: SupabaseClient<Database>;
  orderId: number;
  lineItems: ShipmentLineItemRow[];
  loadLineItems: () => Promise<ShipmentLineItemRow[]>;
}) {
  const { client, orderId } = options;
  let lineItems = options.lineItems;
  let orderMeta = await fetchOrderMetaRecord(client, orderId);

  if (!orderMeta) {
    throw new Error('対象の注文情報が見つかりません。注文を再同期してください。');
  }

  if (!isFulfillmentOrderClosed(orderMeta.shopify_fo_status)) {
    return lineItems;
  }

  if (!orderMeta.shopify_order_id) {
    throw new Error('Shopify 注文IDが未割り当てです。注文を再同期してから再度お試しください。');
  }

  const syncResult = await syncFulfillmentOrderMetadata(
    orderMeta.shop_domain ?? null,
    orderMeta.shopify_order_id
  );

  console.info('Auto-sync fulfillment order metadata before shipment registration', {
    orderId,
    syncResult
  });

  if (syncResult.status === 'synced') {
    lineItems = await options.loadLineItems();
    orderMeta = await fetchOrderMetaRecord(client, orderId);
    if (!isFulfillmentOrderClosed(orderMeta?.shopify_fo_status ?? null)) {
      return lineItems;
    }
  }

  const detail = syncResult.status === 'error' ? ` (${syncResult.error})` : '';
  throw new Error(
    `Shopify 側の Fulfillment Order がクローズされています。注文を未発送に戻した直後の場合は数分後に再同期してから再度お試しください${detail}`
  );
}

function buildCancellationReasonText(reasonType: string, reasonDetail: string | null) {
  const label = REASON_LABELS[reasonType] ?? '未分類';
  const detail = reasonDetail ? ` / ${reasonDetail}` : '';
  return `[LIVAPON] 未発送に戻す: ${label}${detail}`;
}

const REASON_LABELS: Record<string, string> = {
  customer_request: '顧客都合（再配送・キャンセル）',
  address_issue: '住所不備・受取不可',
  inventory_issue: '在庫調整・誤出荷',
  label_error: 'ラベル/伝票の不備',
  other: 'その他',
  unspecified: '未指定'
};
