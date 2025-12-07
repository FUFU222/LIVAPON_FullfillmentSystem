import { NextResponse } from 'next/server';
import { requireAuthContext, isAdmin } from '@/lib/auth';
import { getShipmentImportJobSummary } from '@/lib/data/shipment-import-jobs';

export const runtime = 'nodejs';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const auth = await requireAuthContext();
  const jobId = Number(params.id);

  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
  }

  try {
    const summary = await getShipmentImportJobSummary(jobId, {
      vendorId: auth.vendorId,
      isAdmin: isAdmin(auth)
    });

    if (!summary) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, job: summary }, { status: 200 });
  } catch (error) {
    console.error('Failed to load shipment job summary', { jobId, error });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
