"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

type OverlayContextValue = {
  beginNavigation: () => void;
};

const NavigationOverlayContext = createContext<OverlayContextValue | null>(null);

export function useNavigationOverlay() {
  const value = useContext(NavigationOverlayContext);
  if (!value) {
    throw new Error("useNavigationOverlay must be used within NavigationOverlayProvider");
  }
  return value;
}

export function NavigationOverlayProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  const beginNavigation = useCallback(() => {
    setActive(true);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setTimeout(() => {
      setActive(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [active, pathname]);

  const contextValue = useMemo<OverlayContextValue>(() => ({ beginNavigation }), [beginNavigation]);

  return (
    <NavigationOverlayContext.Provider value={contextValue}>
      {children}
      {active ? (
        <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm">
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-6 py-4 text-sm font-medium text-slate-600 shadow-lg">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden="true" />
              画面を読み込み中です…
            </div>
          </div>
        </div>
      ) : null}
    </NavigationOverlayContext.Provider>
  );
}
