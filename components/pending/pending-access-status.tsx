'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BadgeCheck, Loader2, RefreshCw } from 'lucide-react';
import { resolveRoleFromAuthUser, resolveVendorIdFromAuthUser } from '@/lib/auth-metadata';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const POLL_INTERVAL_MS = 20_000;

type AccessState = 'pending' | 'active';

export function PendingAccessStatus() {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserClient(), []);
  const [accessState, setAccessState] = useState<AccessState>('pending');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkAccessState = useCallback(
    async (options?: { manual?: boolean }) => {
      setIsChecking(true);
      setErrorMessage(null);

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setErrorMessage('利用状態の確認に失敗しました。時間をおいて再度お試しください。');
        setIsChecking(false);
        return;
      }

      const role = resolveRoleFromAuthUser(data.user);
      const vendorId = resolveVendorIdFromAuthUser(data.user);

      if (role === 'admin') {
        router.replace('/admin');
        setIsChecking(false);
        return;
      }

      if (vendorId !== null) {
        setAccessState('active');
        setIsChecking(false);
        return;
      }

      setAccessState('pending');

      if (options?.manual) {
        router.refresh();
      }

      setIsChecking(false);
    },
    [router, supabase.auth]
  );

  useEffect(() => {
    void checkAccessState();
  }, [checkAccessState]);

  useEffect(() => {
    if (accessState === 'active') {
      return;
    }

    const timer = window.setInterval(() => {
      void checkAccessState();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [accessState, checkAccessState]);

  if (accessState === 'active') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-600" aria-hidden="true" />
          <div className="space-y-3">
            <p className="font-medium text-emerald-900">利用開始の準備が整いました。</p>
            <p className="text-emerald-800">
              審査が完了し、配送管理画面をご利用いただけます。以下のボタンからお進みください。
            </p>
            <Button
              type="button"
              className="inline-flex items-center gap-2"
              onClick={() => router.push('/orders')}
            >
              配送管理画面へ進む
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Alert>
        お申し込みありがとうございます。現在、運営チームが内容を確認しています。承認が完了するとセラー向け機能が利用可能になります。利用開始まで今しばらくお待ちください。
      </Alert>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">この画面は20秒ごとに利用状態を確認します。</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void checkAccessState({ manual: true })}
          disabled={isChecking}
          className="inline-flex items-center gap-2 self-start"
        >
          {isChecking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          状況を更新
        </Button>
      </div>
      {errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
    </div>
  );
}
