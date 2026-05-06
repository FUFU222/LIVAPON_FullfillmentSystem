# LIVAPON Fulfillment System

## 現況（2026-05-06）
- Node.js 24 / Next.js 16.2.4 / React 19.2 系で運用。App Router + Supabase を基盤にし、ESLint 9 / Jest 30 / TypeScript 5.4 / GitHub Actions を品質ゲートにする。
- Shopify Webhook は即時キュー投入 (`webhook_jobs`) → GitHub Actions（10 分間隔 or 手動）から `/api/internal/webhook-jobs/process` を叩き、`processShopifyWebhook` → `upsertShopifyOrder` で整合性を確保。
- 発送登録は UI でラインアイテム選択 → `/api/shopify/orders/shipments` が `shipments` / `shipment_line_items` を即時作成し、ユーザーには「発送情報を登録しました」と返す。Shopify 共有は `sync_status` と `sync_pending_until` を使い、`/api/internal/shipments/resync` が順次処理する。
- 旧 shipment import job 系は互換・過去ジョブ処理のため残す。通常導線の発送登録では `/api/shipment-jobs/:id` polling や `shipment_import_jobs` の進捗追跡を使わない。
- Cron 系は Vercel Cron を廃止し、`process-webhook-jobs` / `process-shipment-jobs` / `resync-pending-shipments` の3本を GitHub Actions + `APP_BASE_URL` + `JOB_WORKER_SECRET` / `CRON_SECRET` で統一。
- Shopify 連携後は `vendor_order_notifications` を参照し、`orders/create` 完了時にセラーへメール通知（プロフィール設定で ON/OFF）。
- ロールは `admin` / `vendor` / `pending_vendor`。`vendor_id` / `role` は `app_metadata` を信頼元とし、`user_metadata` は pending_vendor の移行互換だけに限定する。
- 申請〜承認〜利用開始のフローに加え、発送修正申請フォーム、管理ボード、配送同期失敗時の管理者対応（再同期・手動対応済み・Fulfillment ID 紐付け）を提供。
- デモモード（Supabase Service Role 未設定時）はモック注文で UI 検証のみ可能。

## 機能ブロック
- **パブリック / オンボーディング**: ランディング (`/`)、申請フォーム (`/apply`)、サインイン (`/sign-in`)、審査待ち (`/pending`)。
- **セラーコンソール**:
  - `/orders` 検索・ステータスフィルタ・ラインアイテム表示、リアルタイム購読バナー、即時再読込ボタン。発送登録パネルは選択済みラインと数量調整、追跡番号・配送会社入力、確認モーダル、即時受付 Toast を担う。
  - `/orders/shipments` は発送履歴の参照画面。修正や取消が必要な場合は `/support/shipment-adjustment` から管理者へ依頼する運用。
  - `/import` は preview / validation 用の legacy route。ヘッダー / モバイルナビからは外し、現行の正式運用フローには含めない。
  - `/vendor/profile` で会社/担当者/連絡先/通知設定/任意パスワード変更。新規注文メール通知トグルが `vendor_order_notifications` と連動。
  - `/support/shipment-adjustment` で発送後修正申請フォームを提供し、`shipment_adjustment_requests` を作成。
- **管理者コンソール**:
  - `/admin` ダッシュボード：審査待ち申請・最新注文・最新セラーのカード表示。
  - `/admin/applications` で審査（承認時 `approveVendorApplication` がコード採番）。
  - `/admin/vendors` 一覧 + 詳細モーダル + 一括削除。
  - `/admin/orders` で全注文の最新 50 件を参照。
  - `/admin/shipment-requests` で発送修正申請ボード（コメント/担当者/ステータス管理）を提供し、`shipment_adjustment_comments` と連携。
- **Shopify / Supabase 連携**:
  - `/api/shopify/auth/*` で OAuth、`shopify_connections` にアクセストークン保存。
  - `/api/shopify/orders/*` が注文 Webhook 取り込みと FO イベントを処理し、`webhook_jobs` 経由のリトライや `claim_pending_webhook_jobs()` RPC を利用。
  - `/api/shopify/orders/shipments` は発送登録 API。CSRF / セラー認可 / line item 所有権 / 冪等 requestId を検証し、Supabase にローカル発送を作成して `202` を返す。
  - `/api/internal/webhook-jobs/process`, `/api/internal/shipment-jobs/process`, `/api/internal/shipments/resync` は GitHub Actions から叩く内部エンドポイント。
  - `lib/data/orders/*` / `lib/shopify/fulfillment.ts` / `lib/jobs/*` が Fulfillment Order 同期、再同期、同期イベント (`shipment_sync_events`) とログ記録 (`sync_status`, `sync_pending_until`, `sync_error`) を担う。
