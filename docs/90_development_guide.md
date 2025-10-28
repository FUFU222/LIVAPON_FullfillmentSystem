# 90 Development Guide – LIVAPON Fulfillment System

> This document is the development contract.  
> すべての PR・修正は本ガイドに準拠すること。

---

## 🎯 目的

本ドキュメントは、**Supabase × Next.js × Shopify 連携開発** において  
設計・実装・運用の一貫性を保証するための「開発標準ガイドライン」です。  
Codex・人間いずれが開発しても破綻しない構造を維持します。

---

## 1. 基本方針

### 一貫性の原則

- `schema.sql` → `lib/supabase/types.ts` → API → UI の整合を常に取る。
- 命名・型・責務のズレを検知した場合は、**最も上流（schema.sql）** に合わせる。
- 修正は **最小単位（1 ファイル・1 責務）** で行い、ビルドを通してから次へ進む。

### 設計思想

- 「構造と整合性が最大の生産性」という思想のもと、  
  機能よりも**スキーマと責務の安定性**を優先。
- コード生成・修正・マイグレーションはいずれも “整合性の維持” が目的である。

---

## 2. ファイル構成ポリシー

| 層             | ファイル                                                   | 内容                           |
| -------------- | ---------------------------------------------------------- | ------------------------------ |
| Context        | `00_context.md`                                            | 設計哲学・命名規則・文化       |
| Requirements   | `10_requirements_app.md` / `11_requirements_bridge_app.md` | 機能要件・外部連携仕様         |
| Specs          | `20_spec_sku_vendor.md` / `21_spec_ui_wireframes.md`       | データ構造・画面仕様           |
| Implementation | `schema.sql` / `lib` / `app`                               | 実装・型・ビジネスロジック     |
| Operation      | `90_development_guide.md`                                  | 開発運用・整合性・ガイドライン |

---

## 3. Supabase 運用ルール

### マイグレーション管理

- `schema.sql` を **単一ソース・オブ・トゥルース** とする。
- 変更が発生した場合は以下の手順で反映する：
  1. schema.sql を更新
  2. CLI で差分を生成
     ```bash
     supabase migration new <migration_name>
     ```
  3. `supabase db push` で本番環境へ反映
  4. `lib/supabase/types.ts` を自動生成または手動更新

### マイグレーション命名規則

`YYYYMMDD_<entity>_<action>`  
例：`20251005_orders_add_tracking_status`

---

## 4. Codex 連携ルール

### Codex に提供すべき情報

- 常時参照：
  - `00_context.md`（言語・命名）
  - `10_requirements_app.md` / `11_requirements_bridge_app.md`
  - `20_spec_sku_vendor.md` / `21_spec_ui_wireframes.md`
  - `schema.sql`
- 開発時参照：
  - `lib/supabase/types.ts`
  - `lib/data/*`
  - `app/orders/*`
- 補足：
  - コード生成単位は **1 ファイルごとに完結**。
  - 出力後は `lint` → `tsc --noEmit` → `build` を必ず通す。

### 生成ポリシー

- 出力は「実行可能・整合済み」が前提。  
  → 未定義の型・変数・import を残さない。
- 依存変更時は `package.json` を同時にコミット。
- Codex が schema 変更を検知した場合、自動で `types.ts` に反映するよう指示。

---

## 5. チェックリスト（変更時）

| 項目             | 確認内容                                                 |
| ---------------- | -------------------------------------------------------- |
| **スキーマ変更** | schema.sql → migration → types.ts 反映済みか             |
| **UI 変更**      | wireframes と要件の整合性が取れているか                  |
| **API 変更**     | bridge 要件と contract が一致しているか                  |
| **Lint/Build**   | `npm run lint`・`tsc --noEmit`・`npm run build` が通るか |
| **命名規則**     | context.md に沿っているか                                |

---

## 6. リリース運用

### 環境変数

`.env.local`（ローカル）と Vercel の環境変数で管理する。  
主なキーは次のとおり：

| キー                                                         | 用途                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | フロントエンドから Supabase を叩くための公開キー                                                             |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`                 | サーバー（Webhook・OAuth など）で Supabase を操作するための秘密キー                                          |
| `SHOPIFY_STORE_DOMAIN`                                       | Shopify ストアのドメイン（例: `example.myshopify.com`）                                                      |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`                     | Shopify OAuth のクライアント ID / シークレット                                                               |
| `SHOPIFY_WEBHOOK_SECRET`                                     | Shopify Webhook の署名検証用シークレット                                                                     |
| `SHOPIFY_SCOPES`                                             | 承認時に要求するスコープ（カンマ区切り。未設定時は `read_orders,write_orders,read_products,read_customers`） |
| `SHOPIFY_ADMIN_TOKEN`                                        | 必要に応じて Shopify Admin API を直接操作する際のトークン（現状未使用だが将来の配送連携を想定）              |

### デプロイフロー

1. `main` ブランチにマージされたら CI が自動で lint/build。
2. `supabase db push` によりステージ環境へ反映。
3. ステージ確認後、本番へ手動リリース。

---

## 7. 品質基準

| カテゴリ           | 基準                               |
| ------------------ | ---------------------------------- |
| **Lint**           | eslint + prettier に準拠。         |
| **型整合**         | `tsc --noEmit` 通過必須。          |
| **ビルド**         | `next build` 成功をもって完了。    |
| **UI 品質**        | shadcn/ui の標準構成を維持。       |
| **スキーマ整合性** | schema.sql / types.ts の相互一致。 |

---

## 8. トラブル対応方針

| 状況                     | 優先対応                                     |
| ------------------------ | -------------------------------------------- |
| Codex 出力にビルドエラー | 最小修正でビルドを通す（リファクタは後回し） |
| Supabase スキーマ差異    | schema.sql を基準に再生成                    |
| migration 失敗           | rollback 後に schema.sql を再適用            |
| OAuth や API エラー      | 環境変数・権限トークンを再確認               |

---

## 9. チーム運用指針

- Commit メッセージは `[scope]: 内容` 形式  
  例: `db: add shipments table index`
- Pull Request には概要と影響範囲を必ず明記。
- README と requirements の乖離を放置しない。
- 新規メンバーにはこのファイルを最初に読ませる。

---

## 10. 将来的な自動整合

今後、以下の自動チェックを導入予定：

- schema.sql ↔ types.ts 差分比較スクリプト
- requirements ↔ spec ↔ UI のキーワードマッチテスト
- Lint + 型整合 + Build + Schema Diff を nightly CI 化

---

## 🧭 開発の哲学（LIVAPON Standard）

> 「構造の安定が速度を生む」  
> 一貫性こそが、チームでも AI でも同じ品質を維持できる唯一の条件。  
> そのためにこのドキュメント群は存在する。

---
