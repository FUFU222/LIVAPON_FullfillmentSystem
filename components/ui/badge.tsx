import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const intentStyles: Record<string, string> = {
  unfulfilled: 'border-amber-200 bg-amber-50 text-amber-700',
  partially_fulfilled: 'border-sky-200 bg-sky-50 text-sky-700',
  fulfilled: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
  on_hold: 'border-purple-200 bg-purple-50 text-purple-700',
  default: 'border-slate-200 bg-slate-100 text-slate-600'
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  intent?: string | null;
};

export function Badge({ className, intent, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide',
        intentStyles[intent ?? 'default'] ?? intentStyles.default,
        className
      )}
      data-intent={intent}
      {...props}
    />
  );
}
