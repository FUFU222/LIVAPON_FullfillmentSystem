'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFormState, useFormStatus } from 'react-dom';
import { approveApplicationAction, rejectApplicationAction } from '@/app/admin/applications/actions';
import { initialAdminActionState, type AdminActionState } from '@/app/admin/applications/state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { VendorApplication } from '@/lib/data/vendors';

function SubmitButton({ children, pendingLabel, variant = 'default' }: { children: string; pendingLabel: string; variant?: 'default' | 'outline' | 'ghost' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function ActionMessage({ state }: { state: AdminActionState }) {
  if (state.status === 'success' && state.message) {
    return (
      <Alert variant="success" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{state.message}</span>
          {state.details?.vendorCode ? (
            <span className="font-mono text-base">コード: {state.details.vendorCode}</span>
          ) : null}
        </div>
      </Alert>
    );
  }
  if (state.status === 'error' && state.message) {
    return <Alert variant="destructive">{state.message}</Alert>;
  }
  return null;
}

function ApprovalCodeDialog({
  open,
  vendorCode,
  onClose
}: {
  open: boolean;
  vendorCode?: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || !vendorCode) {
    return null;
  }

  const code = vendorCode;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy vendor code', error);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">ベンダーを承認しました</h2>
          <p className="text-sm text-slate-600">
            割り当てたベンダーコードを Shopify 管理などに転記してください。
          </p>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-2xl font-mono font-semibold text-emerald-700">
            {code}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? 'コピーしました' : 'コードをコピー'}
          </Button>
          <Button type="button" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function VendorApplicationCard({ application }: { application: VendorApplication }) {
  const [approveState, approveAction] = useFormState(approveApplicationAction, initialAdminActionState);
  const [rejectState, rejectAction] = useFormState(rejectApplicationAction, initialAdminActionState);
  const rejectFormRef = useRef<HTMLFormElement>(null);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [latestCode, setLatestCode] = useState<string | null>(null);

  useEffect(() => {
    if (approveState.status === 'success') {
      rejectFormRef.current?.reset();
      if (approveState.details?.vendorCode) {
        setLatestCode(approveState.details.vendorCode);
        setShowCodeDialog(true);
      }
    }
  }, [approveState.status, approveState.details]);

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground">{application.companyName}</h3>
          <span className="text-xs uppercase tracking-wide text-slate-500">ID: {application.id}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
          <span>ベンダーコード: {application.vendorCode ?? '承認時に自動割り当て'}</span>
          <span>担当者: {application.contactName ?? '-'}</span>
          <span>メール: {application.contactEmail}</span>
        </div>
        {application.message ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">{application.message}</p>
        ) : null}
      </div>

      <div className="grid gap-3">
        <ActionMessage state={approveState} />
        <ActionMessage state={rejectState} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <form action={approveAction} className="grid gap-3 rounded-md border border-slate-200 p-3">
          <input type="hidden" name="applicationId" value={application.id} />
          <div className="grid gap-1 text-xs text-slate-600">
            <label htmlFor={`vendor-code-${application.id}`} className="font-medium text-foreground">
              ベンダーコード (4 桁・必要な場合のみ)
            </label>
            <Input
              id={`vendor-code-${application.id}`}
              name="vendorCode"
              defaultValue={application.vendorCode ?? ''}
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              placeholder="空欄の場合は承認時に自動採番"
            />
            <p className="text-xs text-slate-500">
              Shopify 側で指定がある場合のみ入力してください。未入力なら承認時に自動採番されます。
            </p>
          </div>
          <div className="grid gap-1 text-xs text-slate-600">
            <label htmlFor={`notes-${application.id}`} className="font-medium text-foreground">
              メモ (任意)
            </label>
            <Input id={`notes-${application.id}`} name="notes" placeholder="内部向けメモ" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="承認中...">承認する</SubmitButton>
          </div>
        </form>

        <form ref={rejectFormRef} action={rejectAction} className="grid gap-3 rounded-md border border-rose-200 bg-rose-50/40 p-3">
          <input type="hidden" name="applicationId" value={application.id} />
          <div className="grid gap-1 text-xs text-rose-700">
            <label htmlFor={`reason-${application.id}`} className="font-medium">
              却下理由 (任意)
            </label>
            <Textarea
              id={`reason-${application.id}`}
              name="reason"
              rows={3}
              placeholder="却下理由や再申請時の注意事項があれば入力してください"
            />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="却下中..." variant="outline">
              却下する
            </SubmitButton>
          </div>
        </form>
      </div>
      <ApprovalCodeDialog
        open={showCodeDialog && Boolean(latestCode)}
        vendorCode={latestCode ?? ''}
        onClose={() => setShowCodeDialog(false)}
      />
    </div>
  );
}
