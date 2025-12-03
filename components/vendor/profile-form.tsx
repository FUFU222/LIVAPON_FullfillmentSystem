'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { updateVendorProfileAction } from '@/app/vendor/profile/actions';
import type { VendorProfileActionState } from '@/app/vendor/profile/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';

export type VendorProfileInitialValues = {
  companyName: string;
  contactName: string | null;
  email: string;
  vendorCode: string | null;
  contactPhone: string | null;
};

const INITIAL_VENDOR_PROFILE_STATE: VendorProfileActionState = {
  status: 'idle',
  message: null
};

export function VendorProfileForm({ initial }: { initial: VendorProfileInitialValues }) {
  const [state, formAction] = useFormState(updateVendorProfileAction, INITIAL_VENDOR_PROFILE_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success' && state.message) {
      showToast({ variant: 'success', title: state.message });
      formRef.current?.reset();
      router.refresh();
    }

    if (state.status === 'error' && state.message) {
      showToast({ variant: 'error', title: state.message });
    }
  }, [router, showToast, state.message, state.status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-6">
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

      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          メールアドレス
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initial.email}
          placeholder="user@example.com"
          autoComplete="email"
          required
          aria-invalid={state.fieldErrors?.email ? 'true' : 'false'}
        />
        {state.fieldErrors?.email ? (
          <p className="text-xs text-red-600">{state.fieldErrors.email}</p>
        ) : null}
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
