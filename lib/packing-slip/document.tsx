// 納品書(packing slip)PDF コンポーネント。
//
// 設計: @react-pdf/renderer による server-side PDF 生成。
// 日本語フォント(Noto Sans JP)はリクエスト時の外部 fetch を避けるため同梱ファイルを使う。
//
// レイアウト方針:
//   - A4 縦
//   - 上部: タイトル + 納品書No・発行日
//   - 中央左: 宛先(顧客名 + shipping 住所)
//   - 中央: 出荷元(セラー) + 販売者(LIVAPON) を 2 列で
//   - 商品テーブル: No / 品名 / 数量

import path from 'node:path';
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { OrderDetail } from '@/lib/data/orders/types';
import type { IssuerInfo } from '@/lib/config/issuer';
import type { VendorAddress } from './types';

// 日本語フォント登録 (CJK)。
// @react-pdf/renderer は src に URL を渡すと PDF 生成時に fetch するため、
// 本番の出力安定性を優先してローカルに同梱したフォントを参照する。
const notoSansJPRegularPath = path.join(process.cwd(), 'public/fonts/NotoSansJP-Regular.ttf');

Font.register({
  family: 'NotoSansJP',
  src: notoSansJPRegularPath
});

// 「、」「。」 等の禁則ぶら下げ無効化(縦組ではないので影響少だが念のため)
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    color: '#1f2937'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    fontSize: 9
  },
  title: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 8,
    marginBottom: 24
  },
  recipientBlock: {
    marginBottom: 18
  },
  recipientName: {
    fontSize: 13,
    marginBottom: 4
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  columnBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 10
  },
  columnLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 4
  },
  columnText: {
    fontSize: 10,
    marginBottom: 2
  },
  metaBlock: {
    marginBottom: 12
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 2
  },
  metaLabel: {
    width: 80,
    color: '#64748b'
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 6
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 6
  },
  colNo: { width: 30, textAlign: 'center' },
  colName: { flex: 1, paddingHorizontal: 4 },
  colQty: { width: 60, textAlign: 'right' }
});

function formatDateJa(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function buildShippingAddressLines(order: OrderDetail): string[] {
  const lines: string[] = [];
  if (order.shippingPostal) lines.push(`〒${order.shippingPostal}`);
  const street = [order.shippingPrefecture, order.shippingCity, order.shippingAddress1]
    .filter((v): v is string => Boolean(v))
    .join(' ');
  if (street) lines.push(street);
  if (order.shippingAddress2) lines.push(order.shippingAddress2);
  return lines;
}

function buildVendorAddressLines(vendor: VendorAddress | null): string[] {
  if (!vendor) {
    return [];
  }
  const lines: string[] = [vendor.name];
  if (vendor.postal) lines.push(`〒${vendor.postal}`);
  const street = [vendor.prefecture, vendor.city, vendor.address1, vendor.address2]
    .filter((v): v is string => Boolean(v))
    .join(' ');
  if (street) lines.push(street);
  if (vendor.contactPhone) lines.push(`TEL: ${vendor.contactPhone}`);
  if (vendor.contactEmail) lines.push(vendor.contactEmail);
  return lines;
}

export type PackingSlipDocumentProps = {
  order: OrderDetail;
  /** content filtering 適用済みの line_items(セラー視点では自分の分のみ) */
  lineItems: OrderDetail['lineItems'];
  vendor: VendorAddress | null;
  issuer: IssuerInfo;
  issuedAt: Date;
};

export function PackingSlipDocument({
  order,
  lineItems,
  vendor,
  issuer,
  issuedAt
}: PackingSlipDocumentProps) {
  const recipientLines = buildShippingAddressLines(order);
  const vendorBlock = buildVendorAddressLines(vendor);

  return (
    <Document title={`納品書 ${order.orderNumber}`} author={issuer.name}>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.headerRow}>
          <Text>
            No: {order.orderNumber}    発行日: {formatDateJa(issuedAt)}
          </Text>
        </View>

        <Text style={styles.title}>納  品  書</Text>

        {/* 宛先 */}
        <View style={styles.recipientBlock}>
          <Text style={styles.recipientName}>
            {order.customerName ?? '(宛名未設定)'} 御中
          </Text>
          {recipientLines.map((l, i) => (
            <Text key={i} style={styles.columnText}>
              {l}
            </Text>
          ))}
        </View>

        {/* 出荷元 / 販売者 */}
        <View style={styles.twoColumns}>
          <View style={styles.columnBox}>
            <Text style={styles.columnLabel}>出荷元</Text>
            {vendorBlock.map((l, i) => (
              <Text key={i} style={styles.columnText}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.columnBox}>
            <Text style={styles.columnLabel}>販売者</Text>
            <Text style={styles.columnText}>{issuer.name}</Text>
            <Text style={styles.columnText}>〒{issuer.postal}</Text>
            <Text style={styles.columnText}>{issuer.address}</Text>
            <Text style={styles.columnText}>{issuer.email}</Text>
          </View>
        </View>

        {/* メタ情報 */}
        <View style={styles.metaBlock}>
          <Text style={{ marginBottom: 6 }}>下記の通り納品いたします。</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>注文番号:</Text>
            <Text>{order.orderNumber}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>OS番号:</Text>
            <Text>{order.osNumber ?? '─'}</Text>
          </View>
        </View>

        {/* 商品テーブル */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colNo}>No</Text>
            <Text style={styles.colName}>品名</Text>
            <Text style={styles.colQty}>数量</Text>
          </View>
          {lineItems.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.colNo}>—</Text>
              <Text style={styles.colName}>
                表示できる商品がありません
              </Text>
              <Text style={styles.colQty}>—</Text>
            </View>
          ) : (
            lineItems.map((li, idx) => {
              const name = li.variantTitle
                ? `${li.productName} (${li.variantTitle})`
                : li.productName;
              return (
                <View key={li.id} style={styles.tableRow}>
                  <Text style={styles.colNo}>{idx + 1}</Text>
                  <Text style={styles.colName}>{name}</Text>
                  <Text style={styles.colQty}>{li.quantity}</Text>
                </View>
              );
            })
          )}
        </View>
      </Page>
    </Document>
  );
}
