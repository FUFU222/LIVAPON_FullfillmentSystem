# 開発状況サマリー（2025-11-20時点）

## 1. 整備済みの主なポイント
1. **OMモデル & データフロー**: `DEVELOPMENT_PLAN_OM_MODEL.md` で役割分担・API 要件・PULL 前提を確定。Bridge App を介して Shopify GraphQL (`order.fulfillmentOrders` など) を取得し、Console 側で FO を正規化する方針で合意済み。
2. **Bridge App / Shopify 設定**: `shopify.app.toml` に必要スコープと `/api/shopify/orders/ingest` Webhook を明示し、再認可も完了。最新トークンは `shopify_connections` テーブルで運用し、再発行時はここを更新すれば良い運用形となっている。
3. **Webhook キュー & ランナー**: `/api/shopify/orders/ingest` は即時に `webhook_jobs` テーブルへ enqueue。`status/attempts/last_error` を持つ行を `claim_pending_webhook_jobs()` (FOR UPDATE SKIP LOCKED) で安全に取り出し、`lib/jobs/webhook-runner.ts` → `processShopifyWebhook` で注文/FO を処理。内部 API `/api/internal/webhook-jobs/process` は `JOB_WORKER_SECRET` を必須にし、GitHub Actions（5 分間隔）から叩く構成へ切り替え済み。`WEBHOOK_JOB_LIMIT` repo variable や workflow_dispatch input でバッチサイズを可変にし、実行サマリを GHA の Step summary に記録するようにした。`ENABLE_INLINE_WEBHOOK_PROCESSING` と `INLINE_WEBHOOK_BATCH` で即時処理のオンデマンド切り替えも可能。
4. **Supabase マイグレーション反映**: 2025-11-13 に `webhook_jobs` テーブルと `claim_pending_webhook_jobs()` RPC を本番へ `supabase db push` 済み。`vendors.contact_name` など既存差分も含め、Stage/Prod が揃った状態。
5. **データベース & トークン管理**: Token/Scope は `shopify_connections` に保存し、Supabase Dashboard で直接確認できる。今後は同テーブルを UI で閲覧できれば十分。`/api/internal/shipments/resync` も GitHub Actions から 30 分間隔で呼び出し、`SHIPMENT_RESYNC_LIMIT` 可変 + Step summary に結果を記録する構成とした。発送済み注文の修正はユーザーからの申請フローに一本化し、コンソール上の「未発送に戻す」ボタンは廃止済み。

> 2025-11-20 追記: 2 つの GitHub Actions（`Process Webhook Jobs`, `Resync Pending Shipments`）に `workflow_dispatch` 入力と repo variable fallback (`WEBHOOK_JOB_LIMIT`, `SHIPMENT_RESYNC_LIMIT`) を追加し、Step summary へ処理件数ログを出すよう統一した。`timeout-minutes: 3`, `curl --max-time 20`, `jq` での `ok` 検証も導入し、失敗時は即エラーとして検知できる。Shipment 側は 30 分間隔、Webhook 側は 5 分間隔で運用中。
6. **UI/UX & リアルタイム同期**: 発送一覧の行高を調整し、リアルタイム購読で `shipments`/`line_items`/`orders` を即時更新。発送登録は「入力 → 確認」二段階、未発送へ戻す際は注意パネルと理由入力を必須化。ブランド表記を「配送管理コンソール」に統一し、ボタン/ナビの hover/active や操作中オーバーレイで体感スピードを底上げ。
7. **在庫ポリシー**: 在庫編集は Shopify GUI（マーチャント管理ロケーション）のみが真実の源。Console は閲覧＋同期に限定し、FS モデル由来の在庫操作フローは廃止済み。
8. **Fulfillment Callback**: `/api/shopify/fulfillment/callback` で Shopify → Console の配送依頼やメタ更新を受信し、`fulfillment_requests` テーブル経由で追跡・解析可能。
9. **Secret & Inline 設定**: 2025-11-13 に `JOB_WORKER_SECRET` をローカル/Vercel の両方へ投入済み。Cron が 1 日 1 回である現状は `ENABLE_INLINE_WEBHOOK_PROCESSING=true`、`INLINE_WEBHOOK_BATCH=5` を標準とし、Pro へ移行した時点で改めて見直す方針。2025-11-14 には GitHub Actions へ Cron を移行し、`JOB_WORKER_SECRET` / `CRON_SECRET` を Bearer 認証で利用する体制へ切り替えた。
10. **注文ステータス整合性と即時通知**: Shopify 側の `fulfilled_quantity` / `fulfillable_quantity` を優先する変換ロジックに変更し、注文一覧とラインアイテムの表示が Shopify 管理画面と即時一致するようにした。保留中の明細は `保留中` バッジで区別し、Supabase Realtime 経由で「新規注文 / 既存注文の更新件数」を含む通知バナーを出すよう改良（自動更新はユーザー操作で制御）。orders テーブルには `shopify_fo_status` を保存し、Webhook 受信時に FO メタを即時再同期 → 発送登録前にも FO 状態をチェックしてクローズ済みなら自動再同期 or 明示的なエラーメッセージを返すようにした。
11. **Realtime 配信の再設計** (NEW): Publication は Supabase 既定の `supabase_realtime` を利用し、`orders/line_items/shipments` を `ALTER PUBLICATION ... ADD TABLE ...` で登録する。UPDATE/DELETE が絡むテーブルは `REPLICA IDENTITY FULL` を付与し、RLS は「RLS OFF → 無フィルタ購読 → RLS ON → vendor フィルタ」の段階で検証する方針に統一した。`docs/livapon-realtime-sync-guidelines.md` にチェックリストを追記済み。
12. **発送修正申請フロー** (NEW): `/support/shipment-adjustment` にベンダー向けフォームを公開し、`shipment_adjustment_requests` テーブルへ保存→管理者審査する運用へ移行。注文番号・発生状況・希望対応を自然文で記入できるよう placeholder / helper を整備し、Console からの直接未発送戻しを完全廃止した。
13. **申請トリアージ画面** (NEW): `/admin/shipment-requests` に管理者向けボードを追加。申請一覧／コメント／ステータス更新／担当アサインを Console 内で完結させ、`shipment_adjustment_comments` に処置内容を記録してベンダーへ返信できるようにした。ベンダー側のフォームにも申請履歴を表示し、進捗をセルフサービスで確認できる。

