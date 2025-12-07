import { NextResponse } from 'next/server';
import { processShipmentImportJobs } from '@/lib/jobs/shipment-import-runner';

export const runtime = 'nodejs';

const AUTH_TOKEN = process.env.CRON_SECRET ?? process.env.JOB_WORKER_SECRET ?? null;

function isAuthorized(request: Request) {
  if (!AUTH_TOKEN) {
    console.warn('[shipment-jobs] CRON_SECRET not configured; allowing request in non-production mode');
    return process.env.NODE_ENV !== 'production';
  }
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : null;
  return token === AUTH_TOKEN;
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
  const jobLimit = parseLimit(url.searchParams.get('jobs'), Number(process.env.SHIPMENT_JOB_LIMIT ?? '1'), 1, 5);
  const itemLimit = parseLimit(url.searchParams.get('items'), Number(process.env.SHIPMENT_JOB_ITEM_LIMIT ?? '50'), 1, 100);

  try {
    const summary = await processShipmentImportJobs({ jobLimit, itemLimit });
    return NextResponse.json({ ok: true, summary }, { status: 200 });
  } catch (error) {
    console.error('Failed to process shipment import jobs', { error });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
