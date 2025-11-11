# 開発体験を崩さない品質ゲート & 運用ガイド

このドキュメントは「Lint が通らない」「型エラーでデプロイが落ちる」といった無駄な往復を減らし、配送管理コンソールの品質を継続的に守るための運用メモです。段階的に導入できるよう、ローカル・Git Hooks・CI/CD・運用監視の 4 層で整理しています。

## 1. ローカル必須チェック
- `npm run lint` … ESLint を警告 0 に収束させる（`--max-warnings=0` を package script に設定）。
- `npm run test` … 単体テストは `--runInBand --passWithNoTests` で安定化。Webhook・ラインアイテムなど重要ロジックは最低 1 つの回帰テストを追加。
- `npm run typecheck` … `tsc --noEmit` を実行し、型追加時に必ず失敗箇所が見えるようにする。
- `npm run build` … Next.js の production build が通ることを確認。`FAVICON` など静的アセットもここで検出できる。

> **開発体験 Tips**: `npm run verify` を作り、上記 4 コマンドをまとめて実行。VSCode の Tasks で 1 キー実行できるようにしておくと便利です。

## 2. Git Hooks（手元の強制力）
- `pre-commit`: `npm run lint` + `npm run typecheck`。`lint-staged` で差分ファイルに限定する。
- `pre-push`: `npm run verify`（lint + type + test + build）。Push 前に落とせば無駄な CI 消費が減ります。
- `prepare-commit-msg`: PR テンプレを反映し、「変更目的」「検証ログ」をコミットメッセージに残す習慣を付ける。

> Husky + lint-staged で 5~10 分あれば導入できます。`npx husky add .husky/pre-push "npm run verify"` などでスクリプト化してください。

## 3. CI/CD と自動バリデーション
GitHub Actions 例（`ci.yml`）
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint -- --max-warnings=0
      - run: npm run typecheck
      - run: npm run test -- --runInBand
      - run: npm run build
```
- どれか 1 つでも落ちたらマージをブロック。
- `vercel --prod` は Actions 成功後にのみ許可する（ブランチ保護規則 + Required status checks）。

### Vercel 関連の自動化
- `vercel env pull` を Actions で実行し、Production/Preview の環境変数差分を検査。「未設定の WEBHOOK_SECRET がある場合は CI を落とす」チェックを追加。
- `vercel alias` のズレ検知: `vercel alias ls` 結果と最新デプロイ ID を比較し、違う場合は警告を出す GitHub Action を nightly で回す。

## 4. 運用・監視
- **Vercel Logs**: `vercel logs <prod-domain> --since 5m --query "status>=400"` をマージ前に実行し、Webhook 401 等が残っていないか確認。
- **Shopify Webhook**: `HMAC mismatch` ログが出たら Slack 通知。Signing secret の再設定手順を docs/95 に追記。
- **Supabase 監視**: `line_items` や `orders` に重複が無いか、夜間バッチで差分チェック。異常検知時は Issue を自動起票。

## 5. 推奨運用フローまとめ
1. 変更 → `npm run verify` でローカル検証。
2. コミットすると `pre-commit` が lint/type を走査。
3. Push 時に `pre-push` で `npm run verify` を再実行。
4. GitHub Actions が Release Gate。ここで落ちたら `vercel` に進まない。
5. CI 通過後にのみ `vercel --prod`。Alias は `vercel alias set` のスクリプトで最新に固定。
6. デプロイ完了後、Vercel Logs & Shopify Dashboard をチェックして 401 や HMAC mismatch が無いか確認。

この 6 ステップを徹底すれば、「Lint が通らない」「型エラーで戻る」「Webhook が 401 のまま」といった無駄な往復がほぼ消え、万一の再発もログで即時追跡できます。
