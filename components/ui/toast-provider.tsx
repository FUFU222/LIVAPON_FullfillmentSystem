'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type CSSProperties
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

export type ToastAction = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  disabled?: boolean;
};

export type ToastOptions = {
  id?: string;
  title: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
  action?: ToastAction;
};

type ToastInternal = Required<Pick<ToastOptions, 'id' | 'title'>> & {
  description?: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClasses: Record<ToastVariant, string> = {
  default: 'bg-slate-950/90 text-slate-50 ring-white/10',
  info: 'bg-sky-700/90 text-sky-50 ring-sky-200/40',
  success: 'bg-emerald-700/90 text-emerald-50 ring-emerald-200/30',
  warning: 'bg-amber-500 text-slate-950 ring-amber-200/50',
  error: 'bg-rose-700/95 text-rose-50 ring-rose-200/30'
};

const variantAccent: Record<ToastVariant, string> = {
  default: 'bg-white/70',
  info: 'bg-sky-200/90',
  success: 'bg-emerald-200/90',
  warning: 'bg-amber-100/90',
  error: 'bg-rose-100/90'
};

const variantIcons: Record<ToastVariant, typeof Info> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle
};

let toastIdCounter = 0;

function createToastId() {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);
  const timersRef = useRef<
    Map<
      string,
      {
        timeoutId: number | null;
        startedAt: number;
        remaining: number;
        duration: number;
      }
    >
  >(new Map());

  const clearTimer = useCallback((id: string) => {
    const entry = timersRef.current.get(id);
    if (entry?.timeoutId != null) {
      window.clearTimeout(entry.timeoutId);
    }
    timersRef.current.delete(id);
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      clearTimer(id);
    },
    [clearTimer]
  );

  const scheduleTimer = useCallback(
    (toastId: string, duration: number) => {
      clearTimer(toastId);

      if (duration === Infinity) {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        dismissToast(toastId);
      }, duration);

      timersRef.current.set(toastId, {
        timeoutId,
        startedAt: Date.now(),
        remaining: duration,
        duration
      });
    },
    [clearTimer, dismissToast]
  );

  const showToast = useCallback(
    ({ id, title, description, duration = 3000, variant = 'default', action }: ToastOptions) => {
      const toastId = id ?? createToastId();

      setToasts((current) => {
        const filtered = current.filter((toast) => toast.id !== toastId);
        const next = [
          ...filtered,
          {
            id: toastId,
            title,
            description,
            variant,
            duration,
            action
          }
        ];

        const limited = next.slice(-2);
        const limitedIds = new Set(limited.map((toast) => toast.id));

        next.forEach((toast) => {
          if (!limitedIds.has(toast.id)) {
            clearTimer(toast.id);
          }
        });

        return limited;
      });

      scheduleTimer(toastId, duration);

      return toastId;
    },
    [clearTimer, scheduleTimer]
  );

  const handleMouseEnter = useCallback((toastId: string) => {
    const entry = timersRef.current.get(toastId);
    if (!entry || entry.timeoutId === null) {
      return;
    }

    window.clearTimeout(entry.timeoutId);
    const elapsed = Date.now() - entry.startedAt;
    const remaining = Math.max(entry.duration - elapsed, 0);

    timersRef.current.set(toastId, {
      ...entry,
      timeoutId: null,
      remaining
    });
  }, []);

  const handleMouseLeave = useCallback(
    (toastId: string) => {
      const entry = timersRef.current.get(toastId);
      if (!entry || entry.duration === Infinity) {
        return;
      }

      const remaining = entry.timeoutId === null ? entry.remaining : entry.duration;

      if (remaining <= 0) {
        dismissToast(toastId);
        return;
      }

      const timeoutId = window.setTimeout(() => {
        dismissToast(toastId);
      }, remaining);

      timersRef.current.set(toastId, {
        ...entry,
        timeoutId,
        startedAt: Date.now(),
        remaining
      });
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-3 px-4 sm:items-end sm:px-6"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto group relative isolate flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl px-5 py-4 text-sm font-medium shadow-[0_20px_50px_rgba(15,23,42,0.35)] ring-1 backdrop-blur-lg transition-[transform,opacity] motion-safe:animate-toast-in',
              'motion-safe:hover:translate-y-[-1px] sm:max-w-md',
              variantClasses[toast.variant]
            )}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => handleMouseEnter(toast.id)}
            onMouseLeave={() => handleMouseLeave(toast.id)}
          >
            {toast.duration !== Infinity ? (
              <span
                className="pointer-events-none absolute inset-x-5 top-2 h-0.5 overflow-hidden rounded-full bg-white/20"
                aria-hidden="true"
              >
                <span
                  className={cn(
                    'block h-full w-full origin-left motion-safe:animate-toast-bar',
                    'group-hover:[animation-play-state:paused]',
                    variantAccent[toast.variant]
                  )}
                  style={{
                    animationDuration: `${toast.duration}ms`,
                    '--toast-duration': `${toast.duration}ms`
                  } as CSSProperties}
                />
              </span>
            ) : null}
            {(() => {
              const Icon = variantIcons[toast.variant];
              return <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />;
            })()}
            <div className="flex-1">
              <p className="text-[0.95rem] font-semibold leading-tight tracking-[-0.01em]">
                {toast.title}
              </p>
              {toast.description ? (
                <p className="mt-1 text-[0.8rem] leading-relaxed opacity-90">{toast.description}</p>
              ) : null}
            </div>
            {toast.action ? (
              <button
                type="button"
                onClick={() => toast.action?.onClick?.()}
                disabled={toast.action.disabled}
                className={cn(
                  'mr-1 inline-flex items-center gap-1 rounded-full border border-white/30 px-3 py-1 text-xs font-semibold transition hover:border-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  toast.action.disabled && 'opacity-50'
                )}
              >
                {toast.action.icon ? (
                  <toast.action.icon className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
                {toast.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-full p-1.5 text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
