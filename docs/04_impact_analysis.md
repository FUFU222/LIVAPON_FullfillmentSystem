# Impact Analysis（影響分析）の概念メモ

## 1. 定義
- **Impact Analysis / Change Impact Analysis**: 変更がシステム全体のどこにどのような影響を与えるかを事前に洗い出し、副作用を最小化するための設計・テスト・レビューを行うプロセス。
- Pull Request や仕様策定時に「影響面 (impact surface)」「影響範囲 (impact scope)」を必ず明記する文化を作る。

## 2. 補助概念
1. **Change Management（変更管理）**  
   - 変更がビジネス/システムへ与える影響を、手続き・レビュー・承認などで管理する。  
   - 仕様変更やリリース前確認も含む。

2. **Regression Prevention（リグレッション防止）**  
   - 既存機能が壊れないようにするテスト・型・E2E などの仕組み。  
   - Impact Analysis で洗い出したリスクをテストで閉じ込める役割。

3. **Dependency Mapping（依存関係マッピング）**  
   - モジュール間依存を可視化し、変更の波及先を把握する。  
   - Codex / AI レビューでも「どの変更がどこに触るか」を抽出するのに近い。

4. **Blast Radius（被害範囲）**  
   - 変更や障害がどこまで影響するかの比喩表現。  
   - 「Scope を限定して blast radius を小さくする設計を取る」など、DevOps / SRE で使われる用語。  
   - Next.js / Supabase / Vercel 環境でも「blast radius を小さく保つ構成」が設計思想として重要。

## 3. 実務での使い方
- 変更前に **Impact Surface** を洗い出し、必要なテスト・監視・通知の更新まで含めて計画。  
- Pull Request テンプレートに **Impact Scope / Risk** を記載。  
- 大きな変更では blast radius を小さくするため段階リリース・feature flag・自動ロールバックを組み合わせる。  
- Regression Prevention の仕組み（型・E2E・スナップショット）で影響範囲の守備範囲を可視化。  
- Dependency Mapping をルーチン化（アーキ図や Sourcegraph/Codex などで毎回把握）。

## 4. LIVAPON での適用
- Shopify Webhook → Supabase → Next.js のチェーンで Impact Analysis を癖づけ、変更前に「どのテーブル／API／UI ハンドラーに影響するか」を一覧化。  
- Slack/Docs にリスク共有し、Releases / GitHub Actions / Supabase migrations まで含めた Change Management を徹底。  
- Blast radius を小さくするため、GitHub Actions（Cron）や Supabase RPC を段階的に切り替える設計・Feature Flag 戦略を取る。  
- CODEx レビュー時には Impact Scope と Regression Prevention の観点を常にセットで確認する。
