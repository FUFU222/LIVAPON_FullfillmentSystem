# Composite Index Implementation Plan

作成日: 2026-03-15

## 1. 目的

この文書は、DB スキーマ監査で挙がった複合インデックス候補を、
そのまま実装タスクに落とせる形へ整理したものです。

参照基準は `supabase-postgres-best-practices` スキルの次の観点です。

- `query-missing-indexes`
- `schema-foreign-key-indexes`

主な考え方は単純です。

- `WHERE` に使う列
- `JOIN` に使う列
- `ORDER BY` に使う列

これらを、実際のクエリの順番に近い形で 1 本のインデックスにまとめます。

## 2. 実装方針

### フェーズ 1 の対象

今回の候補はすべて B-tree の複合インデックスで対応します。

基本方針:

1. まず index を追加する
2. 既存の単一 index はすぐには消さない
3. 実クエリの `EXPLAIN` と運用メトリクスを見てから整理する

### ロールアウト方針

- 開発・検証環境
  - 通常の `create index` で問題なし
- 本番
  - テーブルが大きい場合は `create index concurrently` を優先
  - ただし `concurrently` はトランザクション内で使えないため、Supabase migration とは分けるか、実行方式を事前に確認する

### 検証方針

各 index 追加前後で、最低限次を確認します。

- `EXPLAIN (ANALYZE, BUFFERS)` で Seq Scan / Sort が減るか
- API / 画面の体感が改善するか
- 書き込み時のコスト増が問題ないか

## 3. 候補ごとの実装計画

## 3.1 `orders(vendor_id, order_number)`

### 採用判定

採用

### 対象クエリ

- 発送修正依頼フォームで、ベンダー配下の注文を `vendor_id` と `order_number` で検索

参照:

