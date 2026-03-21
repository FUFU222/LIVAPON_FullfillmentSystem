'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { updateVendorProfileAction } from '@/app/vendor/profile/actions';
import type { VendorProfileActionState } from '@/app/vendor/profile/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';

export type VendorProfileInitialValues = {
  companyName: string;
  contactName: string | null;
  contactEmail: string;
  notificationEmails: string[];
  vendorCode: string | null;
  contactPhone: string | null;
  notifyNewOrders: boolean;
};

const INITIAL_VENDOR_PROFILE_STATE: VendorProfileActionState = {
  status: 'idle',
  message: null,
  submissionId: null
};

const NOTIFICATION_EMAIL_INPUT_IDS = ['notificationEmail1', 'notificationEmail2'] as const;

function shouldPreventEnterSubmit(event: ReactKeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter') {
    return false;
  }

  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLTextAreaElement) {
    return false;
  }

  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  return !['submit', 'button', 'checkbox', 'radio', 'file'].includes(target.type);
}

export function VendorProfileForm({ initial }: { initial: VendorProfileInitialValues }) {
  const [state, formAction] = useFormState(updateVendorProfileAction, INITIAL_VENDOR_PROFILE_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const { showToast } = useToast();
  const router = useRouter();
  const notificationEmailValues = NOTIFICATION_EMAIL_INPUT_IDS.map(
    (_inputId, index) => initial.notificationEmails[index] ?? ''
  );

  function handleFormKeyDown(event: ReactKeyboardEvent<HTMLFormElement>) {
    if (shouldPreventEnterSubmit(event)) {
      event.preventDefault();
    }
  }

  useEffect(() => {
    if (state.status === 'success' && state.message) {
      showToast({
        variant: 'success',
        title: 'セラー情報を保存しました。最新の内容が反映されています。'
      });
      formRef.current?.reset();
      router.refresh();
    }

    if (state.status === 'error' && state.message && !state.fieldErrors) {
      showToast({
        variant: 'error',
        title: '保存に失敗しました。時間を置いて再度お試しください。'
      });
    }
  }, [router, showToast, state.fieldErrors, state.message, state.status, state.submissionId]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-6" onKeyDown={handleFormKeyDown}>
      <div className="grid gap-2">
        <label htmlFor="companyName" className="text-sm font-medium text-foreground">
          会社名
        </label>
        <Input
          id="companyName"
          name="companyName"
          defaultValue={initial.companyName}
          placeholder="株式会社LIVAPON"
          autoComplete="organization"
          required
          aria-invalid={state.fieldErrors?.companyName ? 'true' : 'false'}
        />
        {state.fieldErrors?.companyName ? (
          <p className="text-xs text-red-600">{state.fieldErrors.companyName}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label htmlFor="contactName" className="text-sm font-medium text-foreground">
          担当者名
        </label>
        <Input
          id="contactName"
          name="contactName"
          defaultValue={initial.contactName ?? ''}
          placeholder="田中 太郎"
          autoComplete="name"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="contactPhone" className="text-sm font-medium text-foreground">
          発送担当者の電話番号
        </label>
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          defaultValue={initial.contactPhone ?? ''}
          placeholder="03-1234-5678"
          autoComplete="tel"
          required
          aria-invalid={state.fieldErrors?.contactPhone ? 'true' : 'false'}
        />
        {state.fieldErrors?.contactPhone ? (
          <p className="text-xs text-red-600">{state.fieldErrors.contactPhone}</p>
        ) : (
          <p className="text-xs text-slate-500">緊急時の連絡先として利用します。</p>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <Checkbox
          id="notifyNewOrders"
          name="notifyNewOrders"
          defaultChecked={initial.notifyNewOrders}
          className="mt-1"
        />
        <div className="text-sm text-slate-600">
          <label htmlFor="notifyNewOrders" className="font-medium text-foreground">
            新規注文メール通知
          </label>
          <p className="text-xs text-slate-500">
            連絡先メールアドレスと追加通知先へ注文内容の通知が届きます。不要な場合はチェックを外してください。
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="contactEmail" className="text-sm font-medium text-foreground">
          連絡先メールアドレス
        </label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={initial.contactEmail}
          placeholder="contact@example.com"
          autoComplete="email"
          required
          aria-invalid={state.fieldErrors?.contactEmail ? 'true' : 'false'}
        />
        {state.fieldErrors?.contactEmail ? (
          <p className="text-xs text-red-600">{state.fieldErrors.contactEmail}</p>
        ) : (
          <p className="text-xs text-slate-500">緊急連絡先としても使われ、注文通知はこのアドレスを含めて送信されます。</p>
        )}
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">追加通知先メールアドレス</p>
          <p className="text-xs text-slate-500">
            連絡先メールアドレスに加えて、最大2件まで注文通知の送信先を追加できます。
          </p>
        </div>
        {NOTIFICATION_EMAIL_INPUT_IDS.map((inputId, index) => {
          const value = notificationEmailValues[index];
          const errorMessage = state.fieldErrors?.[inputId];

          return (
            <div key={inputId} className="grid gap-2">
              <label htmlFor={inputId} className="text-sm font-medium text-foreground">
                追加通知先 {index + 1}
              </label>
              <Input
                id={inputId}
                name={inputId}
                type="email"
                defaultValue={value}
                placeholder={`notify-extra${index + 1}@example.com`}
                autoComplete="email"
                aria-invalid={errorMessage ? 'true' : 'false'}
              />
              {errorMessage ? (
                <p className="text-xs text-red-600">{errorMessage}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">ログイン情報</p>
          <p className="text-xs text-slate-500">ログイン用メールアドレスは別管理です。ここではパスワードのみ変更できます。</p>
        </div>
        <div className="grid gap-2">
          <label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
            現在のパスワード
          </label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            placeholder="現在のパスワード"
            autoComplete="current-password"
            aria-invalid={state.fieldErrors?.currentPassword ? 'true' : 'false'}
          />
          {state.fieldErrors?.currentPassword ? (
            <p className="text-xs text-red-600">{state.fieldErrors.currentPassword}</p>
          ) : (
            <p className="text-xs text-slate-500">新しいパスワードを設定する場合のみ入力してください。</p>
          )}
        </div>

        <div className="grid gap-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            新しいパスワード（任意）
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="8文字以上で入力"
            autoComplete="new-password"
            aria-invalid={state.fieldErrors?.password ? 'true' : 'false'}
          />
          {state.fieldErrors?.password ? (
            <p className="text-xs text-red-600">{state.fieldErrors.password}</p>
          ) : (
            <p className="text-xs text-slate-500">新しいパスワードを設定する場合のみ入力してください。</p>
          )}
        </div>
      </div>

      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive">{state.message ?? '更新に失敗しました。'}</Alert>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="px-6" disabled={pending}>
      {pending ? '保存中…' : '保存する'}
    </Button>
  );
}
