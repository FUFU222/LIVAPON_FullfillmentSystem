# LIVAPON Fulfillment System セキュリティ/マルチユーザー監査（2026-02-01）

## 範囲・前提
- 対象: リポジトリ内コード/設定（Next.js + Supabase + Shopify連携）
- 未実施: 本番インフラ設定の検証、外部サービス設定、脆弱性スキャン、侵入テスト
- 注記: Supabase プロジェクトの実際の権限/認可設定はコードからは判断できないため、要確認項目が含まれます。

## サマリー（要求10項目）
| # | 項目 | 判定 | 理由（要点） |
|---|---|---|---|
| 1 | 安全なログイン/セッション管理 | 要改善 | 役割/セラーIDを`user_metadata`でも参照しており改ざんリスク。パスワード変更で現パス検証なし。ローカルサインアウトのみ。 (`lib/auth.ts`, `app/vendor/profile/actions.ts`, `components/auth/sign-out-button.tsx`) |
| 2 | 通信経路の安全性（TLS） | 要確認 | 本番TLSはホスティング依存。ローカル`api.tls`は無効。HSTS/HTTPS強制ヘッダ未設定。 (`supabase/config.toml`, `proxy.ts`) |
| 3 | 鍵/秘密情報の保護（ハッシュ化/耐タンパー） | 要改善 | パスワードはSupabase側でハッシュ化想定だが、DB内のShopifyアクセストークン等が平文保存。キー保管/回転の仕組み記述なし。 (`lib/shopify/oauth.ts`, `supabase/migrations/20251011024028_shopify_oauth_tokens.sql`) |
| 4 | 個人情報保護/GDPR相当 | 要改善 | 同意記録・保管期間・削除/開示の仕組みなし。CSVエクスポートにPII含む。 (`app/(public)/apply/actions.ts`, `app/admin/vendors/export/route.ts`) |
| 5 | バックアップ体制 | 要確認 | バックアップ/リストア方針や手順がコード/ドキュメントにない。 |
| 6 | アクセス集中耐性 | 要改善 | アプリ/API側のレート制限やキュー設計が限定的。バックグラウンド処理はあるが全体設計は不明。 (`app/api/internal/*`, `app/api/shopify/orders/ingest/route.ts`) |
| 7 | 流出防止/最新パッチ/SQLi対策 | 要改善 | RLSが未設定/緩いテーブルがあり、`OrdersInsertUpdate`が全許可。`/app/dev`が本番に残る可能性。セキュリティヘッダ無効。 (`supabase/migrations/*`, `app/dev/*`, `proxy.ts`) |
| 8 | パスワード忘れ対応 | 未実装 | パスワードリセット/再発行の導線がコード上見当たらない。 |
| 9 | SSO/SAML/代理認証 | 未実装 | SAML/SSOの実装・設定が見当たらない。 |
|10| マルチテナント分離 | 要改善 | `vendor_id`/`role`がユーザー操作可能なメタデータ依存。RLSのJWTクレーム設計が不整合の可能性。 (`lib/auth.ts`, `supabase/migrations/*`) |

## 詳細所見

### 1. ログイン/セッション管理
現状
- Supabase Authでログイン/セッション取得 (`components/auth/sign-in-form.tsx`, `lib/auth.ts`).
- サインアウトは`scope: 'local'`のみ (`components/auth/sign-out-button.tsx`).
- `lib/auth.ts`は`user_metadata` + `app_metadata`を統合して`role`/`vendor_id`を解決。
- パスワード変更時に`currentPassword`を要求しているが検証していない。 (`app/vendor/profile/actions.ts`)

懸念
- `user_metadata`はユーザーが更新可能なため、`role`や`vendor_id`を改ざんできる恐れ（権限昇格・テナント越境）。
- セッション破棄がローカルのみだと、他端末のセッションが残る。
- `secure_password_change=false`（ローカル設定）により再認証なしでパスワード更新可能。 (`supabase/config.toml`)

推奨
- `role`/`vendor_id`は`app_metadata`またはDBの権限テーブルから発行し、`user_metadata`を参照しない。
- SupabaseのカスタムアクセストークンフックでJWTに信頼済みクレームを付与、RLSで参照。
- パスワード変更時の再認証を有効化（`secure_password_change=true`）し、実装で確認フローを追加。
- `signOut({ scope: 'global' })`など全端末サインアウトの導入を検討。

### 2. 通信経路（TLS/HTTPS）
現状
- Shopify連携URLはHTTPS設定。 (`shopify.app.toml`)
- ローカルSupabase APIはTLS無効。 (`supabase/config.toml`)
- HSTSやHTTPS強制、CSP等のセキュリティヘッダはコード上有効化されていない。 (`proxy.ts`が`middleware.ts`ではなく未適用)

懸念
- 本番環境でHTTPS強制/HSTSが不明。

推奨
- 本番でHTTPS強制とHSTSを有効化。
- `proxy.ts`を`middleware.ts`へ移行し、セキュリティヘッダとCSPを導入。