- [actions.ts#L130](/Users/fufu/code/LIVAPON_FullfillmentSystem/app/support/shipment-adjustment/actions.ts#L130)

### いま起きていること

現在は `orders(vendor_id)` しか無いため、
ベンダー単位で絞った後に `order_number` 判定を追加で行う形になりやすいです。

件数が増えると、ベンダーごとの注文数に比例して遅くなります。

### 実装 SQL 案

```sql
create index idx_orders_vendor_id_order_number
on public.orders (vendor_id, order_number);
```

### 期待する効果

- 注文番号のピンポイント検索が速くなる
- フォーム送信時の order lookup を安定化できる

### 注意点

- `vendor_id` 先頭なので、`vendor_id` を含むクエリに強い
- `order_number` 単独検索の専用 index ではない

### 検証

- 発送修正依頼フォームの order lookup に対して `EXPLAIN`
- `Bitmap Heap Scan` や `Seq Scan` が `Index Scan` / `Bitmap Index Scan` に寄るか確認

## 3.2 `shipments(vendor_id, shipped_at desc, created_at desc)`

### 採用判定

採用

### 対象クエリ

- ベンダー別の発送履歴一覧

参照:

- [queries.ts#L166](/Users/fufu/code/LIVAPON_FullfillmentSystem/lib/data/orders/queries.ts#L166)

### いま起きていること

現在は `shipments(vendor_id)` のみです。
そのため、vendor で絞った後に `shipped_at desc, created_at desc` の並べ替えが別で発生しやすいです。

### 実装 SQL 案

```sql
create index idx_shipments_vendor_id_shipped_at_created_at
on public.shipments (vendor_id, shipped_at desc, created_at desc);
```

### 期待する効果

- 発送履歴画面のソートコストを下げる
- vendor ごとの最新 shipment 取得を安定化する

### 注意点

- この index が十分効くなら、将来的には単一の `idx_shipments_vendor_id` を整理できる可能性があります
- ただし先に usage を見てから判断します

### 検証

- ベンダー発送履歴の取得クエリで `Sort` ノードが消えるか
- 取得件数が多いベンダーでも応答時間が安定するか

## 3.3 `shipments(sync_status, sync_pending_until)`

### 採用判定

採用。ただし将来 partial index へ見直し余地あり

### 対象クエリ

- Shopify 再同期対象 shipment の取得

参照:

- [shipments.ts#L46](/Users/fufu/code/LIVAPON_FullfillmentSystem/lib/data/orders/shipments.ts#L46)

### いま起きていること

現在は `shipments(sync_status)` のみです。
クエリは `sync_status in ('pending', 'error')` で絞りつつ、
`sync_pending_until` の null / 時刻条件と並び順も使っています。

そのため、候補行が増えると「絞る」「順序付ける」の両方で余計なコストが出ます。

### 実装 SQL 案

```sql
create index idx_shipments_sync_status_pending_until
on public.shipments (sync_status, sync_pending_until);
```

### 期待する効果

- 再同期キューの次対象選定を速くする
- バックグラウンド再試行の安定性を上げる

### 注意点

- 将来的には、`pending` / `error` のみを対象にした partial index の方が効率的な可能性があります
- まずは全件複合 index で導入し、その後 `pg_stat_user_indexes` を見て調整するのが安全です

### 検証

- 再同期対象取得クエリで `sync_status` 単独 index より実行計画が改善するか
- pending/error 件数が増えたときに処理時間が伸びにくいか

## 3.4 `shipment_adjustment_requests(vendor_id, created_at desc)`

### 採用判定

採用

### 対象クエリ

- ベンダー向けの発送修正依頼履歴一覧

参照:

- [page.tsx#L46](/Users/fufu/code/LIVAPON_FullfillmentSystem/app/support/shipment-adjustment/page.tsx#L46)

### いま起きていること

現在は `vendor_id` 単独 index です。
そのため、ベンダーで絞った後に `created_at desc` ソートが別処理になりやすいです。

### 実装 SQL 案

```sql
create index idx_shipment_adjustment_requests_vendor_id_created_at
on public.shipment_adjustment_requests (vendor_id, created_at desc);
```

### 期待する効果

- 依頼履歴一覧の応答時間を安定化
- 新しい依頼から順に出す UI に合う

### 検証

- ベンダー履歴ページのクエリで `Sort` が減るか
- 最新 10-50 件の表示が速くなるか

## 3.5 `shipment_adjustment_requests(status, created_at desc)`

### 採用判定

採用

### 対象クエリ

- 管理者向けの依頼一覧
- status 絞り込み + 新しい順表示

参照:

- [shipment-adjustments.ts#L96](/Users/fufu/code/LIVAPON_FullfillmentSystem/lib/data/shipment-adjustments.ts#L96)

### いま起きていること

現在は `status` 単独 index です。
status ごとの件数が増えると、絞った後の並び替えコストが残ります。

### 実装 SQL 案

```sql
create index idx_shipment_adjustment_requests_status_created_at
on public.shipment_adjustment_requests (status, created_at desc);
```

### 期待する効果

- 管理者ダッシュボードの active / resolved リストを速くする
- 依頼件数増加時のソート負荷を軽減する

### 検証

- admin 一覧の `in(status, ...) + order by created_at desc` で plan を確認

## 3.6 `shipment_import_job_items(job_id, status, id)`

### 採用判定

採用。ただし 2 本目候補あり

### 対象クエリ

- pending 明細を `job_id`, `status` で絞って `id asc` で取り出す

参照:

- [shipment-import-jobs.ts#L366](/Users/fufu/code/LIVAPON_FullfillmentSystem/lib/data/shipment-import-jobs.ts#L366)

### 補足クエリ

- failed 明細を `updated_at desc` で上位 5 件取得する処理もある

参照:

- [shipment-import-jobs.ts#L202](/Users/fufu/code/LIVAPON_FullfillmentSystem/lib/data/shipment-import-jobs.ts#L202)

### いま起きていること

現在は `job_id` 単独、`status` 単独 index です。
ジョブごとに pending 明細を取り出すとき、両条件と並び順を 1 本で支えられていません。

### 実装 SQL 案

```sql
create index idx_shipment_import_job_items_job_id_status_id
on public.shipment_import_job_items (job_id, status, id);
```

### 期待する効果

- ジョブ処理対象の pending item 取得が速くなる
- ワーカーの安定性が上がる

### 注意点

- `failed + updated_at desc` のクエリも重いなら、将来次の 2 本目を検討します

```sql
create index idx_shipment_import_job_items_job_id_status_updated_at
on public.shipment_import_job_items (job_id, status, updated_at desc);
```

今回は hot path を優先し、まず `job_id, status, id` を採用します。

### 検証

- pending item 取得の `EXPLAIN`
- ジョブ実行ループの時間短縮

## 3.7 `line_items(order_id, vendor_id)`

### 採用判定

採用

### 対象クエリ

- `orders` の RLS で `line_items` を `order_id` と `vendor_id` で existence check

参照:

- [schema.sql#L379](/Users/fufu/code/LIVAPON_FullfillmentSystem/schema.sql#L379)

### いま起きていること

現在は `line_items(order_id)` と `line_items(vendor_id)` が別々です。
しかし RLS では「特定 order の中に、この vendor の line item があるか」を同時に見ています。

この種の existence check は件数が増えると頻繁に走るため、
単一 index 2 本よりも複合 1 本の方が効きやすいです。

### 実装 SQL 案

```sql
create index idx_line_items_order_id_vendor_id
on public.line_items (order_id, vendor_id);
```

### 期待する効果

- RLS 判定コストを下げる
- vendor ごとの混載注文表示で plan が安定する

### 注意点

- これは `vendor_id` 単独検索の完全代替ではありません
- `line_items(vendor_id)` 単独 index はいったん残す前提です

### 検証

- vendor orders 一覧関連クエリ
- RLS が掛かった `orders` 取得で nested plan が改善するか

## 4. 実装順

実装順は次を推奨します。

1. `idx_orders_vendor_id_order_number`
2. `idx_shipments_vendor_id_shipped_at_created_at`
3. `idx_shipment_adjustment_requests_vendor_id_created_at`
4. `idx_shipment_adjustment_requests_status_created_at`
5. `idx_shipment_import_job_items_job_id_status_id`
6. `idx_line_items_order_id_vendor_id`
7. `idx_shipments_sync_status_pending_until`

理由:

- 1-6 は UI / RLS / バックグラウンド hot path に直結していて、効果が見えやすい
- 7 は重要だが、クエリ形状がやや特殊で、将来的に partial index への最適化余地がある

## 5. migration タスク分解

### Task A: インデックス追加 migration を作る

候補:

- `supabase/migrations/20260315xxxxxx_add_composite_indexes_phase1.sql`

含める SQL:

- まずは `create index if not exists` ベース
- 本番規模が大きい場合は別運用で `concurrently` を検討

### Task B: 検証クエリを用意する

最低限ほしいもの:

- shipment history
- order lookup
- shipment adjustment admin/vendor list
- shipment import job pending item load
- orders RLS path

### Task C: 追加後の usage を観測する

見たいもの:

- `EXPLAIN (ANALYZE, BUFFERS)`
- `pg_stat_user_indexes`
- API / UI の応答時間

### Task D: 不要な単一 index の整理は別フェーズ

今回すぐにはやらないもの:

- `idx_shipments_vendor_id`
- `idx_shipment_adjustment_requests_vendor_id`
- `idx_shipment_adjustment_requests_status`

理由:

- 追加直後に drop すると切り戻ししづらい
- 実運用で usage を見てから整理した方が安全

## 6. 最終判断

今回の候補は、すべて「実クエリに根拠がある index」です。
そのため、フェーズ 1 として実装する価値があります。

ただし、考え方として大事なのは次です。

- index は「列が重要だから貼る」のではない
- 「その列の組み合わせで、実際に検索・join・sort しているから貼る」

この基準に沿っているため、今回の計画は妥当です。

