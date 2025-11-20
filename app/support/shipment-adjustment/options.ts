export const shipmentIssueTypeOptions = [
  {
    value: 'tracking_update',
    label: '追跡番号・配送会社の修正',
    helper: '誤った追跡番号を登録した、配送会社を差し替えたい場合。'
  },
  {
    value: 'quantity_adjustment',
    label: '数量・ラインアイテムの再調整',
    helper: '数量を減らす/増やす、別ラインアイテムで発送し直したい場合。'
  },
  {
    value: 'cancel_fulfillment',
    label: '発送ステータスを未発送に戻す',
    helper: 'ShopifyでFOがクローズしており、未発送に戻して再登録したい場合。'
  },
  {
    value: 'address_change',
    label: '配送先情報の訂正',
    helper: '住所・氏名の誤りによる再登録。'
  },
  {
    value: 'other',
    label: 'その他（自由入力）',
    helper: '上記に当てはまらないケース。詳しくご記入ください。'
  }
] as const;

export type ShipmentIssueType = (typeof shipmentIssueTypeOptions)[number]['value'];

export const shipmentIssueTypeValues = shipmentIssueTypeOptions.map((option) => option.value);
