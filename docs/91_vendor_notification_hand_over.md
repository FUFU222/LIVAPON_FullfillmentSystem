# 次セッションへの申し送り – セラー通知メール対応（2025-12-04）

## 1. 現在の状態
- Shopify `orders/create` Webhook → `upsertShopifyOrder` の段階でセラーごとにメール通知を行う仕組みが実装済み。`orders/updated` などは通知スキップとして重複送信を防止。
- セラープロフィールに「新規注文メール通知」のトグルがあり、`vendors.notify_new_orders` で制御。
- 送信処理を Gmail API（`lib/notifications/email.ts`）経由へ切り替え済み。サービスアカウント + ドメインワイドデリゲーションで `information@chairman.jp` を `sub`/`sender` に設定する。
- `vendor_order_notifications` テーブルで送信結果を記録済み（`sent / skipped / error`）。

## 2. 今後の実装方針（確定済み）
**フェーズ1（継続対応）**
- Gmail（Google Workspace）API を利用し、送信元を `information@chairman.jp` に統一する。（送信ヘルパー実装済み、Secrets 設定＋本番検証が今後の ToDo）
- Next.js の Route Handler / Server Action から Gmail API を直接呼び出す構成に差し替える。（`lib/notifications/email.ts` をベースに追加テンプレートへ展開）
- セラー通知 / 管理者通知ともに同じ送信ヘルパーで一元管理。（管理者通知の移行は未着手）

**フェーズ2**
- メール送信レイヤーのみ Resend / SES などに切り替える。同じ `sendVendorNewOrderEmail(payload)` インターフェースを維持し、実装を差し替えるだけで移行可能にする。

## 3. オープン課題
1. `vendor_order_notifications` の `status='error'` を自動再送するジョブ（429 や Gmail API 障害時の復旧措置）。
2. 通知先アドレスの拡張（複数アドレス／CC）。
3. Gmail API 利用時の認証手順（サービスアカウント or OAuth）の決定、Secrets 管理。
4. Resend/SES へ移行する際の `from` ドメイン認証手順を別途整備。

## 4. 参考ドキュメント
- `docs/22_vendor_order_email_notifications.md`（仕様・文面・トリガー／動的項目）
- `docs/90_vendor_notification_handoff.md`（送信戦略引き継ぎメモ）

以上を踏まえ、次セッションでは Gmail API 用 Secrets の投入と本番テスト、管理者通知の移行や再送ジョブの設計を優先してください。EOF
