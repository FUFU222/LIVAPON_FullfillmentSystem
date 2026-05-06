# セラー向け注文通知メール仕様

## 1. 目的
- Shopify から新規注文が取り込まれた際に、該当セラーへメールで即座に通知する。
- Console を開いていなくても発送準備が始められるようにし、SLA を短縮する。
- 既存の Webhook / Supabase ジョブフローと整合する安心設計を明文化する。

## 2. トリガーと条件
| フェーズ | トリガー条件 | 備考 |
| --- | --- | --- |
| 新規注文 | `orders` レコード新規作成（`insert`）かつ `vendor_id` が設定済み | Shopify Webhook → `processShopifyWebhook` で確定する段階。|
| 既存注文のセラー割当 | `orders.vendor_id` が `NULL`→値ありに更新されたタイミング | SKU 解決後にセラーが決まるケースを想定。|
| 再通知 | デフォルトでは **なし**。メール未達やセラー設定変更時は手動で再送できるよう CLI/管理画面に余地を残す。|

実装備考（2026-05-06）:
- 現行実装は Gmail API 版。Shopify Webhook のうち `orders/create` のみ自動送信対象とし、`orders/updated` / 再割当は今後の再送フロー整備後に対応予定。
- 送信処理は `lib/shopify/order-import.ts` から `lib/notifications/vendor-new-order.ts` を呼び、送信結果は `vendor_order_notifications` に冪等記録する。

フィルタリング:
- `orders.archived_at IS NULL` のみ。
- `orders.status IN ('unfulfilled', 'partially_fulfilled')` のみ。
- 同一 `order_id + vendor_id` への通知は 1 件まで（取消・再割当時の再送は突き止めた上で別イベント `reassignment` として扱う）。

## 3. 送信先 & テンプレ
- 送信先: `vendor.contact_email`（プロフィールで更新された最新アドレス）。将来的に `vendor_email_preferences` で複数アドレスや CC を扱う拡張も可能。
- From: `GMAIL_SENDER`（未設定時は `information@chairman.jp`）。差出人名は `GMAIL_FROM_NAME`（未設定時は `LIVAPON 事務局`）。
- 件名: `【LIVAPON】新しい注文のご案内`
- 本文（テキスト）: 現行テンプレートは `lib/notifications/vendor-new-order.ts` の `buildPlainTextBody` を正とする。要旨は以下。
  ```
  {{vendor_name}} 様

  新しい注文が届きました。
  ご対応をお願いいたします（注文日時: {{order_created_at}}）。

  ────────────────────
  ■ 配送先
  {{shipping_postal_code}}
  {{shipping_address1}}
  {{shipping_address2}}
  {{shipping_city}} {{shipping_state}}

  ■ 注文内容
  {{#each line_items}}
  ・{{product_name}} × {{quantity}}
  {{/each}}
  ────────────────────

  ■ 注文を確認する
  https://livapon-fullfillment-system.vercel.app/orders

  本メールは送信専用です。
  設定から通知のオン／オフを切り替えられます。
  ```
- HTML テンプレートも `lib/notifications/vendor-new-order.ts` 内で文字列生成する。React Email / `app/emails` は使っていない。
- **動的項目一覧**
  | プレースホルダ | 取得元 |
  | --- | --- |
  | `vendor_name` | `vendors.name` |
  | `order_number` | `orders.order_number`。payload には含めるが、現行件名・本文では未表示。必要なら次回文面改定で追加する。 |
  | `order_created_at` | `orders.created_at`（JST 表記に整形） |
  | `customer_name` | `orders.customer_name` |
  | `shipping_postal_code` / `shipping_state` / `shipping_city` / `shipping_address1` / `shipping_address2` | `orders` の同名カラム |
  | `line_items` | `line_items` テーブル（`product_name`, `quantity`, 任意で `sku`） |

  すべての line_items をセラー単位でフィルタし、メールには自社分のみを列挙する。

