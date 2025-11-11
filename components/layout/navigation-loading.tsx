"use client";

import { Loader2 } from "lucide-react";

export function NavigationLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-6 py-4 text-sm font-medium text-slate-600 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden="true" />
          画面を読み込み中です…
        </div>
      </div>
    </div>
  );
}
