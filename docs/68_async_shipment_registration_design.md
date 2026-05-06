# 配送登録即時受付化 要件定義・実装仕様

最終更新: 2026-05-06

## 1. 目的

セラーが配送情報を登録したとき、Shopify 連携の完了を待たずに LIVAPON 側では即時に「配送登録済み」と扱う。ユーザー体験は「発送情報を登録しました」という単純な成功体験に寄せ、Shopify への Fulfillment 共有はバックエンドで順次処理する。

2026-05-06 時点でこの方針は実装済み。通常の発送登録 API は `shipment_import_jobs` を作らず、ローカル受付と Shopify 同期を明確に分離する。`shipment_import_jobs` 系は legacy / 互換処理として残す。

## 2. 決定事項

### 2.1 状態の分離

- ユーザー向け状態: LIVAPON に `shipments` / `shipment_line_items` が作成された時点で配送登録済み。
- 外部連携状態: `shipments.sync_status` で `pending / processing / synced / error` を管理。
- Shopify 同期失敗時もユーザーの配送登録は巻き戻さない。
- セラーの主導線では同期状態を強調表示しない。運用・調査では `sync_status`, `sync_error`, logs を見る。

### 2.2 API の責務

`POST /api/shopify/orders/shipments` は以下だけを同期的に行う。

1. CSRF same-origin 検証。
2. Supabase Auth によるセラー認可。
3. 入力検証。
4. セラーが選択した line item の所有権検証。
5. ローカル発送レコード作成。
6. Shopify 同期キュー化状態として `sync_status='pending'` を保持。

Shopify API 呼び出しはレスポンス前に行わない。レスポンスは `202` とし、body は `{ ok: true, totalCount, shipmentCount }` にする。連番の `jobId` や `shipmentId` は返さない。

### 2.3 Shopify 同期

- 既存の `resyncPendingShipments()` を Shopify 共有キューの実行単位として使う。
- API 成功後に `resyncPendingShipments({ limit: 1 })` を fire-and-forget で起動してよいが、これは best effort とする。
- 正式な再試行は GitHub Actions / internal route `/api/internal/shipments/resync` が担う。
- FO 未生成や一時障害は `pending` 維持と `sync_pending_until` による backoff。
- 恒久的な Shopify API エラーは `error` と `sync_error` に保存し、運用監視対象にする。

## 3. セキュリティ・可用性要件

### 3.1 冪等性

配送登録 API は二重クリック、ブラウザ再送、ネットワーク retry で同じ発送が重複作成されないこと。

実装要件:

- フロントは送信ごとに `crypto.randomUUID()` で `requestId` を生成し、API body に含める。
- サーバーは `requestId` が UUID 形式であることを検証する。
- サーバーは `vendorId`, `orderId`, tracking number, carrier, line item id, quantity を正規化して payload hash を作る。
- `shipments` に `registration_request_id UUID`, `registration_payload_hash TEXT` を追加する。
- `(vendor_id, registration_request_id, order_id)` の一意制約または unique index を追加する。
- 同じ `requestId + orderId` が再送された場合、payload hash が同じなら既存 shipment を再利用し、異なるなら `409 Conflict` を返す。

### 3.2 認可と入力検証

- 認可は必ずサーバー側の `auth.vendorId` を使い、body の vendor ID は受け取らない。
- `validateShipmentSelectionsForVendor()` により、選択 line item がログインセラーに属することを検証する。
- quantity はサーバー側で再計算・clamp し、クライアント値を信用しない。
- tracking number / carrier は trim し、空文字を拒否する。
- エラーログに配送先住所や顧客名を出さない。tracking number も必要最小限に留める。

### 3.3 可用性と失敗時動作

- Shopify API 障害はユーザーの登録完了レスポンスに影響させない。
- `sync_status='pending'` が一定時間以上滞留した場合、運用監視の対象にする。
- `sync_status='error'` は再同期対象に含めるが、恒久エラーを無限 retry しないよう retry count と error message を残す。
- fire-and-forget 起動がサーバーレス環境で中断されても、定期 resync が拾えることを必須条件にする。

## 4. UX 要件

- 成功 Toast は「発送情報を登録しました」程度に簡潔にする。
- 進捗ジョブ UI と polling は通常導線から外す。
- 成功後は選択状態・追跡番号・配送業者入力をクリアし、注文一覧を refresh する。
- 注文一覧はローカル shipment を元に即 `発送済` / `一部発送済` を表示する。
- 発送履歴一覧には登録済み shipment が即表示される。

## 5. 実装方針 / 実装済み範囲

### 5.1 DB

