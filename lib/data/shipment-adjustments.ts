import { assertServiceClient } from '@/lib/data/orders/clients';
import type { Database } from '@/lib/supabase/types';

export const SHIPMENT_ADJUSTMENT_STATUSES = ['pending', 'in_review', 'needs_info', 'resolved'] as const;
export type ShipmentAdjustmentStatus = (typeof SHIPMENT_ADJUSTMENT_STATUSES)[number];

export type ShipmentAdjustmentComment = {
  id: number;
  body: string;
  authorName: string | null;
  authorRole: string | null;
  visibility: string;
  createdAt: string | null;
};

export type AdminShipmentAdjustmentRequest = {
  id: number;
  vendorId: number;
  vendorName: string | null;
  vendorCode: string | null;
  vendorPhone: string | null;
  orderNumber: string;
  orderId: number | null;
  issueType: string;
  issueSummary: string;
  desiredChange: string;
  lineItemContext: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  trackingNumber: string | null;
  status: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  assignedAdminEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  comments: ShipmentAdjustmentComment[];
};

function mapComment(record: Database['public']['Tables']['shipment_adjustment_comments']['Row']): ShipmentAdjustmentComment {
  return {
    id: record.id,
    body: record.body,
    authorName: record.author_name,
    authorRole: record.author_role,
    visibility: record.visibility,
    createdAt: record.created_at
  };
}

function mapAdminRequest(
  record: Database['public']['Tables']['shipment_adjustment_requests']['Row'] & {
    vendors?: { name: string | null; code: string | null; contact_phone: string | null } | null;
    shipment_adjustment_comments?: Database['public']['Tables']['shipment_adjustment_comments']['Row'][];
  }
): AdminShipmentAdjustmentRequest {
  const comments = (record.shipment_adjustment_comments ?? [])
    .map(mapComment)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

  return {
    id: record.id,
    vendorId: record.vendor_id,
    vendorName: record.vendors?.name ?? null,
    vendorCode: record.vendors?.code ?? null,
    vendorPhone: record.vendors?.contact_phone ?? null,
    orderNumber: record.order_number,
    orderId: record.order_id,
    issueType: record.issue_type,
    issueSummary: record.issue_summary,
    desiredChange: record.desired_change,
    lineItemContext: record.line_item_context,
    contactName: record.contact_name,
    contactEmail: record.contact_email,
    contactPhone: record.contact_phone,
    trackingNumber: record.tracking_number,
    status: record.status,
    resolutionSummary: record.resolution_summary,
    resolvedAt: record.resolved_at,
    assignedAdminEmail: record.assigned_admin_email,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    comments
  };
}

export async function listShipmentAdjustmentRequestsForAdmin(options?: {
  statuses?: ShipmentAdjustmentStatus[];
  limit?: number;
}): Promise<AdminShipmentAdjustmentRequest[]> {
  const client = assertServiceClient();
  const query = client
    .from('shipment_adjustment_requests')
    .select(
      `*, vendors:vendors(name, code, contact_phone), shipment_adjustment_comments:shipment_adjustment_comments(*)`
    )
    .order('created_at', { ascending: false });

  if (options?.statuses && options.statuses.length > 0) {
    query.in('status', options.statuses);
  }

  if (options?.limit) {
    query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAdminRequest);
}

export async function updateShipmentAdjustmentRequestByAdmin(input: {
  requestId: number;
  status?: ShipmentAdjustmentStatus;
  resolutionSummary?: string | null;
  assignedAdminId?: string | null;
  assignedAdminEmail?: string | null;
  comment?: {
    body: string;
    visibility: string;
    authorId: string;
    authorName: string | null;
    authorRole: string;
  } | null;
}): Promise<void> {
  const client = assertServiceClient();

  const { data: request, error: fetchError } = await client
    .from('shipment_adjustment_requests')
    .select('id, vendor_id')
    .eq('id', input.requestId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!request) {
    throw new Error('申請が見つかりません');
  }

  if (input.comment) {
    const { error: commentError } = await client.from('shipment_adjustment_comments').insert({
      request_id: request.id,
      vendor_id: request.vendor_id,
      author_id: input.comment.authorId,
      author_name: input.comment.authorName,
      author_role: input.comment.authorRole,
      visibility: input.comment.visibility,
      body: input.comment.body
    });

    if (commentError) {
      throw commentError;
    }
  }

  const updatePayload: Database['public']['Tables']['shipment_adjustment_requests']['Update'] = {
    status: input.status ?? undefined,
    resolution_summary:
      input.resolutionSummary === undefined ? undefined : input.resolutionSummary ?? null,
    assigned_admin_id: input.assignedAdminId ?? undefined,
    assigned_admin_email: input.assignedAdminEmail ?? undefined,
    resolved_at:
      input.status === undefined
        ? undefined
        : input.status === 'resolved'
          ? new Date().toISOString()
          : null,
    updated_at: new Date().toISOString()
  };

  const { error: updateError } = await client
    .from('shipment_adjustment_requests')
    .update(updatePayload)
    .eq('id', input.requestId);

  if (updateError) {
    throw updateError;
  }
}
