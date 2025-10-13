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
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'info' | 'error';

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
  info: 'bg-slate-900 text-slate-50',
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white'
};

let toastIdCounter = 0;

function createToastId() {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);
  const timeoutRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeoutId = timeoutRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    ({ id, title, description, duration = 3000, variant = 'default' }: ToastOptions) => {
      const toastId = id ?? createToastId();

      setToasts((current) => {
        const next = current.filter((toast) => toast.id !== toastId);
        return [
          ...next,
          {
            id: toastId,
            title,
            description,
            variant,
            duration
          }
        ];
      });

      if (duration !== Infinity) {
        const existingTimeout = timeoutRef.current.get(toastId);
        if (existingTimeout) {
          window.clearTimeout(existingTimeout);
        }
        const timeoutId = window.setTimeout(() => {
          dismissToast(toastId);
        }, duration);
        timeoutRef.current.set(toastId, timeoutId);
      }

      return toastId;
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-xs items-start gap-3 rounded-md px-4 py-3 shadow-lg sm:max-w-sm',
              variantClasses[toast.variant]
            )}
            role={toast.variant === 'error' ? 'alert' : 'status'}
          >
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
