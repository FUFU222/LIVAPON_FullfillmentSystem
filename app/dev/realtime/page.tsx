"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const probeGuardKey = process.env.NEXT_PUBLIC_REALTIME_PROBE_KEY ?? null;

export default function RealtimeProbePage() {
  const debug = process.env.NEXT_PUBLIC_DEBUG_REALTIME === "true";
  const hasGuard = typeof probeGuardKey === "string" && probeGuardKey.length > 0;
  const [isAllowed, setIsAllowed] = useState(!hasGuard);
  const [guardChecked, setGuardChecked] = useState(!hasGuard);

  useEffect(() => {
    if (!hasGuard) {
      setIsAllowed(true);
      setGuardChecked(true);
      return;
    }

    if (typeof window === "undefined") {
      // should never happen on client, but stay safe
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const match = params.get("key") === probeGuardKey;
    setIsAllowed(match);
    setGuardChecked(true);
  }, [hasGuard]);

  useEffect(() => {
    if (!guardChecked || !isAllowed) {
      if (debug) {
        console.warn("Realtime probe blocked: missing or invalid key");
      }
      return;
    }

    const channel = supabase
      .channel("probe-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (debug) {
            console.log("🔥 orders change", payload);
          }
        }
      )
      .subscribe((status) => {
        if (debug) {
          console.log("🔌 realtime status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [debug, guardChecked, isAllowed]);

  return null;
}
