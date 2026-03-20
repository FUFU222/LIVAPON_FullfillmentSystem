# Phase 1 Index Rollout Runbook

作成日: 2026-03-15

## 1. 目的

この runbook は、フェーズ 1 の複合インデックスを
本番 Supabase にできるだけ安全に入れるための手順です。

対象 SQL:

- [20260315_phase1_composite_indexes_concurrently.sql](/Users/fufu/code/LIVAPON_FullfillmentSystem/supabase/manual/20260315_phase1_composite_indexes_concurrently.sql)

## 2. 先に明確にしておくこと

絶対に「ノーリスク」とは言えません。
ただし、今回の変更は次の理由で低リスクです。

- すべて加算的な index 追加であり、既存テーブル定義やデータは変えない
- query の結果は変わらない
- `CREATE INDEX CONCURRENTLY` を使うため、長時間の書き込みブロックを避けやすい

今回の最大リスクは「Supabase が壊れる」ことではなく、次の運用リスクです。

- index build 中の追加 CPU / I/O 負荷
- 開始時と終了時の短いメタデータ lock 待ち
- 大きなテーブルでの index build 時間増加

## 3. 実行方針

### 採用方針

- 本番は通常 migration ではなく、手動 SQL 実行で入れる
- `CREATE INDEX CONCURRENTLY` を使う
- 1 文ずつ、またはファイル全体を transaction なしで実行する

### なぜ migration ではなく手動か

通常の `CREATE INDEX` はテーブル書き込みを止めやすいです。
今回の目的は「安全寄りの rollout」なので、transaction に乗せる前提の migration より、
`CONCURRENTLY` を使う手動実行の方が適しています。

## 4. 実行前チェック

実行前に少なくとも次を確認します。

1. 管理画面やバッチが極端に混む時間帯を避ける
2. Supabase の disk 使用量に十分な余裕がある
3. 大量の migration や backfill が同時に走っていない
4. 長時間トランザクションを持つバッチが走っていない

あるとよい確認 SQL:

```sql
select now();

select pid, usename, state, query_start, wait_event_type, wait_event, query
from pg_stat_activity
where state <> 'idle'
order by query_start asc;
```

## 5. 実行手順

### 手順

1. Supabase SQL Editor を開く
2. `supabase/manual/20260315_phase1_composite_indexes_concurrently.sql` の内容を貼る
3. 明示的な `begin; ... commit;` を付けずに実行する
4. エラーが出たら、その index 名と lock 待ちか syntax かを確認する

### 実行 SQL

```sql
set lock_timeout = '5s';
set statement_timeout = '0';

create index concurrently if not exists idx_orders_vendor_id_order_number
on public.orders (vendor_id, order_number);

create index concurrently if not exists idx_shipments_vendor_id_shipped_at_created_at
on public.shipments (vendor_id, shipped_at desc, created_at desc);

create index concurrently if not exists idx_shipments_sync_status_pending_until
on public.shipments (sync_status, sync_pending_until);

create index concurrently if not exists idx_shipment_adjustment_requests_vendor_id_created_at
on public.shipment_adjustment_requests (vendor_id, created_at desc);

create index concurrently if not exists idx_shipment_adjustment_requests_status_created_at
on public.shipment_adjustment_requests (status, created_at desc);

create index concurrently if not exists idx_shipment_import_job_items_job_id_status_id
on public.shipment_import_job_items (job_id, status, id);

create index concurrently if not exists idx_line_items_order_id_vendor_id
on public.line_items (order_id, vendor_id);
```

## 6. 実行中の確認

index build の進行確認:

```sql
select *
from pg_stat_progress_create_index;
```

lock 待ち確認:

```sql
select pid, usename, wait_event_type, wait_event, query
from pg_stat_activity
where wait_event_type is not null
order by pid;
```

## 7. 実行後の確認

### index が作られたか

```sql
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_orders_vendor_id_order_number',
    'idx_shipments_vendor_id_shipped_at_created_at',
    'idx_shipments_sync_status_pending_until',
    'idx_shipment_adjustment_requests_vendor_id_created_at',
    'idx_shipment_adjustment_requests_status_created_at',
    'idx_shipment_import_job_items_job_id_status_id',
    'idx_line_items_order_id_vendor_id'
  )
order by indexname;
```

### planner に新 index を学習させる

```sql
analyze public.orders;
analyze public.shipments;
analyze public.shipment_adjustment_requests;
analyze public.shipment_import_job_items;
analyze public.line_items;
```

### 代表クエリの plan を確認する

見るべきポイント:

- `Seq Scan` が減るか
- `Sort` が減るか
- 新 index が使われているか

## 8. 失敗時の扱い

### lock timeout が出た場合

これは「壊れた」ではなく、「今その時間帯は向いていない」です。

対応:

1. その statement は中断する
2. 混雑の少ない時間帯に再実行する
3. 1 本ずつ分けて入れる

### もし index を戻したい場合

```sql
drop index concurrently if exists public.idx_orders_vendor_id_order_number;
drop index concurrently if exists public.idx_shipments_vendor_id_shipped_at_created_at;
drop index concurrently if exists public.idx_shipments_sync_status_pending_until;
drop index concurrently if exists public.idx_shipment_adjustment_requests_vendor_id_created_at;
drop index concurrently if exists public.idx_shipment_adjustment_requests_status_created_at;
drop index concurrently if exists public.idx_shipment_import_job_items_job_id_status_id;
drop index concurrently if exists public.idx_line_items_order_id_vendor_id;
```

## 9. 最終判断

今回の変更については、次の意味で「安全寄り」です。

- データは変えない
- 制約も変えない
- RLS の意味も変えない
- query 結果も変えない
- planner の選択肢を増やすだけ

つまり、壊しにいく変更ではなく、読み取り性能を安定化させる変更です。

ただし、絶対保証ではなく「正しい実行方法を守れば、かなり安全」という種類の変更です。

