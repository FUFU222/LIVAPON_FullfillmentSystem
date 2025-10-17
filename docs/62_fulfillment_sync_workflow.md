# 62 Fulfillment Sync ワークフローと耐障害設計

## データマッピングの基本
- Supabase 側の関連テーブル
  - `shipments`: 追跡番号・配送業者・発送ステータスを保持。
  - `shipment_line_items`: 出荷と注文ラインの対応、数量を管理。
  - `line_items`: Shopify の `line_item_id` やベンダー情報を保持。
- マッピング手順
  1. 対象注文の Fulfillment Order を Shopify から取得。
  2. Supabase の `line_item_id` をキーに FO ラインアイテムを特定。
  3. `shipment_line_items` の数量を `line_items_by_fulfillment_order` に組み立てる。
  4. `shipments` の追跡番号・配送会社を `tracking_info` に設定する（SKU は Shopify には送らない）。

## 同期ワークフロー（MVP）
1. ベンダーが UI で「発送済みにする」を実行し、追跡情報を入力。
2. バックエンドは Supabase を更新（`status = shipped` など）。
3. 続いて Shopify Fulfillment API を呼び出し、対応する Fulfillment を作成。
4. 成功時は Supabase に「同期済み」情報を記録し、UI に成功トーストを表示。
5. 失敗時は Supabase 内で `unsynced` 状態として残し、エラー内容を UI に伝える。

### 取消（未発送に戻す）の扱い
- `POST /admin/api/{version}/fulfillments/{fulfillment_id}/cancel.json` を呼び出し、Shopify 側の発送を取り消す。UI の「未発送に戻す」と連動させる。

## エラーハンドリング
- 代表的なエラー
  - **401/403**: OAuth スコープ不足・トークン失効。
  - **404**: FO ID / Fulfillment ID 不正。
  - **422**: リクエスト不備（数量超過、運送会社名の表記ゆれなど）。
  - **429**: レート制限（REST 約 40 リクエスト／分）。少なくとも 1 秒待機して再送。
- UI 側には、原因と対処が分かるテキストでフィードバックする（例：「権限が不足しています。アプリの再認可を確認してください」）。

## リトライ設計
- **手動リトライ**: 失敗した出荷に「再送信」ボタンを用意。CSV 一括処理では失敗行だけ再送できる設計が便利。
- **自動リトライ（任意）**: 指数バックオフ付きで数回再試行。それでも失敗する場合はユーザーに通知。
- リトライ待ちの出荷は「発送済み（未同期）」など明示的に区別し、保留状態を UI で把握できるようにする。

## 非同期キュー化（将来）
- 発送量が増えたら、Supabase トリガー＋Edge Functions などで Shopify 送信をバックグラウンド化し、キューでリトライ制御することも検討。
- キュー化した場合は UI で処理進捗を表示し、即時性低下への不安を軽減する。

