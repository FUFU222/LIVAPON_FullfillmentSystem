'use client';

import { Bell, Building2, KeyRound, Mail, Phone, ShieldCheck, User, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { updateVendorProfileAction } from '@/app/vendor/profile/actions';
import type { VendorProfileActionState } from '@/app/vendor/profile/actions';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
    <form ref={formRef} action={formAction} className="grid gap-8" onKeyDown={handleFormKeyDown}>
      <ProfileSection
        icon={Building2}
        title="基本情報"
        description="発送担当として必要な会社情報と連絡先をまとめて更新できます。"
        tone="slate"
        hints={[
          { icon: User, label: '担当者名を管理' },
          { icon: Phone, label: '電話番号は緊急連絡先に利用' }
        ]}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
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
        </div>
      </ProfileSection>

      <ProfileSection
        icon={Bell}
        title="通知設定"
        description="注文通知の送信有無と送り先をひと目で調整できます。"
        tone="amber"
        hints={[
          { icon: Mail, label: '連絡先メールは通知先に必ず含まれます' },
          { icon: Bell, label: '追加通知先は最大2件まで' }
        ]}
      >
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-50 p-2 text-amber-700 ring-1 ring-amber-200">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <label htmlFor="notifyNewOrders" className="block text-sm font-semibold text-foreground">
                新規注文メール通知
              </label>
              <p className="text-xs leading-5 text-slate-500">
                注文内容を連絡先メールアドレスと追加通知先へ送信します。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className={initial.notifyNewOrders
                ? 'border-amber-200 bg-amber-50 text-amber-700 normal-case tracking-normal'
                : 'border-slate-200 bg-slate-50 text-slate-600 normal-case tracking-normal'}
            >
              {initial.notifyNewOrders ? '現在 ON' : '現在 OFF'}
            </Badge>
            <Checkbox
              id="notifyNewOrders"
              name="notifyNewOrders"
              defaultChecked={initial.notifyNewOrders}
              aria-describedby="notifyNewOrdersHint"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
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
              aria-describedby="notifyNewOrdersHint"
            />
            {state.fieldErrors?.contactEmail ? (
              <p className="text-xs text-red-600">{state.fieldErrors.contactEmail}</p>
            ) : (
              <p id="notifyNewOrdersHint" className="text-xs text-slate-500">
                主通知先として必ず含まれ、緊急連絡先としても利用されます。
              </p>
            )}
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
                ) : (
                  <p className="text-xs text-slate-500">必要な通知先だけを追加できます。</p>
                )}
              </div>
            );
          })}
        </div>
      </ProfileSection>

      <ProfileSection
        icon={ShieldCheck}
        title="ログイン・セキュリティ"
        description="パスワード変更だけを独立して扱えるように分けています。"
        tone="emerald"
        hints={[
          { icon: KeyRound, label: '変更時のみ入力' },
          { icon: Mail, label: 'ログイン用メールアドレスは別管理' }
        ]}
      >
        <div className="grid gap-5 sm:grid-cols-2">
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
              <p className="text-xs text-slate-500">変更時のみ入力してください。</p>
            )}
          </div>

          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              新しいパスワード
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
      </ProfileSection>

      {state.status === 'error' && !state.fieldErrors ? (
        <Alert variant="destructive">{state.message ?? '更新に失敗しました。'}</Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          保存すると、最新の連絡先・通知設定・ログイン情報に更新されます。
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}

function ProfileSection({
  icon: Icon,
  title,
  description,
  tone,
  hints,
  children
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: 'slate' | 'amber' | 'emerald';
  hints: Array<{ icon: LucideIcon; label: string }>;
  children: ReactNode;
}) {
  const toneClasses = {
    slate: {
      panel: 'border-slate-200 bg-white',
      icon: 'bg-slate-900 text-white',
      hint: 'border-slate-200 bg-slate-50 text-slate-600'
    },
    amber: {
      panel: 'border-amber-200 bg-amber-50/40',
      icon: 'bg-amber-500 text-white',
      hint: 'border-amber-200 bg-white text-amber-700'
    },
    emerald: {
      panel: 'border-emerald-200 bg-emerald-50/40',
      icon: 'bg-emerald-500 text-white',
      hint: 'border-emerald-200 bg-white text-emerald-700'
    }
  } as const;

  return (
    <section className={`grid gap-5 rounded-2xl border p-5 sm:p-6 ${toneClasses[tone].panel}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-2xl p-3 shadow-sm ${toneClasses[tone].icon}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hints.map(({ icon: HintIcon, label }) => (
            <span
              key={label}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${toneClasses[tone].hint}`}
            >
              <HintIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </div>
      {children}
    </section>
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
