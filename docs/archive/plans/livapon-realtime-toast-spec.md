
# LIVAPON Realtime Toast Spec (Codex)

> Version: 2025-11-18 / Owner: LIVAPON Core / Scope: Console UI (Next.js + Supabase)  
> Purpose: Define **when and how** to show realtime toasts for *external updates only*, plus implementation patterns (client + DB), accessibility, and tests.

---

## 0. Design Principles (grounded by major design systems)

- **Non-blocking, short, concise**: Toasts/snackbars provide at‑a‑glance feedback and should not interrupt work. Keep copy brief; 1 action max. citeturn0search0turn0search6turn0search27  
- **Use for non‑critical events only**. Critical/require‑action → message bar or modal, not toast. citeturn0search13turn0search2turn0search15
- **Placement is consistent** and avoids key controls; desktop usually top‑right or bottom‑right/bottom. citeturn0search13turn0search0
- **Don’t stack excessively**: show 1–3; queue the rest. (Common guidance across MD/enterprise systems.) citeturn0search27
- **A11y**: Announce politely (role/status, aria‑live=polite), no focus trap, readable durations. citeturn0search13turn0search18turn0search24
- **Admin/Shop UX precedent**: Shopify (Polaris/App Bridge) treats toasts as unobtrusive confirmations at the bottom; newer apps use App Bridge Toast API. citeturn0search14turn0search2

---

## 1. Scope and Goal

**Goal**: Notify users about **external, passive updates** (e.g., Shopify Webhook → Supabase → Realtime) without duplicating feedback for their **own actions**.

**Out of scope**: success/failure feedback for client‑initiated actions (those use inline UI or success banners, not a realtime toast).

---

## 2. When to show (Decision Matrix)

| Table / Event | Origin | Show Toast? | Copy Pattern | Action | Duration |
|---|---|---|---|---|---|
| `orders` INSERT | Webhook/other user | **Yes** | 🟢 新しい注文 #{{id}} が届きました | 詳細へ | 5s |
| `orders` UPDATE(status) | Webhook/other user | **Yes** | 🟡 注文 #{{id}} が更新: {{status}} | 一覧を更新 | 5s |
| `orders` UPDATE(cancelled) | Webhook/other user | **Yes** (Alert style) | 🔴 注文 #{{id}} はキャンセルされました | 詳細へ | 8s / manual |
| `line_items` INSERT/DELETE | Webhook/other user | **Yes** | 🟡 明細を更新（{{diff}}） | OK | 4s |
| `shipments` INSERT | Webhook/other user | **Yes** | 🟢 出荷を作成: {{tracking_no}} | 追跡 | 6s |
| `shipments` UPDATE(status) | Webhook/other user | **Yes** | 🟡 出荷が {{status}} に | 追跡 | 5s |
| Any table, any event | **Self‑initiated** (same session) | **No** (suppress) | — | — | — |
| Critical failure (DB/WS) | System | **No toast** → bar/modal | — | — | — |

Rationale: constrain toasts to non‑blocking, non‑critical feedback; use message bars/modals for required decisions. citeturn0search13turn0search2

---

## 3. UI Spec

- **Placement**: top‑right (desktop console); avoid overlapping header actions. Alternative: bottom for embedded contexts. citeturn0search13turn0search0
- **Max visible**: 3; FIFO queue, auto‑dismiss for info/update; alerts manual. citeturn0search27
- **Visuals**: subtle surface (`bg-white/90`, soft shadow), semantic border (green/yellow/red).  
- **Action**: single CTA (e.g., 「詳細へ」「一覧を更新」). MD discourages multiple action links. citeturn0search0
- **A11y**: `role="status"` / `aria-live="polite"`; no focus grab; ensure screen reader announcement. citeturn0search13turn0search18
- **Persistence**: pair with **header badge** (“+n 新着”) for “see later” workflow.

---

## 4. Client Implementation (Next.js + Supabase)

### 4.1 Event source suppression (phase 1: client‑only heuristic)
Suppress toasts for events that match **recent self actions**.

```ts
// store/rt-source.ts
export const rtSource = {
  lastActionAt: 0,
  lastOrderIds: new Set<number>()
}

// When user performs an action (ship/create/cancel on order X)
export function markSelfAction(orderId: number) {
  rtSource.lastActionAt = Date.now();
  rtSource.lastOrderIds.add(orderId);
  setTimeout(() => rtSource.lastOrderIds.delete(orderId), 20_000); // exclusion window 20s
}

export function shouldToast(orderId: number) {
  const withinWindow = Date.now() - rtSource.lastActionAt < 20_000;
  return !(withinWindow && rtSource.lastOrderIds.has(orderId));
}
```

