# Repository Guidelines

## プロジェクト構成
- `app/` — Next.js App Router。`(public)` が未認証フロー、`(auth)` がサインイン、`orders` / `vendor` / `support` がセラー機能、`admin` が管理コンソール、`api/shopify` が OAuth / Webhook / 配送登録 API。`app/import` は legacy route として残すが正式導線ではない。
- `components/` — UI コンポーネント。`orders/*`・`admin/*` など機能単位、`ui/*` に共通パーツ、`toast-provider.tsx` で通知を集中管理。
- `lib/` — 認証 (`auth.ts`, `auth-metadata.ts`)、Supabase サービス層 (`data/*`)、Shopify 連携 (`shopify/*`)、Gmail API 通知 (`notifications/*`)、共有ユーティリティ。
- `supabase/` — CLI 設定とマイグレーション。`schema.sql` を正とし、差分は `supabase/migrations/` に追加する。
- `docs/` — 番号順に文脈 → 要件 → 仕様 → 実装 → 運用が並ぶ。更新したら関連セクションを横断して整合させる。

## 開発コマンド
- `npm run dev` — Next.js 開発サーバー。
- `npm run lint` — ESLint（Next.js 設定）。
- `npm run test` — Jest（Supabase / Shopify ロジックの単体テスト）。
- `npm run build` — 本番ビルド。`prebuild` で `app/dev` を一時退避し、Next.js の production build / 型検証を通す。
- `npx tsc --noEmit` — 参考用の standalone 型チェック。現時点では CI 必須ゲートではなく、テスト fixture 型整備後に正式化する。
- `supabase db diff --linked --file schema.sql` — 変更差分の確認（プロジェクトに接続済みの場合）。

## コーディング規約
- TypeScript + React Hooks。Async ロジックは `lib/data/*` やサーバーアクションに寄せ、コンポーネントは表示と UX 専任にする。
- Tailwind でスタイル統一。重複するクラスは `components/ui/*` へ切り出し、`buttonClasses` などユーティリティを再利用。
- 命名規則は `docs/00_language.md` に従い、日本語 UI / コメント前提。API との契約値は英語で揃える。
- セラーコードは 4 桁 zero-pad (`0001`)。SKU は `CCCC-NNN-VV` パターン、`vendor_skus` で冪等採番。

## テスト & 品質
- 変更後は最低限 `npm run lint` / `npm test -- --runInBand` / `npm run build` をローカルで実行。
- Supabase スキーマを触った場合は `schema.sql` と `lib/supabase/types.ts` の差分を確認し、必要ならテストにモックを追加。
- UI 変更時は desktop / mobile のスクリーンショットを確認し、モバイル下部ナビや横スクロールの有無も見る。

## コミット / PR
- Conventional Commits を継続（`feat:`, `fix:`, `docs:`, `db:`, `chore:`）。
- 1 PR = 1 改善テーマ。スキーマ変更と UI 変更を分ける。
- PR 説明には「目的」「影響範囲」「確認方法」を明記。ショップ連携が絡む場合は影響する環境変数も書く。

## セキュリティ / 設定
- Secrets は `.env.local` で管理。`SHOPIFY_*` / `SUPABASE_*` をコードに直書きしない。
- Supabase サービスロールキーは server components / server actions でのみ利用。クライアント側には公開キーだけ渡す。
- 長期的に使わないテストストアやトークンは `shopify_connections` から削除し、アクセストークン流出を防ぐ。
