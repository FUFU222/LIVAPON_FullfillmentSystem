# LIVAPON配送管理システムにおけるリアルタイム同期の実装手順

## 背景と課題
LIVAPONのフルフィルメントシステムでは、Shopify → Supabase → Next.js コンソールの流れで注文データを処理し、複数ベンダーが各自の注文を扱います。  
管理者は全ベンダーの動きを監視・審査する必要があるため、**orders / line_items / shipments 各テーブルに対するリアルタイム同期**が必須です。  
しかし現状、同期の実装に不備がありスタックしているため、再構成が必要です。

---

## 環境と要件
- **Supabaseクライアント**: `@supabase/supabase-js@^2.58.0` + `@supabase/ssr@^0.7.0`
- **フロントエンド**: Next.js 14 (App Router + SSR + Server Actions)
- **データモデル**: 各テーブルに `vendor_id` カラムあり。JOIN不要でベンダーごとに絞り込み可能。
- **JWTクレーム**: `vendor_id` が `app_metadata` および `user_metadata` に保存。
- **ユースケース**: 1分あたり数件〜数十件のWebhook更新。複数ベンダーが同一注文を扱う。

---

## Step 1. Supabase データベース設定

### Publication 追加
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders, line_items, shipments;
```
Dashboard → Database → Replication で **supabase_realtime** のトグルをONにする。  
これにより INSERT / UPDATE / DELETE がリアルタイム配信される。

### RLSポリシー設定
- 各テーブルに RLS を有効化。
- JWT の `vendor_id` と行の `vendor_id` が一致する場合のみ SELECT を許可。
- 管理者 (`role=admin`) は全件閲覧可。

### ベンダー区分テーブル `order_vendor_segments`
- `line_items` から `order_id × vendor_id` の組み合わせを正規化して保持する補助テーブル。
- Line item の挿入/更新/削除で自動的に同期され、`orders` 更新時には `updated_at` をタッチして Realtime イベントを発火。
- Realtime はこのテーブルを `vendor_id=eq.{vendorId}` で購読し、複数ベンダー混在注文でも確実に通知できる。

### REPLICA IDENTITY
削除イベントで `payload.old` を取得したい場合：
```sql
ALTER TABLE orders REPLICA IDENTITY FULL;
```

---

## Step 2. Next.js (SSR) × Supabase 認証共有

### setAuth の呼び出し（重要）
リアルタイム購読前に以下を実行：
```ts
const { data: { session } } = await supabase.auth.getSession();
if (session) await supabase.realtime.setAuth(session.access_token);
```
これを行わないと、RLS により匿名ユーザー扱いとなりイベントが届かない。

### クライアント管理
- Supabase クライアントは **シングルトン化**。
- `createBrowserClient()` を1回だけ呼び、再利用。
- 多重生成は購読二重化・リークの原因。

---

## Step 3. フロントエンドでの購読実装

### 基本構成
```tsx
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function OrdersRealtime({ vendorId }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let channel: any;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`orders-vendor-${vendorId}`)
        .on("postgres_changes",
            { event: "*", schema: "public", table: "orders", filter: `vendor_id=eq.${vendorId}` },
            payload => setOrders(prev => [payload.new, ...prev])
        )
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [vendorId]);
}
```

### 複数テーブル購読
`line_items` / `shipments` も同様に購読可能。  
1チャネル内で `.on()` を複数チェインしても良い。

### クリーンアップ
必ず `supabase.removeChannel(channel)` を呼ぶ。  
再利用不可：再購読時は新しいチャネルを生成。

---

## Step 4. スケーラブルなBroadcast実装（将来拡張）

### トリガー例
```sql
CREATE OR REPLACE FUNCTION public.handle_order_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'vendor:' || COALESCE(NEW.vendor_id, OLD.vendor_id)::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### クライアント購読
```ts
supabase
  .channel(`vendor:${vendorId}`, { config: { private: true } })
  .on('broadcast', { event: 'INSERT' }, handleInsert)
  .subscribe();
```

### Broadcast用RLS
```sql
CREATE POLICY "vendor_can_join_their_channel"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (current_setting('request.jwt.claims')::json->>'vendor_id')::text
  = substring(realtime.topic() from 8)
);
```

