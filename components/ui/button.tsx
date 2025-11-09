import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const baseClasses =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]';

const variants = {
  default: 'bg-foreground text-white shadow-sm hover:bg-foreground/90 hover:shadow focus-visible:ring-foreground/80',
  outline: 'border border-foreground text-foreground shadow-sm hover:bg-muted focus-visible:ring-foreground/40',
  ghost: 'text-foreground hover:bg-muted focus-visible:ring-foreground/20'
} as const;

export type ButtonVariant = keyof typeof variants;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function buttonClasses(variant: ButtonVariant = 'default', className?: string) {
  return cn(baseClasses, variants[variant], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return <button ref={ref} className={buttonClasses(variant, className)} {...props} />;
  }
);

Button.displayName = 'Button';
