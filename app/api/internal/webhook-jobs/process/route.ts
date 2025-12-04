import { NextResponse } from 'next/server';
import { processWebhookJobs } from '@/lib/jobs/webhook-runner';

export const runtime = 'nodejs';

const JOB_WORKER_SECRET = process.env.JOB_WORKER_SECRET;

function isAuthorized(request: Request) {
  if (!JOB_WORKER_SECRET) {
    console.warn('[webhook-jobs] JOB_WORKER_SECRET not set; allowing request (development only).');
    return process.env.NODE_ENV !== 'production';
  }

  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : null;
  return token === JOB_WORKER_SECRET;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limitValue = limitParam ? Number(limitParam) : undefined;
  const limit = Number.isFinite(limitValue ?? NaN) ? limitValue : undefined;

  try {
    const summary = await processWebhookJobs({ limit });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('Failed to process webhook jobs', { error });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
