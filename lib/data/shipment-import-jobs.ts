import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getShopifyServiceClient } from '@/lib/shopify/service-client';
import type { ShipmentSelection } from '@/lib/data/orders';

export type ShipmentImportJob = Database['public']['Tables']['shipment_import_jobs']['Row'];
export type ShipmentImportJobItem = Database['public']['Tables']['shipment_import_job_items']['Row'];

export type ShipmentJobSummary = {
  id: number;
  status: string;
  totalCount: number;
  processedCount: number;
  errorCount: number;
  trackingNumber: string;
  carrier: string;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  recentFailures: Array<Pick<ShipmentImportJobItem, 'id' | 'order_id' | 'line_item_id' | 'error_message'>>;
};

type CreateJobInput = {
  vendorId: number;
  trackingNumber: string;
  carrier: string;
  selections: ShipmentSelection[];
};

type SummaryContext = {
  vendorId: number | null;
  isAdmin: boolean;
};

type JobProgressUpdate = {
  processedDelta?: number;
  errorDelta?: number;
  status?: string;
  lastError?: string | null;
  unlock?: boolean;
};

type PendingItemsOptions = {
  limit?: number;
};

type ClaimJobOptions = {
  staleAfterSeconds?: number;
};

function resolveStaleAfterSeconds(overrideSeconds?: number) {
  const rawValue = typeof overrideSeconds === 'number'
    ? overrideSeconds
    : Number(process.env.SHIPMENT_JOB_LOCK_STALE_SECONDS ?? '90');
  return Math.max(30, Math.min(rawValue, 3600));
}

function assertServiceClient(): SupabaseClient<Database> {
  return getShopifyServiceClient();
}

function normalizeSelections(selections: ShipmentSelection[]): Array<{ orderId: number; lineItemId: number; quantity: number }> {
  const map = new Map<string, { orderId: number; lineItemId: number; quantity: number }>();

  selections.forEach((selection) => {
    const orderId = Number(selection.orderId);
    const lineItemId = Number(selection.lineItemId);
    if (!Number.isInteger(orderId) || !Number.isInteger(lineItemId)) {
      return;
    }
    const requested = typeof selection.quantity === 'number' && selection.quantity > 0
      ? Math.floor(selection.quantity)
      : 1;
    const quantity = Math.max(1, Math.min(requested, 9999));
    const key = `${orderId}:${lineItemId}`;
    map.set(key, { orderId, lineItemId, quantity });
  });

  return Array.from(map.values());
}

export async function createShipmentImportJob(input: CreateJobInput): Promise<{ jobId: number; totalCount: number }> {
  if (!Number.isInteger(input.vendorId)) {
    throw new Error('A valid vendorId is required to create shipment jobs');
  }

  const normalized = normalizeSelections(input.selections);
  if (normalized.length === 0) {
    throw new Error('発送できる明細が見つかりませんでした');
  }

  const client = assertServiceClient();
  const { data: job, error } = await client
    .from('shipment_import_jobs')
    .insert({
      vendor_id: input.vendorId,
      tracking_number: input.trackingNumber,
      carrier: input.carrier,
      status: 'pending',
      total_count: normalized.length,
      processed_count: 0,
      error_count: 0
    })
    .select('id')
    .single();

  if (error || !job) {
    throw error || new Error('Failed to create shipment import job');
  }

  const jobItems = normalized.map((selection) => ({
    job_id: job.id,
    vendor_id: input.vendorId,
    order_id: selection.orderId,
    line_item_id: selection.lineItemId,
    quantity: selection.quantity,
    status: 'pending'
  } satisfies Database['public']['Tables']['shipment_import_job_items']['Insert']));

  const { error: itemsError } = await client.from('shipment_import_job_items').insert(jobItems);
  if (itemsError) {
    await client.from('shipment_import_jobs').delete().eq('id', job.id);
    throw itemsError;
  }

  return { jobId: job.id, totalCount: normalized.length };
}

