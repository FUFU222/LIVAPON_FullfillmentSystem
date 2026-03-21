'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type SwitchProps = InputHTMLAttributes<HTMLInputElement>;

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn('inline-flex cursor-pointer items-center', props.disabled && 'cursor-not-allowed opacity-60', className)}>
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            'relative h-6 w-11 rounded-full bg-slate-300 transition-colors duration-200 ease-out',
            'after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm',
            'after:transition-transform after:duration-200 after:ease-out',
            'peer-checked:bg-foreground',
            'peer-checked:after:translate-x-5',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-foreground peer-focus-visible:ring-offset-2',
            'peer-disabled:bg-slate-200'
          )}
        />
      </label>
    );
  }
);

Switch.displayName = 'Switch';
