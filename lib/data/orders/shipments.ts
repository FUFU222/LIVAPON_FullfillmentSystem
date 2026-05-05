import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
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

export type ShipmentBatchPlan = {
  orderId: number;
  lineItemIds: number[];
  lineItemQuantities: Record<number, number>;
};

export type ShipmentResyncSummary = {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ shipmentId: number; message: string }>;
};

export type ShipmentUpsertResult = {
  shipmentId: number;
  syncStatus: 'synced' | 'pending' | 'error';
  syncError: string | null;
};

export type ShipmentRegistrationResult = {
  shipmentIds: number[];
  orderIds: number[];
  itemCount: number;
};

type ShipmentActorType = 'vendor' | 'admin' | 'worker' | 'system';

type ShipmentSyncEventType =
  | 'registered'
  | 'sync_started'
  | 'sync_succeeded'
  | 'sync_failed'
  | 'resync_requested'
  | 'manual_resolved'
  | 'shopify_fulfillment_linked';

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
      await recordShipmentSyncEvent(client, {
        shipmentId: shipment.id,
        orderId: null,
        vendorId: null,
        eventType: 'sync_started',
        statusFrom: 'pending',
        statusTo: 'processing',
        actorType: 'worker'
      });
      await syncShipmentWithShopify(shipment.id);
      await recordShipmentSyncEvent(client, {
        shipmentId: shipment.id,
        orderId: null,
        vendorId: null,
        eventType: 'sync_succeeded',
        statusFrom: 'processing',
        statusTo: 'synced',
        actorType: 'worker'
      });
      summary.succeeded += 1;
    } catch (err) {
      await markShipmentSyncFailure(client, shipment.id, err, { actorType: 'worker' });
      summary.failed += 1;
      summary.errors.push({
        shipmentId: shipment.id,
        message: sanitizeSyncErrorMessage(err instanceof Error ? err.message : 'Unknown error')
      });
    }
  }

  return summary;
}

export async function registerShipmentsFromSelections(
  selections: ShipmentSelection[],
  vendorId: number,
  options: {
    trackingNumber: string;
    carrier: string;
    requestId?: string | null;
    actorUserId?: string | null;
  }
): Promise<ShipmentRegistrationResult> {
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

  const orderIds: number[] = [];
  const shipmentIds: number[] = [];
  let itemCount = 0;

  for (const [orderId, orderSelections] of grouped.entries()) {
    let plan: ShipmentBatchPlan | null = null;

    try {
      plan = await prepareShipmentBatch({
        vendorId,
        orderId,
        selections: orderSelections,
        client,
        skipFulfillmentOrderSync: true
      });
    } catch (error) {
      console.warn('Fulfillment order closed during bulk shipment registration', {
        orderId,
        error
      });
      throw error;
    }

    if (!plan) {
      continue;
    }

    const result = await upsertShipment(
      {
        lineItemIds: plan.lineItemIds,
        lineItemQuantities: plan.lineItemQuantities,
        trackingNumber: options.trackingNumber,
        carrier: options.carrier,
        status: 'shipped'
      },
      vendorId,
      {
        skipFulfillmentOrderSync: true,
        deferShopifySync: true,
        registrationRequestId: options.requestId ?? null,
        actorType: 'vendor',
        actorUserId: options.actorUserId ?? null
      }
    );

    shipmentIds.push(result.shipmentId);
    orderIds.push(orderId);
    itemCount += plan.lineItemIds.length;
  }

  if (orderIds.length === 0) {
    throw new Error('発送できる明細が見つかりませんでした');
  }

  return { shipmentIds, orderIds, itemCount };
}

