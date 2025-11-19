"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [keyword, setKeyword] = useState(params?.get("q") ?? "");
  const [status, setStatus] = useState(params?.get("status") ?? "");

  useEffect(() => {
    setKeyword(params?.get("q") ?? "");
    setStatus(params?.get("status") ?? "");
  }, [params]);

  const applyFilters = (nextKeyword: string, nextStatus: string) => {
    const search = new URLSearchParams(params?.toString() ?? "");
    const trimmed = nextKeyword.trim();
    if (trimmed.length > 0) {
      search.set("q", trimmed);
    } else {
      search.delete("q");
    }
    if (nextStatus) {
      search.set("status", nextStatus);
    } else {
      search.delete("status");
    }
    startTransition(() => {
      const query = search.toString();
      router.replace(query ? `/orders?${query}` : "/orders");
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilters(keyword, status);
  };

  const handleClear = () => {
    setKeyword("");
    setStatus("");
    applyFilters("", "");
  };

  const hasFilters = keyword.trim().length > 0 || status.length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm",
        isPending && "opacity-80"
      )}
    >
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="注文番号・顧客名で検索"
          disabled={isPending}
          className="flex-1 border-none bg-transparent px-0 text-sm focus-visible:ring-0"
        />
      </div>
      <Select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        disabled={isPending}
        className="w-40 text-sm"
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <div className="flex items-center gap-2">
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="gap-1 text-slate-500"
            onClick={handleClear}
            disabled={isPending}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            クリア
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "検索中…" : "検索"}
        </Button>
      </div>
    </form>
  );
}
