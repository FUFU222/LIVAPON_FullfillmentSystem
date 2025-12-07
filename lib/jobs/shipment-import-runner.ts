import { upsertShipment, prepareShipmentBatch, type ShipmentSelection } from '@/lib/data/orders';
import {
  claimShipmentImportJobs,
  loadPendingJobItems,
  incrementJobItemAttempts,
  markJobItemsResult,
  updateShipmentJobProgress,
  countPendingJobItems,
  type ShipmentImportJob,
  type ShipmentImportJobItem
} from '@/lib/data/shipment-import-jobs';

export type ShipmentJobProcessSummary = {
  claimed: number;
  succeeded: number;
  failed: number;
  requeued: number;
  jobs: Array<{
    jobId: number;
    processed: number;
    failed: number;
    remaining: number;
    status: string;
  }>;
};

const DEFAULT_JOB_LIMIT = Number(process.env.SHIPMENT_JOB_LIMIT ?? '1');
const DEFAULT_ITEM_LIMIT = Number(process.env.SHIPMENT_JOB_ITEM_LIMIT ?? '50');

export async function processShipmentImportJobs(options?: { jobLimit?: number; itemLimit?: number }) {
  const jobLimit = clamp(options?.jobLimit ?? DEFAULT_JOB_LIMIT, 1, 5);
  const itemLimit = clamp(options?.itemLimit ?? DEFAULT_ITEM_LIMIT, 1, 100);
  const jobs = await claimShipmentImportJobs(jobLimit);
  const summary: ShipmentJobProcessSummary = {
    claimed: jobs.length,
    succeeded: 0,
    failed: 0,
    requeued: 0,
    jobs: []
  };

  for (const initialJob of jobs) {
    const result = await handleSingleJob(initialJob, itemLimit);
    summary.jobs.push(result);
    if (result.status === 'succeeded') {
      summary.succeeded += 1;
    } else if (result.status === 'failed') {
      summary.failed += 1;
    } else {
      summary.requeued += 1;
    }
  }

  return summary;
}

async function handleSingleJob(job: ShipmentImportJob, itemLimit: number) {
  if (!Number.isInteger(job.vendor_id)) {
    job = await updateShipmentJobProgress(job, {
      status: 'failed',
      lastError: 'Vendor context is missing for this shipment job'
    });
    return {
      jobId: job.id,
      processed: 0,
      failed: 0,
      remaining: job.total_count - job.processed_count - job.error_count,
      status: job.status
    };
  }

  const pendingItems = await loadPendingJobItems(job.id, { limit: itemLimit });

  if (pendingItems.length === 0) {
    const remaining = await countPendingJobItems(job.id);
    const nextStatus = remaining > 0
      ? 'pending'
      : job.error_count > 0
        ? 'failed'
        : 'succeeded';
    job = await updateShipmentJobProgress(job, {
      status: nextStatus,
      unlock: nextStatus === 'pending'
    });
    return {
      jobId: job.id,
      processed: 0,
      failed: 0,
      remaining: job.total_count - job.processed_count - job.error_count,
      status: job.status
    };
  }

  await incrementJobItemAttempts(pendingItems);

  let processedCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;

  const invalidItems = pendingItems.filter((item) => !Number.isInteger(item.order_id) || !Number.isInteger(item.line_item_id));
  if (invalidItems.length > 0) {
    failedCount += invalidItems.length;
    await markJobItemsResult(
      invalidItems.map((item) => item.id),
      'failed',
      { errorMessage: '注文またはラインアイテムの情報が不足しています' }
    );
  }
  const invalidIds = new Set(invalidItems.map((item) => item.id));
  const byOrder = groupItemsByOrder(pendingItems.filter((item) => !invalidIds.has(item.id)));

  for (const [orderId, items] of byOrder.entries()) {
    const selections: ShipmentSelection[] = items.map((item) => ({
      orderId,
      lineItemId: item.line_item_id as number,
      quantity: item.quantity ?? undefined
    }));

    try {
      const plan = await prepareShipmentBatch({
        vendorId: job.vendor_id as number,
        orderId,
        selections
      });

      if (!plan) {
        failedCount += items.length;
        await markJobItemsResult(
          items.map((item) => item.id),
          'failed',
          { errorMessage: '発送できる明細が見つかりませんでした' }
        );
        lastError = '発送できる明細が見つかりませんでした';
        continue;
      }

      await upsertShipment(
        {
          lineItemIds: plan.lineItemIds,
          lineItemQuantities: plan.lineItemQuantities,
          trackingNumber: job.tracking_number,
          carrier: job.carrier,
          status: 'shipped'
        },
        job.vendor_id as number
      );

      processedCount += items.length;
      await markJobItemsResult(items.map((item) => item.id), 'succeeded');
    } catch (error) {
      failedCount += items.length;
      const message = normalizeError(error);
      await markJobItemsResult(
        items.map((item) => item.id),
        'failed',
        { errorMessage: message }
      );
      lastError = message;
    }
  }

  const remainingAfterSlice = await countPendingJobItems(job.id);
  const hasMore = remainingAfterSlice > 0;
  const nextStatus = hasMore
    ? 'pending'
    : job.error_count + failedCount > 0
      ? 'failed'
      : 'succeeded';

  job = await updateShipmentJobProgress(job, {
    processedDelta: processedCount,
    errorDelta: failedCount,
    status: nextStatus,
    lastError: failedCount > 0 ? lastError ?? '発送登録に失敗しました' : undefined,
    unlock: hasMore
  });

  return {
    jobId: job.id,
    processed: processedCount,
    failed: failedCount,
    remaining: job.total_count - job.processed_count - job.error_count,
    status: job.status
  };
}

function groupItemsByOrder(items: ShipmentImportJobItem[]): Map<number, ShipmentImportJobItem[]> {
  const map = new Map<number, ShipmentImportJobItem[]>();
  items.forEach((item) => {
    if (!Number.isInteger(item.order_id)) {
      return;
    }
    const orderId = item.order_id as number;
    const existing = map.get(orderId) ?? [];
    existing.push(item);
    map.set(orderId, existing);
  });
  return map;
}

function clamp(value: number, min: number, max: number) {
  const safe = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, safe));
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return truncate(error.message, 240);
  }
  if (typeof error === 'string') {
    return truncate(error, 240);
  }
  try {
    return truncate(JSON.stringify(error), 240);
  } catch {
    return '不明なエラーが発生しました';
  }
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
