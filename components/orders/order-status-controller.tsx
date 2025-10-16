'use client';

import { useTransition } from 'react';
import { changeOrderStatus } from '@/app/orders/actions';
import { Button } from '@/components/ui/button';

export function OrderStatusController({ orderId, currentStatus }: { orderId: number; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      await changeOrderStatus(orderId, value);
    });
  }

  const isFulfilled = currentStatus === 'fulfilled';
  const action = isFulfilled
    ? { value: 'unfulfilled', label: '未発送に戻す' }
    : { value: 'fulfilled', label: '発送済みにする' };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="default"
        disabled={isPending}
        onClick={() => handleChange(action.value)}
      >
        {action.label}
      </Button>
      <span className="text-xs text-slate-500">
        {isFulfilled
          ? '誤って確定した場合はこちらから未発送に戻せます。'
          : '発送が完了したら確定してください。'}
      </span>
    </div>
  );
}
