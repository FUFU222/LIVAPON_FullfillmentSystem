'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useFormStatus } from 'react-dom';
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
  const [state, formAction] = useActionState(submitVendorApplication, initialApplyFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const router = useRouter();
  const hasFieldErrors = Object.keys(state.errors ?? {}).length > 0;

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset();
      setShowSuccessModal(true);
    }
  }, [state.status]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-2 text-center px-2">
        <h1 className="text-2xl font-semibold text-foreground">利用申請</h1>
        <p className="text-sm leading-relaxed text-slate-500">
          アカウント情報と会社情報を入力し、利用申請をしてください。
        </p>
      </div>

      {state.status === 'error' && state.message && !hasFieldErrors ? (
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
            担当者名
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
            aria-invalid={state.errors?.contactEmail ? 'true' : 'false'}
            className={state.errors?.contactEmail ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
          />
          {state.errors?.contactEmail ? (
            <span className="text-xs text-red-500">{state.errors?.contactEmail}</span>
          ) : null}
        </div>

        <div className="grid gap-2 text-sm text-slate-600">
          <label htmlFor="contactPhone" className="font-medium text-foreground">
            発送担当者の電話番号
          </label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            required
            placeholder="例: 03-1234-5678 / 080-1234-5678"
            autoComplete="tel"
            aria-invalid={state.errors?.contactPhone ? 'true' : 'false'}
            className={state.errors?.contactPhone ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
          />
          <p className="text-xs text-slate-500">発送に関する緊急連絡で使用します。</p>
          {state.errors?.contactPhone ? (
            <span className="text-xs text-red-500">{state.errors?.contactPhone}</span>
          ) : null}
        </div>

        {/* 発送元住所 — 納品書 PDF の「出荷元」欄に印字される。新規申請では必須。 */}
        <fieldset className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-4">
          <legend className="px-1 text-sm font-medium text-foreground">発送元住所</legend>
          <p className="text-xs text-slate-500">
            納品書(packing slip)に印字される、商品の出荷元となる住所です。
          </p>

          <div className="grid gap-2 text-sm text-slate-600 sm:max-w-[240px]">
            <label htmlFor="postal" className="font-medium text-foreground">
              郵便番号
            </label>
            <Input
              id="postal"
              name="postal"
              required
              placeholder="123-4567"
              autoComplete="postal-code"
              inputMode="numeric"
              aria-invalid={state.errors?.postal ? 'true' : 'false'}
              className={state.errors?.postal ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
            />
            {state.errors?.postal ? (
              <span className="text-xs text-red-500">{state.errors?.postal}</span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2 text-sm text-slate-600">
              <label htmlFor="prefecture" className="font-medium text-foreground">
                都道府県
              </label>
              <Input
                id="prefecture"
                name="prefecture"
                required
                placeholder="東京都"
                autoComplete="address-level1"
                aria-invalid={state.errors?.prefecture ? 'true' : 'false'}
                className={state.errors?.prefecture ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
              />
              {state.errors?.prefecture ? (
                <span className="text-xs text-red-500">{state.errors?.prefecture}</span>
              ) : null}
            </div>
            <div className="grid gap-2 text-sm text-slate-600">
              <label htmlFor="city" className="font-medium text-foreground">
                市区町村
              </label>
              <Input
                id="city"
                name="city"
                required
                placeholder="港区南青山"
                autoComplete="address-level2"
                aria-invalid={state.errors?.city ? 'true' : 'false'}
                className={state.errors?.city ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
              />
              {state.errors?.city ? (
                <span className="text-xs text-red-500">{state.errors?.city}</span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 text-sm text-slate-600">
            <label htmlFor="address1" className="font-medium text-foreground">
              番地
            </label>
            <Input
              id="address1"
              name="address1"
              required
              placeholder="2-2-15"
              autoComplete="address-line1"
              aria-invalid={state.errors?.address1 ? 'true' : 'false'}
              className={state.errors?.address1 ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
            />
            {state.errors?.address1 ? (
              <span className="text-xs text-red-500">{state.errors?.address1}</span>
            ) : null}
          </div>

          <div className="grid gap-2 text-sm text-slate-600">
            <label htmlFor="address2" className="font-medium text-foreground">
              建物名・部屋番号 (任意)
            </label>
            <Input
              id="address2"
              name="address2"
              placeholder="○○ビル 3F"
              autoComplete="address-line2"
            />
          </div>
        </fieldset>

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
            aria-invalid={state.errors?.password ? 'true' : 'false'}
            className={state.errors?.password ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
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
            aria-invalid={state.errors?.passwordConfirm ? 'true' : 'false'}
            className={state.errors?.passwordConfirm ? 'border-red-300 focus-visible:ring-red-400/70' : undefined}
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
            セラー画面に進む
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
