// approveVendorApplication の動作検証
//
// 検証対象:
//   1. application → vendors に住所が正しくコピーされる
//   2. 住所未登録(NULL)の application も「null コピー」 で承認は成立する
//   3. application 自体が見つからない場合は throw
//   4. application が pending でない場合は throw

import { approveVendorApplication } from '@/lib/data/vendors';

// ============================================================================
// Supabase クライアント mock ヘルパー
//
// approveVendorApplication が叩く Supabase 操作:
//   - vendor_applications.select(...).eq(...).maybeSingle()
//   - vendor_applications.update({...}).eq('id', appId)
//   - vendors.select(...).eq(...).maybeSingle()         (新規セラーの場合)
//   - vendors.insert(...).select(...).single()           (新規セラーの場合)
//   - vendors.update({...}).eq('id', vendor.id)
//   - auth.admin.updateUserById(...)
// 各 chain を spy できる形で組み立てる。
// ============================================================================
function buildClient(options: {
  application: any;
  vendorInsertResult?: any;
}) {
  const applicationSelect = jest.fn().mockResolvedValue({ data: options.application, error: null });
  // application.update({...}).eq(...) — eq の戻り値が Promise<{error}>
  const applicationUpdateEq = jest.fn().mockResolvedValue({ error: null });
  const applicationUpdate = jest.fn().mockReturnValue({ eq: applicationUpdateEq });

  // application が null の場合(早期 throw ケース)も buildClient が落ちないようガード
  const fallbackVendorInsert = options.application
    ? {
        id: 42,
        code: '0017',
        name: options.application.company_name,
        contact_email: options.application.contact_email,
        contact_name: options.application.contact_name,
        contact_phone: options.application.contact_phone
      }
    : { id: 42, code: '0017', name: '-', contact_email: '-', contact_name: null, contact_phone: null };

  const vendorSelect = jest.fn().mockResolvedValue({ data: null, error: null });
  const vendorInsertSingle = jest.fn().mockResolvedValue({
    data: options.vendorInsertResult ?? fallbackVendorInsert,
    error: null
  });
  const vendorInsert = jest.fn().mockReturnValue({
    select: () => ({ single: vendorInsertSingle })
  });
  // vendors.update({...}).eq('id', vendorId)
  const vendorUpdateEq = jest.fn().mockResolvedValue({ error: null });
  const vendorUpdate = jest.fn().mockReturnValue({ eq: vendorUpdateEq });

  const updateUserById = jest.fn().mockResolvedValue({ error: null });

  return {
    client: {
      from(table: string) {
        if (table === 'vendor_applications') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: applicationSelect
              })
            }),
            update: applicationUpdate
          };
        }
        if (table === 'vendors') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vendorSelect
              })
            }),
            insert: vendorInsert,
            update: vendorUpdate
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
      auth: {
        admin: { updateUserById }
      }
    } as any,
    spies: {
      applicationSelect,
      applicationUpdate,
      applicationUpdateEq,
      vendorSelect,
      vendorInsert,
      vendorInsertSingle,
      vendorUpdate,
      vendorUpdateEq,
      updateUserById
    }
  };
}

// ============================================================================
// テスト本体
// ============================================================================

function buildApplication(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 100,
    auth_user_id: 'auth-user-1',
    vendor_id: null,
    vendor_code: '0017',
    company_name: '株式会社HolyTech',
    contact_name: '山田 太郎',
    contact_email: 'contact@holytech.example',
    contact_phone: '03-1234-5678',
    message: null,
    status: 'pending',
    notes: null,
    reviewer_id: null,
    reviewer_email: null,
    reviewed_at: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    postal: '100-0001',
    prefecture: '東京都',
    city: '千代田区',
    address1: '丸の内1-1-1',
    address2: 'テストビル 3F',
    ...overrides
  };
}

describe('approveVendorApplication', () => {
  it('vendors テーブル更新時に application の住所5項目をそのままコピーする', async () => {
    const application = buildApplication();
    const { client, spies } = buildClient({ application });

    const result = await approveVendorApplication(
      {
        applicationId: 100,
        reviewerId: 'admin-uuid',
        reviewerEmail: 'admin@example.com'
      },
      client
    );

    // vendors.update が呼ばれた payload を検証
    expect(spies.vendorUpdate).toHaveBeenCalledTimes(1);
    const updatePayload = spies.vendorUpdate.mock.calls[0][0];
    expect(updatePayload).toMatchObject({
      name: '株式会社HolyTech',
      contact_email: 'contact@holytech.example',
      contact_name: '山田 太郎',
      contact_phone: '03-1234-5678',
      postal: '100-0001',
      prefecture: '東京都',
      city: '千代田区',
      address1: '丸の内1-1-1',
      address2: 'テストビル 3F'
    });
    expect(spies.vendorUpdateEq).toHaveBeenCalledWith('id', 42);

    // 戻り値の基本項目
    expect(result.vendorId).toBe(42);
    expect(result.companyName).toBe('株式会社HolyTech');
  });

  it('住所が未登録(NULL)の application も承認できる(null コピー)', async () => {
    const application = buildApplication({
      postal: null,
      prefecture: null,
      city: null,
      address1: null,
      address2: null
    });
    const { client, spies } = buildClient({ application });

    await approveVendorApplication(
      {
        applicationId: 100,
        reviewerId: 'admin-uuid',
        reviewerEmail: 'admin@example.com'
      },
      client
    );

    const updatePayload = spies.vendorUpdate.mock.calls[0][0];
    expect(updatePayload).toMatchObject({
      postal: null,
      prefecture: null,
      city: null,
      address1: null,
      address2: null
    });
  });

  it('application が見つからない場合は例外を投げる', async () => {
    const { client } = buildClient({ application: null as any });

    await expect(
      approveVendorApplication(
        { applicationId: 999, reviewerId: 'admin-uuid', reviewerEmail: null },
        client
      )
    ).rejects.toThrow('依頼が見つかりません');
  });

  it('application が pending 以外なら例外を投げる(二重承認防止)', async () => {
    const application = buildApplication({ status: 'approved' });
    const { client } = buildClient({ application });

    await expect(
      approveVendorApplication(
        { applicationId: 100, reviewerId: 'admin-uuid', reviewerEmail: null },
        client
      )
    ).rejects.toThrow('この依頼は既に処理済みです');
  });

  it('vendor_applications を approved 状態に更新する', async () => {
    const application = buildApplication();
    const { client, spies } = buildClient({ application });

    await approveVendorApplication(
      {
        applicationId: 100,
        reviewerId: 'admin-uuid-x',
        reviewerEmail: 'admin@example.com',
        notes: 'OK'
      },
      client
    );

    expect(spies.applicationUpdate).toHaveBeenCalledTimes(1);
    const payload = spies.applicationUpdate.mock.calls[0][0];
    expect(payload.status).toBe('approved');
    expect(payload.vendor_id).toBe(42);
    expect(payload.reviewer_id).toBe('admin-uuid-x');
    expect(payload.notes).toBe('OK');
  });
});
