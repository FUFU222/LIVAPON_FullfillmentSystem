import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const baseClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const variants = {
  default: 'bg-foreground text-white hover:bg-foreground/90',
  outline: 'border border-foreground text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted'
} as const;

type Variant = keyof typeof variants;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function buttonClasses(variant: Variant = 'default', className?: string) {
  return cn(baseClasses, variants[variant], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return <button ref={ref} className={buttonClasses(variant, className)} {...props} />;
  }
);

Button.displayName = 'Button';
