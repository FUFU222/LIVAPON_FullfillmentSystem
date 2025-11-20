'use client';

import { useRef, useState, useTransition } from 'react';
import { Loader2, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import {
  bulkDeleteVendorsAction,
  loadAdminVendorDetailAction
} from '@/app/admin/vendors/actions';
import { VendorDeleteButton } from '@/components/admin/vendor-delete-button';
import { AdminVendorDetail } from '@/components/admin/admin-vendor-detail';
import type { VendorDetail, VendorListEntry } from '@/lib/data/vendors';

function toDisplayDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

type LoadState = 'idle' | 'loading' | 'error';

export function VendorBulkDeleteForm({ vendors }: { vendors: VendorListEntry[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [isBulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [activeVendorId, setActiveVendorId] = useState<number | null>(null);
  const [activeDetail, setActiveDetail] = useState<VendorDetail | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, VendorDetail>>({});
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cachedDetail = activeVendorId ? detailCache[activeVendorId] : null;

  const handleOpenVendor = (vendorId: number) => {
    setActiveVendorId(vendorId);
    setErrorMessage(null);

    if (detailCache[vendorId]) {
      setActiveDetail(detailCache[vendorId]);
      setLoadState('idle');
      return;
    }

    setActiveDetail(null);
    setLoadState('loading');

    startTransition(() => {
      loadAdminVendorDetailAction(vendorId)
        .then((result) => {
          if (!result || result.status !== 'success') {
            const message =
              result?.status === 'not_found'
                ? 'ベンダー詳細が見つかりませんでした。'
                : result?.message ?? 'ベンダー詳細の取得に失敗しました。';
            setErrorMessage(message);
            setLoadState('error');
            return;
          }

          setDetailCache((prev) => ({ ...prev, [vendorId]: result.detail }));
          setActiveDetail(result.detail);
          setLoadState('idle');
        })
        .catch((error) => {
          console.error('Failed to load vendor detail', error);
          setErrorMessage('ベンダー詳細の取得に失敗しました。');
          setLoadState('error');
        });
    });
  };

  const handleCloseModal = () => {
    setActiveVendorId(null);
    setActiveDetail(null);
    setErrorMessage(null);
    setLoadState('idle');
  };

  const renderModalContent = () => {
    if (loadState === 'loading' || isPending) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          <span>読み込み中…</span>
        </div>
      );
    }

    if (loadState === 'error') {
      return <Alert variant="destructive">{errorMessage ?? 'エラーが発生しました。'}</Alert>;
    }

    const detail = activeDetail ?? cachedDetail;

    if (!detail) {
      return <Alert variant="default">ベンダー詳細が見つかりませんでした。</Alert>;
    }

    return <AdminVendorDetail vendor={detail} />;
  };

  const modalTitle = activeDetail?.name ?? cachedDetail?.name ?? 'ベンダー詳細';

  return (
    <form ref={formRef} action={bulkDeleteVendorsAction} className="grid gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          className={buttonClasses('outline', 'text-sm text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed')}
          disabled={selectedIds.length === 0}
          onClick={() => setBulkConfirmOpen(true)}
        >
          選択したベンダーを削除
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">選択</th>
              <th className="px-3 py-2">ベンダー名</th>
              <th className="px-3 py-2">コード</th>
              <th className="px-3 py-2">ステータス</th>
              <th className="px-3 py-2">メール</th>
              <th className="px-3 py-2">登録日</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr
                key={vendor.id}
                className="border-b border-slate-100 text-slate-600 transition hover:bg-slate-50 focus-within:bg-slate-50"
                role="button"
                tabIndex={0}
                onClick={() => handleOpenVendor(vendor.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenVendor(vendor.id);
                  }
                }}
              >
                <td className="px-3 py-2 align-middle"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    name="vendorIds"
                    value={vendor.id}
                    checked={selectedIds.includes(vendor.id)}
                    onChange={(event) => {
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, vendor.id]
                          : current.filter((id) => id !== vendor.id)
                      );
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-foreground">{vendor.name}</td>
                <td className="px-3 py-2">{vendor.code ?? '----'}</td>
                <td className="px-3 py-2">
                  {vendor.lastApplication ? (
                    <Badge
                      className={
                        vendor.lastApplication.status === 'approved'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : vendor.lastApplication.status === 'rejected'
                            ? 'border-red-300 bg-red-50 text-red-600'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                      }
                    >
                      {vendor.lastApplication.status === 'approved'
                        ? '承認済み'
                        : vendor.lastApplication.status === 'rejected'
                          ? '却下'
                          : '審査中'}
                    </Badge>
                  ) : (
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600">審査情報なし</Badge>
                  )}
                </td>
                <td className="px-3 py-2">{vendor.contactEmail ?? '-'}</td>
                <td className="px-3 py-2 text-xs">{toDisplayDate(vendor.createdAt)}</td>
                <td
                  className="px-3 py-2 text-right"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <VendorDeleteButton vendorId={vendor.id} vendorName={vendor.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={activeVendorId !== null}
        onClose={handleCloseModal}
        title={modalTitle}
        footer={
          <div className="flex items-center justify-end">
            <Button type="button" variant="outline" onClick={handleCloseModal} className="gap-2">
              <X className="h-4 w-4" aria-hidden="true" />
              閉じる
            </Button>
          </div>
        }
      >
        {renderModalContent()}
      </Modal>

      <Modal
        open={isBulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        title="選択したベンダーを削除します"
        description="この操作は元に戻せません。関連する情報も削除対象となります。"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setBulkConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              disabled={selectedIds.length === 0}
              onClick={() => {
                setBulkConfirmOpen(false);
                formRef.current?.requestSubmit();
              }}
            >
              削除する
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          選択したベンダーが完全に削除されます。必要に応じてバックアップを取得してから実行してください。
        </p>
      </Modal>
    </form>
  );
}
