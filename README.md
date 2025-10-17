# LIVAPON Fulfillment System Scaffold

Next.js + Supabase + shadcn/ui を用いた配送管理アプリの初期スキャフォールドです。`requirements.md` / `schema.sql` / `ui-wireframes.md` の要件を反映し、以下の画面と仕組みを提供します。

- `/`: ベンダー/管理者向けランディング。利用申請ステップと主要動線（サインイン / 申請フォーム）を案内。
- `/orders`: 注文一覧（検索・ステータスフィルタ・詳細導線）。
- `/orders/[id]`: 注文詳細（発送登録フォーム、発送済み/未発送の切り替え、既存発送の編集）。
- `/import`: CSV インポート（フォーマット検証とプレビュー）。
- Supabase 連携: `orders` / `line_items` / `shipments` / `import_logs` を取り扱うサービス層とサーバーアクション

## セットアップ手順

1. 依存関係をインストール
   ```bash
   pnpm install # または npm install / yarn install
   ```
2. `.env` を作成し、Supabase 環境変数を設定
   ```bash
   cp .env.example .env
   # NEXT_PUBLIC_SUPABASE_URL などをプロジェクトの値に置き換える
   ```
3. Supabase に `schema.sql` を適用
   - Supabase SQL Editor / CLI からテーブル定義を投入
4. 開発サーバーを起動
   ```bash
   pnpm dev
   ```
5. ブラウザで `http://localhost:3000/orders` を開き、UI を確認

> `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を設定しない場合は、UI 表示用にダミーデータが利用されます。

## ディレクトリ構成（抜粋）

```
app/
  layout.tsx                ルートレイアウト（AppShell、会社名表示などを初期化）
  page.tsx                  ランディングページ（利用フロー紹介）
  globals.css               Tailwind ベーススタイル
  orders/
    page.tsx                注文一覧ページ
    [id]/page.tsx           注文詳細ページ
    actions.ts              サーバーアクション（status 更新 / 追跡番号更新）
  import/
    page.tsx                CSV インポートページ
    actions.ts              CSV 検証・ログ記録
    upload-form.tsx         クライアント側のアップロードフォーム
components/
  layout/app-shell.tsx      ナビゲーションを含むレイアウト
  orders/*                  注文画面関連のUIコンポーネント
  ui/*                      shadcn/ui 風の基礎コンポーネント
lib/
  supabase/*                Supabase クライアント・型定義
  data/*                    データ取得・更新ロジック
```

## 今後の拡張ポイント

- Supabase Edge Function を用いた CSV インポートの非同期処理化
- 配送API（ヤマト・佐川など）との連携ロジック実装
- ベンダーごとのマルチテナント認可と Shopify OAuth フローの接続
- Jest / Playwright 等による UI・API テストの追加

## Development Guidelines

- 生成したコードは必ず `npm run lint` と `tsc --noEmit` を通過できる状態にしてください。
- Next.js プロジェクトは `npm run build` が成功する状態を維持してください。
- Supabase の型定義（`lib/supabase/types.ts`）に必ず整合性を合わせてください。
- コード生成は 1 ファイル単位で進め、エラーがないことを確認してから次のファイルを出力してください。
- 型やビルドエラーが発生した場合は、まず最小限の修正を行ってビルドが通る状態を優先してください。
- 生成後に可能であれば「何を修正したか」をコメントや説明で併記してください。
