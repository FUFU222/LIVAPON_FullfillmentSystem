# セキュリティスキャン運用

最終更新: 2026-05-06

この文書は、本番運用に入った後も脆弱性・秘密情報混入・危険な実装パターンを早めに検知するための運用ルールを定義する。スキャンは品質ゲートの一部であり、認可設計、RLS、Webhook HMAC、業務ロジックのレビューを置き換えるものではない。

## 1. 自動実行

`.github/workflows/security-scan.yml` で以下を実行する。

### Pull Request / main push
- `npm audit --omit=dev --audit-level=high`
- `npm audit --audit-level=high`
- OSV-Scanner dependency scan
- Gitleaks secret scan
- Semgrep `p/default` の `ERROR` severity のみ blocking

PR と main push では、開発速度を落としすぎないために「高リスクで修正判断が明確なもの」を blocking にする。

### 毎週月曜 03:23 JST / 手動実行
- Trivy filesystem scan（vulnerability / misconfiguration / secret、HIGH / CRITICAL）
- Semgrep full report（artifact 保存、blocking しない）
- OWASP ZAP baseline scan（`SECURITY_SCAN_BASE_URL` が設定されている場合のみ）

ZAP は実アプリに HTTP アクセスするため、Repository variable `SECURITY_SCAN_BASE_URL` に staging か production 相当の URL を設定する。Production に直接向ける場合は、ログイン不要の public surface のみを baseline scan する想定とし、攻撃的な active scan は実行しない。

## 2. Dependabot

`.github/dependabot.yml` で npm と GitHub Actions の version update PR を毎週月曜朝に作成する。Next / React、テストツール、Supabase SDK はグルーピングし、レビューしやすい単位で PR 化する。

GitHub repository setting 側では Dependabot security updates を有効化する。GitHub が把握している既知脆弱性については、通常の定期 PR を待たずに security update PR が作られる。

## 3. ローカル実行

手元で主なチェックをまとめて回す。

```bash
npm run security:quick
```

個別に確認する場合:

```bash
npm run security:audit:prod
npm run security:audit
npm run security:osv
npm run security:gitleaks
npm run security:semgrep
npm run security:trivy
```

ローカル CLI は以下を利用する。

```bash
brew install osv-scanner gitleaks trivy
```

Semgrep は `uvx --from semgrep semgrep ...` で実行するため、`uv` が未導入の端末では先に `uv` を入れる。

## 4. レポートの扱い

- `security-reports/` と `security-scan-artifacts/` は Git 管理しない。
- Trivy や Semgrep の raw report には、ソース断片や秘密情報に見える値が含まれることがある。
- GitHub Actions の artifact は調査が必要な時だけ確認し、外部共有しない。
- `.env.local` は Git 管理対象外でも secret scan に反応するため、ローカルレポートを保存する場合は redaction 済みの要約だけを残す。

## 5. 限界と補完

このスキャンで担保できる主な範囲:

- 依存パッケージの既知脆弱性
- リポジトリへの秘密情報混入
- 代表的な静的解析ルールに合致する危険実装
- HTTP security header や public page の baseline な挙動

このスキャンだけでは担保できない範囲:

- Supabase RLS / service role key 境界の設計妥当性
- 管理者 API とセラー API の権限分離
- Shopify Webhook HMAC の実運用設定
- メール・配送同期などの業務フロー不整合
- ログに個人情報やトークンが混ざる設計ミス

したがって、配送同期・管理者操作・プロフィール変更・監査ログなどの権限をまたぐ変更では、スキャンに加えてコードレビューとシステムテストを必須にする。

## 6. 公式リファレンス

- OSV-Scanner: https://google.github.io/osv-scanner/
- Gitleaks: https://github.com/gitleaks/gitleaks
- Trivy filesystem scan: https://trivy.dev/latest/docs/target/filesystem/
- Semgrep CLI: https://semgrep.dev/docs/getting-started/quickstart/
- OWASP ZAP baseline scan: https://www.zaproxy.org/docs/docker/baseline-scan/
- Dependabot configuration: https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file
