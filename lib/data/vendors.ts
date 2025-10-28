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

type VendorRecord = Database['public']['Tables']['vendors']['Row'];

type MinimalVendor = {
  id: number;
  code: string | null;
  name: string;
  contact_email: string | null;
  contact_name: string | null;
};

type VendorDetailRecord = VendorRecord & {
  vendor_applications?: VendorApplicationRecord[] | null;
};

export type VendorProfile = {
  id: number;
  code: string | null;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
};

export type VendorListEntry = VendorProfile & {
  createdAt: string | null;
  lastApplication: {
    id: number;
    status: VendorApplication['status'];
    reviewedAt: string | null;
    reviewerEmail: string | null;
    authUserId: string | null;
    companyName: string | null;
  } | null;
};

export type VendorSummaryMetrics = {
  orderCount: number;
  shipmentCount: number;
  skuCount: number;
};

export type VendorDetail = VendorProfile & {
  createdAt: string | null;
  summary: VendorSummaryMetrics;
  applications: Array<{
    id: number;
    status: VendorApplication['status'];
    companyName: string;
    contactName: string | null;
    contactEmail: string;
    message: string | null;
    reviewerEmail: string | null;
    reviewedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    notes: string | null;
  }>;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

async function deleteAuthUsers(client: AnySupabaseClient, authUserIds: string[]) {
  const uniqueIds = Array.from(new Set(authUserIds.filter(isNonEmptyString)));

  for (const userId of uniqueIds) {
    const { error } = await client.auth.admin.deleteUser(userId);

    if (error && error.status !== 404) {
      console.error('Failed to delete Supabase auth user', { userId, error });
      throw error;
    }
  }
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

async function countRelatedRows(
  client: AnySupabaseClient,
  table: keyof Database['public']['Tables'],
  vendorId: number
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('id', { head: true, count: 'exact' })
    .eq('vendor_id', vendorId);

  if (error) {
    console.error(`Failed to count ${String(table)} for vendor`, { vendorId, error });
    return 0;
  }

  return count ?? 0;
}

export async function getVendorDetailForAdmin(vendorId: number): Promise<VendorDetail | null> {
  if (!Number.isInteger(vendorId) || vendorId <= 0) {
    throw new Error('有効なベンダーIDが必要です');
  }

  const client = serviceClient;

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('vendors')
    .select(
      `id, code, name, contact_email, contact_name, created_at,
       vendor_applications:vendor_applications(
         id, status, company_name, contact_name, contact_email, message,
         reviewer_email, reviewed_at, created_at, updated_at, notes
       )`
    )
    .eq('id', vendorId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load vendor detail', error);
    return null;
  }

  if (!data) {
    return null;
  }

  const record = data as VendorDetailRecord;

  const applications = Array.isArray(record.vendor_applications)
    ? record.vendor_applications.map((application) => ({
        id: application.id,
        status: (application.status as VendorApplication['status']) ?? 'pending',
        companyName: application.company_name,
        contactName: application.contact_name,
        contactEmail: application.contact_email,
        message: application.message,
        reviewerEmail: application.reviewer_email,
        reviewedAt: application.reviewed_at,
        createdAt: application.created_at,
        updatedAt: application.updated_at,
        notes: application.notes ?? null
      }))
    : [];

  applications.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const [orderCount, shipmentCount, skuCount] = await Promise.all([
    countRelatedRows(client, 'orders', vendorId),
    countRelatedRows(client, 'shipments', vendorId),
    countRelatedRows(client, 'vendor_skus', vendorId)
  ]);

  const summary: VendorSummaryMetrics = {
    orderCount,
    shipmentCount,
    skuCount
  };

  return {
    id: record.id,
    code: record.code,
    name: record.name,
    contactName: record.contact_name ?? null,
    contactEmail: record.contact_email ?? null,
    createdAt: record.created_at ?? null,
    summary,
    applications
  } satisfies VendorDetail;
}

async function ensureVendor(
  client: SupabaseClient<Database>,
  params: {
    vendorId: number | null;
    vendorCode: string | null;
    companyName: string;
    contactEmail: string;
    contactName?: string | null;
  }
): Promise<MinimalVendor> {
  if (params.vendorId) {
    const { data, error } = await client
      .from('vendors')
      .select('id, code, name, contact_email, contact_name')
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
      .select('id, code, name, contact_email, contact_name')
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
      contact_email: params.contactEmail,
      contact_name: params.contactName?.trim() ?? null
    };

    const { data: insertedVendor, error: insertError } = await client
      .from('vendors')
      .insert(insertPayload)
      .select('id, code, name, contact_email, contact_name')
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
    contact_email: params.contactEmail,
    contact_name: params.contactName?.trim() ?? null
  };

  const { data: newVendor, error: newVendorError } = await client
    .from('vendors')
    .insert(insertPayload)
    .select('id, code, name, contact_email, contact_name')
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
    contactEmail: application.contact_email,
    contactName: application.contact_name
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
      contact_email: application.contact_email,
      contact_name: application.contact_name
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
    .select('id, code, name, contact_email, contact_name')
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
    contactName: data.contact_name,
    contactEmail: data.contact_email
  };
}

type VendorWithApplications = {
  id: number;
  code: string | null;
  name: string;
  contact_email: string | null;
  contact_name: string | null;
  created_at: string | null;
  vendor_applications?: Array<{
    id: number;
    status: string | null;
    reviewed_at: string | null;
    reviewer_email: string | null;
    auth_user_id: string | null;
    company_name: string | null;
    created_at: string | null;
  }>;
};

