"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const showTimerRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);
  const navigationInFlightRef = useRef(false);
  const startPathRef = useRef<string | null>(pathname ?? null);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearFailSafeTimer = useCallback(() => {
    if (failSafeTimerRef.current !== null) {
      window.clearTimeout(failSafeTimerRef.current);
      failSafeTimerRef.current = null;
    }
  }, []);

  const resetNavigationState = useCallback(() => {
    navigationInFlightRef.current = false;
    startPathRef.current = pathname ?? null;
    clearShowTimer();
    clearFailSafeTimer();
    setActive(false);
  }, [clearFailSafeTimer, clearShowTimer, pathname]);

  const beginNavigation = useCallback(() => {
    if (navigationInFlightRef.current) {
      return;
    }

    navigationInFlightRef.current = true;
    startPathRef.current = pathname ?? null;

    const DELAY_MS = 120;
    showTimerRef.current = window.setTimeout(() => {
      setActive(true);
      showTimerRef.current = null;
    }, DELAY_MS);

    // Failsafe only for pathological cases; normal hide is driven by pathname change.
    const FAILSAFE_MS = 15000;
    failSafeTimerRef.current = window.setTimeout(() => {
      resetNavigationState();
    }, FAILSAFE_MS);
  }, [pathname, resetNavigationState]);

  useEffect(() => {
    if (!navigationInFlightRef.current) {
      startPathRef.current = pathname ?? null;
      return;
    }

    if ((pathname ?? null) !== startPathRef.current) {
      resetNavigationState();
    }
  }, [pathname, resetNavigationState]);

  const contextValue = useMemo<OverlayContextValue>(() => ({ beginNavigation }), [beginNavigation]);

  useEffect(() => {
    return () => {
      clearShowTimer();
      clearFailSafeTimer();
    };
  }, [clearFailSafeTimer, clearShowTimer]);

  return (
    <NavigationOverlayContext.Provider value={contextValue}>
      {children}
      {active ? (
        <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm">
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
      ) : null}
    </NavigationOverlayContext.Provider>
  );
}
