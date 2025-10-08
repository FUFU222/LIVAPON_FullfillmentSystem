import { getAuthContext, isAdmin } from '@/lib/auth';
import { getVendors } from '@/lib/data/vendors';

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function GET() {
  const auth = await getAuthContext();

  if (!auth || !isAdmin(auth)) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const vendors = await getVendors(1000);
  const header = [
    'id',
    'code',
    'name',
    'contact_email',
    'status',
    'reviewed_at',
    'reviewer_email',
    'auth_user_id',
    'created_at'
  ];

  const rows = vendors.map((vendor) => [
    vendor.id,
    vendor.code ?? '',
    vendor.name,
    vendor.contactEmail ?? '',
    vendor.lastApplication?.status ?? '',
    vendor.lastApplication?.reviewedAt ?? '',
    vendor.lastApplication?.reviewerEmail ?? '',
    vendor.lastApplication?.authUserId ?? '',
    vendor.createdAt ?? ''
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => toCsvValue(value)).join(','))
    .join('\n');

  const filename = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