> Note: heuristic; multi‑tab/user edge cases remain. Use phase 2 to harden.

### 4.2 Realtime wiring (v2 client)
- Use Postgres Changes with filter + RLS; ensure **auth token is applied to Realtime** before subscribing. citeturn0search16

```ts
// lib/realtime.ts ("use client")
const supabase = getBrowserClient();

const { data: { session } } = await supabase.auth.getSession();
// Apply token so Realtime WS is authorized (required for RLS-protected feeds)
await supabase.realtime.setAuth?.(session?.access_token ?? "");
```

- Subscribe with per‑vendor filters to reduce noise: `filter: vendor_id=eq.${vendorId}`. citeturn0search16

```ts
const ch = supabase
  .channel(`orders-vendor-${vendorId}`)
  .on("postgres_changes",
      { event: "*", schema: "public", table: "orders", filter: `vendor_id=eq.${vendorId}` },
      (payload) => { if (shouldToast(extractOrderId(payload))) showToast(payload) })
  .on("postgres_changes",
      { event: "*", schema: "public", table: "shipments", filter: `vendor_id=eq.${vendorId}` },
      (p) => { if (shouldToast(extractOrderId(p))) showToast(p) })
  .subscribe();
```

### 4.3 UI component (shadcn/ui example)
```tsx
import { useToast, ToastAction } from "@/components/ui/use-toast";

export function showToastFromEvent(ev: { table: string; type: string; id: number; extra?: string }) {
  const { toast } = useToast();
  const title =
    ev.table === "orders" && ev.type === "INSERT"
      ? `🟢 新しい注文 #${ev.id} が届きました`
      : ev.table === "shipments" && ev.type === "UPDATE"
      ? `🟡 出荷が ${ev.extra} に更新`
      : `更新: #${ev.id}`;

  toast({
    title,
    description: `${ev.table} / #${ev.id}`,
    duration: 5000,
    action: <ToastAction altText="詳細へ" onClick={() => router.push(`/orders/${ev.id}`)}>詳細</ToastAction>
  });
}
```

---

## 5. Server/DB Implementation (phase 2: metadata‑aware)

**Problem**: client‑only suppression fails across tabs/users.  
**Solution**: persist **who/what updated** in row data and use it in Realtime payloads.

### 5.1 Schema extensions
Add audit fields to affected tables:

```sql
ALTER TABLE public.orders
  ADD COLUMN last_updated_by uuid,
  ADD COLUMN last_updated_source text; -- 'webhook' | 'worker' | 'console' | etc.

ALTER TABLE public.line_items
  ADD COLUMN last_updated_by uuid,
  ADD COLUMN last_updated_source text;

ALTER TABLE public.shipments
  ADD COLUMN last_updated_by uuid,
  ADD COLUMN last_updated_source text;
