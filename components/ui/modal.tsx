'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
};

export function Modal({ open, onClose, title, description, children, footer, showCloseButton = false }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) {
          return;
        }

        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusable.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey) {
          if (active === first || !dialog.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const root = document.getElementById('__next');
    const previousAriaHidden = root?.getAttribute('aria-hidden') ?? null;
    const hadInert = root?.hasAttribute('inert') ?? false;
    if (root) {
      root.setAttribute('aria-hidden', 'true');
      if (!hadInert) {
        root.setAttribute('inert', '');
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;

      if (root) {
        if (previousAriaHidden !== null) {
          root.setAttribute('aria-hidden', previousAriaHidden);
        } else {
          root.removeAttribute('aria-hidden');
        }

        if (!hadInert) {
          root.removeAttribute('inert');
        } else {
          root.setAttribute('inert', '');
        }
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const dialog = dialogRef.current;
    if (dialog) {
      dialog.focus();
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const first = focusable[0];
      if (first) {
        first.focus();
      }
    }

    return () => {
      const previously = previouslyFocused.current;
      if (previously) {
        previously.focus();
      }
    };
  }, [open]);

  if (!mounted || !open) {
    return null;
  }

  const titleId = title ? 'modal-title' : undefined;
  const descriptionId = description ? 'modal-description' : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-0 sm:items-center sm:px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border border-slate-200 bg-white shadow-xl focus:outline-none sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="relative flex flex-col gap-4 p-4 sm:p-6">
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="absolute right-2 top-2 rounded border border-transparent p-2 text-slate-400 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-600"
            >
              ×
            </button>
          ) : null}
          {title ? (
            <div className="flex flex-col gap-2">
              <h2 id={titleId} className="text-lg font-semibold text-foreground sm:text-xl">
                {title}
              </h2>
              {description ? (
                <div id={descriptionId} className="text-sm text-slate-600">
                  {description}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="text-sm text-slate-700">{children}</div>
        </div>
        {footer ? (
          <div
            data-testid="modal-footer"
            className="sticky bottom-0 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 sm:py-4"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
