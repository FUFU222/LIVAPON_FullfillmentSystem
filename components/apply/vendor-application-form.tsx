'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitVendorApplication } from '@/app/(public)/apply/actions';
import { initialApplyFormState } from '@/app/(public)/apply/state';
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
          アカウント情報と会社情報を入力し、利用申請を送信してください。メール確認後すぐにサインインできますが、承認完了までベンダー機能はロックされています。ベンダーコードは承認時に運営が割り当てます。
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
          <label htmlFor="password" className="font-medium text-foreground">
            パスワード
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="8文字以上で入力"
          />
          {state.errors?.password ? (
            <span className="text-xs text-red-500">{state.errors?.password}</span>
          ) : (
            <p className="text-xs text-slate-500">半角英数字を含む8文字以上のパスワードを設定してください。</p>
          )}
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="passwordConfirm" className="font-medium text-foreground">
            パスワード（確認）
          </label>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="確認のため再入力"
          />
          {state.errors?.passwordConfirm ? (
            <span className="text-xs text-red-500">{state.errors?.passwordConfirm}</span>
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

        <label className="flex items-start gap-3 text-sm text-slate-600">
          <input type="checkbox" name="acceptTerms" className="mt-1" required />
          <span>
            <span className="font-medium text-foreground">利用規約への同意</span>
            <br />
            送信をもって当サービスの利用規約とプライバシーポリシーに同意したものとみなします。
          </span>
        </label>
        {state.errors?.acceptTerms ? (
          <span className="text-xs text-red-500">{state.errors?.acceptTerms}</span>
        ) : null}

        <div className="flex justify-end">
          <SubmitButton pendingLabel="送信中...">申請する</SubmitButton>
        </div>
      </form>
    </div>
  );
}
