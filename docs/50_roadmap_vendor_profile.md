# 🧭 LIVAPON Fulfillment System – Roadmap: Vendor Profile & UI Enhancement

## 🏗 Phase 2: Core Improvements

このドキュメントでは、LIVAPON Fulfillment System の **ベンダープロフィール管理機能** および  
**UI/UX 全体改善方針** をまとめる。

---

## 2️⃣ 注文一覧画面に「更新」ボタンを設置

### 目的

- ベンダーや管理者が最新の注文状況を即時確認できるようにする。

### 実装案

- `/orders` ページにリロードボタン（🔄）を配置。
- `useRouter().refresh()` または `revalidatePath()` により最新データを取得。
- 将来的にリアルタイムサブスクリプション対応も検討。

---

## 3️⃣ 注文情報の取得強化

### 背景

- 一部注文データで顧客名・配送先住所が欠落する可能性がある。

### 対応

- Shopify Webhook 受信時に以下の情報を確実に保存：
  - `customer_name`（first_name + last_name）
  - `shipping_address`（postal, prefecture, city, address_line1, address_line2）
- Supabase `orders` スキーマの該当カラムを再定義。
- 注文一覧画面で常時表示（ツールチップなども検討）。

---

## 4️⃣ スマホフレンドリー化

### 課題

- 現状 UI がデスクトップ前提で設計されている。

### 改善

- Tailwind CSS のブレークポイントでレスポンシブ対応。
- 対象画面：
  - `/orders`
  - `/apply`
  - `/vendor/profile`
- `shadcn/ui` の `<ScrollArea>` / `<Drawer>` を活用してスマホ最適化。

---

## 5️⃣ CSV 機能の最適化

### 目的

- ベンダー単位でのデータ出力・取込を効率化。

### 改善案

- CSV インポート時のエラーハンドリングを追加。
- 成功 / 失敗件数を `import_logs` テーブルに記録。
- エクスポート時にフィルター対応（期間・ステータスなど）。
- 命名規則例：`orders_9999_YYYYMMDD.csv`
  PART 2 / 2 — docs/roadmap-vendor-profile.md（後半）
  markdown
  コードをコピーする

## 6️⃣ ベンダープロフィール更新機能（新規）

### 目的

- ベンダーが自社情報を自律的に管理できるようにする。

### 対象テーブル

- `vendors`

### 編集可能項目

| 項目     | カラム名     |
| -------- | ------------ |
| 会社名   | company_name |
| 担当者名 | manager_name |
| メール   | email        |
| 電話番号 | phone_number |
| 住所     | address      |

### 実装方針

- 新規ページ `/vendor/profile` を作成。
- Supabase RLS ポリシー：
  ```sql
  CREATE POLICY "Vendors can update own profile"
  ON vendors
  FOR UPDATE
  USING (auth.uid() = user_id);
  react-hook-form + zod バリデーションで安全性を確保。
  ```

更新完了後に toast（スナックバー通知）を表示。

将来的にプロフィール画像アップロード（Supabase Storage）にも対応。

7️⃣ トップページのリファイン（完了）
- `/` にランディングページを実装。ベンダー導線と利用フローを案内。
- カラートーンは白黒ベース＋アクセントカラー `#801010` に統一。
- 申請→承認→利用開始の 3 ステップカードを掲載。

8️⃣ UI モダン化
方向性
シンプルでリッチ。過度なアニメーションは避け、操作性を重視。

ベースカラー：白 × 黒 × アクセントカラー（#801010）。

統一化コンポーネント：

shadcn/ui + lucide-react

9️⃣ 将来的なリアルタイム拡張（Phase 3 構想）
目標
注文が入ると、各ベンダーの注文一覧に リアルタイムで行が追加 される。

概要
Shopify Webhook → Supabase orders への Insert をトリガー。

クライアント側で on('postgres_changes') をリッスン。

新しい注文が検知されたら：

テーブル行を Framer Motion でフェードイン＋スライドイン。

toast 通知で「新しい注文を受信しました！」を表示。

技術スタック想定
Supabase Realtime（Postgres Logical Replication）

Zustand または React Context でリアルタイム状態管理。

Framer Motion + Shadcn UI 組み合わせでアニメーション制御。

クライアント実装スケッチ
ts
コードをコピーする
// orders-realtime.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export function subscribeOrders(onInsert: (row: any) => void) {
return supabase
.channel('orders-changes')
.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
onInsert(payload.new); // Framer Motion でアニメ付き追加
})
.subscribe();
}
🔧 実装優先度
優先度 タスク 理由
★★★ ベンダープロフィール更新機能 運用負荷軽減・自律的管理の実現
★★★ 注文情報の取得強化 データ精度・顧客対応の信頼性向上
★★☆ トップページリファイン UX 改善・初回導線整備
★★☆ スマホ対応 利便性向上
★☆☆ CSV 最適化 実務効率改善
★☆☆ UI モダン化 仕上げ工程で実施
★☆☆ リアルタイム行追加（次期構想） 次フェーズにて導入予定