## 4. 技術アプローチ
1. **送信者ライブラリ**
   - **フェーズ1（現行〜当面）**: Gmail（Google Workspace）API を利用。Next.js の Route Handler / Server Action から Gmail API を叩き、プロジェクトのポリシーで定められている `information@chairman.jp` を送信元として扱う。
     - OAuth クライアントまたはサービスアカウントで認証し、Console のサーバーサイドでアクセストークンを保持。
     - セラー通知・管理者通知ともに同じ送信ヘルパーで一元管理する。
   - **フェーズ2（本格スケール後）**: メール送信部分だけ SES などへ差し替え。`sendVendorNewOrderEmail(payload)` のインターフェースは維持し、実装を差し替えるだけで移行できる構成にする。
   - `lib/notifications/email.ts` が Gmail service account JWT、access token cache、MIME 生成、retryable error 判定を担う。
2. **非同期実行**:
   - 既存の Webhook ジョブワーカー（`/api/internal/webhook-jobs/process`）で `processShopifyWebhook` 後に通知を送信する。
   - メール失敗は注文取り込みを失敗扱いにしない。retryable error は通知ログ上で再試行候補にする。
3. **冪等管理**:
   - `vendor_order_notifications` テーブルを新設（`order_id`, `vendor_id`, `notification_type`, `sent_at`, `status`, `error_message`）。
   - 送信前に `UPSERT` し、既に `status='sent'` の同キーが存在する場合はスキップ。
4. **エラー処理**:
   - Gmail API エラーは `status='error'` と `error_message` を保存。GitHub Actions のジョブ Summary で件数を報告。
   - セラーのメール未登録の場合はログ警告＋後続の Slack 通知候補。
5. **将来拡張 / 通知設定**:
   - `order_status` 変化（例: `fulfilled`）時に発送完了通知、`shipment_adjustment_requests` 更新時通知なども同インフラで拡張できる。
   - セラープロフィール画面に「新規注文メール通知」のトグルを追加し、`vendors.notify_new_orders boolean default true` で制御する案を採用。より細かい粒度が必要になった場合は `vendor_notification_preferences(vendor_id, notification_type, enabled)` へ移行する。
   - OFF のセラーには送信処理をスキップしつつ、`vendor_order_notifications` に `status='skipped'` を記録して監査できるようにする。

## 5. 実装済みコンポーネント
1. **スキーマ**: `vendor_order_notifications` と `vendors.notify_new_orders` で冪等送信・通知設定を管理。
2. **メール送信ヘルパー**: `lib/notifications/email.ts`。Gmail service account + domain-wide delegation を前提に MIME を生成して送信する。
3. **テンプレート**: `lib/notifications/vendor-new-order.ts`。text / HTML を同一 payload から生成する。
4. **ジョブ統合**: `lib/shopify/order-import.ts` の注文取り込み成功パスで通知対象セラーを解決し、メール送信とログ保存を行う。
5. **テスト**: `__tests__/vendor-new-order-notification.test.ts` と `__tests__/order-import-notification-recipients.test.ts` で本文・宛先解決を確認する。

## 6. オープン課題
- 再通知ポリシー（未読/未発送が一定時間続いた場合のリマインド）。
- 複数メールアドレス（例: CC: ロジ担当）への配信。プロフィールに複数入力欄を追加する必要があるか検討。
- 国際化（英語版メール）のタイミング。
- 通知設定が OFF のセラーがいる場合、誰がその変更を行ったか追跡できる仕組み（監査ログ）が必要か。`vendor_notification_settings_audit` のような履歴テーブルが候補。
- セラー側のメールサーバーでフィルタされた際のリカバリ手順（bounce 処理や自動再送ポリシー）を決める。

## 7. 参照
- 既存ジョブ: `docs/60_development_status.md`（Webhook Jobs 概要）。
- 通知ガイド: `docs/21_ui_notification_patterns.md`（UI通知だがメール指針と整合させる）。
- Fulfillment フロー: `docs/32_fulfillment_sync_workflow.md`。
