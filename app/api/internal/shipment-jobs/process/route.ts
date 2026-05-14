import { NextResponse } from 'next/server';
import { processShipmentImportJobs } from '@/lib/jobs/shipment-import-runner';
import {
  isAuthorizedInternalRequest,
  isExplicitInternalAuthBypassAllowed
} from '@/lib/security/internal-auth';

export const runtime = 'nodejs';

const AUTH_TOKEN = process.env.CRON_SECRET ?? process.env.JOB_WORKER_SECRET ?? null;

function isAuthorized(request: Request) {
  if (!AUTH_TOKEN) {
    if (isExplicitInternalAuthBypassAllowed()) {
      console.warn('[shipment-jobs] CRON_SECRET/JOB_WORKER_SECRET not configured; allowing request because ALLOW_INSECURE_INTERNAL_ROUTES=true outside production.');
      return true;
    }
    console.error('[shipment-jobs] CRON_SECRET/JOB_WORKER_SECRET is not configured; refusing request.');
    return false;
  }

  return isAuthorizedInternalRequest(request, AUTH_TOKEN);
}

function parseLimit(value: string | null, defaultValue: number, min: number, max: number) {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, parsed));
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const jobLimit = parseLimit(
    url.searchParams.get('jobs') ?? url.searchParams.get('limit'),
    Number(process.env.SHIPMENT_JOB_LIMIT ?? '1'),
    1,
    5
  );
  const itemLimit = parseLimit(url.searchParams.get('items'), Number(process.env.SHIPMENT_JOB_ITEM_LIMIT ?? '50'), 1, 100);

  try {
    const summary = await processShipmentImportJobs({ jobLimit, itemLimit });
    return NextResponse.json({ ok: true, summary }, { status: 200 });
  } catch (error) {
    console.error('Failed to process shipment import jobs', { error });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(request: Request) {
  return handle(request);
}