```

- Populate from app layer (Server Action/RPC), webhook workers, etc.  
- With **Postgres Changes**, these columns appear in `payload.new/old`, so the client can **suppress if `last_updated_by == current_user_id`**. citeturn0search16

### 5.2 Broadcast (optional scale path)
Use **realtime.broadcast_changes()** to emit per‑tenant (or per‑order) topics; private channels require **Realtime authorization policy**. citeturn0search5turn0search17turn0search23

```sql
-- Trigger example
CREATE OR REPLACE FUNCTION public.broadcast_order_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'vendor:' || COALESCE(NEW.vendor_id, OLD.vendor_id)::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER t_orders_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.broadcast_order_changes();
```

Authorization baseline (tighten in prod): citeturn0search17
```sql
CREATE POLICY "authenticated can receive broadcasts"
ON realtime.messages FOR SELECT TO authenticated USING (true);
```

> Docs note that `broadcast_changes` sends full change with metadata; `send` allows custom payloads. citeturn0search23

---

## 6. Copy & Tone

- Keep to **one line + one verb**. (MD/App Bridge style.) citeturn0search0turn0search14
- Examples (JP):
  - 🟢 新しい注文 #{{id}} が届きました
  - 🟡 注文 #{{id}} が更新: {{status}}
  - 🔴 注文 #{{id}} はキャンセルされました

---

## 7. Accessibility Checklist

- `role="status"` (`alert` only for error/urgent).  
- `aria-live="polite"` and durations long enough to read; provide a persistent **badge/history** for recall. citeturn0search18turn0search24
- Do not steal focus; no keyboard trap. citeturn0search13

---

## 8. Testing Matrix

| Case | Steps | Expectation |
|---|---|---|
| Self action suppression | User triggers ship on #123 → webhook echoes UPDATE | **No toast** appears (phase 1 heuristic; phase 2 match last_updated_by). |
| External new order | Webhook INSERT orders(#124) | Toast pops with 🟢 and 「詳細」; header badge +1. |
| Multi‑tab | Same user in 2 tabs → action in tab A | Phase 2: last_updated_by suppresses in **both** tabs. |
| RLS & filter | Subscribe with vendor filter | Events only for that vendor; no leaks. citeturn0search16 |
| Broadcast path (opt) | Fire trigger → private topic | Delivery only if realtime.messages policy permits. citeturn0search17 |
| A11y | Screen reader enabled | Announcement occurs; no focus change. citeturn0search18 |

---

## 9. References

- Material Design 3 — Snackbars: placement, content, actions. citeturn0search0turn0search6  
- Microsoft Fluent 2 — Toast usage (consistent location; non‑blocking). citeturn0search13  
- Shopify App Bridge — Toast (legacy Polaris → App Bridge). citeturn0search14turn0search2  
- Atlassian Design — flags vs dialogs (notification taxonomy). citeturn0search3  
- Supabase Realtime Docs — Postgres Changes, Broadcast & Auth. citeturn0search16turn0search5turn0search17turn0search23  
- A11y discussions/guides — Snackbar/Toast SR behavior. citeturn0search18turn0search24

---

## 10. Appendix: Drop‑in code (TS/SQL)

### A) Client suppressor hook
```ts
// hooks/useSelfActionSuppressor.ts
import { useRef } from "react";
export function useSelfActionSuppressor(windowMs = 20000) {
  const lastAt = useRef(0);
  const ids = useRef<Set<number>>(new Set());
  return {
    mark: (orderId: number) => {
      lastAt.current = Date.now();
      ids.current.add(orderId);
      setTimeout(() => ids.current.delete(orderId), windowMs);
    },
    allowToast: (orderId: number) => !(Date.now() - lastAt.current < windowMs && ids.current.has(orderId))
  };
}
```

### B) DB migration (audit columns)
```sql
-- 2025XXXX_add_audit_columns.sql
ALTER TABLE public.orders    ADD COLUMN IF NOT EXISTS last_updated_by uuid, ADD COLUMN IF NOT EXISTS last_updated_source text;
ALTER TABLE public.line_items ADD COLUMN IF NOT EXISTS last_updated_by uuid, ADD COLUMN IF NOT EXISTS last_updated_source text;
ALTER TABLE public.shipments  ADD COLUMN IF NOT EXISTS last_updated_by uuid, ADD COLUMN IF NOT EXISTS last_updated_source text;
```

### C) Example: Server Action writes audit
```ts
// app/actions/create-shipment.ts
"use server"
import { createServerClient } from "@/lib/supabase/server";

export async function createShipment(orderId: number, data: any) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("shipments").insert({
    order_id: orderId,
    ...data,
    last_updated_by: user?.id ?? null,
    last_updated_source: "console"
  });
}
```

### D) Realtime subscribe
```ts
// app/orders/_components/orders-realtime.tsx
"use client";
import { getBrowserClient } from "@/lib/supabase/client";
import { useSelfActionSuppressor } from "@/hooks/useSelfActionSuppressor";
import { showToastFromEvent } from "@/lib/toasts";

export function OrdersRealtime({ vendorId }: { vendorId: number }) {
  const supabase = getBrowserClient();
  const suppressor = useSelfActionSuppressor(20000);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);

      const ch = supabase.channel(`orders-vendor-${vendorId}`)
        .on("postgres_changes",
            { event: "*", schema: "public", table: "orders", filter: `vendor_id=eq.${vendorId}` },
            (p) => {
              const id = (p.new?.id ?? p.old?.id) as number;
              if (!suppressor.allowToast(id)) return;
              showToastFromEvent({ table: "orders", type: p.eventType, id });
            })
        .subscribe();
    })();
  }, [vendorId]);
}
```
