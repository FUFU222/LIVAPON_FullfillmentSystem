// 納品書(packing slip)生成で使う型定義
//
// 発送元(セラー倉庫)情報は vendors テーブルから読む。
// 未登録カラムが NULL の場合は document 側で「未登録」 fallback を表示する。

import type { OrderDetail } from '@/lib/data/orders/types';
import type { IssuerInfo } from '@/lib/config/issuer';

export type VendorAddress = {
  id: number;
  code: string | null;
  name: string;
  postal: string | null;
  prefecture: string | null;
  city: string | null;
  address1: string | null;
  address2: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

// 納品書 PDF を組み立てるのに必要なデータの束
export type PackingSlipData = {
  order: OrderDetail;
  // セラー視点で出力する時 → 自分の vendor address
  // admin視点で出力する時 → 注文の primary vendor の address(複数セラー稀ケースは将来拡張)
  vendor: VendorAddress | null;
  issuer: IssuerInfo;
  issuedAt: Date;
};

// API 層から見た認可コンテキスト
export type IssuanceContext =
  | { role: 'admin'; userId: string }
  | { role: 'vendor'; userId: string; vendorId: number };

// 発行履歴サマリー(UIで「出力済み」 表示に使う)
export type IssuanceStatus = {
  hasIssued: boolean;
  lastIssuedAt: string | null;
  lastIssuedBy: string | null;
};
