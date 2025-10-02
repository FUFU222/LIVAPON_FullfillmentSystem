'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AdminActionState, approveApplicationAction, initialAdminActionState, rejectApplicationAction } from '@/app/admin/applications/actions';
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
    return <Alert variant="success">{state.message}</Alert>;
  }
  if (state.status === 'error' && state.message) {
    return <Alert variant="destructive">{state.message}</Alert>;
  }
  return null;
}

export function VendorApplicationCard({ application }: { application: VendorApplication }) {
  const [approveState, approveAction] = useFormState(approveApplicationAction, initialAdminActionState);
  const [rejectState, rejectAction] = useFormState(rejectApplicationAction, initialAdminActionState);
  const rejectFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (approveState.status === 'success') {
      rejectFormRef.current?.reset();
    }
  }, [approveState.status]);

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground">{application.companyName}</h3>
          <span className="text-xs uppercase tracking-wide text-slate-500">ID: {application.id}</span>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
          <span>ベンダーコード: {application.vendorCode ?? '未割り当て'}</span>
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
    </div>
  );
}
