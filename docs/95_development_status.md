# 開発状況サマリー（2025-11-09時点）

## 1. 現在の整備済みポイント
- **OMモデル仕様策定**: `DEVELOPMENT_PLAN_OM_MODEL.md` に背景・役割分担・データフロー・API要件を整理済み。
- **Bridge App 設定**
  - `shopify.app.toml` に必要スコープと Webhook 購読 (`/api/shopify/orders/ingest`) を明示。
  - Shopify 側で再認可済み。最新トークンは `shopify_connections` に保存（`shpat_8937...`）。
- **データベース整備**
  - `contact_name` カラム欠如を補うマイグレーションを追加し、本番 DB に `supabase db push` 済み。
  - `shopify_connections` を橋頭堡として Token/Scope を管理（UI 未実装だが Supabase Dashboard で確認可能）。
- **UI/UX 改善**
  - 発送一覧テーブルの行高を縮め、1画面に多くの注文が表示可能に。
  - Supabase Realtime で発送更新を監視し、ベンダー一覧を即時リフレッシュ。
  - 発送登録直後でもステータスを `fulfilled/partially_fulfilled` に派生させ、表示齟齬を解消。
  - ヒーローセクションとヘッダーのブランド名を「配送管理コンソール」に統一し、Official Partner Access バッジの視認性を向上。
  - ボタン／ナビゲーションへの hover/active フィードバックを強化し、遷移時はオーバーレイを表示して操作感を明確化。
  - 発送登録フローを「入力 → 確認」のステップに分け、最終確認セクションで誤操作を防止。
  - 発送取消時に理由・確認ダイアログを必須とし、重要操作であることが明確になるよう UI を調整。
  - 未発送に戻す処理では赤色の確認パネルを表示し、注意喚起と理由入力をセットにした。
- **在庫ポリシー確定**
  - 在庫編集は Shopify GUI（マーチャント管理ロケーション）が唯一の操作点。Console 側は閲覧とステータス同期のみを担い、FS モデル由来の在庫操作は廃止。
- **Fulfillment Callback**
  - `/api/shopify/fulfillment/callback` を実装し、Shopify → Console の配送依頼受信・記録が可能。
  - FO メタ更新や `fulfillment_requests` テーブルを通じた解析も可。

## 2. 直近でやっておきたいこと
1. **Shopify アプリ設定の反映**
   - `shopify app deploy` で TOML 変更（Webhook購読など）を Shopify 側に反映。
   - 必要に応じて開発ストアへ再インストールし、スコープを再適用。
2. **Webhook/FO フローの本番検証**
   - OMモデル前提で `orders/create` → GraphQL PULL → `fulfillmentCreateV2` まで一気通貫テスト。
   - `/api/shopify/orders/ingest` の HMAC 検証ログを確認し、エラーがないかチェック。
3. **アクセストークン管理 UX**
   - `shopify_connections` を閲覧・更新できる管理画面（最低限の read-only）を Console に追加すると運用が楽。
   - Token 履歴・再認可導線も今後の改善候補。
4. **在庫表示方針の確定**
   - GUI 改修後は LIVAPON Console を在庫の真実の源にするか、Shopify GUI を維持するかで表示ロジックが変わるため、仕様合意が必要。
5. **MCP/CLI 連携（任意）**
   - Shopify MCP を Codex に組み込む場合、`mcp.config.json` への追記＋トークン管理が必要。優先度は低だが情報収集済み。

## 3. これまで詰まっていた箇所と解消状況
| 課題 | 状況 |
| --- | --- |
| FSモデル採用で在庫編集できない | OMモデルへ移行し、PULL方式で FO を取得する方針に決定。`DEVELOPMENT_PLAN_OM_MODEL.md` に記録済み。 |
| Shopify API 422 "api_client does not have access to the fulfillment order" | `_merchant_managed_` スコープを使う OM 前提に切り替え。FS向けスコープ削除 → 再認可を実施。 |
| Supabase vendors.contact_name カラム欠如 | マイグレーションで `contact_name` を追加済み（本番 DB 反映済）。 |
| 配送登録後も注文ステータスが未発送のまま | 出荷実績を基に派生ステータスを計算するよう `mapDetailToSummary` を修正。 |
| リアルタイム反映不足 | Supabase Realtime で `shipments`/`line_items`/`orders` を購読し、一覧画面に即時反映。 |
| Webhook 設定の不整合 | `shopify.app.toml` で実装エンドポイント `/api/shopify/orders/ingest` に合わせて購読トピックを明示。 |
| アクセストークンの把握が困難 | `shopify_connections` から直接確認できることを整理。今後 UI を追加予定。 |

## 4. 次の一歩（推奨）
1. Shopify CLI で `shopify app deploy` → 開発ストア再インストール → Webhook テスト。
2. Bridge App から GraphQL `order.fulfillmentOrders` を呼ぶ Console 実装を確定（PULL フローのコード化）。
3. ベンダー在庫管理 UI の仕様整理（Shopify GUI vs Console どちらを真実の源とするか）。
4. 必要に応じて Token 管理 UI / 再認可ボタンを Console に追加。
