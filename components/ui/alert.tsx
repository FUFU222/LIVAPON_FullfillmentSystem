import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'border-slate-200 text-slate-700',
  destructive: 'border-red-300 text-red-600 bg-red-50',
  success: 'border-emerald-300 text-emerald-600 bg-emerald-50'
} as const;

type Variant = keyof typeof variants;

export function Alert({ className, variant = 'default', ...props }: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
