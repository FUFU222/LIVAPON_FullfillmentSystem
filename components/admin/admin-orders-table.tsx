'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, X } from 'lucide-react';
import { loadAdminOrderDetailAction } from '@/app/admin/orders/actions';
import { AdminOrderDetail } from '@/components/admin/admin-order-detail';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { AdminOrderPreview, OrderDetail } from '@/lib/data/orders';

function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

type Props = {
  orders: AdminOrderPreview[];
};

type DetailCache = Record<number, OrderDetail>;

type LoadState = 'idle' | 'loading' | 'error';

export function AdminOrdersTable({ orders }: Props) {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [activeDetail, setActiveDetail] = useState<OrderDetail | null>(null);
  const [detailCache, setDetailCache] = useState<DetailCache>({});
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cachedOrder = activeOrderId ? detailCache[activeOrderId] : null;

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const timeA = a.updatedAt ?? '';
      const timeB = b.updatedAt ?? '';
      return timeB.localeCompare(timeA);
    });
  }, [orders]);

  const handleOpenOrder = (orderId: number) => {
    setActiveOrderId(orderId);
    setErrorMessage(null);

    if (detailCache[orderId]) {
      setActiveDetail(detailCache[orderId]);
      setLoadState('idle');
      return;
    }

    setActiveDetail(null);
    setLoadState('loading');

    startTransition(() => {
      loadAdminOrderDetailAction(orderId)
        .then((result) => {
          if (!result || result.status !== 'success') {
            const message =
              result?.status === 'not_found'
                ? '注文詳細が見つかりませんでした。'
                : result?.message ?? '注文詳細の取得に失敗しました。';
            setErrorMessage(message);
            setLoadState('error');
            return;
          }

          setDetailCache((prev) => ({ ...prev, [orderId]: result.detail }));
          setActiveDetail(result.detail);
          setLoadState('idle');
        })
        .catch((error) => {
          console.error('Failed to load admin order detail', error);
          setErrorMessage('注文詳細の取得に失敗しました。');
          setLoadState('error');
        });
    });
  };

  const handleCloseModal = () => {
    setActiveOrderId(null);
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
      return (
        <Alert variant="destructive">{errorMessage ?? 'エラーが発生しました。'}</Alert>
      );
    }

    const detail = activeDetail ?? cachedOrder;

    if (!detail) {
      return <Alert variant="default">注文詳細が見つかりませんでした。</Alert>;
    }

    return <AdminOrderDetail order={detail} />;
  };

  const modalTitle = activeDetail?.orderNumber ?? cachedOrder?.orderNumber ?? '注文詳細';

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">注文番号</th>
              <th className="px-3 py-2">ステータス</th>
              <th className="px-3 py-2">顧客名</th>
              <th className="px-3 py-2">ベンダー</th>
              <th className="px-3 py-2">最終更新</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer border-b border-slate-100 text-slate-600 transition hover:bg-slate-50 focus-within:bg-slate-50"
                role="button"
                tabIndex={0}
                onClick={() => handleOpenOrder(order.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenOrder(order.id);
                  }
                }}
              >
                <td className="px-3 py-2 font-medium text-foreground">{order.orderNumber}</td>
                <td className="px-3 py-2">
                  <Badge intent={order.status}>{order.status ?? '未設定'}</Badge>
                </td>
                <td className="px-3 py-2">{order.customerName ?? '-'}</td>
                <td className="px-3 py-2">
                  {order.vendorName ? (
                    <span className="flex flex-col">
                      <span>{order.vendorName}</span>
                      <span className="text-xs text-slate-500">{order.vendorCode ?? '----'}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">未割当</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{formatDate(order.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={activeOrderId !== null}
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
    </>
  );
}
