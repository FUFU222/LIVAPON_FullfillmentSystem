# LIVAPON Fulfillment System

## 現況（2025-11-02）
- Next.js 14 App Router + Supabase を基盤にしたベンダー向け配送管理コンソール。
- Shopify Webhook で注文を取込み、ベンダー単位の出荷登録を Supabase に保存しつつ Shopify へ同期。
- ロールは `admin` / `vendor` / `pending_vendor`。申請〜承認〜利用開始のフローが稼働済み。
- デモモード（Supabase Service Role 未設定時）はサンプル注文を返し、UI 検証だけ可能。

## 機能ブロック
- **パブリック / オンボーディング**: ランディング (`/`)、申請フォーム (`/(public)/apply`)、サインイン (`/(auth)/sign-in`)、審査待ち (`/pending`)。
- **ベンダーコンソール**:
  - `/orders` 検索・ステータスフィルタ・ラインアイテム展開表示、即時再読込ボタン。
  - `/orders/[id]` でラインアイテム選択→追跡番号登録→Shopify 連携 (`ShipmentManager`)。
  - `/orders/shipments` は発送履歴とステータス、再読込ボタン。
  - `/import` で CSV プレビュー + バリデーション付きの一括登録。
  - `/vendor/profile` で会社情報・連絡先・任意のパスワード変更。
- **管理者コンソール**:
  - `/admin` ダッシュボード：審査待ち申請・最新注文・最新ベンダーを同時取得。
  - `/admin/applications` で審査（承認時 `approveVendorApplication` がコード採番）。
  - `/admin/vendors` 一覧 + 詳細モーダル + 一括削除 + CSV エクスポート。
  - `/admin/orders` 全注文の最新 50 件を参照。
- **Shopify 連携**:
  - `/api/shopify/auth/*` で OAuth、`shopify_connections` にアクセストークン保存。
  - `/api/shopify/orders/*` で注文 Webhook 取込みと FO 完了トリガー、ベンダー Bulk API。
  - `lib/data/orders.ts` / `lib/shopify/fulfillment.ts` が Fulfillment Order を解析し、`sync_status` とリトライ情報を管理。

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
   - `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_WEBHOOK_SECRET`
   - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_SCOPES`
3. Supabase にスキーマを適用
   ```bash
   supabase db reset --schema public --file schema.sql
   # もしくは supabase db push （プロジェクトに接続済みの場合）
   ```
4. 型定義と DB が揃っていることを確認
   ```bash
   npm run lint
   npm run test
   npx tsc --noEmit
   ```
5. 開発サーバー起動
   ```bash
   npm run dev
   ```
   - Service Role を設定していない場合でも UI は起動し、モックデータで動作確認できる。

## 主なディレクトリ
```
app/
  layout.tsx             グローバルレイアウト + ToastProvider
  page.tsx               ランディングページ
  (auth)/sign-in/        認証フロー
  (public)/apply/        ベンダー申請フォーム
  pending/               審査待ち表示
  orders/                ベンダー向け注文 UI 一式
  import/                CSV インポート UI + サーバーアクション
  vendor/profile/        ベンダープロフィール編集
  admin/                 管理者ダッシュボード / 審査 / ベンダー管理
  api/shopify/           OAuth・Webhook・ベンダー向け API エンドポイント
components/
  orders/*               発送登録・履歴 UI コンポーネント
  admin/*                審査・ベンダー管理 UI
  vendor/*               プロフィールフォーム
  ui/*                   再利用 UI（Button, Alert, Toast など）
lib/
  auth.ts                Supabase Auth コンテキストとロール判定
  data/orders.ts         注文・発送処理（Supabase Service Role）
  data/vendors.ts        申請・ベンダー管理ロジック
  shopify/*              OAuth / Fulfillment / HMAC
  supabase/*             クライアント生成と型
supabase/
  config.toml, migrations/   DB 定義とマイグレーション履歴
schema.sql                スキーマの単一ソース
```

## 今後の主要テーマ
- 発送同期のバックグラウンドキュー化（`sync_pending_until` を消化するワーカー）。
- Shopify FO 未生成時の自動補助生成と、発生条件のドキュメント化。
- ベンダー向け在庫／返品フロー、リアルタイム更新の整備。
