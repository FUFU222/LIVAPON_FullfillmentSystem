# Realtime Troubleshooting Log

最終更新: 2025-11-18

## 1. 概況
- Shopify Webhook → Supabase upsert → Realtime 伝搬までは成功 (`orders`/`line_items`/`shipments` が supabase_realtime publication から配信されることを /dev/realtime で確認)。
- 匿名クライアントや `getBrowserClient()` + filter 無しの購読 (/dev/realtime-jwt) でもイベントは受信できるため、RLS や JWT は起点ではない。
- `/dev/realtime-vendor` と `/orders` の Client Component では Listener mount, SUBSCRIBED から先でイベントが届かず、UI も更新されない。
- `/dev/realtime-vendor` では同時に Supabase REST (`/rest/v1/vendors`) が `Failed to fetch` となり、再レンダー→チャンネル再作成がループしている疑い。

## 2. 切り分け済みテスト
| ページ | 条件 | 結果 / メモ |
| --- | --- | --- |
| `/dev/realtime` | 匿名、RLS 無し、filter 無し | ◎ Postgres Changes を多数受信 |
| `/dev/realtime-jwt` | `getBrowserClient()` + JWT, filter 無し | ◎ `🔥 orders change` ログが出続ける |
| `/dev/realtime-vendor` | Client-only + session vendor_id + OrdersRealtimeListener | × イベント無、REST `/vendors` 失敗が発生 |
| `/orders` | Server + Client 構成 | × Listener は SUBSCRIBED まで。UI に変化なし |

## 3. 仮説と対策状況
1. **ベンダー区分テーブル `order_vendor_segments` を経由する**  
   - line_items の挿入/削除で order_id × vendor_id の行を自動生成し、`orders` 更新時は `updated_at` をタッチしてイベントを出す。  
   - Listener は `order_vendor_segments` を vendor フィルタ付きで購読し、注文全体の変更通知をここから受け取る。  
2. **Supabase ブラウザクライアントのセッション取得が遅延**  
   - `OrdersRealtimeListener` と `AppShell` の双方で `supabase.auth.getSession()` を await してから購読/REST コールを行うよう改修（2025-11-18）。  
   - `NEXT_PUBLIC_DEBUG_REALTIME` ログで JWT が常に存在するか追跡する。  
3. **REST `/vendors` 連打により Listener が頻繁に再生成**  
   - `AppShell` 側で `isMounted` フラグを導入し、アンマウント後の state 更新を防止。  
   - `/dev/realtime-vendor` を使い、同現象が再発しないか監視。  
4. **Server → Client の Suspense/redirect によるアンマウント**  
   - `/orders` については Client-only 版（暫定）を別途用意し、Server Component を経由しない形で Listener が動くか切り分け予定。  
5. **RLS 条件が line_items 依存で高コスト**  
   - `orders.vendor_id` だけで判定できる RLS に書き換える検討を backlog に保持。  
6. **channel filter 未指定のまま全イベントを購読**  
   - `order_vendor_segments` / `line_items` / `shipments` に vendor フィルタを付与し、不要なイベントを抑制する。 

## 4. 次のアクション
1. `/dev/realtime-vendor` を常時 `NEXT_PUBLIC_DEBUG_REALTIME=true` で観測し、`useEffect` cleanup 以降もイベントが届くか確認。
2. `/orders` を Client Component のみで構成した検証ページを追加し、Server Component 経由でもイベント遅延が無いか比較。
3. Vendor 情報の REST 呼び出しが失敗する根因（セッション欠如 / ネットワーク / fetch 設定）を調査し、必要なら AppShell 起動時に vendor name を SSR で受け渡す。 
4. RLS の vendor 判定を `orders.vendor_id` へ一本化する案を設計し、line_items JOIN を避けて Realtime event の負荷を下げる。  
5. Serena (コード検索 MCP) で `RealtimeListener` / `AppShell` に関連する参照を継続把握し、回帰チェックに活用する。 

## 5. リンク集
- 方針: `docs/livapon-realtime-sync-guidelines.md`
- テスト: `docs/42_realtime_test_plan.md`
- Orders Test Plan: `docs/63_orders_test_plan.md`
