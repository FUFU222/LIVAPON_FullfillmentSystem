"use client";

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const statusOptions = [
  { value: '', label: '全ての注文' },
  { value: 'unfulfilled', label: '未発送' },
  { value: 'partially_fulfilled', label: '一部発送済' },
  { value: 'fulfilled', label: '発送済' }
];

export function OrdersFilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const hasInitialFilters = useMemo(() => {
    return Boolean((params?.get('q') ?? '').length || (params?.get('status') ?? '').length);
  }, [params]);
  const [isSearchOpen, setIsSearchOpen] = useState(hasInitialFilters);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    startTransition(() => {
      const query = next.toString();
      router.replace(query ? `/orders?${query}` : '/orders');
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsSearchOpen((prev) => !prev)}
        className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
      >
        {isSearchOpen ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Search className="h-3.5 w-3.5" aria-hidden="true" />}
        {isSearchOpen ? '検索を閉じる' : '検索'}
      </button>
      <div
        className={`relative flex items-center overflow-hidden transition-all duration-200 ${
          isSearchOpen ? 'max-w-[520px] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-nowrap gap-2">
          <Input
            defaultValue={params?.get('q') ?? ''}
            placeholder="注文番号・顧客名で検索"
            onChange={(event) => updateParam('q', event.target.value)}
            disabled={isPending}
            className="w-56 transition-transform duration-200"
          />
          <Select
            defaultValue={params?.get('status') ?? ''}
            onChange={(event) => updateParam('status', event.target.value)}
            disabled={isPending}
            className="w-40"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
