// 納品書生成の認可境界テスト
//
// 検証対象:
//   1. vendor は自分の line_items のみが PDF に渡る(content filtering)
//   2. admin は全 line_items が PDF に渡る
//   3. order が見えない(他社の order を vendor が要求)→ NotFound
//   4. vendor で content filtering 後に空 → Empty エラー

jest.mock('@/lib/data/orders', () => ({
  getOrderDetail: jest.fn(),
  getOrderDetailForAdmin: jest.fn()
}));

jest.mock('@/lib/config/issuer', () => ({
  getIssuerInfo: () => ({
    name: '株式会社CHAIRMAN (LIVAPON)',
    postal: '107-0062',
    address: '東京都港区南青山2-2-15',
    email: 'information@chairman.jp'
  })
}));

// PDF レンダリング本体はネットワーク(フォント取得)を伴うので mock 化
// 戻り値は実際の Buffer ではなく、テスト用のスタブ。
const rendererCalls: any[] = [];
jest.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  View: ({ children }: any) => children,
  StyleSheet: { create: (s: any) => s },
  Font: {
    register: jest.fn(),
    registerHyphenationCallback: jest.fn()
  },
  renderToBuffer: jest.fn(async () => Buffer.from('FAKE_PDF'))
}));

jest.mock('@/lib/packing-slip/document', () => ({
  PackingSlipDocument: jest.fn((props: any) => {
    rendererCalls.push(props);
    return null;
  })
}));

import {
  PackingSlipEmptyError,
  PackingSlipNotFoundError,
  getPackingSlipPDF
} from '@/lib/packing-slip';
import type { OrderDetail } from '@/lib/data/orders/types';

const { getOrderDetail, getOrderDetailForAdmin } = jest.requireMock<{
  getOrderDetail: jest.Mock;
  getOrderDetailForAdmin: jest.Mock;
}>('@/lib/data/orders');

function buildSupabaseClientMock() {
  // vendors テーブル読み: vendorId=10 -> 住所付き / 99 -> null
  const fromVendors = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: {
        id: 10,
        code: '0017',
        name: '株式会社HolyTech',
        postal: '100-0001',
        prefecture: '東京都',
        city: '千代田区',
        address1: '丸の内1-1-1',
        address2: null,
        contact_phone: '03-0000-0000',
        contact_email: 'contact@holytech.example'
      },
      error: null
    })
  };
  const fromIssuances = {
    insert: jest.fn().mockResolvedValue({ error: null })
  };
  return {
    from: jest.fn((table: string) => {
      if (table === 'vendors') return fromVendors;
      if (table === 'packing_slip_issuances') return fromIssuances;
      throw new Error(`unexpected table: ${table}`);
    }),
    __fromIssuances: fromIssuances
  } as any;
}

function buildOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 1083,
    orderNumber: '#1083',
    customerName: '株式会社ジグザグ',
    status: 'fulfilled',
    updatedAt: '2026-03-18T18:03:00Z',
    createdAt: '2026-03-15T10:00:00Z',
    archivedAt: null,
    shippingPostal: '270-1406',
    shippingPrefecture: '千葉県',
    shippingCity: '白井市中',
    shippingAddress1: '149-1MT2F バース16',
    shippingAddress2: '(OS-01142233)',
    osNumber: 'OS-01142233',
    shipments: [],
    lineItems: [
      {
        id: 3276,
        sku: '0017-01',
        variantTitle: null,
        vendorId: 10,
        vendorCode: '0017',
        vendorName: '株式会社HolyTech',
        productName: 'Nagaruru',
        quantity: 1,
        fulfilledQuantity: 1,
        fulfillableQuantity: 0,
        shippedQuantity: 1,
        remainingQuantity: 0,
        shipments: []
      },
      {
        id: 3277,
        sku: '0099-01',
        variantTitle: 'XL',
        vendorId: 99,
        vendorCode: '0099',
        vendorName: 'OtherVendor',
        productName: 'Mystery Item',
        quantity: 2,
        fulfilledQuantity: 2,
        fulfillableQuantity: 0,
        shippedQuantity: 2,
        remainingQuantity: 0,
        shipments: []
      }
    ],
    ...overrides
  };
}