export async function validateShipmentSelectionsForVendor(
  vendorId: number,
  selections: ShipmentSelection[]
): Promise<boolean> {
  if (!Number.isInteger(vendorId)) {
    throw new Error('A valid vendorId is required to validate shipment selections');
  }

  const normalized = normalizeSelections(selections);
  if (normalized.length === 0) {
    return false;
  }

  const lineItemIds = Array.from(new Set(normalized.map((selection) => selection.lineItemId)));
  const client = assertServiceClient();
  const { data, error } = await client
    .from('line_items')
    .select('id, order_id')
    .eq('vendor_id', vendorId)
    .in('id', lineItemIds);

  if (error) {
    throw error;
  }

  const lineItemMap = new Map<number, { id: number; order_id: number | null }>();
  (data ?? []).forEach((item) => {
    lineItemMap.set(item.id, item);
  });

  return normalized.every((selection) => {
    const lineItem = lineItemMap.get(selection.lineItemId);
    if (!lineItem) {
      return false;
    }
    return lineItem.order_id === selection.orderId;
  });
}

export async function getShipmentImportJob(jobId: number): Promise<ShipmentImportJob | null> {
  if (!Number.isInteger(jobId)) {
    return null;
  }

  const client = assertServiceClient();
  const { data, error } = await client
    .from('shipment_import_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getShipmentImportJobSummary(jobId: number, context: SummaryContext): Promise<ShipmentJobSummary | null> {
  if (!Number.isInteger(jobId)) {
    return null;
  }

  const job = await getShipmentImportJob(jobId);
  if (!job) {
    return null;
  }

  if (!context.isAdmin && job.vendor_id !== context.vendorId) {
    return null;
  }

  const client = assertServiceClient();
  const { data: failures } = await client
    .from('shipment_import_job_items')
    .select('id, order_id, line_item_id, error_message')
    .eq('job_id', job.id)
    .eq('status', 'failed')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(5);

  return {
    id: job.id,
    status: job.status,
    totalCount: job.total_count,
    processedCount: job.processed_count,
    errorCount: job.error_count,
    trackingNumber: job.tracking_number,
    carrier: job.carrier,
    lastError: job.last_error,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    recentFailures: failures ?? []
  };
}

export async function claimShipmentImportJobs(limit: number): Promise<ShipmentImportJob[]> {
  const client = assertServiceClient();
  const batchLimit = Math.max(1, Math.min(limit, 5));
  const { data, error } = await client.rpc('claim_pending_shipment_import_jobs', {
    job_limit: batchLimit
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listReclaimableShipmentImportJobIds(
  limit: number,
  options?: ClaimJobOptions
): Promise<number[]> {
  const client = assertServiceClient();
  const batchLimit = Math.max(1, Math.min(limit, 5));
  const staleAfterSeconds = resolveStaleAfterSeconds(options?.staleAfterSeconds);
  const staleBeforeIso = new Date(Date.now() - staleAfterSeconds * 1000).toISOString();

  const claimedIds: number[] = [];
  const { data: unlockedRows, error: unlockedError } = await client
    .from('shipment_import_jobs')
    .select('id')
    .eq('status', 'running')
    .is('locked_at', null)
    .order('updated_at', { ascending: true })
    .limit(batchLimit);

  if (unlockedError) {
    throw unlockedError;
  }

  unlockedRows?.forEach((row) => {
    if (Number.isInteger(row.id)) {
      claimedIds.push(row.id);
    }
  });

  const remaining = batchLimit - claimedIds.length;
  if (remaining <= 0) {
    return claimedIds;
  }

  const { data: staleRows, error: staleError } = await client
    .from('shipment_import_jobs')
    .select('id')
    .eq('status', 'running')
    .not('locked_at', 'is', null)
    .lte('locked_at', staleBeforeIso)
    .order('locked_at', { ascending: true, nullsFirst: true })
    .limit(remaining);

  if (staleError) {
    throw staleError;
  }

  staleRows?.forEach((row) => {
    if (Number.isInteger(row.id) && !claimedIds.includes(row.id)) {
      claimedIds.push(row.id);
    }
  });

  return claimedIds;
}

export async function claimShipmentImportJobById(
  jobId: number,
  options?: ClaimJobOptions
): Promise<ShipmentImportJob | null> {
  if (!Number.isInteger(jobId)) {
    return null;
  }

  const client = assertServiceClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const staleAfterSeconds = resolveStaleAfterSeconds(options?.staleAfterSeconds);
  const staleBeforeIso = new Date(now - staleAfterSeconds * 1000).toISOString();

  const { data: current, error: currentError } = await client
    .from('shipment_import_jobs')
    .select('id, status, attempts, locked_at')
    .eq('id', jobId)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    return null;
  }

  const attempts = current.attempts ?? 0;
  const claimPayload: Partial<ShipmentImportJob> = {
    status: 'running',
    locked_at: nowIso,
    last_attempt_at: nowIso,
    attempts: attempts + 1,
    updated_at: nowIso
  };

  if (current.status === 'pending') {
    const { data } = await client
      .from('shipment_import_jobs')
      .update(claimPayload)
      .eq('id', jobId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();
    return data ?? null;
  }

  if (current.status !== 'running') {
    return null;
  }

  const lockedAt = current.locked_at;
  const isStale = !lockedAt || Date.parse(lockedAt) <= Date.parse(staleBeforeIso);
  if (!isStale) {
    return null;
  }

  const staleClaimQuery = client
    .from('shipment_import_jobs')
    .update(claimPayload)
    .eq('id', jobId)
    .eq('status', 'running')
    .select('*');

  const { data } = lockedAt
    ? await staleClaimQuery.lte('locked_at', staleBeforeIso).maybeSingle()
    : await staleClaimQuery.is('locked_at', null).maybeSingle();

  return data ?? null;
}

export async function loadPendingJobItems(jobId: number, options?: PendingItemsOptions): Promise<ShipmentImportJobItem[]> {
  const client = assertServiceClient();
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 200));
  const { data, error } = await client
    .from('shipment_import_job_items')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .order('id', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function incrementJobItemAttempts(items: ShipmentImportJobItem[]): Promise<void> {
  if (!items.length) {
    return;
  }
  const client = assertServiceClient();
  const nowIso = new Date().toISOString();
  await Promise.all(
    items.map((item) =>
      client
        .from('shipment_import_job_items')
        .update({
          attempts: (item.attempts ?? 0) + 1,
          last_attempt_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', item.id)
    )
  );
}

export async function markJobItemsResult(
  jobItemIds: number[],
  status: 'succeeded' | 'failed',
  options?: { errorMessage?: string | null }
) {
  if (!jobItemIds.length) {
    return;
  }

  const client = assertServiceClient();
  const nowIso = new Date().toISOString();
  const payload: Partial<ShipmentImportJobItem> = {
    status,
    error_message: status === 'failed' ? options?.errorMessage ?? null : null,
    updated_at: nowIso
  } as Partial<ShipmentImportJobItem>;

  const { error } = await client
    .from('shipment_import_job_items')
    .update(payload)
    .in('id', jobItemIds);

  if (error) {
    throw error;
  }
}

export async function updateShipmentJobProgress(job: ShipmentImportJob, update: JobProgressUpdate): Promise<ShipmentImportJob> {
  const client = assertServiceClient();
  const nowIso = new Date().toISOString();
  const processed = job.processed_count + (update.processedDelta ?? 0);
  const errors = job.error_count + (update.errorDelta ?? 0);

  const payload: Partial<ShipmentImportJob> = {
    processed_count: processed,
    error_count: errors,
    updated_at: nowIso
  };

  if (update.status) {
    payload.status = update.status;
  }

  if (update.lastError !== undefined) {
    payload.last_error = update.lastError;
  }

  if (update.unlock) {
    payload.locked_at = null;
  }

  const { data, error } = await client
    .from('shipment_import_jobs')
    .update(payload)
    .eq('id', job.id)
    .select('*')
    .single();

  if (error || !data) {
    throw error || new Error('Failed to update shipment job progress');
  }

  return data;
}

export async function countPendingJobItems(jobId: number): Promise<number> {
  const client = assertServiceClient();
  const { count, error } = await client
    .from('shipment_import_job_items')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'pending');

  if (error) {
    throw error;
  }

  return count ?? 0;
}
