import { getOptionalServiceClient } from '@/lib/data/orders/clients';

const DEFAULT_WEBHOOK_DELAY_WARNING_MINUTES = 15;
const configuredWebhookDelayWarningMinutes = Number(process.env.WEBHOOK_DELAY_WARNING_MINUTES);
const WEBHOOK_DELAY_WARNING_MINUTES = Number.isFinite(configuredWebhookDelayWarningMinutes)
  ? Math.max(1, configuredWebhookDelayWarningMinutes)
  : DEFAULT_WEBHOOK_DELAY_WARNING_MINUTES;

export type AdminOperationalStatus = {
  pendingDataCount: number;
  failedSyncCount: number;
  delayedShopifyUpdateCount: number;
  oldestShopifyUpdateAgeMinutes: number | null;
  attentionCount: number;
  checkedAt: string;
};

type CountResult = PromiseLike<{ count: number | null; error: unknown }>;

async function resolveCount(query: CountResult, label: string): Promise<number> {
  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count ${label}`);
  }

  return count ?? 0;
}

function resolveAgeMinutes(createdAt: string | null | undefined, nowMs: number): number | null {
  if (!createdAt) {
    return null;
  }

  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((nowMs - createdAtMs) / 60_000));
}

export async function getAdminOperationalStatus(): Promise<AdminOperationalStatus> {
  const client = getOptionalServiceClient();
  const now = new Date();
  const nowMs = now.getTime();
  const delayThresholdIso = new Date(nowMs - WEBHOOK_DELAY_WARNING_MINUTES * 60_000).toISOString();

  if (!client) {
    return {
      pendingDataCount: 0,
      failedSyncCount: 0,
      delayedShopifyUpdateCount: 0,
      oldestShopifyUpdateAgeMinutes: null,
      attentionCount: 0,
      checkedAt: now.toISOString()
    };
  }

  const [
    pendingWebhookJobs,
    pendingShipmentJobs,
    pendingShipmentSyncs,
    failedWebhookJobs,
    failedShipmentJobs,
    failedShipmentSyncs,
    delayedShopifyUpdates,
    oldestShopifyUpdate
  ] = await Promise.all([
    resolveCount(
      client
        .from('webhook_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'running']),
      'pending webhook jobs'
    ),
    resolveCount(
      client
        .from('shipment_import_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'running']),
      'pending shipment jobs'
    ),
    resolveCount(
      client
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .in('sync_status', ['pending', 'processing']),
      'pending shipment syncs'
    ),
    resolveCount(
      client
        .from('webhook_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
      'failed webhook jobs'
    ),
    resolveCount(
      client
        .from('shipment_import_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
      'failed shipment jobs'
    ),
    resolveCount(
      client
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .eq('sync_status', 'error'),
      'failed shipment syncs'
    ),
    resolveCount(
      client
        .from('webhook_jobs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'running'])
        .lte('created_at', delayThresholdIso),
      'delayed Shopify updates'
    ),
    client
      .from('webhook_jobs')
      .select('created_at')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  if (oldestShopifyUpdate.error) {
    throw new Error('Failed to load oldest Shopify update');
  }

  const pendingDataCount = pendingWebhookJobs + pendingShipmentJobs + pendingShipmentSyncs;
  const failedSyncCount = failedWebhookJobs + failedShipmentJobs + failedShipmentSyncs;

  return {
    pendingDataCount,
    failedSyncCount,
    delayedShopifyUpdateCount: delayedShopifyUpdates,
    oldestShopifyUpdateAgeMinutes: resolveAgeMinutes(
      oldestShopifyUpdate.data?.created_at ?? null,
      nowMs
    ),
    attentionCount: failedSyncCount + delayedShopifyUpdates,
    checkedAt: now.toISOString()
  };
}
