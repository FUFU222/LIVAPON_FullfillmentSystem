# Docs Index

最終整理: 2026-05-16

このディレクトリでは、現行運用の判断材料になる文書を `docs/` 直下に置き、過去の計画・監査・引き継ぎは `docs/archive/` に退避する。2026-05-16 時点の実装は、Node.js 24 / Next.js 16.2.6、Shopify Webhook + GitHub Actions worker、配送登録の即時受付 + バックグラウンド同期、Gmail API 通知を正とする。

## 0x — 基本方針
- `docs/00_language.md` — 言語ポリシー
- `docs/01_system_overview.md` — システム概要
- `docs/02_repository_guidelines.md` — リポジトリ運用
- `docs/03_dev_principles.md` — 開発原則
- `docs/04_impact_analysis.md` — Impact Analysis メモ

## 1x — アーキテクチャ / 要件
- `docs/10_om_model_transition.md` — OMモデル移行計画
- `docs/11_requirements_console.md` — Console 要件
- `docs/12_requirements_bridge_app.md` — Bridge App 要件
- `docs/13_sku_vendor_spec.md` — SKU & Vendor 仕様
- `docs/14_vendor_console_roadmap.md` — セラー UI ロードマップ

## 2x — UI / UX
- `docs/20_ui_wireframes.md`
- `docs/21_ui_notification_patterns.md`
- `docs/22_vendor_order_email_notifications.md` — セラー向け注文通知メール仕様

## 3x — フルフィルメント / データ同期
- `docs/30_fulfillment_sync_overview.md`
- `docs/31_fulfillment_api_details.md`
- `docs/32_fulfillment_sync_workflow.md`
- `docs/33_fulfillment_sync_backlog.md` — 現行 backlog。完了済み worker は Done に移動済み。
- `docs/34_fulfillment_order_plan.md` — FO 連携の現行ステータスと残タスク。
- `docs/35_csv_import_notes.md` — legacy / reference。正式導線ではない。
- `docs/68_async_shipment_registration_design.md` — 配送登録即時受付化の実装済み設計。

## 4x — Supabase Realtime Platform
- `docs/livapon-realtime-sync-guidelines.md` — 中心方針（今回の軸）
- `docs/41_realtime_troubleshooting.md` — 現状の課題ログ
- `docs/42_realtime_test_plan.md` — Realtime テスト

## 5x — プロセス / 品質
- `docs/50_development_guide.md`
- `docs/51_ci_quality.md`
- `docs/52_security_scanning.md` — セキュリティスキャン、Dependabot、レポート運用。
- `docs/68_security_operational_readiness_20260513.md` — 2026-05-13 セキュリティ/運用レビューと残課題。

## 6x — ステータス / レポート / テスト
- `docs/60_development_status.md`
- `docs/63_orders_test_plan.md`
- `docs/67_test_strategy_20260315.md` — 推奨テスト体系と実装計画

## 現行スコープ外 / Legacy
- `/import` と `shipment_import_jobs` は互換・過去ジョブ処理・CSV preview のため残す。通常のセラー発送登録は `/orders` から `shipments` を即時作成し、Shopify 同期は `/api/internal/shipments/resync` が順次処理する。
- セラー自身による発送取消・再同期 UI は正式導線ではない。修正は `/support/shipment-adjustment` から管理者へ依頼し、同期失敗の管理者対応は admin 画面で行う。
- standalone の `npx tsc --noEmit` / `npm run typecheck` は現行 CI ゲートではない。必須ゲートは `npm run lint` / `npm test -- --runInBand` / `npm run build`。
- 2026-05-06 に未使用依存として `date-fns`, `class-variance-authority`, `@testing-library/user-event` を削除した。日時整形は `lib/date-time.ts`、ボタン variant は `components/ui/button.tsx` の軽量実装を使う。
- 2026-05-16 に 2026-03 期の DB スキーマ/インフラ監査 (`64_*`) と Phase1 index 実装計画・rollout runbook (`65_`, `66_`)、`shopify_shipping_sync_report.pdf` を `docs/archive/` へ退避した。現役の判断材料は本 index と各章ファイルに残す。

## Archive
- `docs/archive/README.md` — 過去の計画メモ / 監査メモ / 引き継ぎメモ
  - 現役の仕様・運用判断には使わない履歴置き場

> Serena を使う場合は、上記ファイル名をキーに高速検索できます。
