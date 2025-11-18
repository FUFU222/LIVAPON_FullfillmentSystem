"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { buttonClasses, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";

const statusOptions = [
  { value: "", label: "全ての注文" },
  { value: "unfulfilled", label: "未発送" },
  { value: "partially_fulfilled", label: "一部発送済" },
  { value: "fulfilled", label: "発送済" }
];

export function OrderFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const hasActiveFilters = useMemo(() => {
    const q = params?.get("q") ?? "";
    const s = params?.get("status") ?? "";
    return q.length > 0 || s.length > 0;
  }, [params]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setKeyword(params?.get("q") ?? "");
    setStatus(params?.get("status") ?? "");
  }, [open, params]);

  const buildSearchParams = (nextKeyword: string, nextStatus: string) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    const trimmed = nextKeyword.trim();
    if (trimmed.length > 0) {
      next.set("q", trimmed);
    } else {
      next.delete("q");
    }

    if (nextStatus) {
      next.set("status", nextStatus);
    } else {
      next.delete("status");
    }
    return next;
  };

  const applyFilters = () => {
    const next = buildSearchParams(keyword, status);
    startTransition(() => {
      const query = next.toString();
      router.replace(query ? `/orders?${query}` : "/orders");
    });
    setOpen(false);
  };

  const clearFilters = () => {
    setKeyword("");
    setStatus("");
    const next = buildSearchParams("", "");
    startTransition(() => {
      const query = next.toString();
      router.replace(query ? `/orders?${query}` : "/orders");
    });
  };

  return (
    <>
      <button
        type="button"
        className={buttonClasses(
          "outline",
          "gap-2 px-3 py-2 text-sm text-slate-600 data-[active=true]:border-foreground data-[active=true]:text-foreground"
        )}
        onClick={() => setOpen(true)}
        data-active={hasActiveFilters}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        検索
        {hasActiveFilters ? (
          <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-foreground" />
        ) : null}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="注文を検索"
        description="注文番号または顧客名とステータスでフィルタリングできます。"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={clearFilters} disabled={isPending}>
              条件をクリア
            </Button>
            <Button type="button" onClick={applyFilters} disabled={isPending}>
              {isPending ? "検索中…" : "検索する"}
            </Button>
          </div>
        }
        showCloseButton
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">キーワード</label>
            <Input
              value={keyword}
              placeholder="注文番号・顧客名で検索"
              onChange={(event) => setKeyword(event.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">ステータス</label>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              disabled={isPending}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Modal>
    </>
  );
}
