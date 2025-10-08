'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const statusOptions = [
  { value: '', label: '全ての注文' },
  { value: 'unfulfilled', label: '未発送' },
  { value: 'partially_fulfilled', label: '一部発送済' },
  { value: 'fulfilled', label: '発送済' }
];

export function OrderFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
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
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
      <Input
        defaultValue={params?.get('q') ?? ''}
        placeholder="注文番号・顧客名で検索"
        onChange={(event) => updateParam('q', event.target.value)}
        disabled={isPending}
      />
      <Select
        defaultValue={params?.get('status') ?? ''}
        onChange={(event) => updateParam('status', event.target.value)}
        disabled={isPending}
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
