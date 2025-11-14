# Realtime Sync Guidelines

## 目的
Shopify からの Webhook/Realtime イベントを Console UI に即時反映させる際、単一ケース想定にならないようにするための設計・実装ガイドライン。

## 対象イベント
- 新規注文 (`orders/create`)
- 既存注文の更新 (`orders/updated`, `orders/cancelled`)
- Fulfillment Order イベント (`fulfillment_orders/*`)
- 出荷更新 (`shipments` / `line_items` の追加・削除・数量変更)

## 基本方針
1. **Webhook → Supabase 更新 → Realtime 通知 → UI** を標準フローとする。UI は常に Supabase を真実のソースとし、Shopify へ直接依存しない。
2. **ベンダー単位**で Realtime 購読する。複数ベンダーが同じ注文に混在するケースでも、それぞれの UI には自分に関連するイベントのみ届く構成を徹底する。
3. **更新対象の明示**
   - 新規注文: `orders` INSERT を vendor_id フィルタで購読
   - 既存注文更新: `orders` UPDATE（ステータス/archived_at など）
   - ラインアイテム/発送: `line_items`, `shipments` の INSERT/UPDATE/DELETE
4. **UI 反映は二段階**
   - ① 即時通知（トースト/バナー/バッジ）でユーザーに気付きを与える
   - ② ユーザー操作で `router.refresh()` または、楽観的更新で DOM を更新 → バックグラウンドで再フェッチして確定

## 想定ケース（抜け漏れ防止チェック）
- [ ] 同一注文に複数ベンダーがいる場合
- [ ] Shopify 側で注文を未発送に戻した直後（FO が差し替わるケース）
- [ ] 同じベンダーが複数タブを開いている場合（通知が重複しないか）
- [ ] リロードせずに連続で更新が入る場合（通知バッジや件数が正しく累積されるか）
- [ ] ログイン直後/初回ロード時に Realtime チャンネルが正しく購読されるか

## 実装パターン
### リアルタイム通知コンポーネント
- 通知バナー or 常駐バッジで `新規 n 件 / 更新 m 件` を表示
- 「後で」ボタンで通知を消しても、内部 state は保持し続ける（タブ切り替え等でも安心）
- 「更新する」で `router.refresh()` → state リセット → バッジも消す

### Realtime チャンネル設計
```ts
supabase
  .channel(`orders-vendor-${vendorId}`)
  .on('postgres_changes', { schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` }, handleOrder)
  .on('postgres_changes', { schema: 'public', table: 'line_items', filter: `vendor_id=eq.${vendorId}` }, handleLineItem)
  .on('postgres_changes', { schema: 'public', table: 'shipments', filter: `vendor_id=eq.${vendorId}` }, handleShipment)
  .subscribe();
```

### Webhook → Realtime 連携
- Webhook 受信時に `orders` / `line_items` / `shipments` を確実に更新する（FO 同期も含む）
- 更新後の Supabase を真実とし、UI は Realtime イベントで差分を検知

## リスク軽減（Impact Analysis 観点）
- 変更前に依存モジュール（orders/line_items/shipments/webhook_jobs/Realtime channel）への影響を洗い出す
- 特に Blast Radius（影響範囲）を意識し、Feature Flag や段階リリースで安全に展開
- Regression Prevention: E2E や component test で通知が期待通り出るかを検証

## 今後の拡張
- ヘッダーバッジや通知センターとの統合
- ベンダーごとの「未読通知」カウンタを Supabase 側で管理
- 新規注文の楽観的挿入（WS 受信直後に一覧へ追加 → バックグラウンドで確定）
