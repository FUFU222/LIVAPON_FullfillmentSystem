# Realtime Test Plan

最終更新: 2025-11-18

## 1. 目的
- Supabase Realtime（Postgres Changes）で注文/ラインアイテム/出荷の更新をセラー UI に即時反映させる。
- RLS・JWT・Channel 設定の組み合わせを明示し、バグ切り分けを高速化する。
- Serena コードサーチや /dev ページ群を併用し、回帰テストを自動化しやすい構造に整える。

## 2. テーブル & Publication 前提
1. `supabase_realtime` publication に `orders`, `line_items`, `shipments` を登録。  
   ```sql
   alter publication supabase_realtime add table public.orders;
   alter publication supabase_realtime add table public.line_items;
   alter publication supabase_realtime add table public.shipments;
   ```
2. UPDATE/DELETE 差分が必要なテーブルは `REPLICA IDENTITY FULL` を設定。  
   ```sql
   alter table public.orders replica identity full;
   ```
3. RLS は「RLS OFF → 無フィルタ購読 → RLS ON → vendor フィルタ」の順に検証する。

## 3. ページ別テストケース
| ページ | 条件 | 期待挙動 | カバレッジ |
| --- | --- | --- | --- |
| `/dev/realtime` | 匿名 (RLS 無効) | `orders`/`line_items`/`shipments` すべてのイベントが🔥ログとして表示される | Publication/Replica Identity |
| `/dev/realtime-jwt` | `getBrowserClient()` + JWT | `orders` イベントが vendor 関係なく表示。`RealtimeListener status` が `SUBSCRIBED` になる | JWT + RLS=OFF |
| `/dev/realtime-vendor` | Client-only + session vendor_id + `OrdersRealtimeListener` | `order_vendor_segments` / `line_items` / `shipments` が vendor フィルタで購読され、Debug バナーに対象注文だけが表示される。`/rest/v1/vendors` 取得が失敗しない | JWT + vendor フィルタ |
| `/orders` | Server+Client | `OrdersRealtimeListener` が SUBSCRIBED 後、UI バナーが件数を更新し `router.refresh()` で再読込できる | 実運用 UI |

## 4. 手動テスト手順
1. `NEXT_PUBLIC_DEBUG_REALTIME=true` を設定し、ブラウザ Console の `[realtime]` ログを有効化。
2. `/dev/realtime` を開き、`supabase sql` などで `insert into orders ...` を実行し、即時ログを確認。
3. `/dev/realtime-jwt` でサインイン済みユーザーとしてアクセスし、ログに JWT vendor_id が表示されるか確認。
4. `/dev/realtime-vendor` で `OrdersRealtimeListener` が vendor 限定イベントを受信するか (shipments/line_items/orders すべて)。
5. `/orders` でトーストやバナーがリアルタイム更新へ反応し、`OrdersRefreshButton` が fallback として機能するかチェック。

## 5. 自動化アイデア
- Playwright で `/dev/realtime-*` を `page.waitForConsoleMessage('🔥 orders change')` する smoke テスト。
- Serena で `OrdersRealtimeListener` の参照を検知し、PR ごとに影響範囲を表示。
- GitHub Actions で `supabase db lint` を実行し publication/replica identity の差分を検出。

## 6. チェックリスト
- [ ] `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` が揃っている。
- [ ] Supabase Dashboard で `orders/line_items/shipments` が publication に含まれている。
- [ ] `order_vendor_segments` が `line_items` トリガーで正しく生成され、publication / RLS / Realtime filter へ追加済み。
- [ ] `auth.jwt()->>'vendor_id'` が必ず設定され、RLS で参照可能。
- [ ] Listener が `supabase.auth.getSession()` 完了後に購読を開始している。
- [ ] `/rest/v1/vendors` など別 fetch がエラーを出さない。
- [ ] 失敗時のログ（Console/Toast）がユーザーに原因を伝える。

## 7. 参照
- 方針: `docs/livapon-realtime-sync-guidelines.md`
- 既知課題: `docs/41_realtime_troubleshooting.md`
- Orders 総合テスト: `docs/63_orders_test_plan.md`
