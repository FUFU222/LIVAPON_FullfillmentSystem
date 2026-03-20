jest.mock('@/lib/data/webhook-jobs', () => ({
  claimWebhookJobs: jest.fn(),
  markJobCompleted: jest.fn(),
  markJobFailed: jest.fn()
}));

jest.mock('@/lib/shopify/webhook-processor', () => ({
  processShopifyWebhook: jest.fn()
}));

import {
  claimWebhookJobs,
  markJobCompleted,
  markJobFailed
} from '@/lib/data/webhook-jobs';
import { processShopifyWebhook } from '@/lib/shopify/webhook-processor';
import { processWebhookJobs } from '@/lib/jobs/webhook-runner';

function createJob(overrides?: {
  id?: number;
  attempts?: number;
  shopDomain?: string;
  topic?: string;
}) {
  return {
    id: overrides?.id ?? 1,
    shop_domain: overrides?.shopDomain ?? 'example.myshopify.com',
    topic: overrides?.topic ?? 'orders/create',
    attempts: overrides?.attempts ?? 1,
    webhook_id: null,
    api_version: '2025-10',
    payload: { id: 1001, line_items: [] },
    status: 'running',
    locked_at: '2026-03-15T00:00:00.000Z',
    last_error: null,
    created_at: '2026-03-15T00:00:00.000Z',
    updated_at: '2026-03-15T00:00:00.000Z'
  };
}

describe('processWebhookJobs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (claimWebhookJobs as jest.Mock).mockResolvedValue([]);
    (processShopifyWebhook as jest.Mock).mockResolvedValue(undefined);
    (markJobCompleted as jest.Mock).mockResolvedValue(undefined);
    (markJobFailed as jest.Mock).mockResolvedValue(undefined);
  });

  it('claims jobs with a clamped limit and marks successful jobs completed', async () => {
    (claimWebhookJobs as jest.Mock).mockResolvedValue([createJob({ id: 10 })]);

    const summary = await processWebhookJobs({ limit: 99 });

    expect(claimWebhookJobs).toHaveBeenCalledWith(50);
    expect(processShopifyWebhook).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
    expect(markJobCompleted).toHaveBeenCalledWith(10);
    expect(markJobFailed).not.toHaveBeenCalled();
    expect(summary).toEqual({
      claimed: 1,
      succeeded: 1,
      failed: 0
    });
  });

  it('marks failures as retryable when attempts are below the max', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (claimWebhookJobs as jest.Mock).mockResolvedValue([createJob({ id: 11, attempts: 1 })]);
    (processShopifyWebhook as jest.Mock).mockRejectedValueOnce(new Error('temporary outage'));

    const summary = await processWebhookJobs({ limit: 1, maxAttempts: 3 });

    expect(markJobCompleted).not.toHaveBeenCalled();
    expect(markJobFailed).toHaveBeenCalledWith(11, 'temporary outage', { retryable: true });
    expect(summary).toEqual({
      claimed: 1,
      succeeded: 0,
      failed: 1
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to process webhook job',
      expect.objectContaining({
        jobId: 11,
        retryable: true
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('marks failures as terminal when attempts reached the max', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (claimWebhookJobs as jest.Mock).mockResolvedValue([createJob({ id: 12, attempts: 3 })]);
    (processShopifyWebhook as jest.Mock).mockRejectedValueOnce(new Error('permanent failure'));

    const summary = await processWebhookJobs({ limit: 1, maxAttempts: 3 });

    expect(markJobFailed).toHaveBeenCalledWith(12, 'permanent failure', { retryable: false });
    expect(summary).toEqual({
      claimed: 1,
      succeeded: 0,
      failed: 1
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to process webhook job',
      expect.objectContaining({
        jobId: 12,
        retryable: false
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('continues processing subsequent jobs after a failure', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = createJob({ id: 20, attempts: 1 });
    const second = createJob({ id: 21, attempts: 1, topic: 'orders/cancelled' });
    (claimWebhookJobs as jest.Mock).mockResolvedValue([first, second]);
    (processShopifyWebhook as jest.Mock)
      .mockRejectedValueOnce(new Error('first failed'))
      .mockResolvedValueOnce(undefined);

    const summary = await processWebhookJobs({ limit: 2, maxAttempts: 5 });

    expect(markJobFailed).toHaveBeenCalledWith(20, 'first failed', { retryable: true });
    expect(markJobCompleted).toHaveBeenCalledWith(21);
    expect(summary).toEqual({
      claimed: 2,
      succeeded: 1,
      failed: 1
    });

    consoleErrorSpy.mockRestore();
  });
});
