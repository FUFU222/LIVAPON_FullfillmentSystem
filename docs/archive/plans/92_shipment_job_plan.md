# 配送登録ジョブ設計メモ（2025-12-04）

## 1. 背景
- トラッキング番号 + 配送会社の登録はフロントで同期実行しており、1件でもレスポンスが重い。
- 10件以上をまとめて登録すると 3〜5 分待つケースがあり、ユーザ体験が悪化。
- 今後も大量登録やCSVインポートなどが想定されるため、バックグラウンドジョブ化＋進捗表示が必須。

## 2. 方針（Vercel / Next.js 維持）
1. **ジョブ化**: フロント→Route Handler ではジョブ作成のみ行い、即座にジョブIDを返す。
2. **バックグラウンド**: 既存の `/api/internal/...` と同様に、内部 Route Handler + Vercel Cron で `processShipmentJobs()` を実行。
3. **進捗表示**: Supabase にジョブテーブルを持たせ、フロントからポーリング（または Realtime）で `processed_count` 等を表示。

## 3. テーブル設計（Supabase）
### 3.1 shipment_import_jobs
| Column | Type | Note |
| --- | --- | --- |
| id | bigint | PK |
| vendor_id | int | RLS 用、NULL = admin job |
| tracking_number | text | 全件共通の追跡番号 |
| carrier | text | 全件共通の配送会社コード |
| status | text | pending / running / succeeded / failed |
| total_count | int | 登録予定件数 |
| processed_count | int | 完了件数 |
| error_count | int | 失敗件数 |
| last_error | text | 最後のエラー内容 |
| locked_at | timestamptz | ジョブを処理中のときにロックする |
| created_at / updated_at | timestamptz | |

### 3.2 shipment_import_job_items
| Column | Type | Note |
| --- | --- | --- |
| id | bigint | PK |
| job_id | bigint | FK → shipment_import_jobs |
| order_id | int | | 
| line_item_id | int | | 
| quantity | int | | 
| status | text | pending / succeeded / error |
| error_message | text | |
| attempts | int | 再試行回数 |
| last_attempt_at | timestamptz | 最終トライ時刻 |
| created_at / updated_at | timestamptz | |

### 3.3 RLS / インデックス
- `shipment_import_jobs.vendor_id = auth.vendor_id` で行フィルタ。
- `status` + `created_at` で処理待ちを取り出しやすいインデックスを追加。

## 4. API 変更
### 4.1 POST `/api/shopify/orders/shipments`
- **リクエスト**: 現在と同じ payload（選択した line_items, tracking_number, carrier）。
- **レスポンス**: `{ jobId }` のみ返却。HTTP 202。
- **役割**: `shipment_import_jobs` + `job_items` を作成し、`total_count` を設定。
 - **実装メモ**: バリデーション通過後は selection を正規化 → レコード insert。`jobId` と `totalCount` を JSON で返す。

### 4.2 GET `/api/shipment-import-jobs/:id`
- **用途**: フロントから進捗をポーリング。`status / processed_count / error_count` を返す薄いAPI。
- 将来的に Supabase Realtime へ移行しても良い。

### 4.3 POST `/api/internal/shipment-jobs/process`
- **実装**: `processShipmentJobs()` を呼び出し。Vercel Cron から 1〜2分間隔で叩く。
- **認証**: `Authorization: Bearer <CRON_SECRET>` を必須にし、未設定時は dev でのみフリーにする。
- ロジック:
  1. `shipment_import_jobs` から `status='pending'` を `FOR UPDATE SKIP LOCKED` で取得。
  2. `status='running'` で `locked_at` が古いジョブ（stale lock）も再取得候補に含める。
  3. claim したジョブを `status='running'` に更新後、`job_items` を順次処理。
  4. Shopify API → Supabase RPC で発送登録。
  5. 成功/失敗ごとに `processed_count` / `error_count` を更新。
  6. 全件成功で `status='succeeded'`。失敗が残れば `status='failed'`。
  7. 失敗時は `last_error` を更新し、監視ログから追跡できる状態を保つ。

## 8. 運用ガードレール（再発防止）
- `Process Shipment Jobs` のワークフローは API のクエリパラメータ仕様（`jobs` / `items`）と常に整合させる。
- 変更時は PR テンプレの「出荷ジョブ系の変更時のみ（必須）」を全項目チェックする。
- CI（lint/test/build）を必須化し、未通過の PR は `main` にマージしない。
- 障害調査時は以下を最低確認:
  - `shipment_import_jobs.status` と `locked_at`
  - `shipment_import_job_items.status` 集計
  - `Process Shipment Jobs` の `summary.claimed/succeeded/failed`

## 5. フロント側の変更
1. **ディスパッチパネル**
   - Submit 時に `jobId` を受け取り、画面下にプログレスバー（例: `3 / 10 処理中...`）を表示。
   - 5 秒おきに `/api/shipment-import-jobs/:id` をポーリング → `status` に応じて UI 更新。
   - `status='succeeded'` になったら成功トースト + 選択解除。`error_count > 0` なら失敗件数と再試行導線を表示。

2. **エラー表示**
   - `shipment_import_job_items` の `error_message` を一覧で確認できるモーダルを用意し、失敗行だけ再送できるようにする（後続タスク）。

## 6. API 内部チューニング（優先課題）
1. **Supabase RPC 化**: 追跡番号登録 → `shipments` insert/update → `orders` status 更新を RPC 1回で完結させる。
2. **Shopify API 呼び出しの並列化/削減**: 同一注文内で複数ラインを登録する場合、可能なら1 API で処理する（GraphQL or batch endpoint）。
3. **ログ抑制**: Route Handler 内の `console.log` を必要最低限にし、処理時間短縮。

## 7. 今後のToDo / 検討事項
- ジョブ処理に失敗した行だけを再送する仕組み（再ジョブ化 or UI からの再送）。
- CSVインポートとの共通化（`app/import` との統合）。
- 進捗通知をSupabase Realtimeへ移行し、ポーリング無しでも更新されるようにする。 
- 将来的に長時間ジョブが増える場合は Supabase Edge Functions や GitHub Actions への移行も検討。
