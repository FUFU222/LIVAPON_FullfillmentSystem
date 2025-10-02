'use client';

import { useTransition } from 'react';
import { changeOrderStatus } from '@/app/orders/actions';
import { Button } from '@/components/ui/button';

const statuses: Array<{ value: string; label: string }> = [
  { value: 'unfulfilled', label: '未発送にする' },
  { value: 'partially_fulfilled', label: '一部発送済にする' },
  { value: 'fulfilled', label: '発送済にする' }
];

export function OrderStatusController({ orderId, currentStatus }: { orderId: number; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      await changeOrderStatus(orderId, value);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <Button
          key={status.value}
          type="button"
          variant={currentStatus === status.value ? 'default' : 'outline'}
          disabled={isPending}
          onClick={() => handleChange(status.value)}
        >
          {status.label}
        </Button>
      ))}
    </div>
  );
}
