// 納品書発行履歴の記録 / 参照
//
// admin 発行: vendor_id = NULL
// vendor 発行: vendor_id = 自分の vendorId
// RLS が二重に保護しているので、誤って他セラーの履歴を INSERT/SELECT できない。

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import type { IssuanceContext, IssuanceStatus } from './types';

type Client = SupabaseClient<Database>;

/** 1 件の納品書発行を履歴テーブルへ記録 */
export async function recordIssuance(
  client: Client,
  orderId: number,
  ctx: IssuanceContext
): Promise<void> {
  const payload = {
    order_id: orderId,
    vendor_id: ctx.role === 'vendor' ? ctx.vendorId : null,
    issued_by: ctx.userId
  };
  const { error } = await client.from('packing_slip_issuances').insert(payload);
  if (error) {
    // 履歴記録失敗で PDF 生成全体を fail にはしない。ログのみ。
    console.error('Failed to record packing slip issuance', {
      orderId,
      role: ctx.role,
      error: error.message
    });
  }
}

/**
 * 指定注文について、現在のセッションの視点で「発行済みか?」 を返す。
 * - vendor の場合: 自分の vendor_id で発行した履歴の有無
 * - admin の場合: 何らかの発行履歴の有無(vendor 発行も admin 発行もカウント)
 */
export async function getIssuanceStatus(
  client: Client,
  orderId: number,
  ctx: IssuanceContext
): Promise<IssuanceStatus> {
  let query = client
    .from('packing_slip_issuances')
    .select('issued_at, issued_by')
    .eq('order_id', orderId)
    .order('issued_at', { ascending: false })
    .limit(1);

  if (ctx.role === 'vendor') {
    query = query.eq('vendor_id', ctx.vendorId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to read packing slip issuance', { orderId, error: error.message });
    return { hasIssued: false, lastIssuedAt: null, lastIssuedBy: null };
  }
  const first = data?.[0];
  if (!first) return { hasIssued: false, lastIssuedAt: null, lastIssuedBy: null };
  return {
    hasIssued: true,
    lastIssuedAt: first.issued_at,
    lastIssuedBy: first.issued_by
  };
}

/**
 * 複数の order に対する発行ステータスを 1 クエリで取得(一覧画面のアイコン表示用)
 * Map<orderId, hasIssued> を返す。
 */
export async function getIssuanceFlagsByOrderIds(
  client: Client,
  orderIds: number[],
  ctx: IssuanceContext
): Promise<Map<number, boolean>> {
  const flags = new Map<number, boolean>();
  orderIds.forEach((id) => flags.set(id, false));

  if (orderIds.length === 0) return flags;

  let query = client
    .from('packing_slip_issuances')
    .select('order_id')
    .in('order_id', orderIds);

  if (ctx.role === 'vendor') {
    query = query.eq('vendor_id', ctx.vendorId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to load packing slip issuance flags', { error: error.message });
    return flags;
  }
  (data ?? []).forEach((row) => {
    if (typeof row.order_id === 'number') {
      flags.set(row.order_id, true);
    }
  });
  return flags;
}
