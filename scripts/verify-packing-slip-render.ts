import { renderToBuffer } from '@react-pdf/renderer';
import { PackingSlipDocument } from '@/lib/packing-slip/document';
import type { IssuerInfo } from '@/lib/config/issuer';
import type { OrderDetail } from '@/lib/data/orders/types';
import type { VendorAddress } from '@/lib/packing-slip/types';

const order: OrderDetail = {
  id: 1,
  orderNumber: '#TEST1001',
  customerName: '山田 太郎',
  status: 'open',
  updatedAt: null,
  createdAt: null,
  archivedAt: null,
  shippingPostal: '100-0001',
  shippingPrefecture: '東京都',
  shippingCity: '千代田区',
  shippingAddress1: '千代田1-1',
  shippingAddress2: null,
  osNumber: 'OS-1',
  shipments: [],
  lineItems: [
    {
      id: 10,
      sku: 'SKU-1',
      variantTitle: null,
      vendorId: 1,
      vendorCode: 'V001',
      vendorName: 'テスト出品者',
      productName: 'テスト商品',
      quantity: 2,
      fulfilledQuantity: 0,
      fulfillableQuantity: 2,
      shippedQuantity: 0,
      remainingQuantity: 2,
      shipments: []
    }
  ]
};

const vendor: VendorAddress = {
  id: 1,
  code: 'V001',
  name: 'テスト出品者',
  postal: '150-0001',
  prefecture: '東京都',
  city: '渋谷区',
  address1: '神宮前1-1',
  address2: null,
  contactPhone: null,
  contactEmail: 'vendor@example.com'
};

const issuer: IssuerInfo = {
  name: 'LIVAPON',
  postal: '100-0001',
  address: '東京都千代田区千代田1-1',
  email: 'support@example.com'
};

async function main() {
  const document = PackingSlipDocument({
    order,
    lineItems: order.lineItems,
    vendor,
    issuer,
    issuedAt: new Date('2026-05-13T00:00:00Z')
  });

  const buffer = await renderToBuffer(document);

  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    throw new Error('Packing slip PDF render returned an empty result');
  }

  console.log(`packing-slip-render-ok ${buffer.byteLength}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