### 1.1 Webhook 経路と通知設定
| 経路 | トピック | 目的 |
| ---- | ------- | ---- |
| Shopify → LIVAPON（直送） | `orders/create`, `orders/updated`, `orders/cancelled` | OM モデル用の注文反映 |
| Shopify → LIVAPON（直送） | `fulfillment_orders/order_routing_complete`, `fulfillment_orders/hold_released`, `fulfillment_orders/cancellation_request_accepted` | FO 状態の即時反映 |
| LIVAPON → Bridge App → Shopify | `fulfillmentCreateV2` 等 | 発送登録・追跡番号更新 |
| Bridge App 経由再同期 | 任意 | Webhook すり抜け時の再取得・監査 |

Webhook 検証では `SHOPIFY_WEBHOOK_SECRET` → `_APP` → `_STORE` → `SHOPIFY_API_SECRET` の順で環境変数をフォールバックし、ストア通知とアプリ通知どちらも捕捉。

## 2. 未処理タスク（優先度順）
1. **GitHub Actions 変数整備**: `APP_BASE_URL`（例: https://xxxxx.vercel.app）を GitHub repo variables に追加し、`JOB_WORKER_SECRET` / `CRON_SECRET` を GitHub Secrets に登録して Actions から参照できるようにする。Vercel との値ズレがないか定期棚卸し。
2. **監査・可観測性**: `webhook_jobs` の状態をダッシュボード化するか Slack 通知を追加し、失敗ジョブを素早く検知できるようにする。
3. **Shopify アプリ反映 & テスト**: `shopify app deploy` → 開発ストア再インストール → `orders/create` ～ `fulfillmentCreateV2` の一気通貫テストで OM モデル前提のフローを検証。
4. **アクセストークン UX**: `shopify_connections` を read-only 表示できる簡易画面を Console に追加し、再認可導線や履歴管理を計画。
5. **在庫表示仕様の最終合意**: Shopify GUI を真実の源に固定するのか、Console に二次編集機能を戻すのかを決め、UI の表示/警告ロジックを固める。

## 3. 最近解消した課題
- **FS モデルの制約**: Shopify 側在庫編集ができない問題は OM モデルへ切り替えることで解消し、FS 用スコープを撤廃。
- **Shopify API 422**: `_merchant_managed_` スコープへ移行し、必要なトピックを再認可してリクエストが通る状態に修正。
- **`vendors.contact_name` 欠如**: マイグレーションを作成し、`supabase db push` で本番適用済み。
- **配送登録後のステータス差異**: `mapDetailToSummary` を調整し、出荷実績ベースで `fulfilled/partially_fulfilled` を即時計算。
- **リアルタイム反映不足**: Supabase Realtime を `shipments`/`line_items`/`orders` に導入し、一覧の即時更新を実現。
- **Webhook 設定不整合**: `shopify.app.toml` と実装エンドポイントを一致させ、対象トピックの購読を明示。
- **トークン把握の煩雑さ**: `shopify_connections` を橋頭堡とし、Supabase Dashboard でアクセスできるよう整理。

## 4. 推奨実行順序
1. **Shopify 側同期**: `shopify app deploy` + 開発ストア再インストール → Webhook HMAC ログの健全性を確認し、`orders/create` ～ `fulfillmentCreateV2` の通しテストを記録。
2. **ジョブ監査体制**: GitHub Actions の実行ログ＋`webhook_jobs` ステータス監視（Dashboard or Slack）を整備し、失敗時に即時再実行できる CLI フローを明文化。
3. **運用ガードレール**: GitHub Actions / inline 処理の負荷を踏まえ、Pro プラン移行 or Supabase PG Cron の導入判断、ならびに在庫表示仕様の決定をステークホルダーと合意。