### 3. 鍵/秘密情報の保持
現状
- パスワードはSupabase側でハッシュ化される想定。
- ShopifyアクセストークンをDBに保存。 (`lib/shopify/oauth.ts`, `supabase/migrations/20251011024028_shopify_oauth_tokens.sql`)
- Gmail等の秘密情報は環境変数で取得。 (`lib/notifications/email.ts`)

懸念
- アクセストークンが平文保存で、DB流出時のリスクが高い。

推奨
- Supabase VaultやKMSでの暗号化、列レベル暗号化を検討。
- トークンのローテーション/失効フローを明確化。
- 本番ログに秘密情報や指紋情報を出力しないように調整。 (`app/api/shopify/orders/ingest/route.ts`)

### 4. 個人情報保護（GDPR相当）
現状
- 連絡先/住所/電話等のPIIを保存。
- 利用規約の同意チェックはあるが、同意記録は保存していない。 (`app/(public)/apply/actions.ts`)
- CSVエクスポートでPIIを出力。 (`app/admin/vendors/export/route.ts`)

懸念
- 同意管理、データ保持期間、削除/開示対応、監査ログが未整備。

推奨
- 同意日時・バージョンの記録。
- データ削除/エクスポート手順の整備。
- PIIアクセスの監査ログ。

### 5. バックアップ
現状
- バックアップ/リストア方針がコード・ドキュメントから確認できない。

推奨
- SupabaseのPITR/バックアップ設定の確認。
- 定期的なリストアテストを運用計画に組み込む。

### 6. アクセス集中耐性
現状
- Webhookはジョブキュー化され、ロックによる多重処理防止はある。 (`supabase/migrations/20251113140500_create_webhook_jobs.sql`)
- API/画面に対するレート制限やWAFなどの記述はなし。

懸念
- 公開APIやフォームへのリクエスト集中時に耐性が不明。

推奨
- Next.js middlewareやEdgeでのレート制限。
- Webhook/ジョブ処理の並列制御と監視。

### 7. 流出防止/パッチ/SQLi
現状
- Supabaseクエリビルダーを使っており、明示的な生SQLは少ない。
- RLSが限定的で、`OrdersInsertUpdate`が全許可。 (`supabase/migrations/20251114192302_enable_orders_realtime_security.sql`)
- 多くのテーブルでRLS未設定（例: `vendors`, `vendor_applications`, `shopify_connections`, `webhook_jobs` など）。
- `app/dev/*`のデバッグページが本番に残る可能性。
- セキュリティヘッダ適用が未設定。 (`proxy.ts`未適用)

懸念
- 公開anonキー利用時、RLS未設定テーブルへの不正アクセスが起きる恐れ。
- `OrdersInsertUpdate`が認証ユーザーに書き込みを許可するため、改ざんリスク。

推奨
- すべての公開テーブルにRLSを適用し、最小権限に制限。
- `OrdersInsertUpdate`を削除し、必要な操作のみ許可。
- `/app/dev`を本番ビルドから除外、または認証/環境フラグで完全遮断。
- 依存関係の脆弱性スキャンをCIに追加。

### 8. パスワード忘れ対応
現状
- パスワードリセット導線/メール送信処理が存在しない。

推奨
- Supabaseのパスワードリセット機能をUIに追加。

### 9. SSO/SAML
現状
- SAML/SSOの導入コードがない。

推奨
- 企業向け要件がある場合、Supabase SSO or 外部IdP連携を設計。

### 10. マルチテナント分離
現状
- RLSが`auth.jwt()->>'vendor_id'`・`auth.jwt()->>'role'`を前提にしている。 (`supabase/migrations/*`)
- アプリ側は`user_metadata`を参照して`vendor_id`/`role`を解決。 (`lib/auth.ts`)

懸念
- `user_metadata`はユーザーが更新可能なため、テナント越境・権限昇格の恐れ。
- JWTに`vendor_id`や`role`が含まれる保証がなく、RLSが機能しない可能性。

推奨
- `vendor_id`/`role`はDBテーブルに格納し、`auth.uid()`でJOINして取得。
- RLSは`auth.uid()`ベースで実装し、クレーム依存を減らす。
- `app_metadata`のみ参照し、`user_metadata`から`role`を排除。

## 追加で気になった点
- `proxy.ts`でセキュリティヘッダを定義しているが、Next.jsの`middleware.ts`としては実行されないため無効。 (`proxy.ts`)
- ローカル設定で`enable_confirmations=false`、`minimum_password_length=6`などの弱い設定があり、本番流用されると危険。 (`supabase/config.toml`)
- `app/dev`系ページは本番に残ると情報漏洩・攻撃面の拡大につながる。

## 優先度付き改善提案（短期）
1. `role`/`vendor_id`の信頼性確保（`user_metadata`依存を廃止、RLSを`auth.uid()`ベースに整理）
2. `OrdersInsertUpdate`ポリシー削除 + 全テーブルRLS適用
3. `/app/dev`の本番遮断、セキュリティヘッダの有効化
4. パスワードリセット機能導入、`secure_password_change=true`の運用
5. バックアップ/リストア計画の整備

