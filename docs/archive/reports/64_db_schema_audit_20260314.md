# DB Schema Audit

作成日: 2026-03-14

## 1. この監査の目的

この文書は、LIVAPON Fulfillment System の既存 Postgres/Supabase スキーマが、
どの程度ベストプラクティスに近いかを確認するための監査レポートです。

今回の監査では、主に次の観点を見ています。

- データ型の選び方
- 一意制約、外部キー、CHECK 制約の有無
- 実際のクエリに合ったインデックス設計
- RLS の適用状況
- アプリのバグがあっても DB 自体が不正データを防げるか

参照した基準は `supabase-postgres-best-practices` スキルのうち、次の項目です。

- `schema-data-types`
- `schema-constraints`
- `schema-foreign-key-indexes`
- `query-missing-indexes`
- `security-rls-basics`
- `security-rls-performance`

## 2. 結論

### 総合評価

「MVP としては良い設計。ただし、Postgres のベストプラクティス級にはまだ届いていない」です。

良いところははっきりあります。

- `orders` / `line_items` / `shipments` の責務分離が自然
- 非同期処理用の `webhook_jobs` と `shipment_import_jobs` が分かれている
- RLS を主要テーブルにしっかり適用している
- Shopify 由来の一意キーを要所で押さえている

一方で、今の設計はまだ「アプリが正しく動けば問題ない」寄りです。
ベストプラクティス寄りの設計は「アプリにバグがあっても DB が不正データを止める」状態です。

この観点では、次の 4 点が特に弱いです。

1. `timestamp` と `timestamptz` が混在している
2. 業務ルールが DB 制約ではなくアプリ実装に依存している
3. 複合インデックスが不足している
4. 一部の複数テーブル更新がトランザクションで守られていない

## 3. 「DB が壊れる」「データが破損する」とは何か

ここでいう「壊れる」は、ディスクや DB サーバそのものが壊れる話ではありません。
実務で主に怖いのは、DB は動いているのに中身の整合性が壊れることです。

### このシステムで起こりうる破損イメージ

- 同じ意味のデータが重複する
  - 例: 同じメールアドレスで `pending` の申請が 2 件入る
- 本来ありえない値が入る
  - 例: `quantity = -1`
  - 例: `fulfilled_quantity > quantity`
- 状態が食い違う
  - 例: 注文は未発送なのに shipment が既に存在する
- 関係が壊れる
  - 例: shipment の vendor と、その shipment に含まれる line item の vendor が一致しない
- 時刻の意味がずれる
  - 例: UTC を入れたつもりでも `timestamp without time zone` に入り、環境ごとに解釈が変わる
- 一部だけ保存される
  - 例: ジョブ本体は作れたが、ジョブ明細は失敗して途中状態が残る

DB 設計の理想は、こうした状態を「アプリの気合い」ではなく「DB 制約」で防ぐことです。

## 4. 主要な監査結果

### 優先度 High: 時刻型が混在している

#### なぜ問題か

`timestamp without time zone` は、時差情報を持ちません。
アプリ側が ISO8601 の UTC 文字列を普通に書き込んでいても、
DB 側では「ただの日時」として扱われるため、環境や取り回し次第で意味がずれます。

#### このリポジトリで見えたこと

- 古い主要テーブルは `timestamp` を使っている
  - `vendors.created_at`
  - `vendor_applications.created_at`, `updated_at`
  - `orders.created_at`, `updated_at`
  - `line_items.created_at`
  - `shipments.shipped_at`, `created_at`, `updated_at`
  - `import_logs.created_at`
- 新しめのテーブルは `timestamptz` を使っている
  - `shipment_import_jobs`
  - `shipment_adjustment_requests`
  - `webhook_jobs`
  - `fulfillment_requests`

#### 実務上の影響

- 並び順や差分監査が信用しづらくなる
- 「いつ更新されたか」の認識が人や環境で変わる
- 後から BI、監査ログ、複数タイムゾーン対応をすると痛む

#### 推奨

- 今後追加する日時列は原則すべて `timestamptz`
- 既存の主要 mutable table も順次 `timestamptz` に揃える
- 特に `orders`, `shipments`, `vendor_applications` を優先する

### 優先度 High: 業務ルールが DB 制約ではなくアプリに依存している

#### 代表例 1: vendor application の重複 pending

アプリ側では、同じメールアドレスの `pending` 申請が既にあるかを確認してから insert しています。
ただし、DB 側にはそれを保証する一意制約がありません。

