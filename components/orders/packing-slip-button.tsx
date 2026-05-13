'use client';

// 注文ごとに納品書(PDF)を出力するボタン。
// バックエンド API は GET /api/orders/[orderId]/packing-slip で PDF を返す。
// クリックで新規タブを開き、ブラウザ標準の PDF プレビューを起動する。
//
// `issued` が true の時は「再ダウンロード」 ラベルに切り替え、
// 視覚的に既出力であることを示す。

import { FileText } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PackingSlipButtonProps = {
  orderId: number;
  issued?: boolean;
  size?: 'sm' | 'md';
  variant?: 'default' | 'outline';
  className?: string;
};

export function PackingSlipButton({
  orderId,
  issued = false,
  size = 'md',
  variant = 'outline',
  className
}: PackingSlipButtonProps) {
  const href = `/api/orders/${orderId}/packing-slip`;
  const label = issued ? '納品書を再ダウンロード' : '納品書を出力';
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1 gap-1' : 'gap-2';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonClasses(variant), sizeClasses, className)}
      // 認可違反やネットワーク失敗を含むエラーはユーザーには見えにくいので、
      // タイトル属性に簡易ガイドを置く。
      title={issued ? 'クリックで再ダウンロードします' : 'クリックで納品書 PDF を生成します'}
    >
      <FileText className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      {label}
    </a>
  );
}

// 一覧のセル用: ステータスのみを表すコンパクト表示(クリック可能)
type PackingSlipStatusIconProps = {
  orderId: number;
  issued: boolean;
};

export function PackingSlipStatusIcon({ orderId, issued }: PackingSlipStatusIconProps) {
  const href = `/api/orders/${orderId}/packing-slip`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition',
        issued
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      )}
      title={issued ? '納品書: 出力済み(クリックで再ダウンロード)' : '納品書: 未出力(クリックで出力)'}
      aria-label={issued ? '納品書 出力済み' : '納品書 未出力'}
      onClick={(e) => e.stopPropagation()}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{issued ? '出力済' : '未出力'}</span>
    </a>
  );
}