export async function prepareShipmentBatch(options: {
  vendorId: number;
  orderId: number;
  selections: ShipmentSelection[];
  client?: SupabaseClient<Database>;
  skipFulfillmentOrderSync?: boolean;
}): Promise<ShipmentBatchPlan | null> {
  const { vendorId, orderId, selections } = options;
  if (!Number.isInteger(vendorId) || !Number.isInteger(orderId)) {
    return null;
  }

  const client = options.client ?? assertServiceClient();
  const lineItemIds = selections
    .map((selection) => selection.lineItemId)
    .filter((id) => Number.isInteger(id)) as number[];

  if (lineItemIds.length === 0) {
    return null;
  }

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
    return null;
  }

  if (!options.skipFulfillmentOrderSync) {
    lineItems = await ensureFulfillmentOrderIsActive({
      client,
      orderId,
      lineItems,
      loadLineItems
    });
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
  selections.forEach((selection) => {
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
    return null;
  }

  return {
    orderId,
    lineItemIds: selectedLineItemIds,
    lineItemQuantities: quantityMap
  } satisfies ShipmentBatchPlan;
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
  vendorId: number,
  options?: {
    skipFulfillmentOrderSync?: boolean;
    nonFatalSyncErrors?: boolean;
    deferShopifySync?: boolean;
    registrationRequestId?: string | null;
    registrationPayloadHash?: string | null;
    actorType?: ShipmentActorType;
    actorUserId?: string | null;
  }
): Promise<ShipmentUpsertResult> {
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
        'id, vendor_id, order_id, fulfillable_quantity, fulfilled_quantity, fulfillment_order_line_item_id, shopify_line_item_id, quantity'
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

  if (!options?.skipFulfillmentOrderSync) {
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
  }

  const nowIso = new Date().toISOString();
  const registrationRequestId = options?.registrationRequestId ?? null;
  const registrationPayloadHash = registrationRequestId
    ? options?.registrationPayloadHash ?? buildShipmentRegistrationHash({
        vendorId,
        orderId,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier,
        lineItemIds: shipment.lineItemIds,
        lineItemQuantities: shipment.lineItemQuantities ?? {}
      })
    : null;

  if (!shipment.id && registrationRequestId) {
    const existingRegistration = await loadExistingShipmentRegistration(
      client,
      vendorId,
      registrationRequestId,
      orderId
    );
    if (existingRegistration) {
      if (existingRegistration.registration_payload_hash !== registrationPayloadHash) {
        throw new Error('Shipment request payload conflicts with a previous registration');
      }

      return {
        shipmentId: existingRegistration.id,
        syncStatus: normalizeShipmentSyncStatus(existingRegistration.sync_status),
        syncError: existingRegistration.sync_error ?? null
      };
    }
  }

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
    sync_pending_until: null,
    registration_request_id: registrationRequestId,
    registration_payload_hash: registrationPayloadHash
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
      if (registrationRequestId && isUniqueViolation(insertError)) {
        const existingRegistration = await loadExistingShipmentRegistration(
          client,
          vendorId,
          registrationRequestId,
          orderId
        );
        if (existingRegistration) {
          if (existingRegistration.registration_payload_hash !== registrationPayloadHash) {
            throw new Error('Shipment request payload conflicts with a previous registration');
          }

          return {
            shipmentId: existingRegistration.id,
            syncStatus: normalizeShipmentSyncStatus(existingRegistration.sync_status),
            syncError: existingRegistration.sync_error ?? null
          };
        }
      }
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

  await recordShipmentSyncEvent(client, {
    shipmentId: shipmentId as number,
    orderId,
    vendorId,
    eventType: 'registered',
    statusTo: 'pending',
    requestId: registrationRequestId,
    actorType: options?.actorType ?? 'vendor',
    actorUserId: options?.actorUserId ?? null,
    metadata: {
      lineItemCount: shipment.lineItemIds.length,
      deferred: Boolean(options?.deferShopifySync)
    }
  });

  if (options?.deferShopifySync) {
    return {
      shipmentId: shipmentId as number,
      syncStatus: 'pending',
      syncError: null
    };
  }

  try {
    await recordShipmentSyncEvent(client, {
      shipmentId: shipmentId as number,
      orderId,
      vendorId,
      eventType: 'sync_started',
      statusFrom: 'pending',
      statusTo: 'processing',
      actorType: options?.actorType ?? 'worker',
      actorUserId: options?.actorUserId ?? null
    });
    await syncShipmentWithShopify(shipmentId as number);
    await recordShipmentSyncEvent(client, {
      shipmentId: shipmentId as number,
      orderId,
      vendorId,
      eventType: 'sync_succeeded',
      statusFrom: 'processing',
      statusTo: 'synced',
      actorType: options?.actorType ?? 'worker',
      actorUserId: options?.actorUserId ?? null
    });
    return {
      shipmentId: shipmentId as number,
      syncStatus: 'synced',
      syncError: null
    };
  } catch (error) {
    const now = new Date();
    const nowIso = now.toISOString();
    const rawMessage = sanitizeSyncErrorMessage(
      error instanceof Error ? error.message : 'Shopify 連携で不明なエラーが発生しました'
    );
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

    const resultStatus = updatePayload.sync_status === 'pending' ? 'pending' : 'error';

    await recordShipmentSyncEvent(client, {
      shipmentId: shipmentId as number,
      orderId,
      vendorId,
      eventType: 'sync_failed',
      statusFrom: 'processing',
      statusTo: resultStatus,
      actorType: options?.actorType ?? 'worker',
      actorUserId: options?.actorUserId ?? null,
      errorMessage: rawMessage,
      metadata: {
        isFoMissing,
        retryCount: updatePayload.sync_retry_count ?? null,
        pendingUntil: updatePayload.sync_pending_until ?? null
      }
    });

    console.error('Failed to sync shipment with Shopify', {
      shipmentId,
      vendorId,
      orderId,
      syncStatus: resultStatus,
      isFoMissing,
      nonFatalSyncErrors: Boolean(options?.nonFatalSyncErrors),
      error: rawMessage
    });

    if (options?.nonFatalSyncErrors) {
      return {
        shipmentId: shipmentId as number,
        syncStatus: resultStatus,
        syncError: rawMessage
      };
    }

    if (isFoMissing) {
      throw new Error('Shopify 側の Fulfillment Order がまだ生成されていないため、追跡番号の同期を保留しました。数分後に自動で再試行します。');
    }

    throw error instanceof Error ? error : new Error(rawMessage);
  }
}

async function markShipmentSyncFailure(
  client: SupabaseClient<Database>,
  shipmentId: number,
  error: unknown,
  options?: {
    actorType?: ShipmentActorType;
    actorUserId?: string | null;
  }
) {
  const now = new Date();
  const nowIso = now.toISOString();
  const rawMessage = sanitizeSyncErrorMessage(
    error instanceof Error ? error.message : 'Shopify 連携で不明なエラーが発生しました'
  );
  const shouldRetry = isRetriableShipmentSyncError(rawMessage);

  const { data: shipment, error: loadError } = await client
    .from('shipments')
    .select('id, vendor_id, order_id, sync_status, sync_retry_count')
    .eq('id', shipmentId)
    .maybeSingle();

  if (loadError) {
    console.error('Failed to load shipment before marking sync failure', {
      shipmentId,
      error: loadError
    });
    return;
  }

  const currentRetryCount = shipment?.sync_retry_count ?? 0;
  const nextRetryCount = currentRetryCount + 1;
  const pendingUntil = shouldRetry
    ? new Date(now.getTime() + calculateShipmentRetryDelayMinutes(currentRetryCount) * 60_000).toISOString()
    : null;
  const nextStatus = shouldRetry ? 'pending' : 'error';

  const updatePayload: Database['public']['Tables']['shipments']['Update'] = {
    sync_status: nextStatus,
    sync_error: rawMessage,
    updated_at: nowIso,
    last_retry_at: nowIso,
    sync_retry_count: nextRetryCount,
    sync_pending_until: pendingUntil
  };

  const { error: updateError } = await client
    .from('shipments')
    .update(updatePayload)
    .eq('id', shipmentId);

  if (updateError) {
    console.error('Failed to mark shipment sync failure', {
      shipmentId,
      error: updateError
    });
    return;
  }

  await recordShipmentSyncEvent(client, {
    shipmentId,
    orderId: shipment?.order_id ?? null,
    vendorId: shipment?.vendor_id ?? null,
    eventType: 'sync_failed',
    statusFrom: shipment?.sync_status ?? 'processing',
    statusTo: nextStatus,
    actorType: options?.actorType ?? 'worker',
    actorUserId: options?.actorUserId ?? null,
    errorMessage: rawMessage,
    metadata: {
      retryCount: nextRetryCount,
      pendingUntil
    }
  });
}

function isRetriableShipmentSyncError(message: string) {
  if (message.includes('No fulfillment order found for Shopify order')) {
    return true;
  }
  return /\b(429|500|502|503|504)\b/.test(message);
}

function sanitizeSyncErrorMessage(message: string) {
  return message
    .replace(/shpat_[A-Za-z0-9_]+/g, 'shpat_[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/X-Shopify-Access-Token["':\s]+[A-Za-z0-9._~+/=-]+/gi, 'X-Shopify-Access-Token [redacted]')
    .slice(0, 2000);
}