`20260504120000_async_shipment_registration.sql` で `shipments` に以下を追加済み。

- `registration_request_id UUID`
- `registration_payload_hash TEXT`
- unique index: `(vendor_id, registration_request_id, order_id)` where `registration_request_id is not null`

加えて `shipment_sync_events` を作成し、shipment 単位の同期・管理者操作イベントを append-only で保存する。

`schema.sql` と Supabase 型の整合も更新する。

### 5.2 バックエンド

- `prepareShipmentBatch()` に `skipFulfillmentOrderSync?: boolean` を追加し、即時受付パスでは Shopify FO 事前同期を行わない。
- `upsertShipment()` に `deferShopifySync?: boolean` と registration metadata を追加し、指定時はローカル保存後に `syncShipmentWithShopify()` を呼ばず `syncStatus: 'pending'` を返す。
- `registerShipmentsFromSelections()` は注文単位で shipment を作成し、`{ shipmentIds, orderIds, itemCount }` を返す。
- 配送登録 API は `registerShipmentsFromSelections()` を呼び、成功後に `resyncPendingShipments({ limit: 1 })` を best effort で起動する。

### 5.3 フロントエンド

- `OrdersDispatchPanel` は API 成功後に job tracking を開始しない。
- API body に `requestId` を含める。
- 成功後は Toast、選択クリア、入力リセット、`router.refresh()` を行う。
- `/api/shipment-jobs/:id` polling はこの画面からは使わない。

## 6. TDD 計画

### RED

1. `POST /api/shopify/orders/shipments`
   - `registerShipmentsFromSelections()` を呼び、`createShipmentImportJob()` を呼ばない。
   - `resyncPendingShipments()` が未解決でも `202` を即返す。
   - `requestId` が無効なら `400`。
   - 同じ request payload の再送は成功扱い、hash 不一致は `409`。

2. `lib/data/orders/shipments`
   - `prepareShipmentBatch(..., { skipFulfillmentOrderSync: true })` は `syncFulfillmentOrderMetadata()` を呼ばない。
   - `upsertShipment(..., { deferShopifySync: true })` は `syncShipmentWithShopify()` を呼ばず、`sync_status='pending'` の shipment を作る。
   - registration unique conflict 時は既存 shipment を再利用する。

3. `OrdersDispatchPanel`
   - 成功レスポンスに `jobId` がなくても成功 Toast を出す。
   - `/api/shipment-jobs/:id` を fetch しない。
   - 成功後に選択状態と入力値がクリアされる。

### GREEN / REFACTOR（完了）

- テストを通す最小実装を行う。
- job polling 関連 state / timer / UI / import を削除する。
- 既存の shipment import job runner と internal route は残し、既存テストを壊さない。

## 7. 受け入れ条件

- セラーが配送登録を送信すると、Shopify API の応答を待たずに成功 Toast が出る。
- 注文一覧は refresh 後すぐにローカル発送状態を反映する。
- 発送履歴一覧に登録済み shipment が表示される。
- Shopify 同期は `sync_status='pending'` からバックグラウンドで `synced` へ進む。
- Shopify 同期失敗時も発送登録は消えず、`sync_status='error'` と `sync_error` に原因が残る。
- 同一 `requestId` の再送で shipment が重複しない。
- 既存の CSRF・認可・RLS 前提を弱めない。

## 8. 本番移行・互換性要件

本番投入時は DB migration とアプリ deploy の順序で不整合が出ないよう、以下を必須条件にする。

- DB 追加カラムは nullable で追加し、既存 shipment への backfill を必須にしない。
- unique index は `registration_request_id is not null` の partial index にし、既存データに影響しない形で作成する。
- migration 適用後、旧アプリコードが動いても配送登録・再同期が壊れないこと。
- 新 API は `requestId` を必須にするが、同一 deploy 内でフロントも同時に送るため、旧フロントとの混在期間がある場合は短期互換としてサーバー側で requestId を生成する。
- deploy 直後に `sync_status in ('pending', 'error')` の件数を確認し、異常増加した場合は新規配送登録 API の変更だけを切り戻せるようにする。
- `shipment_import_jobs` 系は削除しない。既存 internal route と runner は互換のため残す。
- 本番確認は、1 件のテスト注文で「登録直後に LIVAPON 側は発送済み」「数分以内に Shopify 側へ Fulfillment 反映」「再送しても重複なし」を確認してから通常運用に戻す。

## 9. テスト運用方針

100 円商品を本番 EC に置いて手動決済・キャンセルする実注文テストは、最終 smoke test としては有効だが、日常的な検証手段にはしない。通常は以下の階層で品質を担保する。

