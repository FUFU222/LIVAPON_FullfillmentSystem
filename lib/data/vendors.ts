import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const serviceUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AnySupabaseClient = SupabaseClient<Database, any, any>;

const serviceClient: AnySupabaseClient | null = serviceUrl && serviceKey
  ? createClient<Database>(serviceUrl, serviceKey, {
      auth: {
        persistSession: false
      }
    })
  : null;

type VendorApplicationRecord = Database['public']['Tables']['vendor_applications']['Row'];

type VendorInsert = Database['public']['Tables']['vendors']['Insert'];

type MinimalVendor = {
  id: number;
  code: string | null;
  name: string;
  contact_email: string | null;
};

export type VendorProfile = {
  id: number;
  code: string | null;
  name: string;
  contactEmail: string | null;
};

export type VendorListEntry = VendorProfile & {
  createdAt: string | null;
  authUserId: string | null;
  hasAuthAccount: boolean;
};

export type VendorApplication = {
  authUserId: string | null;
  id: number;
  vendorCode: string | null;
  companyName: string;
  contactName: string | null;
  contactEmail: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  vendorId: number | null;
  reviewerId: string | null;
  reviewerEmail: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function assertServiceClient(): AnySupabaseClient {
  if (!serviceClient) {
    throw new Error('Supabase service client is not configured');
  }
  return serviceClient;
}

function sanitizeVendorCode(code: string | null | undefined): string | null {
  if (!code) {
    return null;
  }
  const normalized = code.trim();
  if (!/^\d{4}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function toVendorApplication(record: VendorApplicationRecord): VendorApplication {
  return {
    authUserId: record.auth_user_id,
    id: record.id,
    vendorCode: record.vendor_code,
    companyName: record.company_name,
    contactName: record.contact_name,
    contactEmail: record.contact_email,
    message: record.message,
    status: (record.status as VendorApplication['status']) ?? 'pending',
    notes: record.notes,
    vendorId: record.vendor_id,
    reviewerId: record.reviewer_id,
    reviewerEmail: record.reviewer_email,
    reviewedAt: record.reviewed_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

async function generateNextVendorCode(client: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await client
    .from('vendors')
    .select('code')
    .not('code', 'is', null)
    .order('code', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const latestCode = data?.[0]?.code;
  const numeric = Number(latestCode ?? '0');
  if (Number.isNaN(numeric)) {
    return '0001';
  }
  const next = numeric + 1;
  return next.toString().padStart(4, '0');
}

async function ensureVendor(
  client: SupabaseClient<Database>,
  params: {
    vendorId: number | null;
    vendorCode: string | null;
    companyName: string;
    contactEmail: string;
  }
): Promise<MinimalVendor> {
  if (params.vendorId) {
    const { data, error } = await client
      .from('vendors')
      .select('id, code, name, contact_email')
      .eq('id', params.vendorId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  const sanitizedCode = sanitizeVendorCode(params.vendorCode);

  if (sanitizedCode) {
    const { data: existingVendor, error: existingVendorError } = await client
      .from('vendors')
      .select('id, code, name, contact_email')
      .eq('code', sanitizedCode)
      .maybeSingle();

    if (existingVendorError) {
      throw existingVendorError;
    }

    if (existingVendor) {
      if (params.vendorId && existingVendor.id !== params.vendorId) {
        throw new Error('指定したベンダーコードは既に別のベンダーで使用されています');
      }
      if (!params.vendorId) {
        throw new Error('指定したベンダーコードは既に使用されています');
      }
      return existingVendor;
    }

    const insertPayload: VendorInsert = {
      code: sanitizedCode,
      name: params.companyName,
      contact_email: params.contactEmail
    };

    const { data: insertedVendor, error: insertError } = await client
      .from('vendors')
      .insert(insertPayload)
      .select('id, code, name, contact_email')
      .single();

    if (insertError) {
      throw insertError;
    }

    return insertedVendor;
  }

  const nextCode = await generateNextVendorCode(client);
  const insertPayload: VendorInsert = {
    code: nextCode,
    name: params.companyName,
    contact_email: params.contactEmail
  };

  const { data: newVendor, error: newVendorError } = await client
    .from('vendors')
    .insert(insertPayload)
      .select('id, code, name, contact_email')
    .single();

  if (newVendorError) {
    throw newVendorError;
  }

  return newVendor;
}

export async function createVendorApplication(
  input: {
    companyName: string;
    contactName?: string;
    contactEmail: string;
    message?: string;
    authUserId?: string | null;
  },
  clientOverride?: AnySupabaseClient
): Promise<VendorApplication> {
  const client = clientOverride ?? assertServiceClient();

  const normalizedEmail = input.contactEmail.trim().toLowerCase();

  const { data: existingPending, error: existingError } = await client
    .from('vendor_applications')
    .select('id, status')
    .eq('contact_email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingPending) {
    throw new Error('既に審査中の申請が存在します');
  }

  const insertPayload: Database['public']['Tables']['vendor_applications']['Insert'] = {
    auth_user_id: input.authUserId ?? null,
    vendor_code: null,
    company_name: input.companyName.trim(),
    contact_name: input.contactName?.trim() ?? null,
    contact_email: normalizedEmail,
    message: input.message?.trim() ?? null,
    status: 'pending'
  };

  const { data, error } = await client
    .from('vendor_applications')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return toVendorApplication(data);
}

export async function getPendingVendorApplications(): Promise<VendorApplication[]> {
  const client = assertServiceClient();

  const { data, error } = await client
    .from('vendor_applications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(toVendorApplication);
}

export async function getRecentVendorApplications(limit = 20): Promise<VendorApplication[]> {
  const client = assertServiceClient();

  const { data, error } = await client
    .from('vendor_applications')
    .select('*')
    .neq('status', 'pending')
    .order('reviewed_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(toVendorApplication);
}

export async function approveVendorApplication(params: {
  applicationId: number;
  reviewerId: string;
  reviewerEmail: string | null;
  vendorCode?: string | null;
  notes?: string | null;
}): Promise<{ vendorId: number; vendorCode: string }> {
  const client = assertServiceClient();

  const { data: application, error: fetchError } = await client
    .from('vendor_applications')
    .select('*')
    .eq('id', params.applicationId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!application) {
    throw new Error('申請が見つかりません');
  }

  if (application.status !== 'pending') {
    throw new Error('この申請は既に処理済みです');
  }

  const vendorCodeInput = sanitizeVendorCode(params.vendorCode ?? application.vendor_code);

  const vendor = await ensureVendor(client, {
    vendorId: application.vendor_id,
    vendorCode: vendorCodeInput ?? application.vendor_code,
    companyName: application.company_name,
    contactEmail: application.contact_email
  });

  if (application.auth_user_id) {
    try {
      await client.auth.admin.updateUserById(application.auth_user_id, {
        app_metadata: {
          role: 'vendor',
          vendor_id: vendor.id
        },
        user_metadata: {
          vendor_id: vendor.id
        }
      });
    } catch (updateAuthError) {
      console.error('Failed to update user metadata for vendor approval', updateAuthError);
      throw new Error('ユーザー情報の更新に失敗しました。時間をおいて再度お試しください。');
    }
  }

  const { error: updateApplicationError } = await client
    .from('vendor_applications')
    .update({
      status: 'approved',
      vendor_id: vendor.id,
      vendor_code: vendor.code,
      reviewed_at: new Date().toISOString(),
      reviewer_id: params.reviewerId,
      reviewer_email: params.reviewerEmail,
      notes: params.notes ?? null,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.applicationId);

  if (updateApplicationError) {
    throw updateApplicationError;
  }

  const { error: updateVendorError } = await client
    .from('vendors')
    .update({
      name: application.company_name,
      contact_email: application.contact_email
    })
    .eq('id', vendor.id);

  if (updateVendorError) {
    throw updateVendorError;
  }

  return {
    vendorId: vendor.id,
    vendorCode: vendor.code ?? ''
  };
}

export async function rejectVendorApplication(params: {
  applicationId: number;
  reviewerId: string;
  reviewerEmail: string | null;
  reason?: string | null;
}): Promise<void> {
  const client = assertServiceClient();

  const { data: application, error: fetchError } = await client
    .from('vendor_applications')
    .select('id, status')
    .eq('id', params.applicationId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!application) {
    throw new Error('申請が見つかりません');
  }

  if (application.status !== 'pending') {
    throw new Error('この申請は既に処理済みです');
  }

  const { error: updateError } = await client
    .from('vendor_applications')
    .update({
      status: 'rejected',
      notes: params.reason ?? null,
      reviewed_at: new Date().toISOString(),
      reviewer_id: params.reviewerId,
      reviewer_email: params.reviewerEmail,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.applicationId);

  if (updateError) {
    throw updateError;
  }
}

export async function getVendorProfile(vendorId: number): Promise<VendorProfile | null> {
  const client = assertServiceClient();

  const { data, error } = await client
    .from('vendors')
    .select('id, code, name, contact_email')
    .eq('id', vendorId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    contactEmail: data.contact_email
  };
}

async function resolveAuthStatus(
  client: AnySupabaseClient,
  vendors: Array<{
    id: number;
    code: string | null;
    name: string;
    contact_email: string | null;
    created_at: string | null;
    applications?: Array<{ auth_user_id: string | null }>;
  }>
): Promise<VendorListEntry[]> {
  return Promise.all(
    (vendors ?? []).map(async (vendor) => {
      const authUserId = Array.isArray(vendor.applications)
        ? vendor.applications.find((app) => app?.auth_user_id)?.auth_user_id ?? null
        : null;

      if (!authUserId) {
        return {
          id: vendor.id,
          code: vendor.code,
          name: vendor.name,
          contactEmail: vendor.contact_email,
          createdAt: vendor.created_at,
          authUserId: null,
          hasAuthAccount: false
        } satisfies VendorListEntry;
      }

      try {
        await client.auth.admin.getUserById(authUserId);
        return {
          id: vendor.id,
          code: vendor.code,
          name: vendor.name,
          contactEmail: vendor.contact_email,
          createdAt: vendor.created_at,
          authUserId,
          hasAuthAccount: true
        } satisfies VendorListEntry;
      } catch (_error) {
        return {
          id: vendor.id,
          code: vendor.code,
          name: vendor.name,
          contactEmail: vendor.contact_email,
          createdAt: vendor.created_at,
          authUserId,
          hasAuthAccount: false
        } satisfies VendorListEntry;
      }
    })
  );
}

export async function getRecentVendors(limit = 5): Promise<VendorListEntry[]> {
  const client = assertServiceClient();

  const { data, error } = await client
    .from('vendors')
    .select('id, code, name, contact_email, created_at, applications:vendor_applications(auth_user_id)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return resolveAuthStatus(client, data ?? []);
}

export async function getVendors(limit = 50): Promise<VendorListEntry[]> {
  const client = assertServiceClient();

  const { data, error } = await client
    .from('vendors')
    .select('id, code, name, contact_email, created_at, applications:vendor_applications(auth_user_id)')
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return resolveAuthStatus(client, data);
}

export async function deleteVendor(vendorId: number): Promise<void> {
  if (!Number.isInteger(vendorId) || vendorId <= 0) {
    throw new Error('有効なベンダーIDが必要です');
  }

  const client = assertServiceClient();

  const relatedTables: Array<{ table: keyof Database['public']['Tables']; label: string }> = [
    { table: 'orders', label: '注文' },
    { table: 'line_items', label: 'ラインアイテム' },
    { table: 'shipments', label: '出荷' },
    { table: 'vendor_skus', label: 'SKU' },
    { table: 'import_logs', label: 'インポートログ' }
  ];

  for (const entry of relatedTables) {
    const { count, error } = await client
      .from(entry.table)
      .select('id', { head: true, count: 'exact' })
      .eq('vendor_id', vendorId);

    if (error) {
      throw error;
    }

    if ((count ?? 0) > 0) {
      throw new Error(`${entry.label}に関連データが存在するため削除できません。`);
    }
  }

  const { error: detachApplicationsError } = await client
    .from('vendor_applications')
    .update({ vendor_id: null, vendor_code: null })
    .eq('vendor_id', vendorId);

  if (detachApplicationsError) {
    throw detachApplicationsError;
  }

  const { data, error } = await client
    .from('vendors')
    .delete()
    .eq('id', vendorId)
    .select('id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('指定したベンダーが見つかりません。');
  }
}
