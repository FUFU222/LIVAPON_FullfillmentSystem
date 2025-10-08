'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { bulkDeleteVendorsAction } from '@/app/admin/vendors/actions';
import { VendorDeleteButton } from '@/components/admin/vendor-delete-button';
import type { VendorListEntry } from '@/lib/data/vendors';

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

export function VendorBulkDeleteForm({ vendors }: { vendors: VendorListEntry[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  return (
    <form action={bulkDeleteVendorsAction} className="grid gap-3">
      <div className="flex justify-end">
        <button
          type="submit"
          className={buttonClasses('outline', 'text-sm text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed')}
          disabled={selectedIds.length === 0}
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
              <th className="px-3 py-2">Auth</th>
              <th className="px-3 py-2">メール</th>
              <th className="px-3 py-2">登録日</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((vendor) => (
              <tr key={vendor.id} className="border-b border-slate-100 text-slate-600">
                <td className="px-3 py-2 align-middle">
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
                <td className="px-3 py-2">
                  {vendor.lastApplication?.authUserId ? (
                    <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700">連携済み</Badge>
                  ) : (
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600">未連携</Badge>
                  )}
                </td>
                <td className="px-3 py-2">{vendor.contactEmail ?? '-'}</td>
                <td className="px-3 py-2 text-xs">{toDisplayDate(vendor.createdAt)}</td>
                <td className="px-3 py-2 text-right">
                  <VendorDeleteButton vendorId={vendor.id} vendorName={vendor.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
