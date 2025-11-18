# Vendor Console & Profile Roadmap

最終更新: 2025-11-02

## 1. 現在の提供機能
- `/orders` リスト + 即時更新ボタン。
- `/orders/[id]` で部分発送対応のラインアイテム選択と追跡番号登録。
- `/orders/shipments` 履歴テーブル（`sync_status` 表示）。
- `/import` CSV プレビュー & 行単位バリデーション。
- `/vendor/profile` で会社名・担当者名・メール・任意パスワード変更（成功時 Toast、Router refresh）。
- Toast/Alert/Modal コンポーネントは共通実装済み。

## 2. 最近完了した項目
- Vendor Profile フォームとサーバーアクションの実装（`updateVendorProfileAction`）。
- Orders テーブルの refresh トリガー + Toast 通知 (`OrdersRefreshButton`)。
- Shopify 発送同期の数量計算ロジック改善（部分数量 / FO 残量を考慮）。
- CSV インポートのプレビュー＋検証フロー整備。

## 3. 進行中 / 近日対応
| タスク | 詳細 | 担当 |
| ------ | ---- | ---- |
| 発送再同期ワーカー | `sync_pending_until` 到来時に自動で `syncShipmentWithShopify` を実行 | Codex WIP |
| 発送取消 UI | `cancelShipment` を `/orders/shipments` から呼べるようボタン追加 | Pending |
| プロフィール拡張調査 | 住所/電話など追加フィールドと RLS 設計 | 調査中 |

## 4. 中期バックログ
- Shopify FO 未生成時の補助 API（GraphQL `fulfillmentOrderCreate`）導入と運用手順書化。
- 発送履歴に「再同期」ボタン＋履歴タイムラインを表示。
- 在庫状況・未割当 SKU の可視化（`line_items` 拡張）。
- CSV エクスポート機能（期間・ステータスフィルタ）。
- ベンダーごとの KPI カード（注文数 / 出荷数 / 同期エラー数）。

## 5. UX 改善メモ
- Orders テーブルの列幅が狭い環境では注文番号と顧客名が折返すため、`sm` 未満は 2 行表示にする。
- モバイル向けにテーブル行をカード化する案あり（優先度低）。
- Toast の表示秒数は 3.5s を基準にし、成功トーストは自動で消す。

## 6. リスク / 留意点
- ベンダー削除時に関連注文を保持するか完全削除するかは運用判断が必要（現在は CASCADE）。
- プロフィール更新でメールを変更すると Supabase Auth 側の確認メールが発生する。サポート手順を FAQ に追加予定。
- CSV インポートの timezone は `Asia/Tokyo` 前提。今後多地域対応を検討。
