"use client";

import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

export default function SessionTestPage() {
  useEffect(() => {
    const supabase = getBrowserClient();

    supabase.auth.getSession().then((result) => {
      console.log("🔎 user_metadata:", result.data.session?.user?.user_metadata ?? null);
      console.log("🔎 app_metadata:", result.data.session?.user?.app_metadata ?? null);
    });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-sm text-slate-600">
      <h1 className="text-2xl font-semibold text-foreground">Supabase Session Test</h1>
      <p>ブラウザの Console を開くと Supabase の session 情報が表示されます。</p>
    </main>
  );
}
