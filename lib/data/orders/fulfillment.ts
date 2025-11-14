import type { Database } from '@/lib/supabase/types';
import {
  applyFulfillmentOrderSnapshot,
  fetchFulfillmentOrderSnapshots,
  loadShopifyAccessToken,
  syncShipmentWithShopify
} from '@/lib/shopify/fulfillment';
import type { FulfillmentOrderSyncResult } from './types';
import { assertServiceClient, normalizeShopDomainValue } from './clients';

export async function triggerShipmentResyncForShopifyOrder(shopifyOrderId: number): Promise<void> {
  const client = assertServiceClient();

  const { data: orderRecord, error: orderError } = await client
    .from('orders')
    .select('id, shop_domain')
    .eq('shopify_order_id', shopifyOrderId)
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!orderRecord) {
    console.info('Shopify order not found in Supabase for resync trigger', {
      shopifyOrderId
    });
    return;
  }

  try {
    await syncFulfillmentOrderMetadata(orderRecord.shop_domain ?? null, shopifyOrderId);
  } catch (error) {
    console.error('Failed to sync fulfillment order metadata during resync trigger', {
      error,
      shopifyOrderId
    });
  }

  const { data: shipments, error: shipmentsError } = await client
    .from('shipments')
    .select('id, sync_status, sync_pending_until')
    .eq('order_id', orderRecord.id)
    .in('sync_status', ['pending', 'error']);

  if (shipmentsError) {
    throw shipmentsError;
  }

  if (!shipments || shipments.length === 0) {
    return;
  }

  for (const shipment of shipments as Array<{ id: number; sync_pending_until: string | null }>) {
    const pendingUntil = shipment.sync_pending_until ? Date.parse(shipment.sync_pending_until) : null;
    if (pendingUntil && pendingUntil > Date.now()) {
      continue;
    }

    try {
      await syncShipmentWithShopify(shipment.id);
    } catch (error) {
      console.error('Failed to resync shipment after FO webhook', {
        error,
        shipmentId: shipment.id,
        shopifyOrderId
      });
    }
  }
}

export async function syncFulfillmentOrderMetadata(
  shopDomain: string | null,
  shopifyOrderId: number
): Promise<FulfillmentOrderSyncResult> {
  if (!Number.isInteger(shopifyOrderId)) {
    throw new Error('A valid shopifyOrderId is required to sync fulfillment orders');
  }

  const client = assertServiceClient();
  const normalizedDomain = normalizeShopDomainValue(shopDomain);

  let orderQuery = client
    .from('orders')
    .select('id, shop_domain')
    .eq('shopify_order_id', shopifyOrderId)
    .limit(1);

  if (normalizedDomain) {
    orderQuery = orderQuery.eq('shop_domain', normalizedDomain);
  }

  const { data: orderRecord, error: orderError } = await orderQuery.maybeSingle();

  if (orderError) {
    return { status: 'error', error: orderError.message };
  }

  if (!orderRecord) {
    return { status: 'error', error: 'Order not found in Supabase' };
  }

  const domainForToken = normalizeShopDomainValue(orderRecord.shop_domain) ?? normalizedDomain;
  const fallbackDomain = normalizeShopDomainValue(process.env.SHOPIFY_STORE_DOMAIN ?? '');
  const resolvedShopDomain = domainForToken ?? fallbackDomain;

  if (!resolvedShopDomain) {
    return { status: 'error', error: 'Shop domain is not configured for fulfillment sync' };
  }

  try {
    const accessToken = await loadShopifyAccessToken(client, resolvedShopDomain);
    const snapshots = await fetchFulfillmentOrderSnapshots(
      resolvedShopDomain,
      accessToken,
      shopifyOrderId
    );

    if (!snapshots || snapshots.length === 0) {
      return { status: 'pending', reason: 'not_found', attempts: 0 };
    }

    const primarySnapshot = snapshots[0];

    await applyFulfillmentOrderSnapshot({
      client,
      orderRecordId: orderRecord.id,
      shopifyOrderId,
      fulfillmentOrderId: primarySnapshot.id,
      lineItems: primarySnapshot.line_items,
      foStatus: primarySnapshot.status ?? null
    });

    return {
      status: 'synced',
      fulfillmentOrderId: primarySnapshot.id,
      lineItemCount: primarySnapshot.line_items.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to sync fulfillment order metadata', {
      error,
      shopifyOrderId,
      shopDomain: resolvedShopDomain
    });
    return { status: 'error', error: message };
  }
}
