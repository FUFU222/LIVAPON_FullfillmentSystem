'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
      setShowSuccessModal(true);
    }
  }, [state.status]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">ベンダー利用申請</h1>
        <p className="text-sm text-slate-500">
          アカウント情報と会社情報を入力し、利用申請を送信してください。
        </p>
      </div>

      {state.status === 'error' && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}

      <form ref={formRef} action={formAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <PendingModal />
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
            送信をもって当サービスの{' '}
            <Link href="/terms" className="text-foreground underline underline-offset-4">
              利用規約
            </Link>
            {' '}と{' '}
            <Link href="/privacy" className="text-foreground underline underline-offset-4">
              プライバシーポリシー
            </Link>
            {' '}に同意したものとみなします。
          </span>
        </label>
        {state.errors?.acceptTerms ? (
          <span className="text-xs text-red-500">{state.errors?.acceptTerms}</span>
        ) : null}

        <div className="flex justify-end">
          <SubmitButton pendingLabel="送信中...">申請する</SubmitButton>
        </div>
      </form>
      <SuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onGoPending={() => {
          setShowSuccessModal(false);
          router.push('/pending');
        }}
      />
    </div>
  );
}

function PendingModal() {
  const { pending } = useFormStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !pending) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-lg">
        <p className="text-sm text-slate-500">申請を送信しています。しばらくお待ちください…</p>
      </div>
    </div>,
    document.body
  );
}

function SuccessModal({
  open,
  onClose,
  onGoPending
}: {
  open: boolean;
  onClose: () => void;
  onGoPending: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
        <div className="space-y-3 text-sm text-slate-600">
          <h2 className="text-lg font-semibold text-foreground">申請を受け付けました</h2>
          <p>利用申請とアカウント登録を受け付けました。承認完了まで今しばらくお待ちください。</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            閉じる
          </Button>
          <Button type="button" onClick={onGoPending}>
            ベンダー画面に進む
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
