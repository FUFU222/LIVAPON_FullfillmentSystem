# Vendor Console & Profile Roadmap

最終更新: 2026-05-06

## 1. 現在の提供機能
- `/orders` リスト + 即時更新ボタン。
- `/orders` 画面内の発送登録パネルで部分発送対応のラインアイテム選択と追跡番号登録。Shopify 同期完了を待たず、LIVAPON 側は即時に発送登録済みとして扱う。
- `/orders/shipments` 履歴テーブルと、管理者への発送修正依頼導線。desktop はテーブル、mobile はカード表示を使う。
- `/vendor/profile` で会社名・担当者名・メール・任意パスワード変更（成功時 Toast、Router refresh）。
- Toast/Alert/Modal コンポーネントは共通実装済み。画面遷移の blocking spinner は使わず、loading UI は静的 skeleton にする。
- モバイル下部ナビ（注文 / 履歴 / 修正 / 会社）と横長ヘッダーロゴを提供済み。
- `/import` はコード残存機能であり、現行の正式運用スコープには含めない。

## 2. 最近完了した項目
- Vendor Profile フォームとサーバーアクションの実装（`updateVendorProfileAction`）。
- Orders テーブルの refresh トリガー + Toast 通知 (`OrdersRefreshButton`)。
- Shopify 発送同期の数量計算ロジック改善（部分数量 / FO 残量を考慮）。
- 配送登録 API の即時受付化、冪等 `requestId`、バックグラウンド resync への移行。
- 発送履歴・管理者注文詳細のモバイル UI 改善。
- 余白を切り詰めた横長 SVG ヘッダーロゴへ差し替え。
- CSV インポートの preview / validation コード保全。

## 3. 進行中 / 近日対応
| タスク | 詳細 | 担当 |
| ------ | ---- | ---- |
| プロフィール拡張調査 | 住所/電話など追加フィールドと RLS 設計 | 調査中 |
| 同期失敗監視 | `sync_status='error'` / stale `processing` を admin / Slack / Dashboard に出す | 次フェーズ |

## 4. 中期バックログ
- Shopify FO 未生成時の補助 API（GraphQL `fulfillmentOrderCreate`）導入と運用手順書化。
- 在庫状況・未割当 SKU の可視化（`line_items` 拡張）。
- セラーごとの KPI カード（注文数 / 出荷数 / 同期エラー数）。

## 5. UX 改善メモ
- Orders テーブルの列幅が狭い環境では注文番号と顧客名が折返すため、`sm` 未満は 2 行表示にする。
- モバイル向け注文・発送履歴はカード化済み。今後は管理画面の長文エラーやフォーム幅を継続 QA する。
- Toast の表示秒数は 3.5s を基準にし、成功トーストは自動で消す。

## 6. リスク / 留意点
- セラー削除時に関連注文を保持するか完全削除するかは運用判断が必要（現在は CASCADE）。
- プロフィール更新でメールを変更すると Supabase Auth 側の確認メールが発生する。サポート手順を FAQ に追加予定。
- CSV インポートは現行運用スコープ外だが、再開する場合の timezone 前提は `Asia/Tokyo`。