- **UI / ナビゲーション**:
  - ヘッダーは `public/brand/livapon-header-logo.svg` を横長ロゴとして使用。余白の大きい正方形ロゴは favicon / アセット用途に限定する。
  - モバイルは下部ナビを使い、セラー: 注文 / 履歴 / 修正 / 会社、管理者: 管理 / 注文 / 申請 / 修正 / セラーをアイコン付きで表示する。
  - 画面遷移のグローバル blocking spinner は廃止。Next.js の loading UI は静的 skeleton に留め、既に表示可能な画面を塞がない。

## セットアップ
1. 依存関係をインストール
   ```bash
   npm install
   ```
2. `.env.local` を作成し、以下を設定
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_WEBHOOK_SECRET`（必要に応じて `_APP` `_STORE` で個別管理）
   - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_SCOPES`
3. Supabase にスキーマを適用
   ```bash
   supabase db reset --schema public --file schema.sql
   # もしくは supabase db push （プロジェクトに接続済みの場合）
   ```
4. 型定義と DB が揃っていることを確認
   ```bash
   npm run lint
   npm test -- --runInBand
   npm run build
   ```
5. 開発サーバー起動
   ```bash
   npm run dev
   ```
   - Service Role を設定していない場合でも UI は起動し、モックデータで動作確認できる。
   - GitHub Actions でジョブ処理を動かす場合は、リポジトリ Variables/Secrets に `APP_BASE_URL`, `JOB_WORKER_SECRET`, `CRON_SECRET`, `SHIPMENT_JOB_LIMIT`, `SHIPMENT_RESYNC_LIMIT`, `WEBHOOK_JOB_LIMIT` などを登録する。

## 主なディレクトリ
```
app/
  layout.tsx             グローバルレイアウト + ToastProvider
  page.tsx               ランディングページ
  (auth)/sign-in/        認証フロー
  (public)/apply/        セラー申請フォーム
  pending/               審査待ち表示
  orders/                セラー向け注文 UI 一式
  import/                CSV preview / validation コード（現行運用スコープ外）
  support/               発送修正申請フォーム
  vendor/profile/        セラープロフィール編集
  admin/                 管理者ダッシュボード / 審査 / セラー管理
  dev/                   メールプレビュー等の開発用ページ
  api/                   Shopify / internal / shipment job API 群
components/
  orders/*               発送登録・履歴 UI コンポーネント
  admin/*                審査・セラー管理 UI
  vendor/*               プロフィールフォーム
  ui/*                   再利用 UI（Button, Alert, Toast など）
lib/
  auth.ts                Supabase Auth コンテキストとロール判定
  auth-metadata.ts       app_metadata 優先の role / vendor_id 解決
  data/orders/*          注文・発送・同期イベント処理（サービスロール）
  data/vendors.ts        申請・セラー管理ロジック
  data/shipment-import-jobs.ts  legacy shipment job 処理
  jobs/*                 webhook / shipment / resync ワーカー共通処理
  notifications/*        Gmail API 通知メールのテンプレ・送信ヘルパー
  shopify/*              OAuth / Fulfillment / HMAC
  supabase/*             クライアント生成と型
supabase/
  config.toml, migrations/   DB 定義とマイグレーション履歴
schema.sql                スキーマの単一ソース
```

## 今後の主要テーマ
- **GitHub Actions と Secrets の棚卸し**: `APP_BASE_URL` repo variable、`JOB_WORKER_SECRET` / `CRON_SECRET` の GitHub / Vercel 間の値ズレを定期確認し、Workflow 失敗を防止。
- **ジョブ監視と可観測性**: `webhook_jobs` / `shipments.sync_status` / legacy `shipment_import_jobs` の失敗件数を Slack or ダッシュボードで可視化、GitHub Actions の Step summary を運用ログに転記。
- **Shopify 開発ストア / staging 相当の総合テスト**: 本番 100 円注文は最終 smoke に限定し、通常は mock + Shopify test order で `orders/create` ～ Fulfillment 同期を検証する。
- **アクセストークン管理 UI**: `shopify_connections` を参照できる read-only 画面や再認可導線を Console へ追加。
- **監査ログの次フェーズ**: プロフィール変更、通知設定変更、管理者操作、OAuth/scope 変更を横断する activity log を設計する。
