# Development Guide – LIVAPON Fulfillment System

> 本ドキュメントは開発契約。すべての修正・PR はこの方針に従うこと。

最終更新: 2025-11-02

---

## 1. 基本方針
- `schema.sql` → マイグレーション → `lib/supabase/types.ts` → サービス層 → UI の一貫性を最優先。
- 変更は最小単位（1 ファイル・1 責務）で行い、lint / test / typecheck を通してから次に進む。
- 命名・コメント・UI テキストは日本語を優先し、外部 API 仕様は原文（英語）を併記。

## 2. ドキュメント階層
| 層 | ファイル |
| -- | -------- |
| コンテキスト | `docs/00_context.md` |
| 要件 | `docs/10_requirements_app.md`, `docs/11_requirements_bridge_app.md` |
| 仕様 | `docs/21_spec_ui_wireframes.md`, `docs/40_sku_vendor_spec.md` |
| 実装 | `schema.sql`, `supabase/migrations/*`, `lib/**/*.ts`, `app/**/*` |
| 運用 | `docs/50_roadmap_vendor_profile.md`, `docs/60-70*.md`, `docs/90_development_guide.md` |

---

## 3. Supabase 運用
1. 変更は必ず `schema.sql` に反映。
2. CLI で差分を生成し、マイグレーションをコミット。
   ```bash
   supabase migration new <migration_name>
   # SQL 追記後
   supabase db push
   ```
3. `lib/supabase/types.ts` を更新（`supabase gen types typescript --linked` 推奨）。
4. サービス層・UI を更新し、`npm run test` でロジック整合を確認。

マイグレーション命名: `YYYYMMDDHHMMSS_<subject>.sql`。例: `20251031100220_add_shipment_retry_fields.sql`。

---

## 4. 開発フロー
1. ブランチ作成 → ドキュメント確認。
2. 実装 → ローカル検証。
3. テスト
   ```bash
   npm run lint
   npm run test
   npx tsc --noEmit
   npm run build
   ```
4. 影響範囲を PR 説明に記載。UI 変更はスクショ添付。
5. マージ後、必要なら `supabase db push` で環境反映。

---

## 5. コーディング規約
- TypeScript/React Hooks。ビジネスロジックは server action / `lib/data/*` へ寄せ、コンポーネントはプレゼンテーション重視。
- Tailwind ユーティリティは再利用し、複雑なスタイルは `components/ui/*` へ抽象化。
- 文字列は `t()` などの抽象化はまだ導入していないため、日本語ハードコードに統一。
- ベンダー / 注文 ID のチェックは server side で必須。UI 側では信頼しない。

---

## 6. チェックリスト
| 項目 | 確認 |
| ---- | ---- |
| スキーマ整合 | `schema.sql` ↔ マイグレーション ↔ `types.ts` が一致しているか |
| UI 仕様 | `docs/21_spec_ui_wireframes.md` と乖離していないか |
| Shopify 連携 | `docs/60-63`, `docs/70` の設計と矛盾がないか |
| テスト | `npm run lint` / `npm run test` / `npx tsc --noEmit` / `npm run build` OK |
| 文書整合 | 関連ドキュメントの更新（要件/仕様/運用）を行ったか |

---

## 7. 環境変数
| 変数 | 用途 |
| ---- | ---- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | クライアント用 Supabase 接続 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | サーバーアクション / Webhook 用 |
| `SUPABASE_ACCESS_TOKEN` | CLI で `supabase db push` を行う際に使用 |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | OAuth クレデンシャル |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook HMAC 検証 |
| `SHOPIFY_STORE_DOMAIN` | 既定のストアドメイン（例: `example.myshopify.com`） |
| `SHOPIFY_SCOPES` | 要求スコープ（未設定時はデフォルト文字列） |
| `SHOPIFY_ADMIN_API_VERSION` | API バージョン指定（省略時 `2025-10`） |

Secrets は `.env.local` で管理し、Git にコミットしない。

---

## 8. 品質基準
| カテゴリ | 基準 |
| -------- | ---- |
| Lint | `npm run lint` 合格 |
| 型 | `npx tsc --noEmit` 合格 |
| テスト | `npm run test` 合格（Jest） |
| ビルド | `npm run build` 成功 |
| UI | shadcn/ui ベース、アクセシビリティ要件を満たす |
| ログ | 失敗時は `console.error` で詳細を残し、`sync_error` 等にも保存 |

---

## 9. インシデント対応
| 状況 | 初動 |
| ---- | ---- |
| Shopify API エラー | `sync_error` を確認 → トークン・FO・レートを切り分け |
| Supabase スキーマ差分 | `schema.sql` と `types.ts` を照合し再生成 |
| CI 失敗 | ローカル再現 → 最小修正で解決。大規模リファクタは別 PR |
| OAuth 失敗 | スコープ/リダイレクト URL/ドメイン設定を再確認 |

---

## 10. チーム運用
- Conventional Commits（`feat:`, `fix:`, `docs:`, `db:`, `chore:`）。
- PR テンプレ: 目的 / 変更点 / テスト / 関連ドキュメント。
- docs に差分がある場合、PR に必ず含める。
- 新規メンバーは `docs/01_overview.md` → `docs/10/11/21/40` → `docs/60-70` → 本ガイドの順で読む。

---

## 11. 今後導入予定の自動化
- schema.sql ↔ types.ts の diff チェック CI。
- Shopify 同期タスクのバックグラウンドワーカー監視。
- ドキュメント間リンクチェック（要件 ↔ 仕様 ↔ 実装）。
