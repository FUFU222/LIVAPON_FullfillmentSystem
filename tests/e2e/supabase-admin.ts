import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getCredentials, type E2ERole } from './fixtures';

type ServiceClient = SupabaseClient<Database>;
type VendorRow = Database['public']['Tables']['vendors']['Row'];
type ShipmentAdjustmentInsert = Database['public']['Tables']['shipment_adjustment_requests']['Insert'];
type VendorApplicationInsert = Database['public']['Tables']['vendor_applications']['Insert'];
type LineItemRow = Database['public']['Tables']['line_items']['Row'];
type ShipmentRow = Database['public']['Tables']['shipments']['Row'];

type VendorContext = {
  email: string;
  userId: string;
  vendorId: number;
  userMetadata: Record<string, unknown>;
  vendor: VendorRow;
};

export type VendorProfileSnapshot = VendorContext;

export type SeededShipmentAdjustmentRequest = {
  requestId: number;
  vendorId: number;
  issueSummary: string;
  desiredChange: string;
  orderNumber: string;
};

export type SeededPendingVendorApplication = {
  applicationId: number;
  userId: string;
  email: string;
  password: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
};

export type RealtimeLineItemFixture = Pick<LineItemRow, 'id' | 'order_id' | 'vendor_id' | 'last_updated_source'>;
export type RealtimeShipmentFixture = Pick<ShipmentRow, 'id' | 'order_id' | 'vendor_id' | 'last_updated_source'>;

let serviceClient: ServiceClient | null = null;

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getServiceClient() {
  if (serviceClient) {
    return serviceClient;
  }

  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.E2E_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error('SUPABASE url/service role env is missing for E2E cleanup');
  }

  serviceClient = createClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return serviceClient;
}

function extractVendorId(user: User): number {
  const candidates = [
    user.app_metadata?.vendor_id,
    user.app_metadata?.vendorId,
    user.user_metadata?.vendor_id,
    user.user_metadata?.vendorId
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  throw new Error(`No vendor_id found in auth metadata for ${user.email ?? user.id}`);
}

async function findAuthUserByEmail(email: string) {
  const client = getServiceClient();
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const matched = users.find((user) => (user.email ?? '').trim().toLowerCase() === normalized);
    if (matched) {
      return matched;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  throw new Error(`Auth user not found for ${email}`);
}

export async function getVendorContext(role: E2ERole): Promise<VendorContext> {
  const credentials = getCredentials(role);
  if (!credentials) {
    throw new Error(`Missing E2E credentials for ${role}`);
  }

  const client = getServiceClient();
  const user = await findAuthUserByEmail(credentials.email);
  const vendorId = extractVendorId(user);
  const { data: vendor, error } = await client.from('vendors').select('*').eq('id', vendorId).single();

  if (error) {
    throw error;
  }

  return {
    email: credentials.email,
    userId: user.id,
    vendorId,
    userMetadata: { ...(user.user_metadata ?? {}) },
    vendor
  };
}

export async function findLineItemForRole(input: { role: E2ERole; orderNumber?: string | null }) {
  const context = await getVendorContext(input.role);
  const client = getServiceClient();

  let query = client
    .from('line_items')
    .select('id, order_id, vendor_id, last_updated_source')
    .eq('vendor_id', context.vendorId)
    .limit(1);

  if (input.orderNumber) {
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id')
      .eq('order_number', input.orderNumber)
      .limit(1)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!order) {
      return null;
    }

    query = client
      .from('line_items')
      .select('id, order_id, vendor_id, last_updated_source')
      .eq('vendor_id', context.vendorId)
      .eq('order_id', order.id)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }
  return data as RealtimeLineItemFixture | null;
}

export async function touchLineItemSource(input: { lineItemId: number; source: string }) {
  const client = getServiceClient();
  const { error } = await client
    .from('line_items')
    .update({ last_updated_source: input.source })
    .eq('id', input.lineItemId);

  if (error) {
    throw error;
  }
}

export async function findShipmentForRole(input: { role: E2ERole; orderNumber?: string | null }) {
  const context = await getVendorContext(input.role);
  const client = getServiceClient();

  let query = client
    .from('shipments')
    .select('id, order_id, vendor_id, last_updated_source')
    .eq('vendor_id', context.vendorId)
    .limit(1);

  if (input.orderNumber) {
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id')
      .eq('order_number', input.orderNumber)
      .limit(1)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!order) {
      return null;
    }

    query = client
      .from('shipments')
      .select('id, order_id, vendor_id, last_updated_source')
      .eq('vendor_id', context.vendorId)
      .eq('order_id', order.id)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }
  return data as RealtimeShipmentFixture | null;
}

export async function touchShipmentSource(input: { shipmentId: number; source: string }) {
  const client = getServiceClient();
  const { error } = await client
    .from('shipments')
    .update({ last_updated_source: input.source })
    .eq('id', input.shipmentId);

  if (error) {
    throw error;
  }
}

export async function snapshotVendorProfile(role: E2ERole): Promise<VendorProfileSnapshot> {
  return getVendorContext(role);
}

export async function restoreVendorProfile(snapshot: VendorProfileSnapshot) {
  const client = getServiceClient();

  const { error: vendorError } = await client
    .from('vendors')
    .update({
      name: snapshot.vendor.name,
      contact_email: snapshot.vendor.contact_email,
      contact_name: snapshot.vendor.contact_name,
      contact_phone: snapshot.vendor.contact_phone,
      notify_new_orders: snapshot.vendor.notify_new_orders
    })
    .eq('id', snapshot.vendorId);

  if (vendorError) {
    throw vendorError;
  }

  const { error: authError } = await client.auth.admin.updateUserById(snapshot.userId, {
    user_metadata: snapshot.userMetadata
  });

  if (authError) {
    throw authError;
  }
}

