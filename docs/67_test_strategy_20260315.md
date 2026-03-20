# テスト戦略ガイド（2026-03-15）

## 1. 目的
- LIVAPON Fulfillment System の品質保証を、ブラウザ依存の重い検証だけに寄せず、業務ロジックの境界ごとに安定して守る。
- 認可、マルチテナント分離、Shopify 連携、ジョブ処理、通知、Realtime のような事故影響の大きい領域を、最も切り分けやすい粒度で証明する。
- PR で高速に回るテストと、夜間または手動で回す高コストなテストを分離し、開発速度を落とさない。

> CSV インポートは廃止済み機能のため、本戦略の優先対象から外す。

## 2. 結論: このコードベースに合うテスト体型
このリポジトリに最適なのは、`E2E 中心` ではなく `業務ロジック中心のハイブリッド・テストピラミッド` です。

推奨する重みづけ:
- 45% Domain / Logic テスト
- 35% Server Action / Route / Job テスト
- 10% UI コンポーネントテスト
- 10% Playwright E2E
- 別枠で `nightly` または `manual` の hybrid テスト

理由:
- 重要な仕様が UI よりも Server Action、Route Handler、Supabase、Shopify webhook/job に集まっている。
- 画面からしか確認できない仕様は意外と少なく、多くはブラウザなしで再現できる。
- E2E だけで保証しようとすると、セットアップが重く、失敗時の原因が見えにくい。

## 3. 設計思想

### 3.1 何をどこで証明するか
- `ブラウザでしか分からないこと` は E2E で証明する。
- `ブラウザを通さなくても分かること` は 1 つ下の安定した境界で証明する。
- 外部依存をまたぐ処理は、境界の手前でモックし、内側の業務ロジックはできるだけ本物を通す。

### 3.2 テストは実装の写経ではない
テストは「このコードがこう書かれているからこう動く」を確認するものではなく、「このシステムは業務上こうあるべき」という約束を証明するものとして設計する。

例:
- vendor A は vendor B の注文を見てはいけない
- admin だけが管理画面に入れる
- Shopify webhook は署名検証を通ったものだけ処理する
- shipment adjustment が解決済みになったら vendor に通知される

### 3.3 E2E は最後の配線確認
E2E は万能ではない。役割は以下に限定する。
- 認証とリダイレクト
- 画面の主要導線
- 役割ごとの権限制御
- テナント分離
- 本当に壊れたら業務停止に近いフロー

## 4. レイヤ別の責務

### 4.1 Domain / Logic テスト
対象:
- バリデーション
- 変換
- ステータス判定
- 数量計算
- payload 生成
- retry 条件

特徴:
- 速い
- 壊れた理由が分かりやすい
- ケースを細かく増やしやすい

このリポジトリの代表例:
- `lib/apply/validation.test.ts`
- `lib/apply/submission-errors.test.ts`
- `lib/utils.test.ts`
- `__tests__/orders-transformers.test.ts`
- `__tests__/shopify-hmac.test.ts`
- `__tests__/shopify-app-config.test.ts`

今後この層へ寄せたいロジック:
- `app/orders/page.tsx` の filter / pagination 判定
- `lib/data/orders/shipments.ts` の selection 集約、数量丸め、対象 line item 判定
- 通知メールの本文組み立て

### 4.2 Server Action / Route / Job テスト
対象:
- Server Action
- Route Handler
- Background Job
- 外部 API 呼び出し前後の業務ルール

特徴:
- 業務ロジックの中核
- 認証、DB 更新、通知、revalidate、retry を 1 本で見られる
- E2E より速く、UI 変更の影響を受けにくい

このリポジトリの代表例:
- `__tests__/shipment-adjustment-actions.test.ts`
- `__tests__/shopify-orders-ingest.test.ts`
- `__tests__/shopify-shipments-route.test.ts`
- `__tests__/shipment-import-runner.test.ts`
- `__tests__/internal-shipment-jobs-process-route.test.ts`
- `__tests__/shipment-job-status-route.test.ts`

原則:
- `auth`
- `DB I/O`
- `cache invalidation`
- `notification`
- `error handling`
を 1 つの仕様として確認する。

### 4.3 UI コンポーネントテスト
対象:
- 表示ロジック
- 誤操作防止 UI
- 状態変化の反映

特徴:
- コンポーネントの契約を守る
- DOM レベルで確認する
- CSS の細部までは見ない

このリポジトリの代表例:
- `__tests__/orders-table.test.tsx`
- `__tests__/status-badge.test.tsx`
- `__tests__/vendor-delete-button.test.tsx`
- `__tests__/vendor-bulk-delete-form.test.tsx`
- `__tests__/navigation-overlay.test.tsx`

原則:
- スナップショット中心にはしない
- 業務影響のある表示だけ明示的に検証する

### 4.4 Playwright E2E
対象:
- 認証導線
- role ごとの画面遷移
- マルチテナント表示分離
- 主要画面の保存、申請、承認フロー