function calculateShipmentRetryDelayMinutes(currentRetryCount: number) {
  const baseDelayMinutes = 5;
  return Math.min(60, baseDelayMinutes * Math.pow(2, currentRetryCount));
}

async function loadExistingShipmentRegistration(
  client: SupabaseClient<Database>,
  vendorId: number,
  registrationRequestId: string,
  orderId: number
) {
  const { data, error } = await client
    .from('shipments')
    .select('id, sync_status, sync_error, registration_payload_hash')
    .eq('vendor_id', vendorId)
    .eq('registration_request_id', registrationRequestId)
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function normalizeShipmentSyncStatus(value: string | null | undefined): ShipmentUpsertResult['syncStatus'] {
  if (value === 'synced' || value === 'error') {
    return value;
  }
  return 'pending';
}

function buildShipmentRegistrationHash(params: {
  vendorId: number;
  orderId: number;
  trackingNumber: string;
  carrier: string;
  lineItemIds: number[];
  lineItemQuantities: Record<number, number | null>;
}) {
  const items = [...params.lineItemIds]
    .sort((a, b) => a - b)
    .map((lineItemId) => ({
      lineItemId,
      quantity: params.lineItemQuantities[lineItemId] ?? null
    }));

  return createHash('sha256')
    .update(JSON.stringify({
      vendorId: params.vendorId,
      orderId: params.orderId,
      trackingNumber: params.trackingNumber.trim(),
      carrier: params.carrier.trim(),
      items
    }))
    .digest('hex');
}

async function recordShipmentSyncEvent(
  client: SupabaseClient<Database>,
  params: {
    shipmentId: number;
    orderId: number | null;
    vendorId: number | null;
    eventType: ShipmentSyncEventType;
    actorType?: ShipmentActorType;
    actorUserId?: string | null;
    statusFrom?: string | null;
    statusTo?: string | null;
    requestId?: string | null;
    errorMessage?: string | null;
    metadata?: Json;
  }
) {
  const payload: Database['public']['Tables']['shipment_sync_events']['Insert'] = {
    shipment_id: params.shipmentId,
    order_id: params.orderId,
    vendor_id: params.vendorId,
    actor_type: params.actorType ?? 'system',
    actor_user_id: params.actorUserId ?? null,
    event_type: params.eventType,
    status_from: params.statusFrom ?? null,
    status_to: params.statusTo ?? null,
    request_id: params.requestId ?? null,
    error_message: params.errorMessage ?? null,
    metadata: params.metadata ?? {}
  };

  const { error } = await client
    .from('shipment_sync_events')
    .insert(payload);

  if (error) {
    console.error('Failed to record shipment sync event', {
      shipmentId: params.shipmentId,
      eventType: params.eventType,
      error
    });
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

export async function resyncShipmentByAdmin(
  shipmentId: number,
  options?: { actorUserId?: string | null }
): Promise<ShipmentUpsertResult> {
  if (!Number.isInteger(shipmentId)) {
    throw new Error('A valid shipmentId is required to resync shipment');
  }

  const client = assertServiceClient();

  await recordShipmentSyncEvent(client, {
    shipmentId,
    orderId: null,
    vendorId: null,
    eventType: 'resync_requested',
    actorType: 'admin',
    actorUserId: options?.actorUserId ?? null
  });

  try {
    await recordShipmentSyncEvent(client, {
      shipmentId,
      orderId: null,
      vendorId: null,
      eventType: 'sync_started',
      statusFrom: 'pending',
      statusTo: 'processing',
      actorType: 'admin',
      actorUserId: options?.actorUserId ?? null
    });
    await syncShipmentWithShopify(shipmentId);
    await recordShipmentSyncEvent(client, {
      shipmentId,
      orderId: null,
      vendorId: null,
      eventType: 'sync_succeeded',
      statusFrom: 'processing',
      statusTo: 'synced',
      actorType: 'admin',
      actorUserId: options?.actorUserId ?? null
    });
    return {
      shipmentId,
      syncStatus: 'synced',
      syncError: null
    };
  } catch (error) {
    await markShipmentSyncFailure(client, shipmentId, error, {
      actorType: 'admin',
      actorUserId: options?.actorUserId ?? null
    });
    const rawMessage = sanitizeSyncErrorMessage(
      error instanceof Error ? error.message : 'Shopify 連携で不明なエラーが発生しました'
    );
    return {
      shipmentId,
      syncStatus: isRetriableShipmentSyncError(rawMessage) ? 'pending' : 'error',
      syncError: rawMessage
    };
  }
}

export async function markShipmentManualResolved(
  shipmentId: number,
  options?: { actorUserId?: string | null }
): Promise<void> {
  if (!Number.isInteger(shipmentId)) {
    throw new Error('A valid shipmentId is required to mark shipment resolved');
  }

  const client = assertServiceClient();
  const { data: shipment, error: loadError } = await client
    .from('shipments')
    .select('id, vendor_id, order_id, sync_status')
    .eq('id', shipmentId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await client
    .from('shipments')
    .update({
      sync_status: 'manual_resolved',
      sync_error: null,
      sync_pending_until: null,
      updated_at: nowIso,
      last_updated_source: 'admin:manual-resolved',
      last_updated_by: options?.actorUserId ?? null
    })
    .eq('id', shipmentId);

  if (updateError) {
    throw updateError;
  }

  await recordShipmentSyncEvent(client, {
    shipmentId,
    orderId: shipment.order_id ?? null,
    vendorId: shipment.vendor_id ?? null,
    eventType: 'manual_resolved',
    statusFrom: shipment.sync_status ?? null,
    statusTo: 'manual_resolved',
    actorType: 'admin',
    actorUserId: options?.actorUserId ?? null
  });
}

export async function linkShopifyFulfillmentToShipment(
  shipmentId: number,
  shopifyFulfillmentId: number,
  options?: { actorUserId?: string | null }
): Promise<void> {
  if (!Number.isInteger(shipmentId)) {
    throw new Error('A valid shipmentId is required to link fulfillment');
  }

  if (!Number.isInteger(shopifyFulfillmentId) || shopifyFulfillmentId <= 0) {
    throw new Error('A valid Shopify fulfillment id is required');
  }

  const client = assertServiceClient();
  const { data: shipment, error: loadError } = await client
    .from('shipments')
    .select('id, vendor_id, order_id, sync_status')
    .eq('id', shipmentId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (!shipment) {
    throw new Error('Shipment not found');
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await client
    .from('shipments')
    .update({
      shopify_fulfillment_id: shopifyFulfillmentId,
      sync_status: 'synced',
      sync_error: null,
      synced_at: nowIso,
      sync_pending_until: null,
      sync_retry_count: 0,
      updated_at: nowIso,
      last_updated_source: 'admin:fulfillment-link',
      last_updated_by: options?.actorUserId ?? null
    })
    .eq('id', shipmentId);

  if (updateError) {
    throw updateError;
  }

  await recordShipmentSyncEvent(client, {
    shipmentId,
    orderId: shipment.order_id ?? null,
    vendorId: shipment.vendor_id ?? null,
    eventType: 'shopify_fulfillment_linked',
    statusFrom: shipment.sync_status ?? null,
    statusTo: 'synced',
    actorType: 'admin',
    actorUserId: options?.actorUserId ?? null,
    metadata: {
      shopifyFulfillmentId
    }
  });
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

  if (syncResult.status === 'error') {
    const detail = syncResult.error ? ` (${syncResult.error})` : '';
    throw new Error(
      `Shopify 側の Fulfillment Order 情報を取得できませんでした。時間をおいて再度お試しください${detail}`
    );
  }

  if (syncResult.status === 'pending') {
    throw new Error('Shopify 側で Fulfillment Order がまだ生成されていません。数分後に再同期してから再度お試しください。');
  }

  lineItems = await options.loadLineItems();
  orderMeta = await fetchOrderMetaRecord(client, orderId);

  if (isFulfillmentOrderClosed(orderMeta?.shopify_fo_status ?? null)) {
    console.warn('Fulfillment order is closed/cancelled but proceeding due to re-open allowance', {
      orderId,
      fulfillmentStatus: orderMeta?.shopify_fo_status
    });
  }

  return lineItems;
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
