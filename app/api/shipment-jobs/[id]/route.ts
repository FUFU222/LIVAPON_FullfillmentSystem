import { NextResponse } from 'next/server';
import { requireAuthContext, isAdmin } from '@/lib/auth';
import { getShipmentImportJobSummary } from '@/lib/data/shipment-import-jobs';
import { processShipmentImportJobById } from '@/lib/jobs/shipment-import-runner';
import { isSameOriginRequest } from '@/lib/security/csrf';

export const runtime = 'nodejs';
const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);
type RouteContext = { params: Promise<{ id: string }> };
type AuthContext = Awaited<ReturnType<typeof requireAuthContext>>;

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAuthContext();
  const jobId = await resolveJobId(context);

  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  try {
    const summary = await loadSummary(jobId, auth);

    if (!summary) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, job: summary }, { status: 200 });
  } catch (error) {
    console.error('Failed to load shipment job summary', { jobId, error });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const auth = await requireAuthContext();
  const jobId = await resolveJobId(context);

  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  try {
    let summary = await loadSummary(jobId, auth);

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
        console.error('Failed to advance shipment job on process request', { jobId, error });
      }

      const refreshed = await loadSummary(jobId, auth);
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

async function resolveJobId(context: RouteContext): Promise<number> {
  const params = await context.params;
  return Number(params.id);
}

async function loadSummary(jobId: number, auth: AuthContext) {
  return getShipmentImportJobSummary(jobId, {
    vendorId: auth.vendorId,
    isAdmin: isAdmin(auth)
  });
}
