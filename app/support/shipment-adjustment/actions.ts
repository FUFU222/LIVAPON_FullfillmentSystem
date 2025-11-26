'use server';

import { revalidatePath } from 'next/cache';
import { getServerActionClient } from '@/lib/supabase/server';
import { assertAuthorizedVendor, requireAuthContext } from '@/lib/auth';
import type { ShipmentAdjustmentFormState } from './state';
import { shipmentIssueTypeValues, type ShipmentIssueType } from './options';

function isShipmentIssueType(value: string): value is ShipmentIssueType {
  return shipmentIssueTypeValues.includes(value as ShipmentIssueType);
}

function normalizeOrderNumber(raw: string): string {
  const trimmed = raw.replace(/\s+/g, '').replace(/^#+/, '');
  if (!trimmed) {
    return '';
  }
  return `#${trimmed}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitShipmentAdjustmentRequest(
  _prevState: ShipmentAdjustmentFormState,
  formData: FormData
): Promise<ShipmentAdjustmentFormState> {
  const rawOrderNumber = formData.get('orderNumber');
  const rawTrackingNumber = formData.get('trackingNumber');
  const rawIssueType = formData.get('issueType');
  const rawIssueSummary = formData.get('issueSummary');
  const rawDesiredChange = formData.get('desiredChange');
  const rawLineItemContext = formData.get('lineItemContext');
  const rawContactName = formData.get('contactName');
  const rawContactEmail = formData.get('contactEmail');
  const rawContactPhone = formData.get('contactPhone');

  const orderNumberInput = typeof rawOrderNumber === 'string' ? rawOrderNumber.trim() : '';
  const normalizedOrderNumber = normalizeOrderNumber(orderNumberInput);
  const trackingNumber = typeof rawTrackingNumber === 'string' ? rawTrackingNumber.trim() : '';
  const issueTypeInput = typeof rawIssueType === 'string' ? rawIssueType : 'other';
  let issueType: ShipmentIssueType = 'other';
  const issueSummary = typeof rawIssueSummary === 'string' ? rawIssueSummary.trim() : '';
  const desiredChange = typeof rawDesiredChange === 'string' ? rawDesiredChange.trim() : '';
  const lineItemContext = typeof rawLineItemContext === 'string' ? rawLineItemContext.trim() : '';
  const contactName = typeof rawContactName === 'string' ? rawContactName.trim() : '';
  const contactEmail = typeof rawContactEmail === 'string' ? rawContactEmail.trim() : '';
  const contactPhone = typeof rawContactPhone === 'string' ? rawContactPhone.trim() : '';

  const fieldErrors: ShipmentAdjustmentFormState['fieldErrors'] = {};

  if (!orderNumberInput) {
    fieldErrors.orderNumber = 'Shopifyの注文番号（#1234 形式）を入力してください。';
  }

  if (!normalizedOrderNumber) {
    fieldErrors.orderNumber = '注文番号の形式が正しくありません。';
  }

  if (!isShipmentIssueType(issueTypeInput)) {
    fieldErrors.issueType = '申請区分を選択してください。';
  } else {
    issueType = issueTypeInput;
  }

  if (!issueSummary || issueSummary.length < 10) {
    fieldErrors.issueSummary = '状況を10文字以上で具体的に記載してください。';
  }

  if (!desiredChange || desiredChange.length < 5) {
    fieldErrors.desiredChange = '希望する対応内容を記入してください。';
  }

  if (!contactName) {
    fieldErrors.contactName = '担当者名を入力してください。';
  }

  if (!contactEmail) {
    fieldErrors.contactEmail = '連絡先メールアドレスを入力してください。';
  } else if (!isValidEmail(contactEmail)) {
    fieldErrors.contactEmail = 'メールアドレスの形式が正しくありません。';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      message: '入力内容を確認してください。',
      fieldErrors,
      requestId: null
    } satisfies ShipmentAdjustmentFormState;
  }

  const auth = await requireAuthContext();
  assertAuthorizedVendor(auth.vendorId);

  const supabase = getServerActionClient();

  let orderId: number | null = null;
  let shopifyOrderId: number | null = null;

  if (normalizedOrderNumber) {
    const normalizedWithoutHash = normalizedOrderNumber.replace(/^#/, '');
    const candidateNumbers = new Set<string>();
    candidateNumbers.add(normalizedOrderNumber);
    if (normalizedWithoutHash) {
      candidateNumbers.add(normalizedWithoutHash);
      candidateNumbers.add(`#${normalizedWithoutHash}`);
    }
    if (orderNumberInput) {
      candidateNumbers.add(orderNumberInput);
    }

    const candidates = Array.from(candidateNumbers.values()).filter((value) => value.length > 0);

    if (candidates.length > 0) {
      const { data: matchingOrders, error: orderLookupError } = await supabase
        .from('orders')
        .select('id, order_number, shopify_order_id')
        .eq('vendor_id', auth.vendorId)
        .in('order_number', candidates)
        .limit(1);

      if (orderLookupError) {
        console.error('Failed to lookup order for shipment adjustment request', orderLookupError);
      } else if (matchingOrders && matchingOrders.length > 0) {
        orderId = matchingOrders[0]?.id ?? null;
        shopifyOrderId = matchingOrders[0]?.shopify_order_id ?? null;
      }
    }
  }

  const { data, error } = await supabase
    .from('shipment_adjustment_requests')
    .insert({
      vendor_id: auth.vendorId,
      order_id: orderId,
      order_number: normalizedOrderNumber,
      shopify_order_id: shopifyOrderId,
      tracking_number: trackingNumber || null,
      issue_type: issueType,
      issue_summary: issueSummary,
      desired_change: desiredChange,
      line_item_context: lineItemContext || null,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone || null,
      submitted_by: auth.user.id,
      status: 'pending'
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create shipment adjustment request', error);
    return {
      status: 'error',
      message: '申請の送信に失敗しました。時間を置いて再度お試しください。',
      requestId: null
    } satisfies ShipmentAdjustmentFormState;
  }

  revalidatePath('/orders/shipments');
  revalidatePath('/support/shipment-adjustment');

  return {
    status: 'success',
    message: '申請を受け付けました。管理者が確認次第ご連絡します。',
    requestId: data?.id ?? null
  } satisfies ShipmentAdjustmentFormState;
}
