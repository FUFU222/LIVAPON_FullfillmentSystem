# 60 Fulfillment Sync Overview

## 目的
- LIVAPON Fulfillment System から Supabase 上のベンダー発送データを Shopify へ反映する設計をまとめる（2025年10月時点）。
- Shopify が完全に Fulfillment Orders を中心とする運用に移行している現状を踏まえた API 利用方針を整理する。

## 推奨アーキテクチャ（2025-10 時点）
- **Fulfillment Orders API の利用が必須**：注文作成時にロケーションごとの Fulfillment Order（FO）が自動生成される。バックエンドは FO を取得し、その FO に紐づく Fulfillment（発送）を作成する。
- **部分発送・複数ロケーション発送を標準サポート**：FO の仕組みにより、同一注文でも複数回に分けた発送やロケーション単位の管理が可能。Shopify 側の注文ステータスも自動で Unfulfilled → Partially Fulfilled → Fulfilled と変化する。
- **旧 Fulfillment API は非推奨**：`/orders/{id}/fulfillments.json` を直接叩く方式は廃止方向。2025 年 4 月以降の新規公開アプリは GraphQL Admin API の利用が必須。現時点では理解しやすい REST での実装を進めつつ、将来的な GraphQL 対応を見据えておく。
- **GraphQL の利点**：`fulfillmentCreate` ミューテーションなら 1 度に複数の追跡番号を取り扱える。REST だと 1 Fulfillment につき 1 追跡番号なので、後追いで `update_tracking` を呼ぶ必要がある。切り替え易い抽象化を検討。
- **ロケーション戦略**：Basic プランのロケーション上限に注意。ベンダー数が上限を超えないならベンダー別ロケーションも可。超える場合は単一ロケーション内でベンダー判別だけ行い、部分発送で対応する。

## 主要コンセプト
- **Fulfillment Order (FO)**：ロケーションごとの発送指示。手動で作成することはできず、注文作成時に自動生成される。
- **FO ラインアイテム**：FO 内に含まれる注文ライン。`fulfillable_quantity`（未発送数）を保持する。
- **Fulfillment**：実際に Shopify にPOSTする発送オブジェクト。FO ラインアイテムの ID と数量、追跡情報を含む。

## LIVAPON 側のデータ前提
- Supabase 側で Shopify `order_id`・`line_item_id` を保持し、FO / FO ラインアイテム ID を取得・キャッシュするように設計（必要に応じてカラム追加）。
- SKU は内部処理用。Shopify API 呼び出し時は FO / ラインアイテム ID を利用する。
- 部分数量発送も FO ラインアイテムに数量を指定して実現可能。

## ベンダー操作フローとの整合
- ベンダー UI で「発送済みにする」を押す → バックエンドで Supabase 更新 → Shopify Fulfillment を作成 → ステータスが Shopify 側に反映される、という流れ。

