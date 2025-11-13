import {
  claimWebhookJobs,
  markJobCompleted,
  markJobFailed,
  type WebhookJobRecord
} from '@/lib/data/webhook-jobs';
import { processShopifyWebhook } from '@/lib/shopify/webhook-processor';

const DEFAULT_MAX_ATTEMPTS = Number(process.env.WEBHOOK_JOB_MAX_ATTEMPTS ?? '5');

export type WebhookJobSummary = {
  claimed: number;
  succeeded: number;
  failed: number;
};

export async function processWebhookJobs(options?: { limit?: number; maxAttempts?: number }) {
  const limit = Math.max(1, Math.min(options?.limit ?? 5, 50));
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const jobs = await claimWebhookJobs(limit);
  const summary: WebhookJobSummary = {
    claimed: jobs.length,
    succeeded: 0,
    failed: 0
  };

  for (const job of jobs) {
    await handleJob(job, summary, maxAttempts);
  }

  return summary;
}

async function handleJob(job: WebhookJobRecord, summary: WebhookJobSummary, maxAttempts: number) {
  try {
    await processShopifyWebhook(job);
    await markJobCompleted(job.id);
    summary.succeeded += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while processing webhook job';
    const retryable = job.attempts < maxAttempts;
    await markJobFailed(job.id, message, { retryable });
    summary.failed += 1;
    console.error('Failed to process webhook job', {
      jobId: job.id,
      shop: job.shop_domain,
      topic: job.topic,
      attempts: job.attempts,
      retryable,
      error
    });
  }
}