このリポジトリの代表例:
- `tests/e2e/auth-guards.spec.ts`
- `tests/e2e/vendor-orders.spec.ts`
- `tests/e2e/vendor-profile.spec.ts`
- `tests/e2e/vendor-shipment-adjustment.spec.ts`
- `tests/e2e/admin-applications.spec.ts`
- `tests/e2e/admin-shipment-requests.spec.ts`

原則:
- 全画面全操作はやらない
- `@smoke`, `@auth`, `@vendor`, `@admin`, `@hybrid`, `@realtime` のように意図でタグ分けする
- 失敗時に原因が分からないテストは増やさない

### 4.5 Hybrid / Nightly テスト
対象:
- Realtime
- Shopify 実連携に近いフロー
- service-role cleanup 前提の変更系シナリオ

原則:
- 毎 PR では回さない
- nightly または明示実行に分ける
- 実行条件と前提 env を必ずドキュメント化する

既存資料:
- `docs/42_realtime_test_plan.md`
- `docs/63_orders_test_plan.md`

## 5. 業務フロー別の最適な配置

### 5.1 認証 / 認可 / role redirect
守るべき約束:
- 未ログインは sign-in へ飛ぶ
- pending vendor は `/pending` に飛ぶ
- vendor は admin に入れない
- admin は vendor 側 `/orders` ではなく admin へ飛ぶ

担当レイヤ:
- Domain: auth metadata 解決
- Action/Route: `requireAuthContext`, `assertAdmin`, `assertAuthorizedVendor`
- E2E: 最終的な redirect の確認

既存:
- `__tests__/auth-metadata.test.ts`
- `tests/e2e/auth-guards.spec.ts`

### 5.2 注文一覧 / テナント分離
守るべき約束:
- vendor は自分の注文だけ見る
- 検索、status filter、pagination が正しい
- mixed order でも他 vendor の line item を出さない

担当レイヤ:
- Domain: filter / pagination / summary transform
- UI: table 表示
- E2E: テナント分離と主要検索導線

既存:
- `__tests__/orders-transformers.test.ts`
- `__tests__/orders-table.test.tsx`
- `tests/e2e/vendor-orders.spec.ts`
- `tests/e2e/cross-tenant-rls.spec.ts`

不足:
- status filter
- pagination
- mixed order での表示分離
- shipment history の RLS

### 5.3 Vendor profile
守るべき約束:
- 入力検証が正しい
- vendor テーブル更新と auth metadata 更新が一貫する
- メール変更とパスワード変更の失敗分岐が正しく扱われる

担当レイヤ:
- Domain: email / phone validation
- Action: update 処理と失敗分岐
- E2E: 実際の保存と再表示

既存:
- `tests/e2e/vendor-profile.spec.ts`

不足:
- `app/vendor/profile/actions.ts` の単体統合テスト

### 5.4 Shipment adjustment
守るべき約束:
- vendor は申請できる
- admin はコメント / status 更新できる
- internal comment は vendor に見えない
- resolved 時の通知が期待通り送られる

担当レイヤ:
- Action: vendor/admin action の分岐
- Notification: メール payload
- E2E: vendor/admin の往復

既存:
- `__tests__/shipment-adjustment-actions.test.ts`
- `tests/e2e/vendor-shipment-adjustment.spec.ts`
- `tests/e2e/admin-shipment-requests.spec.ts`

不足:
- `app/admin/shipment-requests/actions.ts` の action テスト
- `lib/notifications/shipment-adjustment-update.ts` の本文テスト

### 5.5 Shopify webhook / fulfillment / shipment sync
守るべき約束:
- 署名検証が正しい
- 未登録 shop は拒否する
- 対応 topic だけ処理する
- webhook -> order upsert -> fulfillment metadata sync -> shipment resync の連鎖が正しい
- 再試行可能な失敗と非再試行の失敗を分ける

担当レイヤ:
- Domain: HMAC, topic 判定, app config
- Route: ingest / shipments route
- Job: webhook runner
- Fulfillment: shipment sync

既存:
- `__tests__/shopify-hmac.test.ts`
- `__tests__/shopify-oauth.test.ts`
- `__tests__/shopify-orders-ingest.test.ts`
- `__tests__/shopify-webhook-processor.test.ts`
- `__tests__/shopify-shipments-route.test.ts`
- `__tests__/shopify-fulfillment.test.ts`

不足:
- `lib/jobs/webhook-runner.ts`
- `app/api/internal/webhook-jobs/process/route.ts`
- `app/api/internal/shipments/resync/route.ts`
- `lib/data/orders/shipments.ts` の主要分岐

### 5.6 Admin applications / vendor lifecycle
守るべき約束:
- 申請 validation が正しい
- email conflict が正しく返る
- sign-up と vendor application 作成が整合する
- admin approval / rejection が vendor ライフサイクルに反映される

担当レイヤ:
- Domain: validation / error translation
- Action: submit vendor application
- E2E: admin approval / rejection / post-login

