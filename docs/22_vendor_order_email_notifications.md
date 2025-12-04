# ベンダー向け注文通知メール計画

## 1. 目的
- Shopify から新規注文が取り込まれた際に、該当ベンダーへメールで即座に通知する。
- Console を開いていなくても発送準備が始められるようにし、SLA を短縮する。
- 既存の Webhook / Supabase ジョブフローと整合する安心設計を明文化する。

## 2. トリガーと条件
| フェーズ | トリガー条件 | 備考 |
| --- | --- | --- |
| 新規注文 | `orders` レコード新規作成（`insert`）かつ `vendor_id` が設定済み | Shopify Webhook → `processShopifyWebhook` で確定する段階。|
| 既存注文のベンダー割当 | `orders.vendor_id` が `NULL`→値ありに更新されたタイミング | SKU 解決後にベンダーが決まるケースを想定。|
| 再通知 | デフォルトでは **なし**。メール未達やベンダー設定変更時は手動で再送できるよう CLI/管理画面に余地を残す。|

フィルタリング:
- `orders.archived_at IS NULL` のみ。
- `orders.status IN ('unfulfilled', 'partially_fulfilled')` のみ。
- 同一 `order_id + vendor_id` への通知は 1 件まで（取消・再割当時の再送は突き止めた上で別イベント `reassignment` として扱う）。

## 3. 送信先 & テンプレ
- 送信先: `vendor.contact_email`（プロフィールで更新された最新アドレス）。必要に応じて個別通知先を追加できるよう `vendor_email_preferences` テーブルの追加も検討。
- From: `notifications@livapon.jp`（SPF/DKIM 設定が必要）。
- 件名: `【LIVAPON】新しい注文 #{{order_number}} が登録されました`
- 本文（テキスト）:
  ```
  {{vendor_name}} 御中

  新しい注文 #{{order_number}} （顧客: {{customer_name}}）が登録されました。

  - 注文日時: {{order_created_at}}
  - 配送先: {{shipping_address_line1}} {{shipping_city}}
  - ラインアイテム数: {{line_item_count}}

  Console にログインして発送準備を進めてください。
  https://livapon-fullfillment-system.vercel.app/orders

  ※本メールは送信専用です。心当たりがない場合は運用担当までお知らせください。
  ```
- HTML テンプレートは `app/emails/vendor-new-order.tsx`（予定）でひな形化し、ブランドカラーに合わせたヘッダー/CTA ボタンを配置する。

## 4. 技術アプローチ
1. **送信者ライブラリ**: Resend か SendGrid を採用。Node.js からの実装容易さとインフラ負荷を考え、Resend を第一候補とする。
   - `.env` に `RESEND_API_KEY`。
   - `lib/notifications/email.ts` に送信ヘルパーを作成し、テンプレート別に型安全な呼び出しにする。
2. **非同期実行**:
   - 既存の Webhook ジョブワーカー（`/api/internal/webhook-jobs/process`）で `processShopifyWebhook` 後に通知キューへ追加。
   - もしくは Postgres `orders` テーブルの `AFTER INSERT` トリガー → `NOTIFY` で `Edge Function` を起動する案も検討可能だが、まずはワーカーに統合する。
3. **冪等管理**:
   - `vendor_order_notifications` テーブルを新設（`order_id`, `vendor_id`, `notification_type`, `sent_at`, `status`, `error_message`）。
   - 送信前に `UPSERT` し、既に `status='sent'` の同キーが存在する場合はスキップ。
4. **エラー処理**:
   - Resend エラーは `status='error'` と `error_message` を保存。GitHub Actions のジョブ Summary で件数を報告。
   - ベンダーのメール未登録の場合はログ警告＋後続の Slack 通知候補。
5. **将来拡張**:
   - `order_status` 変化（例: `fulfilled`）時に発送完了通知、`shipment_adjustment_requests` 更新時通知なども同インフラで拡張できる。
   - ベンダー単位で通知 ON/OFF が設定できるよう `vendor_notification_settings` を追加する余地を記載。
   - シンプルな案として `vendor` テーブルに `notify_new_orders boolean default true` を追加し、`/vendor/profile` にチェックボックスを配置する。詳細な通知種別を扱う場合は `vendor_notification_preferences(vendor_id, notification_type, enabled)` を設計する。
   - OFF のベンダーには送信処理をスキップしつつ、`vendor_order_notifications` に `status='skipped'` でログを残し、監査できるようにする。

## 5. 開発ステップ案
1. **スキーマ**: `20251204090000_create_vendor_notification_logs.sql`（仮）で `vendor_order_notifications` 作成・インデックス追加。
2. **メール送信ヘルパー**: `lib/notifications/email.ts` に Resend クライアント（SWR/キャッシュ含む）。`sendVendorNewOrderEmail(payload)` を export。
3. **テンプレート**: `app/emails/vendor-new-order.tsx`（React Email + Tailwind）。`lib/emails/vendor-new-order.ts` でも良い。
4. **ジョブ統合**: `lib/jobs/webhook-runner.ts` → `processShopifyWebhook` の成功パスで、`orders` の挿入結果を元に通知関数を呼び出す。`Promise.allSettled` でメール失敗があっても注文処理は継続。
5. **監視**: GitHub Actions の Step summary に `sentCount / errorCount` を表示し、`vendor_order_notifications` を 24 時間で TTL 集計するクエリを `docs/60_development_status.md` に追記予定。
6. **文言確認**: プロダクトオーナー確認用のプレビュー（Storybook 代わりに `/dev/email-preview/vendor-new-order`）を作成。

## 6. オープン課題
- 再通知ポリシー（未読/未発送が一定時間続いた場合のリマインド）。
- 複数メールアドレス（例: CC: ロジ担当）への配信。プロフィールに複数入力欄を追加する必要があるか検討。
- 国際化（英語版メール）のタイミング。
- 通知設定が OFF のベンダーがいる場合、誰がその変更を行ったか追跡できる仕組み（監査ログ）が必要か。
- ベンダー側のメールサーバーでフィルタされた際のリカバリ手順（bounce 処理や自動再送ポリシー）を決める。

## 7. 参照
- 既存ジョブ: `docs/60_development_status.md`（Webhook Jobs 概要）。
- 通知ガイド: `docs/21_ui_notification_patterns.md`（UI通知だがメール指針と整合させる）。
- Fulfillment フロー: `docs/32_fulfillment_sync_workflow.md`。
