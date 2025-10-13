'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  confirmVariant = 'default',
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
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
  }, [open, onCancel]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const root = document.getElementById('__next');
    const previousAriaHidden = root?.getAttribute('aria-hidden');
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

  const titleId = 'confirm-dialog-title';
  const descriptionId = description ? 'confirm-dialog-description' : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="mb-4 flex flex-col gap-2">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          {description ? (
            <div id={descriptionId} className="text-sm text-slate-600">
              {description}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-3 text-sm">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={cn(
              confirmVariant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-500'
                : undefined
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
