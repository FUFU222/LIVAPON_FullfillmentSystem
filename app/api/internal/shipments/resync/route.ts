import { NextResponse } from 'next/server';
import { resyncPendingShipments } from '@/lib/data/orders';
import {
  isAuthorizedInternalRequest,
  isExplicitInternalAuthBypassAllowed
} from '@/lib/security/internal-auth';

export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(request: Request) {
  if (!CRON_SECRET) {
    if (isExplicitInternalAuthBypassAllowed()) {
      console.warn('CRON_SECRET is not configured; allowing request because ALLOW_INSECURE_INTERNAL_ROUTES=true outside production.');
      return true;
    }
    console.error('CRON_SECRET is not configured; refusing request.');
    return false;
  }

  return isAuthorizedInternalRequest(request, CRON_SECRET);
}

async function handleRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limitValue = limitParam ? Number(limitParam) : undefined;
  const limit = Number.isFinite(limitValue ?? NaN) ? limitValue : undefined;

  try {
    const summary = await resyncPendingShipments({ limit });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error('Failed to resync pending shipments', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleRequest(request);
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: { Allow: 'POST' } });
}
