import { NextResponse } from 'next/server';
import { processWebhookJobs } from '@/lib/jobs/webhook-runner';
import {
  isAuthorizedInternalRequest,
  isExplicitInternalAuthBypassAllowed
} from '@/lib/security/internal-auth';

export const runtime = 'nodejs';

const JOB_WORKER_SECRET = process.env.JOB_WORKER_SECRET;

function isAuthorized(request: Request) {
  if (!JOB_WORKER_SECRET) {
    if (isExplicitInternalAuthBypassAllowed()) {
      console.warn('[webhook-jobs] JOB_WORKER_SECRET not set; allowing request because ALLOW_INSECURE_INTERNAL_ROUTES=true outside production.');
      return true;
    }
    console.error('[webhook-jobs] JOB_WORKER_SECRET is not configured; refusing request.');
    return false;
  }

  return isAuthorizedInternalRequest(request, JOB_WORKER_SECRET);
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

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
}

export async function POST(request: Request) {
  return handle(request);
}