function pickLatestApplication(
  applications: VendorWithApplications['vendor_applications']
): VendorListEntry['lastApplication'] {
  if (!Array.isArray(applications) || applications.length === 0) {
    return null;
  }

  let latest = applications[0] ?? null;

  for (let index = 1; index < applications.length; index += 1) {
    const current = applications[index];
    if (!current) {
      continue;
    }

    const latestTimestamp = latest?.reviewed_at ?? latest?.created_at ?? '';
    const currentTimestamp = current.reviewed_at ?? current.created_at ?? '';

    if (currentTimestamp > latestTimestamp) {
      latest = current;
    }
  }

  if (!latest) {
    return null;
  }

  return {
    id: latest.id,
    status: (latest.status as VendorApplication['status']) ?? 'pending',
    reviewedAt: latest.reviewed_at,
    reviewerEmail: latest.reviewer_email,
    authUserId: latest.auth_user_id,
    companyName: latest.company_name
  } satisfies VendorListEntry['lastApplication'];
}

function mapVendorsWithApplications(
  rows: VendorWithApplications[]
): VendorListEntry[] {
  return (rows ?? []).map((vendor) => {
    const lastApplication = pickLatestApplication(vendor.vendor_applications);

    return {
      id: vendor.id,
      code: vendor.code,
      name: lastApplication?.companyName ?? vendor.name,
      contactName: vendor.contact_name,
      contactEmail: vendor.contact_email,
      createdAt: vendor.created_at,
      lastApplication
    } satisfies VendorListEntry;
  });
}

export async function getRecentVendors(limit = 5): Promise<VendorListEntry[]> {
  const client = assertServiceClient();

  const { data, error } = await client
    .from('vendors')
    .select(
      `id, code, name, contact_email, contact_name, created_at,
       vendor_applications:vendor_applications(
         id, status, reviewed_at, reviewer_email, auth_user_id, company_name, created_at
       )`
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return mapVendorsWithApplications((data as VendorWithApplications[]) ?? []);
}

export async function getVendors(limit = 50): Promise<VendorListEntry[]> {
  const client = assertServiceClient();

  const { data, error } = await client
    .from('vendors')
    .select(
      `id, code, name, contact_email, contact_name, created_at,
       vendor_applications:vendor_applications(
         id, status, reviewed_at, reviewer_email, auth_user_id, company_name, created_at
       )`
    )
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return mapVendorsWithApplications((data as VendorWithApplications[]) ?? []);
}

export async function deleteVendor(vendorId: number): Promise<void> {
  if (!Number.isInteger(vendorId) || vendorId <= 0) {
    throw new Error('有効なベンダーIDが必要です');
  }

  const client = assertServiceClient();

  const { data: vendorRecord, error: fetchVendorError } = await client
    .from('vendors')
    .select('id, code')
    .eq('id', vendorId)
    .maybeSingle();

  if (fetchVendorError) {
    throw fetchVendorError;
  }

  if (!vendorRecord) {
    throw new Error('指定したベンダーが見つかりません。');
  }

  const applicationRows: Array<{ id: number; auth_user_id: string | null }> = [];

  const { data: applicationsByVendor, error: applicationsByVendorError } = await client
    .from('vendor_applications')
    .select('id, auth_user_id')
    .eq('vendor_id', vendorId);

  if (applicationsByVendorError) {
    throw applicationsByVendorError;
  }

  if (applicationsByVendor) {
    applicationRows.push(...applicationsByVendor);
  }

  if (isNonEmptyString(vendorRecord.code)) {
    const { data: applicationsByCode, error: applicationsByCodeError } = await client
      .from('vendor_applications')
      .select('id, auth_user_id')
      .eq('vendor_code', vendorRecord.code);

    if (applicationsByCodeError) {
      throw applicationsByCodeError;
    }

    if (applicationsByCode) {
      applicationRows.push(...applicationsByCode);
    }
  }

  const applicationIds = Array.from(new Set(applicationRows.map((row) => row.id)));
  const authUserIds = applicationRows
    .map((row) => row.auth_user_id)
    .filter(isNonEmptyString);

  const relatedTables: Array<{ table: keyof Database['public']['Tables']; label: string; strategy: 'block' | 'purge' }> = [
    { table: 'orders', label: '注文', strategy: 'block' },
    { table: 'line_items', label: 'ラインアイテム', strategy: 'block' },
    { table: 'shipments', label: '出荷', strategy: 'block' },
    { table: 'vendor_skus', label: 'SKU', strategy: 'purge' },
    { table: 'import_logs', label: 'インポートログ', strategy: 'purge' }
  ];

  for (const entry of relatedTables) {
    const { count, error } = await client
      .from(entry.table)
      .select('id', { head: true, count: 'exact' })
      .eq('vendor_id', vendorId);

    if (error) {
      throw error;
    }

    const total = count ?? 0;

    if (total === 0) {
      continue;
    }

    if (entry.strategy === 'purge') {
      const { error: purgeError } = await client
        .from(entry.table)
        .delete()
        .eq('vendor_id', vendorId);

      if (purgeError) {
        throw purgeError;
      }
    } else {
      throw new Error(`${entry.label}に関連データが存在するため削除できません。`);
    }
  }

  if (authUserIds.length > 0) {
    await deleteAuthUsers(client, authUserIds);
  }

  if (applicationIds.length > 0) {
    const { error: deleteApplicationsError } = await client
      .from('vendor_applications')
      .delete()
      .in('id', applicationIds);

    if (deleteApplicationsError) {
      throw deleteApplicationsError;
    }
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