describe('getPackingSlipPDF — content filtering / authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rendererCalls.length = 0;
  });

  it('vendor は自分の vendorId の line_items だけが PDF に渡る', async () => {
    getOrderDetail.mockResolvedValue(buildOrder());
    const client = buildSupabaseClientMock();

    const result = await getPackingSlipPDF(client, 1083, {
      role: 'vendor',
      userId: 'user-uuid',
      vendorId: 10
    });

    expect(result.filename).toBe('packing-slip-#1083.pdf');
    expect(result.buffer.toString()).toBe('FAKE_PDF');

    // Document に渡された line_items が vendor 10 の分のみ
    expect(rendererCalls).toHaveLength(1);
    const passed = rendererCalls[0];
    expect(passed.lineItems).toHaveLength(1);
    expect(passed.lineItems[0].vendorId).toBe(10);
    expect(passed.lineItems[0].productName).toBe('Nagaruru');

    // getOrderDetail が vendorId 引数つきで呼ばれている(RLS が効く)
    expect(getOrderDetail).toHaveBeenCalledWith(10, 1083);
    expect(getOrderDetailForAdmin).not.toHaveBeenCalled();
  });

  it('admin は全 line_items が PDF に渡る', async () => {
    getOrderDetailForAdmin.mockResolvedValue(buildOrder());
    const client = buildSupabaseClientMock();

    await getPackingSlipPDF(client, 1083, {
      role: 'admin',
      userId: 'admin-uuid'
    });

    expect(rendererCalls).toHaveLength(1);
    const passed = rendererCalls[0];
    expect(passed.lineItems).toHaveLength(2);

    expect(getOrderDetailForAdmin).toHaveBeenCalledWith(1083);
    expect(getOrderDetail).not.toHaveBeenCalled();
  });

  it('order が見つからない場合は PackingSlipNotFoundError を投げる(他社注文を vendor が要求した場合も含む)', async () => {
    getOrderDetail.mockResolvedValue(null);
    const client = buildSupabaseClientMock();

    await expect(
      getPackingSlipPDF(client, 9999, { role: 'vendor', userId: 'u', vendorId: 10 })
    ).rejects.toBeInstanceOf(PackingSlipNotFoundError);
  });

  it('vendor で content filtering 後に line_items が空なら PackingSlipEmptyError', async () => {
    // 注文は存在するが、line_items は他社の物だけ(filter 後 0 件)
    const order = buildOrder({
      lineItems: [
        {
          id: 3277,
          sku: '0099-01',
          variantTitle: null,
          vendorId: 99,
          vendorCode: '0099',
          vendorName: 'OtherVendor',
          productName: 'Mystery Item',
          quantity: 2,
          fulfilledQuantity: 2,
          fulfillableQuantity: 0,
          shippedQuantity: 2,
          remainingQuantity: 0,
          shipments: []
        }
      ]
    });
    getOrderDetail.mockResolvedValue(order);
    const client = buildSupabaseClientMock();

    await expect(
      getPackingSlipPDF(client, 1083, { role: 'vendor', userId: 'u', vendorId: 10 })
    ).rejects.toBeInstanceOf(PackingSlipEmptyError);
  });

  it('vendor 発行時は packing_slip_issuances に vendor_id 付きで INSERT される', async () => {
    getOrderDetail.mockResolvedValue(buildOrder());
    const client = buildSupabaseClientMock();

    await getPackingSlipPDF(client, 1083, {
      role: 'vendor',
      userId: 'user-uuid',
      vendorId: 10
    });

    expect(client.__fromIssuances.insert).toHaveBeenCalledWith({
      order_id: 1083,
      vendor_id: 10,
      issued_by: 'user-uuid'
    });
  });

  it('admin 発行時は packing_slip_issuances の vendor_id が NULL になる', async () => {
    getOrderDetailForAdmin.mockResolvedValue(buildOrder());
    const client = buildSupabaseClientMock();

    await getPackingSlipPDF(client, 1083, { role: 'admin', userId: 'admin-uuid' });

    expect(client.__fromIssuances.insert).toHaveBeenCalledWith({
      order_id: 1083,
      vendor_id: null,
      issued_by: 'admin-uuid'
    });
  });
});