1. CI / ローカル総合テスト
   - Shopify Admin API は mock し、`orders`, `line_items`, `shipments` fixture で配送登録から `sync_status` 遷移まで検証する。
   - HMAC, CSRF, セラー認可, 冪等性, retry/backoff, payload 生成を自動テストする。

2. Shopify 開発ストア / ステージングストア
   - LIVAPON の staging 環境を接続し、Bogus Gateway または Shopify Payments test mode で test order を作る。
   - 実決済や本番注文を発生させず、Shopify が実際に Fulfillment Order を生成する経路を確認する。

3. 本番 smoke test
   - 決済・本番ストア固有設定まで含めた最終確認が必要なリリースだけ、100 円商品や非公開導線を使った本番実注文テストを 1 件実施する。
   - 実施時はテスト用 SKU / タグ / 顧客メールを使い、確認後にキャンセル・アーカイブする。
   - 本番で manual payment を使うテストは Shopify 上は実注文扱いになるため、頻度を最小限にする。

## 10. 同期失敗時の運用フロー

配送登録後の Shopify 共有は、原則として自動再試行で回復させる。ユーザーが自分で Shopify に同じ配送を手入力する運用は、重複 Fulfillment の原因になるため通常フローには含めない。

1. 登録直後
   - LIVAPON 側に `sync_status = 'pending'` の shipment を作成し、ユーザー画面では配送済みとして扱う。
   - API 応答後に `resyncPendingShipments({ limit: 1 })` を best effort で起動し、可能なら即時に Shopify へ反映する。

2. 一時的な失敗
   - Shopify の Fulfillment Order 未生成、429、5xx、ネットワーク失敗は自動再試行対象にする。
   - `sync_pending_until` と `sync_retry_count` で backoff を管理し、GitHub Actions の `/api/internal/shipments/resync` が期限到来分を再送する。
   - ユーザーへは配送登録済み表示を維持し、管理側だけが失敗件数・最終エラーを監視する。
   - 同期 worker は失敗時も必ず `processing` から `pending` または `error` へ戻し、再同期対象から消えないようにする。

3. 設定・権限起因の失敗
   - Shopify token 失効、scope 不足、shop domain 不整合などは再試行だけでは解消しないため、管理者アラート対象にする。
   - 管理者が接続設定を修復した後、同じ再同期キューで再送する。
   - 管理者対応の主導線は Shopify 管理画面ではなく LIVAPON の admin 画面に置く。
   - admin 画面には同期失敗一覧、最終エラー、再同期実行、手動対応済み化、必要に応じた `shopify_fulfillment_id` 紐付けを用意する。

4. 業務状態起因の失敗
   - Shopify 側で注文キャンセル済み、既に Fulfillment 済み、数量不一致などの場合は自動で確定処理しない。
   - 管理者が LIVAPON と Shopify の状態を確認し、再同期・手動対応済み化・配送登録取消のいずれかを選ぶ。

5. 手動 Shopify 登録が必要な例外
   - 顧客対応上ただちに Shopify 側を更新する必要があり、自動復旧を待てない場合だけ手動登録を許容する。
   - 手動登録後は LIVAPON 側で `shopify_fulfillment_id` を紐付ける、または手動対応済みステータスにして、後続の自動再同期が重複 Fulfillment を作らないようにする。
   - Shopify 管理画面での直接操作は break-glass 手順として扱い、通常運用の手順書には含めない。

## 11. ログ・監査のフェーズ分け

今回の配送 UX 改善では、配送同期の安全運用に必要な最小ログだけを実装範囲に含める。プロフィール変更やシステム全体の監査ログ基盤は、独立した次フェーズとして設計する。

### 今回含めるログ

- shipment 単位の同期イベントを append-only で残す。
- 対象イベントは `registered`, `sync_started`, `sync_succeeded`, `sync_failed`, `resync_requested`, `manual_resolved`, `shopify_fulfillment_linked` とする。
- 保存する情報は `shipment_id`, `order_id`, `vendor_id`, `actor_type`, `actor_user_id`, `event_type`, `status_from`, `status_to`, `request_id`, `error_message`, `metadata`, `created_at` を基本にする。
- Shopify access token、個人情報、配送先住所全文、メール本文などの秘匿情報はログに保存しない。
- 管理者画面では shipment 詳細から直近イベントを確認できるようにする。

### 次フェーズに分けるログ

- セラープロフィール変更履歴。
- 通知設定変更履歴。
- 管理者によるセラー承認・拒否・削除・権限変更の監査ログ。
- Shopify OAuth / scope 変更履歴。
- システム全体の activity/audit log 画面、検索、保管期間、エクスポート、アラート連携。
