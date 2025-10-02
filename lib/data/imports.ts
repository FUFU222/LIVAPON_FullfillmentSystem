import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = serviceUrl && serviceKey
  ? createClient<Database>(serviceUrl, serviceKey, {
      auth: { persistSession: false }
    })
  : null;

export type CsvRow = {
  orderNumber: string;
  lineItemId: number;
  trackingNumber: string;
  carrier: string;
};

export async function recordImportLog(
  vendorId: number | null,
  fileName: string,
  status: 'pending' | 'success' | 'failed',
  errorMessage?: string
) {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }

  const payload: Database['public']['Tables']['import_logs']['Insert'] = {
    vendor_id: vendorId,
    file_name: fileName,
    status,
    error_message: errorMessage ?? null
  };

  const { error } = await (serviceClient as any)
    .from('import_logs')
    .insert(payload);

  if (error) {
    throw error;
  }
}
