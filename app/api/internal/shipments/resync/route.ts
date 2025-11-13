import { NextResponse } from 'next/server';
import { resyncPendingShipments } from '@/lib/data/orders';

const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(request: Request) {
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRON_SECRET is not configured; refusing request.');
      return false;
    }
    console.warn('CRON_SECRET is not configured; allowing request in non-production environment.');
    return true;
  }

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null;

  return token === CRON_SECRET;
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

export async function GET(request: Request) {
  return handleRequest(request);
}
