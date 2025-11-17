"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const probeGuardKey = process.env.NEXT_PUBLIC_REALTIME_PROBE_KEY ?? null;

export default function RealtimeProbePage() {
  const searchParams = useSearchParams();
  const debug = process.env.NEXT_PUBLIC_DEBUG_REALTIME === "true";
  const hasGuard = typeof probeGuardKey === "string" && probeGuardKey.length > 0;
  const providedGuard = searchParams.get("key");
  const isAllowed = hasGuard ? providedGuard === probeGuardKey : true;

  useEffect(() => {
    if (!isAllowed) {
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
  }, [debug, isAllowed]);

  return null;
}
