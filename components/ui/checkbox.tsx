'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const baseClasses =
  'h-4 w-4 rounded border border-slate-300 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:opacity-40';

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} type="checkbox" className={cn(baseClasses, className)} {...props} />;
  }
);

Checkbox.displayName = 'Checkbox';