既存:
- `lib/apply/validation.test.ts`
- `lib/apply/submission-errors.test.ts`
- `tests/e2e/admin-applications.spec.ts`

不足:
- `app/(public)/apply/actions.ts` の action テスト

### 5.7 Admin vendors
守るべき約束:
- 単体削除、複数削除、invalid ID、partial failure の扱い
- detail 読み込みの権限制御

担当レイヤ:
- Action: delete / bulk delete / detail load
- UI: confirm modal, requestSubmit
- E2E: 必須ではないが、管理業務の重要度次第で smoke を追加

既存:
- `__tests__/vendor-delete-button.test.tsx`
- `__tests__/vendor-bulk-delete-form.test.tsx`

不足:
- `app/admin/vendors/actions.ts` の action テスト

## 6. 推奨テストスイート構成

### 6.1 PR Fast Lane
毎 PR で必須:
- `npm run lint`
- `npm run test -- --runInBand`
- `npm run build`

将来的に追加:
- `npm run typecheck`

含めるテスト:
- Domain / Logic
- Action / Route / Job
- 軽量 UI テスト

### 6.2 PR Smoke Lane
毎 PR または main 直前で実行:
- Playwright `@smoke`
- Playwright `@auth`

対象:
- sign-in redirect
- admin/vendor redirect
- vendor orders page open
- vendor profile open
- shipment adjustment open
- admin applications open
- admin shipment requests open

### 6.3 Nightly / Manual Lane
対象:
- `@hybrid`
- `@realtime`
- mutation-heavy E2E
- Shopify 実データに近い連携確認

## 7. 命名規約とテスト配置ルール
- 純粋ロジックは対象ファイルの近くに置く
  - 例: `lib/apply/validation.ts` -> `lib/apply/validation.test.ts`
- 複数依存をまたぐ Action / Route / Job は `__tests__` に集約してよい
- E2E は `tests/e2e/*.spec.ts`
- テスト名は `何を守るか` が分かる文にする
  - 良い例: `vendor A does not see vendor B order numbers`
  - 悪い例: `works correctly`

## 8. 実装計画

### Phase 1: 最優先
1. `app/(public)/apply/actions.ts` に action テストを追加
   - validation error
   - email conflict
   - auth sign-up error
   - createVendorApplication 成功
   - 例外時の message 解決
2. `app/vendor/profile/actions.ts` に action テストを追加
   - field validation
   - vendor update failure
   - auth update failure
   - email unchanged / changed の分岐
   - password 更新あり / なし
3. `app/admin/shipment-requests/actions.ts` に action テストを追加
   - admin 権限チェック
   - requestId invalid
   - resolved 時の通知成功 / 失敗 / retry
   - vendor visible comment と resolved の分岐
4. `lib/jobs/webhook-runner.ts` に job テストを追加
   - success
   - retryable fail
   - non-retryable fail
   - summary count
5. `app/api/internal/webhook-jobs/process/route.ts` と `app/api/internal/shipments/resync/route.ts` に route テストを追加
   - secret あり / なし
   - production / non-production
   - limit parsing
   - downstream error の 500

### Phase 2: 次点
1. `app/admin/vendors/actions.ts` の action テスト
2. `lib/notifications/shipment-adjustment-update.ts` の本文テスト
3. `lib/notifications/vendor-new-order.ts` の本文テスト
4. `lib/security/csrf.ts` の unit テスト
5. `lib/data/orders/shipments.ts` のロジック分離とテスト追加

### Phase 3: E2E 補強
1. `tests/e2e/vendor-orders.spec.ts`
   - status filter
   - pagination
   - mixed order visibility
2. `tests/e2e/cross-tenant-rls.spec.ts`
   - shipment history 分離
3. admin vendors の smoke 導線を必要に応じて追加

## 9. 具体的な品質目標
- 重要業務フローは、少なくとも `1本の E2E` と `1本以上の内側テスト` の両方で守る
- 新しい Server Action / Route / Job を追加したら、同時に Jest テストを追加する
- 新しい E2E は `PR smoke` に入れるか `nightly` に送るかを作成時に決める
- `test.skip` は恒久状態にしない。Issue か doc に理由と戻し条件を残す

## 10. すぐやるべき運用変更
- `package.json` に `typecheck` を追加
- Playwright のタグ別実行 script を追加
  - 例: `test:e2e:smoke`, `test:e2e:hybrid`
- PR では `@smoke @auth` を回す CI を追加
- `docs/63_orders_test_plan.md` と `docs/42_realtime_test_plan.md` を本戦略の運用レーンに紐付ける

## 11. この方針の見方
この戦略は「テストを増やすこと」自体が目的ではない。目的は、以下を安定して守ることです。

- 間違った相手にデータを見せない
- 発送や連携の業務フローを壊さない
- 外部依存の揺れがあっても失敗の仕方を制御する
- UI 変更で本質的でないテストが大量に壊れない

つまり、LIVAPON におけるテストは `見た目の自動確認` ではなく、`業務上の約束を境界ごとに証明するための設計` として扱う。
