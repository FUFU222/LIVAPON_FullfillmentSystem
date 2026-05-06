# 注文・配送同期テスト計画（2026-05-06）

## 1. 目的
- Shopify (OMモデル) と LIVAPON 配送管理システム間のデータ同期／UI を実運用に近い形で検証する。
- 複数セラー・在庫不足・キャンセル・アーカイブなど、主要な業務シナリオで問題がないか確認する。
- 重要操作（配送登録即時受付、同期失敗の管理者対応、修正申請 等）のログ／通知が期待通り残るかをチェックする。

## 2. テストケース
### A. 複数セラー
1. **セラーA/B の混載注文**: FO がセラー別に分割され、Console の表示も正しいか。
2. **セラーBのみ発送／取消**: 権限チェック（A の注文は B から操作不可）。
3. **セラー別ステータス**: 片方が発送しても、他方に不要な影響が出ないこと。

### B. 在庫・数量
1. **在庫どおりの発送**: Shopify GUIの在庫数と Console の発送結果が一致するか。
2. **在庫不足（部分発送）**: 3個中2個のみ発送→残り数量の扱い、エラー表示。
3. **Shopify GUIで在庫調整**: Console は閲覧のみ運用で齟齬がないか、必要なら差異警告を検討。

### C. キャンセル／アーカイブ／修正申請
1. **Shopifyで注文キャンセル**: Webhook→Supabase更新→Consoleに手動リロード通知。
2. **Shopifyで注文アーカイブ**: `archived_at` 同期、Consoleで操作不可＆バッジ表示。
3. **発送後の修正申請**: `/support/shipment-adjustment` フォームから依頼→管理者が LIVAPON admin 画面で状況確認・コメント・ステータス更新を行い、必要な場合だけ Shopify 管理画面を break-glass として使う。
   - `/admin/shipment-requests` で申請にコメント・ステータス更新ができ、セラー履歴に反映されること。
4. **配送同期失敗対応**: `sync_status='error'` の shipment を admin 画面で再同期、Fulfillment ID 紐付け、手動対応済み化できること。

### D. SKU不整合／422エラー
1. **SKU未登録**: Consoleでの表示／警告の出方。
2. **Shopify API 422**: 数量不整合によるエラー発生時の UI/ログ。

### E. CSVインポート（legacy / UI再公開時の準備）
1. CSVで大量注文を投入→エラー行表示。
2. CSV経由の発送登録が FO / Shopify と整合するか。

### H. 配送登録即時受付
1. **正常系**: セラーが追跡番号・配送会社を登録すると、Shopify API の完了を待たずに成功 Toast が出て、注文一覧と発送履歴に即時反映される。
2. **冪等性**: 同一 `requestId` の再送で shipment が重複せず、payload が異なる場合は `409` になる。
3. **バックグラウンド同期**: `sync_status='pending'` が GitHub Actions worker または手動 resync で `synced` へ進む。
4. **失敗系**: Shopify API 422 / FO 未生成 / token 不足で `sync_error` と `shipment_sync_events` が残り、ユーザーの発送登録自体は消えない。

### F. Bridge App / OAuth
1. **トークン再認可**: `shopify.app.toml` → `shopify app deploy` → `/api/shopify/auth/start`。`shopify_connections` が更新されるか。
2. **アクセストークン期限切れ**: エラー時のアラート／再認可案内。

### G. Realtime Sync（Postgres Changes）
1. **Publication 検証**: `supabase_realtime` publication に `orders/line_items/shipments` が登録されていることを `pg_publication_tables` で確認。
2. **Replica Identity**: `orders` など UPDATE/DELETE 対象テーブルに `REPLICA IDENTITY FULL` を設定し、更新イベントが届くかテスト。
3. **RLS フロー**: `NEXT_PUBLIC_DEBUG_REALTIME=true` でブラウザの `[realtime] ...` ログを確認しつつ、(a) RLS OFF で購読 → (b) RLS ON + セラーフィルタ → (c) Supabase Auth の `vendor_id` が JWT に含まれるケースでイベントが届くかを記録。
4. **UI 冪等性**: 通知トースト表示と `router.refresh()` の再フェッチが両方機能し、イベント取りこぼし時でも最終的に整合が取れるかをスクリーンキャプチャ付きで証明する。

## 3. 実施タイミング
- 本番リリース前：mock + staging / 開発ストアで主要シナリオを実施。本番 100 円注文は最終 smoke が必要なリリースだけ 1 件に限定する。
- リリース後：月次または四半期ごとに要点チェック（複数セラー・キャンセル・アーカイブ・在庫不足など）。
- Shopify APIバージョン切替／アプリ設定変更時に再検証。

## 4. 引き継ぎのヒント
- テスト結果を Issue/PR に紐付け、ログ・スクリーンショットを残す。
- Supabase や Shopify 設定の Runbook を整備し、再現手順を共有。
- 自動化できそうな部分（APIテスト等）は Playwright/Cypress での回帰テスト化も検討。
