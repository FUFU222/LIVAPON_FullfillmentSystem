'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type SwitchProps = InputHTMLAttributes<HTMLInputElement>;

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn('inline-flex cursor-pointer items-center', props.disabled && 'cursor-not-allowed opacity-60')}>
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            'relative h-6 w-11 rounded-full bg-slate-300 transition-colors duration-150',
            'peer-checked:bg-foreground',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-foreground peer-focus-visible:ring-offset-2',
            className
          )}
        >
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 peer-checked:translate-x-5" />
        </span>
      </label>
    );
  }
);

Switch.displayName = 'Switch';
