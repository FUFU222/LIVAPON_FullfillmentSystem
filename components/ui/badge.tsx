import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const intentStyles: Record<string, string> = {
  unfulfilled: 'border-slate-200 text-slate-600',
  partially_fulfilled: 'border-amber-500/40 text-amber-600',
  fulfilled: 'border-emerald-500/40 text-emerald-600',
  default: 'border-slate-200 text-slate-600'
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
