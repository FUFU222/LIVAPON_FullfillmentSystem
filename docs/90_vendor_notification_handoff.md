# ベンダー通知メール実装 引き継ぎメモ（2025-12-04）

## 1. 現在の実装状況
- Shopify Webhook 取り込み (`processShopifyWebhook` → `upsertShopifyOrder`) の完了時に、ラインアイテムをベンダー単位で集計して通知処理を実行。
- ベンダーごとの通知結果は `vendor_order_notifications` テーブルで冪等管理し、`sent / skipped / error` を記録。
- ベンダープロフィールに「新規注文メール通知」のトグルを追加し、`vendors.notify_new_orders` で ON/OFF を制御。
- メール本文は `lib/notifications/vendor-new-order.ts` で生成し、注文情報・配送先・商品名×数量を列挙するテキストメール。
- 送信には Resend SDK を利用。Rate Limit (2 req/sec) に備えて 700ms の再送処理を導入済み。

## 2. 既知課題
1. **ドメイン未認証**: `notifications@livapon.jp` を使用しているが、Resend 側でドメイン認証が未完了のため `validation_error` が返る。
2. **運用ポリシー変更**: Resend で独自ドメインを認証するのが難しいため、「既存の information@〜 など別アドレスから送信したい」という要望が出ている。
3. **再送フロー未整備**: `vendor_order_notifications` が `error` のままの場合、手動で再送する仕組みが未実装。

## 3. 合意済みの次ステップ案
| フェーズ | 内容 |
| --- | --- |
| フェーズ1（現行〜当面） | Gmail (Google Workspace) API を利用し、`notify@chairman.jp` から送信する。Next.js の Route Handler / Server Action で Gmail API を叩き、ベンダー通知/管理者通知を一元管理する。 |
| フェーズ2（本格スケール） | メール送信レイヤーだけ Resend / SES などに差し替える。同じ `sendVendorNewOrderEmail(payload)` インターフェースを維持し、実装を差し替えるだけで移行する。 |
| 共通課題 | `vendor_order_notifications` の `status='error'` 再送ジョブ、通知先の拡張（複数アドレス/CC）、監査ログの整備など。 |

## 4. 引き継ぎポイント
- **環境変数**: 現状は `RESEND_API_KEY` のみ利用。送信元アドレスを変更する場合も、Resend 側のドメイン/From 設定を合わせて更新する必要がある。
- **通知ログ**: Supabase の `vendor_order_notifications` は監査用途として重要。誤送信が無いか・メールが届かない場合のトラブルシュートに活用できる。
- **UI 連動**: ベンダープロフィールで通知を OFF にしているとメールは送信されない（`status='skipped'`）。この仕様を運用チームに共有しておく。 |

## 5. 依存ファイルまとめ
- DB: `schema.sql`, `supabase/migrations/20251204120000_add_vendor_notifications.sql`
- ロジック: `lib/shopify/order-import.ts`, `lib/notifications/vendor-new-order.ts`, `lib/data/vendors.ts`
- UI/アクション: `app/vendor/profile/page.tsx`, `components/vendor/profile-form.tsx`, `app/vendor/profile/actions.ts`
- ドキュメント: `docs/22_vendor_order_email_notifications.md`（仕様詳細）

---
このメモをベースに、送信元アドレスの切り替えと環境変数の見直しを行ってください。EOF
