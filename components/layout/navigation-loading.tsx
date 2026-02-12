"use client";

import { Loader2 } from "lucide-react";

export function NavigationLoadingOverlay() {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-center">
        <div
          className="flex items-center rounded-xl border border-slate-200 bg-white/90 px-6 py-4 shadow-lg"
          role="status"
          aria-label="読み込み中"
        >
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
