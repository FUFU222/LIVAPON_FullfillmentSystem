# 1. プロジェクトの方向転換（OMモデルへの移行）
- **背景**: Shopify 上での在庫編集を GUI 経由で自由に行いたいという運用要件が最優先された。
- **技術的結論**: Fulfillment Service (FS) モデルでは、Shopify が外部委託前提で FO を他ロケーションへアサインするため、在庫編集が制限される。これを回避するため、注文を Shopify 標準ロケーション（マーチャント管理ロケーション）で処理する **Order Management (OM) モデル** に転換。
- **影響範囲**:
  - Fulfillment Service 固有の Webhook (例: `fulfillment_orders/order_routing_complete`) への依存を解消。
  - FO 情報取得の責務を「Webhook待ち (PUSH)」から「GraphQL API での能動取得 (PULL)」に切り替え。
  - Bridge App のスコープ構成や実装を FS 前提のコードからクリーンアップ。

# 2. システム構成と役割分担の明確化
| コンポーネント | 役割 | 主な責務 |
| --- | --- | --- |
| Shopify ストア | 注文・在庫の真実の源 | 注文発生、在庫管理 (GUI 操作可)、FO 自動生成 (マーチャント管理ロケーション) |
| LIVAPON 配送管理コンソール | 業務ロジック層 | Shopify Webhook 受信、注文/FO データを Supabase に保存、セラー UI 提供、FO の分配ロジック実行、Bridge App への API 呼び出し指示 |
| Bridge App | API クライアント層 | Console からの依頼に基づき Shopify Admin API を実行（`Order.fulfillmentOrders`、`fulfillmentCreateV2` 等）。コンソール以外からの直接アクセスは受けない |

# 3. OMモデル採用による新しいデータフロー（PUSHからPULLへの転換背景を含む）
1. **注文発生**
   - トリガー: Shopify の `orders/create` Webhook。
   - Console が受信し、注文情報を Supabase に保存。

2. **FO ID の取得 (PULL)**
   - Console が注文 ID をキーに Bridge App へ API Call を依頼。
   - Bridge App が GraphQL `Order.fulfillmentOrders` を実行し、FO ID / ラインアイテム情報を取得。
   - Console は取得結果を Supabase に格納し、FO キャッシュを更新。

3. **セラー処理 & 追跡番号の送信**
   - セラー UI で配送処理 (出荷登録)。
   - Console が shipment 情報を Supabase に保存し、Bridge App へ追跡番号と FO ID を渡す。

4. **Fulfillment 作成**
   - Bridge App が `fulfillmentCreateV2`（REST 置換無し）を実行し、Shopify に追跡番号を登録。
   - 成功時、Console が Supabase の shipment ステータスを更新。

> **補足（PUSH → PULL 転換理由）**: FS モデルでは Shopify が FO アサイン完了時に `fulfillment_orders/order_routing_complete` などを PUSH していた。OM モデルではマーチャント自身が Fulfillment を握るため、同 Webhook が発火しない / 不安定となり、代わりに Console が能動的に GraphQL API を叩く PULL 方式へ移行した。

# 4. Bridge AppのAPI要件（必須スコープとMutation）
- **必須スコープ**
  - `read_orders`
  - `write_fulfillments`
  - `read_merchant_managed_fulfillment_orders`
  - `write_merchant_managed_fulfillment_orders`
- **不要になるスコープ**
  - `read_assigned_fulfillment_orders`
  - `write_assigned_fulfillment_orders`
- **主に使用する API**
  - GraphQL: `order(id: ...) { fulfillmentOrders { ... } }`
  - REST / GraphQL: `fulfillmentCreateV2`（追跡番号書き込み）
- **役割分担**
  - Console は API 呼び出しを直接持たず、Bridge App へリクエストするだけ。
  - Bridge App は「アクセストークン管理＋API 実行＋レスポンス返却」に専念する。

# 5. 解決済みの問題と今後の課題
## 解決済み
- Fulfillment callback ルートを Console 側に実装済み（OM モデル移行でも利用可能な設計）。
- Supabase に FO / shipment メタ情報を保存する仕組みが整備済み。
- `l/nav` UI の表示をコンパクト化し、発送管理画面の閲覧性を改善。

## 今後の課題
1. **Bridge App スコープ更新**
   - アプリ再認可を行い、`*_merchant_managed_fulfillment_orders` に置き換える。
2. **PULL フロー実装**
   - Console → Bridge App の GraphQL 呼び出しを本番導線として確立。
   - 失敗時のリトライ設計やログ監視を追加。
3. **在庫同期ポリシー整理**
   - GUI 操作を許容するため、Console 側の在庫表示や警告機能の設計が必要。
4. **BCP / フォールバック**
   - Bridge App がダウンした場合の配送登録代替フローを検討（例: 手動追跡入力）。

以上を踏まえ、OM モデルで安定運用するための開発ロードマップ策定と実装を進める。
