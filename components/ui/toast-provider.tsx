'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

export type ToastOptions = {
  id?: string;
  title: string;
  description?: string;
  duration?: number;
  variant?: ToastVariant;
};

type ToastInternal = Required<Pick<ToastOptions, 'id' | 'title'>> & {
  description?: string;
  variant: ToastVariant;
  duration: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantClasses: Record<ToastVariant, string> = {
  default: 'bg-slate-900 text-slate-50',
  info: 'bg-sky-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-400 text-slate-950',
  error: 'bg-red-600 text-white'
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
    ({ id, title, description, duration = 3000, variant = 'default' }: ToastOptions) => {
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
            duration
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
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-end gap-2 px-4 sm:px-6"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-xs items-start gap-3 rounded-md px-4 py-3 shadow-lg transition-opacity sm:max-w-sm',
              variantClasses[toast.variant]
            )}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => handleMouseEnter(toast.id)}
            onMouseLeave={() => handleMouseLeave(toast.id)}
          >
            {(() => {
              const Icon = variantIcons[toast.variant];
              return <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />;
            })()}
            <div className="flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-xs opacity-80">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded p-1 text-current opacity-70 transition-opacity hover:opacity-100"
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
