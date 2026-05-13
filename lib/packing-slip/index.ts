// 納品書(packing slip)機能の公開エントリーポイント。
//
// 責務:
//   1. 注文データと発送元(vendor)情報の読込
//   2. ロールに応じた content filtering(セラーは自分の line_items のみ)
//   3. PDF レンダリング
//   4. 発行履歴の記録
//
// 認可境界:
//   - 注文の取得は getOrderDetail / getOrderDetailForAdmin で RLS が効く
//   - 加えて vendor の場合は line_items を自分の vendor_id でフィルタ
//   - vendor が他人の注文を取りに来た場合は order が null になるので呼び出し側で 403

import { renderToBuffer } from '@react-pdf/renderer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { getIssuerInfo } from '@/lib/config/issuer';
import { getOrderDetail, getOrderDetailForAdmin } from '@/lib/data/orders';
import type { OrderDetail } from '@/lib/data/orders/types';
import { PackingSlipDocument } from './document';
import { recordIssuance } from './issuance';
import type { IssuanceContext, VendorAddress } from './types';

export { getIssuanceStatus, getIssuanceFlagsByOrderIds, recordIssuance } from './issuance';
export type { IssuanceContext, IssuanceStatus, VendorAddress } from './types';

type Client = SupabaseClient<Database>;

export class PackingSlipNotFoundError extends Error {
  constructor() {
    super('指定された注文が見つからないか、アクセス権限がありません');
    this.name = 'PackingSlipNotFoundError';
  }
}

export class PackingSlipEmptyError extends Error {
  constructor() {
    super('この注文には出力できる商品がありません');
    this.name = 'PackingSlipEmptyError';
  }
}

/**
 * 発送元(vendor)の住所情報を vendors テーブルから読む。
 * RLS により、admin は任意の vendor、vendor は自分の vendor_id しか取れない。
 */
async function loadVendorAddress(
  client: Client,
  vendorId: number | null
): Promise<VendorAddress | null> {
  if (!vendorId) return null;
  const { data, error } = await client
    .from('vendors')
    .select('id, code, name, postal, prefecture, city, address1, address2, contact_phone, contact_email')
    .eq('id', vendorId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('Failed to load vendor address', error);
    return null;
  }
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    postal: data.postal ?? null,
    prefecture: data.prefecture ?? null,
    city: data.city ?? null,
    address1: data.address1 ?? null,
    address2: data.address2 ?? null,
    contactPhone: data.contact_phone ?? null,
    contactEmail: data.contact_email ?? null
  };
}

/**
 * line_items を発送元 vendor の候補とともに整理する。
 * - admin の場合: 注文の primary vendor(orders.vendor_id 由来か、最頻 vendor)
 * - vendor の場合: 自分の vendor_id
 */
function pickPrimaryVendorId(order: OrderDetail, ctx: IssuanceContext): number | null {
  if (ctx.role === 'vendor') return ctx.vendorId;
  // admin: 注文の line_items から vendor_id の最頻値を採用
  const counts = new Map<number, number>();
  for (const li of order.lineItems) {
    if (li.vendorId == null) continue;
    counts.set(li.vendorId, (counts.get(li.vendorId) ?? 0) + 1);
  }
  let best: { id: number; count: number } | null = null;
  for (const [id, count] of counts) {
    if (!best || count > best.count) best = { id, count };
  }
  return best?.id ?? null;
}

function filterLineItemsForContext(
  order: OrderDetail,
  ctx: IssuanceContext
): OrderDetail['lineItems'] {
  if (ctx.role === 'admin') return order.lineItems;
  return order.lineItems.filter((li) => li.vendorId === ctx.vendorId);
}

/**
 * 納品書 PDF を生成して返す(動的生成)。
 * 戻り値: PDF バイナリ + 表示用ファイル名
 * 認可違反: PackingSlipNotFoundError をスロー(呼び出し側で 404/403 を返す)
 * 中身ゼロ: PackingSlipEmptyError をスロー(セラーで自分の line_items が0件など)
 */
export async function getPackingSlipPDF(
  client: Client,
  orderId: number,
  ctx: IssuanceContext
): Promise<{ buffer: Buffer; filename: string }> {
  const order =
    ctx.role === 'admin'
      ? await getOrderDetailForAdmin(orderId)
      : await getOrderDetail(ctx.vendorId, orderId);

  if (!order) {
    throw new PackingSlipNotFoundError();
  }

  const lineItems = filterLineItemsForContext(order, ctx);
  if (lineItems.length === 0) {
    throw new PackingSlipEmptyError();
  }

  const primaryVendorId = pickPrimaryVendorId(order, ctx);
  const vendor = await loadVendorAddress(client, primaryVendorId);
  const issuer = getIssuerInfo();
  const issuedAt = new Date();

  const document = PackingSlipDocument({
    order,
    lineItems,
    vendor,
    issuer,
    issuedAt
  });

  const buffer = await renderToBuffer(document);

  // 発行履歴を記録(失敗しても PDF 生成は成功扱い)
  await recordIssuance(client, orderId, ctx);

  const safeOrderNumber = (order.orderNumber || `order-${orderId}`).replace(/[^A-Za-z0-9#_-]/g, '');
  const filename = `packing-slip-${safeOrderNumber}.pdf`;

  return { buffer, filename };
}
