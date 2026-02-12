import { NextResponse } from 'next/server';
import { requireAuthContext, isAdmin } from '@/lib/auth';
import { getShipmentImportJobSummary } from '@/lib/data/shipment-import-jobs';
import { processShipmentImportJobById } from '@/lib/jobs/shipment-import-runner';

export const runtime = 'nodejs';
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const auth = await requireAuthContext();
  const jobId = Number(params.id);

  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  try {
    let summary = await getShipmentImportJobSummary(jobId, {
      vendorId: auth.vendorId,
      isAdmin: isAdmin(auth)
    });

    if (!summary) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!TERMINAL_STATUSES.has(summary.status)) {
      const itemLimit = parseLimit(
        process.env.SHIPMENT_JOB_POLL_ITEM_LIMIT,
        Number(process.env.SHIPMENT_JOB_ITEM_LIMIT ?? '50'),
        1,
        50
      );

      try {
        await processShipmentImportJobById(jobId, { itemLimit, orderLimit: 1 });
      } catch (error) {
        console.error('Failed to advance shipment job on status check', { jobId, error });
      }

      const refreshed = await getShipmentImportJobSummary(jobId, {
        vendorId: auth.vendorId,
        isAdmin: isAdmin(auth)
      });
      if (refreshed) {
        summary = refreshed;
      }
    }

    return NextResponse.json({ ok: true, job: summary }, { status: 200 });
  } catch (error) {
    console.error('Failed to load shipment job summary', { jobId, error });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

function parseLimit(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(min, Math.min(fallback, max));
  }
  return Math.max(min, Math.min(parsed, max));
}