この状態では、同時送信が起きると次の順で重複が入ります。

1. リクエスト A が pending の既存申請を探す
2. リクエスト B も同時に探す
3. どちらも「まだ無い」と判断する
4. A も B も insert する

#### 実務上の影響

- 管理画面で同一申請が二重に見える
- 承認フローが不安定になる
- サポート対応で「どっちが本物か」が分かりづらくなる

#### 推奨

- `lower(contact_email)` を使った部分ユニークインデックスを追加する
- 条件は `where status = 'pending'`

例:

```sql
create unique index vendor_applications_pending_email_uniq
on vendor_applications (lower(contact_email))
where status = 'pending';
```

#### 代表例 2: quantity 系の妥当性

今のスキーマでは、数量カラムに基本的な `CHECK` 制約がありません。

- `line_items.quantity`
- `line_items.fulfillable_quantity`
- `line_items.fulfilled_quantity`
- `shipment_line_items.quantity`
- `shipment_import_job_items.quantity`

#### 実務上の影響

- バグや手動更新で負数や矛盾値が入る
- 画面の残数計算が壊れる
- Shopify 同期時に意味不明な状態になる

#### 推奨

最低限、次の制約を検討します。

- `quantity >= 0`
- `fulfilled_quantity >= 0`
- `fulfillable_quantity >= 0`
- `fulfilled_quantity <= quantity`
- `shipment_line_items.quantity > 0`

### 優先度 High: 状態列が自由文字列で、DB が typo を止めない

このシステムには状態列が多くあります。

- `orders.status`
- `shipments.status`
- `shipments.sync_status`
- `vendor_applications.status`
- `shipment_import_jobs.status`
- `shipment_import_job_items.status`
- `shipment_adjustment_requests.status`
- `webhook_jobs.status`

UI やアプリコードは有限集合を前提にしていますが、DB は自由入力を許しています。

#### 何が起きるか

- `resolved` のつもりで `resolve` が入る
- `cancelled` と `canceled` が混ざる
- 集計件数が合わなくなる
- バッジ表示や検索条件が効かなくなる

#### 推奨

運用しやすい順番としては次のどちらかです。

1. `text + check constraint`
2. Postgres enum type

この規模ならまずは `check constraint` で十分です。

### 優先度 Medium-High: 実際のクエリに合わせた複合インデックスが不足している

単一列インデックスはかなり入っています。
ただし、実際のアプリは複数条件と並び順の組み合わせで読んでいるため、
大きくなるほど複合インデックスが必要になります。

#### 具体例 1: 発送履歴

発送履歴は `vendor_id` で絞りつつ、`shipped_at`, `created_at` で並べています。

今の設計:

- ある: `shipments(vendor_id)`
- ない: `shipments(vendor_id, shipped_at desc, created_at desc)`

#### 具体例 2: 再同期ジョブ

再同期対象の shipment は `sync_status` と `sync_pending_until` で絞っています。

今の設計:

- ある: `shipments(sync_status)`
- ない: `shipments(sync_status, sync_pending_until)`

#### 具体例 3: 注文番号検索

発送修正依頼フォームでは `orders` を `vendor_id` と `order_number` で引いています。

今の設計:

- ある: `orders(vendor_id)`
- ない: `orders(vendor_id, order_number)`

#### 具体例 4: shipment adjustment 一覧

管理者向けは `status` で絞って `created_at desc`、
ベンダー向けは `vendor_id` で絞って `created_at desc` を使っています。

今の設計:

- ある: `shipment_adjustment_requests(status)`
- ある: `shipment_adjustment_requests(vendor_id)`
- ない:
  - `shipment_adjustment_requests(status, created_at desc)`
  - `shipment_adjustment_requests(vendor_id, created_at desc)`

#### 具体例 5: shipment import job items

ジョブ明細は `job_id` と `status` で頻繁に絞り、`id` や `updated_at` で並べています。

今の設計:

- ある: `shipment_import_job_items(job_id)`
- ある: `shipment_import_job_items(status)`
- ない:
  - `shipment_import_job_items(job_id, status, id)`
  - または `shipment_import_job_items(job_id, status, updated_at desc)`

#### 補足: RLS とインデックス

`orders` の SELECT ポリシーは、`line_items` を見て vendor 所属を判定しています。
この種類の RLS は、関連先の探索に使う列へ複合インデックスがないと、
行数が増えたときに重くなりやすいです。

