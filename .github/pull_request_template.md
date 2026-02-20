## 変更概要

<!-- 何を、なぜ変更したかを簡潔に記載 -->

## リスク評価

- [ ] 既存フローへの影響範囲を確認した
- [ ] ロールバック手順を確認した（DB変更がある場合は手順を記載）

## 検証チェック

- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`

## 出荷ジョブ系の変更時のみ（必須）

- [ ] `shipment_import_jobs` の状態遷移（`pending -> running -> succeeded/failed`）を確認
- [ ] `shipment_import_job_items` が `pending` のまま残留しないことを確認
- [ ] ワーカーAPIとGitHub Actionsのクエリパラメータ名が一致していることを確認

## 補足

<!-- 運用チーム向け注意点・監視ポイント・必要な環境変数変更 -->
