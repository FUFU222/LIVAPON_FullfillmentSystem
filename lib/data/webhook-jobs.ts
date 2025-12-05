import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/types';
import { getShopifyServiceClient } from '@/lib/shopify/service-client';

export type WebhookJobRecord = Database['public']['Tables']['webhook_jobs']['Row'];

type EnqueuePayload = {
  shopDomain: string;
  topic: string;
  apiVersion?: string | null;
  webhookId?: string | null;
  payload: Json;
};

function assertServiceClient(): SupabaseClient<Database> {
  return getShopifyServiceClient();
}

export async function enqueueWebhookJob(data: EnqueuePayload): Promise<WebhookJobRecord> {
  const client = assertServiceClient();
  if (data.webhookId) {
    const existing = await findJobByWebhookId(client, data.webhookId);
    if (existing) {
      console.info('Webhook job already enqueued/processed. Skipping duplicate.', {
        webhookId: data.webhookId,
        status: existing.status
      });
      return existing;
    }
  }
  const payload: Database['public']['Tables']['webhook_jobs']['Insert'] = {
    shop_domain: data.shopDomain,
    topic: data.topic,
    api_version: data.apiVersion ?? null,
    webhook_id: data.webhookId ?? null,
    payload: data.payload,
    status: 'pending'
  };

  const { data: inserted, error } = await client
    .from('webhook_jobs')
    .insert(payload)
    .select()
    .single();

  if (error || !inserted) {
    if (data.webhookId && error && (error as { code?: string }).code === '23505') {
      const existing = await findJobByWebhookId(client, data.webhookId);
      if (existing) {
        console.info('Webhook job insert hit unique constraint; returning existing job.', {
          webhookId: data.webhookId,
          status: existing.status
        });
        return existing;
      }
    }
    throw error || new Error('Failed to enqueue webhook job');
  }

  return inserted;
}

export async function claimWebhookJobs(limit: number): Promise<WebhookJobRecord[]> {
  const client = assertServiceClient();
  const { data, error } = await client.rpc('claim_pending_webhook_jobs', {
    batch_limit: limit
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function markJobCompleted(jobId: number) {
  const client = assertServiceClient();
  const { error } = await client
    .from('webhook_jobs')
    .update({ status: 'completed', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    throw error;
  }
}

export async function markJobFailed(jobId: number, errorMessage: string, options?: { retryable?: boolean }) {
  const client = assertServiceClient();
  const nextStatus = options?.retryable === false ? 'failed' : 'pending';
  const { error } = await client
    .from('webhook_jobs')
    .update({
      status: nextStatus,
      last_error: errorMessage,
      locked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    throw error;
  }
}

async function findJobByWebhookId(
  client: SupabaseClient<Database>,
  webhookId: string
): Promise<WebhookJobRecord | null> {
  const { data, error } = await client
    .from('webhook_jobs')
    .select('*')
    .eq('webhook_id', webhookId)
    .maybeSingle();

  if (error && (error as { code?: string }).code !== 'PGRST116') {
    throw error;
  }

  return data ?? null;
}
