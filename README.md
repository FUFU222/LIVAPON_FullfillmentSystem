# LIVAPON Fulfillment System

Shopify 連携の発送オペレーション基盤。Next.js 16 (App Router) + Supabase + GitHub Actions worker で、注文取り込み・発送登録・配送同期・セラー通知をまかなう。

## ドキュメント

全仕様・運用判断の起点は [docs/README.md](docs/README.md)。アーキテクチャ概要は [docs/01_system_overview.md](docs/01_system_overview.md) を参照。

## 開発

- `npm run dev` — Next.js 開発サーバ
- `npm run lint` — ESLint (warnings=0)
- `npm test` — Jest
- `npm run build` — 本番ビルド

セットアップ・コーディング規約は [docs/50_development_guide.md](docs/50_development_guide.md)、リポジトリ運用は [docs/02_repository_guidelines.md](docs/02_repository_guidelines.md) を参照。