特に `line_items(order_id, vendor_id)` か、同等の探索を支える複合インデックスを検討したいです。

### 優先度 Medium: 複数テーブル更新がトランザクションで守られていない箇所がある

これは厳密には「テーブル設計」だけの話ではありませんが、
データ整合性に直接効くため監査対象に含めます。

#### 代表例 1: shipment import job 作成

今の実装は次の順です。

1. `shipment_import_jobs` を insert
2. `shipment_import_job_items` を insert
3. 失敗したら jobs を delete

これは「最終的には整える」処理であって、「最初から原子的」ではありません。

#### リスク

- delete に失敗すると親だけ残る
- 途中で例外が起きると観測上の中途半端状態が一瞬でも発生する

#### 代表例 2: shipment adjustment のコメント追加 + ステータス更新

今の実装はコメント insert と request update が別クエリです。

#### リスク

- コメントだけ入って request の状態更新が失敗する
- 監査上、1 つの業務操作が分裂して見える

#### 推奨

- 重要な複数テーブル更新は transaction か RPC に寄せる
- 「業務上 1 回の操作」と見なすものは DB でも 1 単位で成功/失敗させる

### 優先度 Medium: mutable なテーブルでも `updated_at` や更新トリガが不足している

`orders`, `shipments`, `vendor_applications` などは `updated_at` を持っていますが、
DB が一律で自動更新しているわけではありません。

また `vendors` はプロフィール更新があるにもかかわらず `updated_at` がありません。

#### リスク

- 更新履歴の信頼性がコード依存になる
- 将来バッチや SQL 直更新が入ると更新時刻がずれる

#### 推奨

- mutable table には原則 `updated_at`
- `before update` トリガで DB 側で自動更新する

### 優先度 Medium-Low: データ型がやや古い、または意味が曖昧な列がある

#### 1. `serial` / `int` と `bigserial` / `bigint` が混在

今すぐ壊れる話ではありませんが、ベストプラクティスとしては
`generated ... as identity` と `bigint` の方が今後の保守性は高いです。

#### 2. `varchar(n)` が多い

Postgres では性能上ほぼ優位性がないため、
長さ制約そのものに意味が薄い列は `text` の方が素直です。

#### 3. `char(4)` の vendor code

`char(n)` はスペース埋めが入るため、アプリコード上では扱いがやや不自然です。
この用途なら `text` + `check (char_length(code) = 4)` の方が意図が明確です。

#### 4. `shopify_connections.access_token`

設計としては service-role-only に寄せてあり、MVP としては理解できます。
ただし、より強いベストプラクティスでは機密情報の保存方法を別途見直したいです。

## 5. テーブル群ごとの評価

### 5.1 vendors / vendor_applications

#### 良い点

- `vendors` と `vendor_applications` が分かれており、申請と本採用データが混ざっていない
- `vendors.code` を業務識別子として持っている

#### 気になる点

- `vendors.created_at` が `timestamp`
- `vendors` に `updated_at` が無い
- `vendor_applications` に pending 重複を止める DB 制約が無い
- `status` が自由文字列

#### 評価

構造は良いが、承認フローの安全性はまだアプリ依存です。

### 5.2 orders / line_items / order_vendor_segments

#### 良い点

- 注文ヘッダと明細の分離は自然
- Shopify 側 order id と line item id を使って一意性を押さえている
- `order_vendor_segments` は多ベンダー注文への対応として良い補助設計
- RLS でも扱いやすい構造になっている

#### 気になる点

- `orders` の時刻が `timestamp`
- `line_items` に数量系 `CHECK` が無い
- `orders.status` が自由文字列
- `line_items` に `updated_at` が無い
- `OrdersReadable` の RLS を支える複合インデックスが弱い

#### 評価

このシステムの中では最も設計が良い層です。
ただし、データ整合性の guardrail を DB 側にもう一段追加したいです。

### 5.3 shipments / shipment_line_items

#### 良い点

- shipment 本体と shipment-line pivot を分けており、部分発送を表現しやすい
- Shopify 同期用の列が整理されている

#### 気になる点

- `shipments` の主要時刻が `timestamp`
- `status`, `sync_status` が自由文字列
- `shipment_line_items.quantity` に制約が無い
- 再同期や履歴表示向けの複合インデックスが足りない
- vendor/order を nullable にしているので、手動操作で孤児状態を作りやすい

