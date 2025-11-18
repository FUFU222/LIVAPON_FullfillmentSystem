"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { useOrdersRealtimeContext } from "./orders-realtime-context";

export function OrdersRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { showToast, dismissToast } = useToast();
  const refreshToastRef = useRef<string | null>(null);
  const { pendingCount, markOrdersAsRefreshed } = useOrdersRealtimeContext();
  const pendingSnapshotRef = useRef(0);

  function handleRefresh() {
    if (isPending) {
      return;
    }

    pendingSnapshotRef.current = pendingCount;

    const toastId = showToast({
      id: "orders-refresh-progress",
      title: "注文情報を更新中…",
      description: "最新の注文データを取得しています。",
      duration: Infinity,
      variant: "info",
    });

    refreshToastRef.current = toastId;

    startTransition(() => {
      router.refresh();
    });
  }

  useEffect(() => {
    if (!isPending && refreshToastRef.current) {
      const toastId = refreshToastRef.current;
      dismissToast(toastId);
      refreshToastRef.current = null;

      const hadUpdates = pendingSnapshotRef.current > 0;
      const toastPayload = hadUpdates
        ? {
            id: "orders-refresh-complete",
            title: "注文が最新の状態になりました",
            description: `注文 ${pendingSnapshotRef.current}件を反映しました。`,
            variant: "success" as const,
          }
        : {
            id: "orders-refresh-nochange",
            title: "更新はありませんでした",
            description: "一覧は最新の状態です。",
            variant: "info" as const,
          };

      const successId = showToast({ ...toastPayload, duration: 2500 });

      window.setTimeout(() => {
        dismissToast(successId);
      }, 2500);

      pendingSnapshotRef.current = 0;
      markOrdersAsRefreshed();
    }
  }, [isPending, dismissToast, showToast, markOrdersAsRefreshed]);

  useEffect(() => {
    return () => {
      if (refreshToastRef.current) {
        dismissToast(refreshToastRef.current);
        refreshToastRef.current = null;
      }
    };
  }, [dismissToast]);

  return (
    <button
      type="button"
      className={buttonClasses(
        "ghost",
        "gap-2 px-3 py-2 text-sm transition-opacity"
      )}
      onClick={handleRefresh}
      disabled={isPending}
      aria-busy={isPending}
    >
      <RefreshCw
        className={cn(
          "h-4 w-4 transition-transform",
          isPending && "animate-spin text-slate-400"
        )}
        aria-hidden="true"
      />
      <span className={cn("transition-opacity", isPending && "opacity-60")}>
        {isPending ? "再読み込み中…" : "再読み込み"}
      </span>
    </button>
  );
}