export function buildE2EMarker(prefix: string) {
  return `[E2E:${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}]`;
}

export async function seedShipmentAdjustmentRequestForRole(input: {
  role: E2ERole;
  orderNumber: string;
  issueSummary?: string;
  desiredChange?: string;
  status?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}) {
  const context = await getVendorContext(input.role);
  const client = getServiceClient();

  const payload: ShipmentAdjustmentInsert = {
    vendor_id: context.vendorId,
    order_id: null,
    order_number: input.orderNumber,
    shopify_order_id: null,
    tracking_number: null,
    issue_type: 'tracking_update',
    issue_summary:
      input.issueSummary ?? `${buildE2EMarker('shipment-adjustment')} seeded request for admin workflow`,
    desired_change:
      input.desiredChange ?? 'E2E seeded request. Safe to delete after admin mutation tests.',
    line_item_context: null,
    contact_name: input.contactName ?? context.vendor.contact_name ?? 'E2E Vendor Contact',
    contact_email: input.contactEmail ?? context.vendor.contact_email ?? context.email,
    contact_phone: input.contactPhone ?? context.vendor.contact_phone,
    submitted_by: context.userId,
    status: input.status ?? 'pending'
  };

  const { data, error } = await client
    .from('shipment_adjustment_requests')
    .insert(payload)
    .select('id, issue_summary, desired_change, order_number, vendor_id')
    .single();

  if (error) {
    throw error;
  }

  return {
    requestId: data.id,
    vendorId: data.vendor_id,
    issueSummary: data.issue_summary,
    desiredChange: data.desired_change,
    orderNumber: data.order_number
  } satisfies SeededShipmentAdjustmentRequest;
}

export async function findShipmentAdjustmentRequestByIssueSummary(input: {
  role: E2ERole;
  issueSummary: string;
}) {
  const context = await getVendorContext(input.role);
  const client = getServiceClient();
  const { data, error } = await client
    .from('shipment_adjustment_requests')
    .select('id, vendor_id, issue_summary, desired_change, order_number')
    .eq('vendor_id', context.vendorId)
    .eq('issue_summary', input.issueSummary)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteShipmentAdjustmentRequest(requestId: number) {
  const client = getServiceClient();

  const { error: commentError } = await client
    .from('shipment_adjustment_comments')
    .delete()
    .eq('request_id', requestId);

  if (commentError) {
    throw commentError;
  }

  const { error: requestError } = await client
    .from('shipment_adjustment_requests')
    .delete()
    .eq('id', requestId);

  if (requestError) {
    throw requestError;
  }
}

export async function createPendingVendorApplicationFixture(): Promise<SeededPendingVendorApplication> {
  const client = getServiceClient();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e.pending.${unique}@example.com`;
  const password = 'Akira0817';
  const companyName = `E2E Pending ${unique}`;
  const contactName = `E2E Contact ${unique}`;
  const contactPhone = '03-4444-8888';

  const { data: userData, error: userError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'pending_vendor',
      company_name: companyName,
      contact_name: contactName,
      contact_phone: contactPhone
    }
  });

  if (userError || !userData.user) {
    throw userError ?? new Error('Failed to create E2E pending user');
  }

  const payload: VendorApplicationInsert = {
    auth_user_id: userData.user.id,
    vendor_code: null,
    company_name: companyName,
    contact_name: contactName,
    contact_email: email,
    contact_phone: contactPhone,
    message: `E2E fixture ${unique}`,
    status: 'pending'
  };

  const { data: application, error: applicationError } = await client
    .from('vendor_applications')
    .insert(payload)
    .select('id')
    .single();

  if (applicationError || !application) {
    await client.auth.admin.deleteUser(userData.user.id);
    throw applicationError ?? new Error('Failed to create E2E pending application');
  }

  return {
    applicationId: application.id,
    userId: userData.user.id,
    email,
    password,
    companyName,
    contactName,
    contactPhone
  };
}

export async function getVendorApplicationById(applicationId: number) {
  const client = getServiceClient();
  const { data, error } = await client
    .from('vendor_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function cleanupVendorApplicationFixture(input: {
  applicationId: number;
  userId: string;
  vendorId?: number | null;
}) {
  const client = getServiceClient();

  const { error: deleteApplicationError } = await client
    .from('vendor_applications')
    .delete()
    .eq('id', input.applicationId);

  if (deleteApplicationError) {
    throw deleteApplicationError;
  }

  if (input.vendorId) {
    const { error: deleteVendorError } = await client
      .from('vendors')
      .delete()
      .eq('id', input.vendorId);

    if (deleteVendorError) {
      throw deleteVendorError;
    }
  }

  const { error: deleteUserError } = await client.auth.admin.deleteUser(input.userId);
  if (deleteUserError) {
    throw deleteUserError;
  }
}

export async function addShipmentAdjustmentComment(input: {
  requestId: number;
  vendorId: number;
  body: string;
  visibility: 'vendor' | 'internal';
  authorId?: string | null;
  authorName?: string | null;
  authorRole?: string | null;
}) {
  const client = getServiceClient();
  const { error } = await client.from('shipment_adjustment_comments').insert({
    request_id: input.requestId,
    vendor_id: input.vendorId,
    body: input.body,
    visibility: input.visibility,
    author_id: input.authorId ?? null,
    author_name: input.authorName ?? 'E2E Admin',
    author_role: input.authorRole ?? 'admin'
  });

  if (error) {
    throw error;
  }
}

export function getRequiredOrderNumber(envName: string) {
  return readRequiredEnv(envName);
}
