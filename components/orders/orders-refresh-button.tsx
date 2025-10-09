'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buttonClasses } from '@/components/ui/button';

export function OrdersRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={buttonClasses('outline', 'text-sm')}
      onClick={handleRefresh}
      disabled={isPending}
    >
      {isPending ? '更新中…' : '更新'}
    </button>
  );
}
