# UI 通知・ダイアログ & ランディング指針

## 目的
- フィードバック UI（Toast / Alert / Modal）の使い分けを明示し、実装を統一する。
- 業務 SaaS らしい落ち着きとアクセシビリティを担保する。

## パターン選択
| シナリオ | 推奨手段 | 補足 |
| -------- | -------- | ---- |
| 保存完了・短時間処理 | **Toast** | 操作を遮らず成功/失敗を即通知。重複トーストは `id` で制御。|
| 破壊的操作・確認が必要 | **Modal Dialog** | 背景をロックし、肯否を明確に取る。|
| フォームエラー・状態メッセージ | **Inline Alert** | 画面に残して見逃しを防ぐ。|
| 長期的なお知らせ / メンテ情報 | **Banner** | ルートレイアウトに表示。|

## Toast ガイド
- 実装: `ToastProvider`（`app/layout.tsx`）。呼び出しは `useToast()`（例: `OrdersRefreshButton`, `VendorProfileForm`）。
- 表示位置: 右上。1 件ずつ縦積み。
- プロパティ: `{ id?, variant: 'default' | 'success' | 'error', title, description?, duration? }`。
- 長時間処理（CSV インポートなど）は `duration: Infinity` で表示し、完了時に `dismissToast`。
- アクセシビリティ: `aria-live="polite"` を維持。テキストは 40 文字以内を推奨。

## Modal ガイド
- コンポーネント: `components/ui/modal.tsx`（Radix Dialog ベース）。
- 要件:
  - `aria-modal="true"`、タイトル要素に `id`。
  - オープン時は主要ボタンへフォーカス移動。閉じたらトリガーへ戻す。
  - Esc / 背景クリックで閉じられるよう許可しつつ、破壊的操作は明示的ボタンを用意。
- 用途: セラー削除確認、申請詳細など。情報表示のみなら Drawer/Sheet も検討。

## Alert & Banner
- Alert: `components/ui/alert.tsx` を使用（`variant="default|success|destructive|warning"`）。
- フォームバリデーションエラーは入力直後に表示し、`aria-invalid` を併用。
- システム全体のお知らせはグローバルバナー（未実装）にまとめる計画。暫定的にページ上部の Alert を使用。

## ランディングページ指針
- トーン: 信頼感と落ち着き。余白は広め (`py-16`)、アクセントは `#801010` に限定。
- CTA: 黒背景ボタンは主要、アウトラインボタンは副 CTA。Hover 時に `-translate-y-0.5` を適用。
- コピー: セラーが得られるメリットを 1 行目で提示。横文字は必要最小限。
- レスポンシブ: CTA → フローの順で縦積み、ラインは縦方向グラデーションに切替。

## 実装参照
- `components/orders/orders-refresh-button.tsx` — Toast の典型例。
- `components/vendor/profile-form.tsx` — フォーム内 Alert + Toast の連携。
- `components/admin/vendor-bulk-delete-form.tsx` — Modal + Transition + Alert を組み合わせたケース。

## QA チェックリスト
- [ ] Toast/Alert の文言が日本語で簡潔かつ操作内容を伝えているか。
- [ ] Toast が複数回連続で出ても積み上がりすぎないか（id 重複防止）。
- [ ] Modal 内で Tab 移動がループし、Esc で閉じられるか。
- [ ] ランディングの CTA コントラスト比が WCAG AA を満たすか。背景 `from-white via-slate-50 to-white` 上で `#801010` 利用可。
- [ ] 主要ページでスクリーンリーダーが状態変化を読み上げるか（`aria-live`, `role="status"`）。
