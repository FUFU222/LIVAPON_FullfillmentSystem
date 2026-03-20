# Requirements: LIVAPON 配送管理システム (MVP)

## 背景と目的
- LIVAPON/CHAIRMAN で扱う Shopify 注文を Supabase に集約し、セラーが追跡番号登録・発送管理を自律的に行えるようにする（配送管理システム）。
- 管理者はセラー申請の審査・セラー情報整理・注文状況の俯瞰を担う。
- Shopify Fulfillment Orders（FO）との整合を取り、部分発送・リトライを含めた追跡番号同期を実現する。

> ステータス: セラー/管理者用 UI と Shopify 連携は稼働。CSV インポートとセラー自己取消 / 再送 UI は現行運用スコープ外。

---

## コアユースケース
1. **注文同期**: Shopify Webhook (`orders/create`, `orders/updated`, FO 関連トピック) が Supabase の `orders` / `line_items` を更新。
2. **セラーオンボーディング**: 申請フォーム→メール認証→管理者承認→ロール自動割当→`vendor` ログイン。
3. **セラー出荷管理**:
   - `/orders` で検索・フィルタ、ラインアイテム単位で数量と SKU を確認し、同ページ内の発送登録パネルから複数ラインアイテムを選択して追跡番号＋配送会社を登録（Shopify へ Fulfillment 作成 / 更新）。
   - `/orders/shipments` で過去発送を参照し、修正が必要な場合は `/support/shipment-adjustment` から管理者へ依頼。
   - `/vendor/profile` で会社名・担当者・連絡先・任意のパスワード変更。
4. **管理者業務**:
   - `/admin` ダッシュボードで pending 申請・最近の注文・新規セラーをモニタ。
   - `/admin/applications` で審査（承認: コード採番 + Supabase Auth 紐付け / 却下: 理由登録）。
   - `/admin/vendors` で一覧確認、詳細モーダル、単体/一括削除。
   - `/admin/orders` で最新 50 件の注文を参照。
5. **Shopify 同期**:
   - `upsertShipment` が `shipments` / `shipment_line_items` を作成し、`sync_status` を `pending` に。
   - `syncShipmentWithShopify` が FO 情報を取得し Fulfillment API を呼出、成功で `synced`、未生成 FO はリトライスケジュール。
   - `triggerShipmentResyncForShopifyOrder` が FO 完了 Webhook を受け、保留分を即再同期。
   - `cancelShipment` が Shopify Fulfillment を取消し、Supabase レコードを削除。
6. **保留機能（現行運用スコープ外）**:
   - `/import` のコードは残っているが、現在は preview / validation / `import_logs` 記録が中心で、正式な一括登録フローとは扱わない。
   - テンプレや導線を再設計する場合に備え、`order_number,sku,tracking_number,carrier[,quantity]` ベースの案は維持する。

---

## 機能要件サマリ
| 分類 | 要件 |
| ---- | ---- |
| 認証/ロール | Supabase Auth + Server Session。`pending_vendor` は `/pending` へ強制リダイレクト。|
| 注文閲覧 | 検索（注文番号/顧客名）、ステータスフィルタ、行展開で SKU・セラー名表示。|
| 発送登録 | ラインアイテム複数選択、数量自動算出（残数が優先）、送信後は UI をリセット。|
| 発送履歴 | 過去発送の参照と修正依頼導線。セルフサービスのキャンセル / 再送は現行スコープ外。|
| 申請審査 | 申請カードで承認/却下。承認時は 4 桁コード自動採番・Auth ユーザー紐付け。|
| セラー管理 | 一覧→詳細モーダル（申請履歴 + Summary）、一括削除。|
| Shopify 同期 | OAuth (`write_merchant_managed_fulfillment_orders`)、Webhook 検証、FO 情報キャッシュ、指数バックオフ。|
| CSV | 現行運用スコープ外。再開時は preview / 行別エラー / ログ保存 / 正式登録の責務を再整理する。 |

---

## 非機能要件
- **スキーマ整合性**: `schema.sql` ↔ マイグレーション ↔ `lib/supabase/types.ts` を常に同期。
- **監視/ログ**: Shopify API 失敗や FO 未生成は `console.error` で記録し、`sync_error` カラムに残す。
- **性能**: 1,000 行規模の注文表示を想定。クエリは Supabase 側でフィルタ、必要に応じてキャッシュ (`cache`)。
- **UX**: 成功/失敗は Toast + インライン Alert。長時間処理は Toast duration Infinity + 手動 dismiss。
- **アクセシビリティ**: Form / Table のラベル・aria 属性は `docs/21_ui_notification_patterns.md` に準拠。

---

## 将来拡張
- Shopify FO 未生成時の自動補償（GraphQL `fulfillmentOrderCreate` も視野）。
- `sync_pending_until` を消化する Cron / Edge Function ワーカー。
- 返品・再発送フロー、在庫の可視化（Supabase `inventory` テーブル追加予定）。
- App Extension / Shopify 管理画面への UI 埋め込み。
- 多言語 UI（英語/日本語切替）と国際配送キャリアの追加。