---

## Step 5. テストと運用ポイント

### 動作確認
- Supabase Dashboard → Realtime でイベント確認。
- UIで受信できない場合：`setAuth()` or RLSポリシー設定を再確認。

### パフォーマンス監視
- イベント頻度が多い場合、filterで条件を絞る。
- 不要なUPDATEを購読しない。
- ネットワーク切断時はステータス監視・再購読ロジックを追加。

---

## 要点まとめ
✅ `supabase_realtime` パブリケーションにテーブル登録  
✅ RLSでベンダー分離（JWT.vendor_idを参照）  
✅ `supabase.realtime.setAuth()` を購読前に実行  
✅ `filter: vendor_id=eq.${vendorId}` を指定  
✅ `.removeChannel()` で購読解除  
✅ 将来はBroadcast + privateチャンネルでスケール対応  

---

## 参考資料
- Supabase Docs: [Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- Supabase Docs: [Realtime Authorization (Broadcast)](https://supabase.com/docs/guides/realtime/authorization)
- Stack Overflow: [Supabase realtime client with clerk auth](https://stackoverflow.com/questions/76156587/supabase-realtime-client-with-clerk-auth)
- Stack Overflow: [How to subscribe to a supabase realtime channel multiple times?](https://stackoverflow.com/questions/77673035/how-to-subscribe-to-a-supabase-realtime-channel-multiple-times)
- Reddit: [Realtime filters on update and insert events](https://www.reddit.com/r/Supabase/comments/148h1v4/realtime_filters_on_update_and_insert_events/)
- Answer Overflow: [Realtime not working in Node SSR](https://www.answeroverflow.com/m/1430305564117700768)
---

## Appendix: Postgres Changes チェックリスト

### 目的
Shopify からの Webhook/Realtime イベントを Console UI に即時反映させる際、単一ケース想定にならないようにするための設計・実装ガイドライン。

### 対象イベント
- 新規注文 (`orders/create`)
- 既存注文の更新 (`orders/updated`, `orders/cancelled`)
- Fulfillment Order イベント (`fulfillment_orders/*`)
- 出荷更新 (`shipments` / `line_items` の追加・削除・数量変更)

### 基本方針
1. **Webhook → Supabase 更新 → Realtime 通知 → UI** を標準フローとする。UI は常に Supabase を真実のソースとし、Shopify へ直接依存しない。
2. **ベンダー単位**で Realtime 購読する。複数ベンダーが同じ注文に混在するケースでも、それぞれの UI には自分に関連するイベントのみ届く構成を徹底する。
3. **更新対象の明示**
   - 新規注文: `orders` INSERT を vendor_id フィルタで購読
   - 既存注文更新: `orders` UPDATE（ステータス/archived_at など）
   - ラインアイテム/発送: `line_items`, `shipments` の INSERT/UPDATE/DELETE
4. **UI 反映は二段階**
   - ① 即時通知（トースト/バナー/バッジ）でユーザーに気付きを与える
   - ② ユーザー操作で `router.refresh()` または、楽観的更新で DOM を更新 → バックグラウンドで再フェッチして確定

### Supabase 設定チェックリスト（Postgres Changes）
1. **Publication** — 公式 `supabase_realtime` に対象テーブルを登録する。
   ```sql
   alter publication supabase_realtime add table public.orders;
   alter publication supabase_realtime add table public.line_items;
   alter publication supabase_realtime add table public.shipments;
   ```
   ダッシュボードの *Database → Replication → Publications* でも同じ操作ができる。独自 publication を作っても Realtime サーバーは購読しないため、必ず `supabase_realtime` に寄せる。
2. **Replica Identity** — UPDATE/DELETE の差分を流すテーブルは `REPLICA IDENTITY FULL` を付与する。
   ```sql
   alter table public.orders replica identity full;
   ```
   行数が多いテーブルは WAL 増を考慮しつつ、必要最小限の列（主キーなど）を指定する。
3. **RLS と JWT** — RLS は Realtime にも適用されるため、疎通確認は「RLS OFF → 無フィルタ購読 → RLS ON → vendor フィルタ適用」の順で行う。Supabase Auth のユーザー `user_metadata/app_metadata` に `vendor_id` を必ずセットし、`auth.jwt()->>'vendor_id'` で参照できるようにしておく。

### 想定ケース（抜け漏れ防止チェック）
- [ ] 同一注文に複数ベンダーがいる場合
- [ ] Shopify 側で注文を未発送に戻した直後（FO が差し替わるケース）
- [ ] 同じベンダーが複数タブを開いている場合（通知が重複しないか）
- [ ] リロードせずに連続で更新が入る場合（通知バッジや件数が正しく累積されるか）
- [ ] ログイン直後/初回ロード時に Realtime チャンネルが正しく購読されるか

### 実装パターン
#### リアルタイム通知コンポーネント
- 通知バナー or 常駐バッジで `新規 n 件 / 更新 m 件` を表示
- 「後で」ボタンで通知を消しても、内部 state は保持し続ける（タブ切り替え等でも安心）
- 「更新する」で `router.refresh()` → state リセット → バッジも消す

#### Realtime チャンネル設計
```ts
supabase
  .channel(`orders-vendor-${vendorId}`)
  .on('postgres_changes', { schema: 'public', table: 'order_vendor_segments', filter: `vendor_id=eq.${vendorId}` }, handleOrder)
  .on('postgres_changes', { schema: 'public', table: 'line_items', filter: `vendor_id=eq.${vendorId}` }, handleLineItem)
  .on('postgres_changes', { schema: 'public', table: 'shipments', filter: `vendor_id=eq.${vendorId}` }, handleShipment)
  .subscribe();
```

#### Webhook → Realtime 連携
- Webhook 受信時に `orders` / `line_items` / `shipments` を確実に更新する（FO 同期も含む）
- 更新後の Supabase を真実とし、UI は Realtime イベントで差分を検知

### リスク軽減（Impact Analysis 観点）
- 変更前に依存モジュール（orders/line_items/shipments/webhook_jobs/Realtime channel）への影響を洗い出す
- 特に Blast Radius（影響範囲）を意識し、Feature Flag や段階リリースで安全に展開
- Regression Prevention: E2E や component test で通知が期待通り出るかを検証

### 今後の拡張
- ヘッダーバッジや通知センターとの統合
- ベンダーごとの「未読通知」カウンタを Supabase 側で管理
- 新規注文の楽観的挿入（WS 受信直後に一覧へ追加 → バックグラウンドで確定）
### 更新ソースメタデータ（Self-update と外部更新の判別）

1. **目的**
   - ベンダー自身の操作による更新と、Webhook など外部起因の更新を区別し、通知トーストは後者（受動的な更新）に限定する。

2. **DB 変更案**
   - `orders` / `line_items` / `shipments` に `last_updated_source`（TEXT）と `last_updated_by`（UUID など）を追加。
   - Supabase RPC や API でデータを更新する際、以下の値を必ず書き込む：
     - UI 経由の操作：`source = 'console'`, `last_updated_by = <Supabase Auth user id>`
     - Webhook/ワーカー：`source = 'webhook'` など、呼び出し元を表す固定文字列。
   - 既存トリガー／`sync_order_line_items` 内でも同カラムを更新する。

3. **Realtime payload の利用**
   - Realtime で `new.last_updated_source` / `new.last_updated_by` を受け取り、`OrdersRealtimeListener` で以下を判定：
     - `source === 'console'` かつ `last_updated_by === auth.user.id` ⇒ 自分の操作なのでトースト不要。
     - それ以外 ⇒ トーストに積み上げて「最新に更新」ボタンを表示。

4. **利点**
   - マルチタブや複数ユーザーでも誤検知がなくなる。
   - 受動的イベントのみトーストで知らせるという UX 要件を満たせる。

5. **導入手順サマリ**
   1. カラム追加＆既存 RPC/トリガー更新（マイグレーション）。
   2. Webhook ジョブや UI の更新処理で `last_updated_source/by` を埋め込む。
   3. `OrdersRealtimeListener` で payload からメタデータを参照し、通知出し分けを実装。

このステップを経れば、通知トーストは外部更新のみを対象にでき、ユーザー自身の操作による更新ではトーストが出ない構成にできる。
