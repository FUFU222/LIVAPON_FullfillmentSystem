'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitVendorApplication, initialApplyFormState } from '@/app/(public)/apply/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';

function SubmitButton({ pendingLabel, children }: { pendingLabel: string; children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function VendorApplicationForm() {
  const [state, formAction] = useFormState(submitVendorApplication, initialApplyFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">ベンダー利用申請</h1>
        <p className="text-sm text-slate-500">
          既定のベンダーコードと会社情報を入力し、利用申請を送信してください。承認後にログイン情報をお送りします。
        </p>
      </div>

      {state.status === 'success' && state.message ? (
        <Alert variant="success">{state.message}</Alert>
      ) : null}

      {state.status === 'error' && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}

      <form ref={formRef} action={formAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="vendorCode" className="font-medium text-foreground">
            ベンダーコード (任意)
          </label>
          <Input
            id="vendorCode"
            name="vendorCode"
            pattern="\d{4}"
            placeholder="0001"
            inputMode="numeric"
          />
          <p className="text-xs text-slate-500">4桁の数字で入力してください。未発行の場合は空欄で構いません。</p>
          {state.errors?.vendorCode ? (
            <span className="text-xs text-red-500">{state.errors?.vendorCode}</span>
          ) : null}
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="companyName" className="font-medium text-foreground">
            会社名
          </label>
          <Input id="companyName" name="companyName" required placeholder="株式会社サンプル" />
          {state.errors?.companyName ? (
            <span className="text-xs text-red-500">{state.errors?.companyName}</span>
          ) : null}
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="contactName" className="font-medium text-foreground">
            担当者名 (任意)
          </label>
          <Input id="contactName" name="contactName" placeholder="山田 太郎" />
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="contactEmail" className="font-medium text-foreground">
            メールアドレス
          </label>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            placeholder="contact@example.com"
          />
          {state.errors?.contactEmail ? (
            <span className="text-xs text-red-500">{state.errors?.contactEmail}</span>
          ) : null}
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="message" className="font-medium text-foreground">
            備考 (任意)
          </label>
          <Textarea
            id="message"
            name="message"
            rows={4}
            placeholder="サービスの利用目的や補足事項があればご記入ください。"
          />
        </div>

        <div className="flex justify-end">
          <SubmitButton pendingLabel="送信中...">申請する</SubmitButton>
        </div>
      </form>
    </div>
  );
}