#### 評価

ドメインの形は良いですが、運用規模が大きくなると性能と整合性の両方で痛みやすい層です。

### 5.4 shipment_import_jobs / shipment_import_job_items

#### 良い点

- ジョブテーブルとジョブ明細が分かれている
- `locked_at`, `attempts`, `last_attempt_at` があり、ワーカー再実行に配慮している
- `SKIP LOCKED` を使う関数まで用意されている

#### 気になる点

- counts と quantity に `CHECK` が無い
- `status` が自由文字列
- reclaim / progress / failure summary 向けの複合インデックスが不足
- 作成処理が transaction ではない

#### 評価

非同期処理の骨格は強いです。
ここは「構造は合格、DB 制約とインデックスはまだ不足」と評価できます。

### 5.5 shipment_adjustment_requests / shipment_adjustment_comments

#### 良い点

- サポート業務用に専用テーブルを分けている
- コメントテーブル分離も自然
- RLS も用途に対してかなり丁寧

#### 気になる点

- `status`, `issue_type`, `visibility`, `author_role` が自由文字列
- vendor 一覧 / admin 一覧の実クエリに対し複合インデックスが不足
- コメント追加と状態変更が別クエリ

#### 評価

用途整理はうまいです。
ただし、ワークフロー系テーブルなので、状態値の制約はもう少し強くしておきたいです。

### 5.6 webhook_jobs / fulfillment_requests / shopify_connections

#### 良い点

- 外部連携データを内部テーブルとして分離している
- `webhook_jobs` は一意 webhook id、attempts、lock を持っており良い
- service-role-only 前提に寄せている

#### 気になる点

- `webhook_jobs.status` が自由文字列
- `fulfillment_requests.status` が自由文字列
- 機密情報保存方針は、将来のセキュリティレビューで再確認したい

#### 評価

この層は比較的よくできています。
改善優先度は core domain より下です。

## 6. 直す順番

### フェーズ 1: 早く直すべきもの

1. `vendor_applications` に pending 重複防止の部分ユニークインデックスを追加
2. 主要テーブルの日時列を `timestamptz` に寄せる
3. 以下の複合インデックスを優先追加
   - `orders(vendor_id, order_number)`
   - `shipments(vendor_id, shipped_at desc, created_at desc)`
   - `shipments(sync_status, sync_pending_until)`
   - `shipment_adjustment_requests(vendor_id, created_at desc)`
   - `shipment_adjustment_requests(status, created_at desc)`
   - `shipment_import_job_items(job_id, status, id)`
   - `line_items(order_id, vendor_id)` または同等の複合索引
4. quantity 系の `CHECK` 制約を追加

### フェーズ 2: 安全性を上げるもの

1. 状態列を `check constraint` で固定
2. mutable table の `updated_at` 自動更新トリガを整備
3. 複数テーブル更新を transaction / RPC に寄せる

### フェーズ 3: 設計を整えるもの

1. `serial` から `identity` への移行方針検討
2. `varchar(n)` と `char(4)` の整理
3. 機密情報保存方針の見直し

## 7. ジュニアエンジニア向けの説明テンプレート

このスキーマをジュニアに説明するなら、次の言い方が分かりやすいです。

### まず褒めるポイント

- テーブルの役割分担は良い
- 注文、明細、出荷、ジョブ、申請がちゃんと分かれている
- RLS も入っていて、マルチテナントを意識している

### 次に本質を伝える

「今の設計は、アプリが正しく動けば基本回る。でも、DB 自体が bad data を止める力はまだ弱い」

### 具体例で説明する

- アプリにバグがあると同じ申請が 2 件入る
- typo で変な status が入っても DB は止めない
- 時刻の扱いが混ざっていて、後から監査や集計で困る
- 検索条件に対して索引が弱いので、データが増えると遅くなる

### 目指す状態

「アプリが多少ミスしても、DB が不正データを受け付けない設計」

## 8. 最終判定

### 判定

ベストプラクティスに「近い部分は多い」が、「まだ guardrail が足りない」です。

### 一言でまとめると

このスキーマは、

- 構造設計: 良い
- セキュリティ意識: 良い
- 非同期処理の分離: 良い
- データ整合性の強制力: まだ弱い
- 将来の運用/性能に対する備え: もう一段必要

つまり、

「MVP としては十分戦える。だが、長く運用する DB としては、制約とインデックスを強化したい」
