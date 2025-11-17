# 実注文テスト計画（2025-11-09）

## 1. 目的
- Shopify (OMモデル) と LIVAPON 配送管理コンソール間のデータ同期／UI を実運用に近い形で検証する。
- 複数ベンダー・在庫不足・キャンセル・アーカイブなど、主要な業務シナリオで問題がないか確認する。
- 重要操作（未発送に戻す、再入荷 等）のログ／通知が期待通り残るかをチェックする。

## 2. テストケース
### A. 複数ベンダー
1. **ベンダーA/B の混載注文**: FO がベンダー別に分割され、Console の表示も正しいか。
2. **ベンダーBのみ発送／取消**: 権限チェック（A の注文は B から操作不可）。
3. **ベンダー別ステータス**: 片方が発送しても、他方に不要な影響が出ないこと。

### B. 在庫・数量
1. **在庫どおりの発送**: Shopify GUIの在庫数と Console の発送結果が一致するか。
2. **在庫不足（部分発送）**: 3個中2個のみ発送→残り数量の扱い、エラー表示。
3. **Shopify GUIで在庫調整**: Console は閲覧のみ運用で齟齬がないか、必要なら差異警告を検討。

### C. キャンセル／アーカイブ／再入荷
1. **Shopifyで注文キャンセル**: Webhook→Supabase更新→Consoleに手動リロード通知。
2. **Shopifyで注文アーカイブ**: `archived_at` 同期、Consoleで操作不可＆バッジ表示。
3. **未発送に戻す**: 理由選択＋ログ記録（`shipment_cancellation_logs`）。
4. **再入荷**: Shopifyで在庫戻しした時に Console の表示（「在庫戻し済み」）が正しいか。

### D. SKU不整合／422エラー
1. **SKU未登録**: Consoleでの表示／警告の出方。
2. **Shopify API 422**: 数量不整合によるエラー発生時の UI/ログ。

### E. CSVインポート（UI再公開時の準備）
1. CSVで大量注文を投入→エラー行表示。
2. CSV経由の発送登録が FO / Shopify と整合するか。

### F. Bridge App / OAuth
1. **トークン再認可**: `shopify.app.toml` → `shopify app deploy` → `/api/shopify/auth/start`。`shopify_connections` が更新されるか。
2. **アクセストークン期限切れ**: エラー時のアラート／再認可案内。

### G. Realtime Sync（Postgres Changes）
1. **Publication 検証**: `supabase_realtime` publication に `orders/line_items/shipments` が登録されていることを `pg_publication_tables` で確認。
2. **Replica Identity**: `orders` など UPDATE/DELETE 対象テーブルに `REPLICA IDENTITY FULL` を設定し、更新イベントが届くかテスト。
3. **RLS フロー**: `NEXT_PUBLIC_DEBUG_REALTIME=true` でブラウザの `[realtime] ...` ログを確認しつつ、(a) RLS OFF で購読 → (b) RLS ON + ベンダーフィルタ → (c) Supabase Auth の `vendor_id` が JWT に含まれるケースでイベントが届くかを記録。
4. **UI 冪等性**: 通知トースト表示と `router.refresh()` の再フェッチが両方機能し、イベント取りこぼし時でも最終的に整合が取れるかをスクリーンキャプチャ付きで証明する。

## 3. 実施タイミング
- 本番リリース前：上記主要シナリオをすべて実施。
- リリース後：月次または四半期ごとに要点チェック（複数ベンダー・キャンセル・アーカイブ・在庫不足など）。
- Shopify APIバージョン切替／アプリ設定変更時に再検証。

## 4. 引き継ぎのヒント
- テスト結果を Issue/PR に紐付け、ログ・スクリーンショットを残す。
- Supabase や Shopify 設定の Runbook を整備し、再現手順を共有。
- 自動化できそうな部分（APIテスト等）は Playwright/Cypress での回帰テスト化も検討。
