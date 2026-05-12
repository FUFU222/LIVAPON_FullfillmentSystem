// 納品書 PDF 出力機能の動作確認用に、最小限のデモデータを Supabase に投入する。
//
// 使い方:
//   npm run seed:packing-slip
//   npm run seed:packing-slip -- --clean   # demo データを削除
//
// 必要な環境変数(.env.local):
//   SUPABASE_URL                    or NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// 生成されるもの:
//   - admin auth user      : demo.admin@livapon.local
//   - vendor auth user     : demo.vendor@livapon.local
//   - vendor(code=9991)    : 株式会社デモテック(住所込み)
//   - order #90001         : 顧客 = 株式会社ジグザグ(模擬)、OS番号 OS-99999999
//   - line_item 1 件        : Nagaruru デモ商品 × 2
//   - shipment 1 件         : ヤマト追跡 DEMO-1234-5678
//
// 全データは demo プレフィックスや 99 番台コードで識別可能。
// --clean で安全に削除できる。

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/types';

type Client = SupabaseClient<Database>;

// =====================================================================
// 定数
// =====================================================================

const DEMO_ADMIN_EMAIL = 'demo.admin@livapon.local';
const DEMO_VENDOR_USER_EMAIL = 'demo.vendor@livapon.local';
const DEMO_PASSWORD = 'DemoPass!2026';

const DEMO_VENDOR_CODE = '9991';
const DEMO_VENDOR_NAME = '株式会社デモテック';

const DEMO_ORDER_NUMBER = '#90001';
const DEMO_OS_NUMBER = 'OS-99999999';
const DEMO_SHOP_DOMAIN = 'demo-shop.myshopify.com';

// Shopify IDs(大きい値で実本番と衝突回避)
const DEMO_SHOPIFY_ORDER_ID = 9_000_000_001;
const DEMO_SHOPIFY_FO_ID = 9_000_000_002;
const DEMO_SHOPIFY_LINE_ITEM_ID = 9_000_000_003;
const DEMO_FO_LINE_ITEM_ID = 9_000_000_004;

const DEMO_TRACKING_NUMBER = 'DEMO-1234-5678';

// =====================================================================
// 環境変数ロード & クライアント取得
// =====================================================================

function loadEnvFiles() {
  const projectRoot = join(__dirname, '..');
  const candidates = [
    process.env.DOTENV_CONFIG_PATH,
    join(projectRoot, '.env.local'),
    join(projectRoot, '.env')
  ].filter((v): v is string => Boolean(v));
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath });
      return envPath;
    }
  }
  return null;
}

function getServiceClient(): Client {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.local を確認してください。'
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// =====================================================================
// vendor
// =====================================================================

async function ensureDemoVendor(client: Client) {
  const payload = {
    code: DEMO_VENDOR_CODE,
    name: DEMO_VENDOR_NAME,
    contact_name: 'デモ 太郎',
    contact_email: DEMO_VENDOR_USER_EMAIL,
    contact_phone: '03-1234-5678',
    notification_emails: [],
    notify_new_orders: true,
    postal: '107-0062',
    prefecture: '東京都',
    city: '港区',
    address1: '南青山2-2-15',
    address2: 'デモビル3F'
  };
  const { data, error } = await client
    .from('vendors')
    .upsert(payload, { onConflict: 'code' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// =====================================================================
// auth user(admin / vendor)
// =====================================================================

async function findUserByEmail(client: Client, email: string): Promise<User | null> {
  // 1000 件まではこれで十分
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = (data?.users ?? []) as User[];
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit;
    if (users.length < 100) return null;
  }
  return null;
}

async function ensureDemoUser(
  client: Client,
  spec: { email: string; role: 'admin' | 'vendor'; vendorId: number | null }
) {
  const appMetadata: Record<string, unknown> =
    spec.role === 'admin'
      ? { role: 'admin' }
      : { role: 'vendor', vendor_id: spec.vendorId };

  const existing = await findUserByEmail(client, spec.email);
  if (existing) {
    const { data, error } = await client.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      app_metadata: appMetadata,
      user_metadata: {
        contact_name: spec.role === 'vendor' ? 'デモ 太郎' : null,
        company_name: spec.role === 'vendor' ? DEMO_VENDOR_NAME : null
      }
    });
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await client.auth.admin.createUser({
    email: spec.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: {
      contact_name: spec.role === 'vendor' ? 'デモ 太郎' : null,
      company_name: spec.role === 'vendor' ? DEMO_VENDOR_NAME : null
    }
  });
  if (error) throw error;
  if (!data.user) throw new Error('createUser returned no user');
  return data.user;
}

// =====================================================================
// order / line_item / shipment
// =====================================================================

async function ensureDemoOrder(client: Client, vendorId: number) {
  const payload = {
    shopify_order_id: DEMO_SHOPIFY_ORDER_ID,
    shopify_fulfillment_order_id: DEMO_SHOPIFY_FO_ID,
    shopify_fo_status: 'closed',
    shop_domain: DEMO_SHOP_DOMAIN,
    vendor_id: vendorId,
    order_number: DEMO_ORDER_NUMBER,
    customer_name: '株式会社ジグザグ(デモ)',
    shipping_postal: '270-1406',
    shipping_prefecture: '千葉県',
    shipping_city: '白井市中',
    shipping_address1: '149-1MT2F バース16',
    shipping_address2: `(${DEMO_OS_NUMBER})`,
    status: 'fulfilled'
  };
  const { data, error } = await client
    .from('orders')
    .upsert(payload, { onConflict: 'shopify_order_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function ensureDemoLineItem(client: Client, orderId: number, vendorId: number) {
  const payload = {
    order_id: orderId,
    vendor_id: vendorId,
    shopify_line_item_id: DEMO_SHOPIFY_LINE_ITEM_ID,
    fulfillment_order_line_item_id: DEMO_FO_LINE_ITEM_ID,
    sku: 'DEMO-001',
    product_name: 'Nagaruru デモ竹歯ブラシ',
    variant_title: 'チャコール',
    quantity: 2,
    fulfilled_quantity: 2,
    fulfillable_quantity: 0
  };
  const { data, error } = await client
    .from('line_items')
    .upsert(payload, { onConflict: 'order_id,shopify_line_item_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function ensureDemoShipment(
  client: Client,
  orderId: number,
  vendorId: number,
  lineItemId: number
) {
  // shipments のユニーク制約は (vendor_id, registration_request_id, order_id) 等。
  // 単純にするため、既存の demo shipment(tracking_number で識別)を消してから insert する。
  await client
    .from('shipments')
    .delete()
    .eq('order_id', orderId)
    .eq('tracking_number', DEMO_TRACKING_NUMBER);

  const { data, error } = await client
    .from('shipments')
    .insert({
      order_id: orderId,
      vendor_id: vendorId,
      tracking_number: DEMO_TRACKING_NUMBER,
      carrier: 'yamato',
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      sync_status: 'synced'
    })
    .select('*')
    .single();
  if (error) throw error;

  // line_item とのピボット
  await client.from('shipment_line_items').upsert(
    {
      shipment_id: data.id,
      line_item_id: lineItemId,
      quantity: 2
    },
    { onConflict: 'shipment_id,line_item_id' }
  );

  return data;
}

// =====================================================================
// cleanup
// =====================================================================

async function cleanupDemo(client: Client) {
  // 1. order を起点に shipments / shipment_line_items / line_items / orders を消す
  const { data: order } = await client
    .from('orders')
    .select('id')
    .eq('shopify_order_id', DEMO_SHOPIFY_ORDER_ID)
    .maybeSingle();
  if (order) {
    const { data: shipments } = await client
      .from('shipments')
      .select('id')
      .eq('order_id', order.id);
    const shipmentIds = (shipments ?? []).map((s) => s.id);
    if (shipmentIds.length > 0) {
      await client.from('shipment_line_items').delete().in('shipment_id', shipmentIds);
      await client.from('shipments').delete().in('id', shipmentIds);
    }
    await client.from('packing_slip_issuances').delete().eq('order_id', order.id);
    await client.from('line_items').delete().eq('order_id', order.id);
    await client.from('orders').delete().eq('id', order.id);
  }

  // 2. vendor を消す
  await client.from('vendors').delete().eq('code', DEMO_VENDOR_CODE);

  // 3. auth users を消す
  for (const email of [DEMO_ADMIN_EMAIL, DEMO_VENDOR_USER_EMAIL]) {
    const user = await findUserByEmail(client, email);
    if (user) {
      await client.auth.admin.deleteUser(user.id);
    }
  }
}

// =====================================================================
// 出力
// =====================================================================

function printSummary(input: {
  adminUser: User;
  vendorUser: User;
  order: { id: number; order_number: string };
}) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 納品書デモデータの seed が完了しました');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔑 ログインクレデンシャル');
  console.log('');
  console.log('  [管理者]');
  console.log(`    email    : ${input.adminUser.email}`);
  console.log(`    password : ${DEMO_PASSWORD}`);
  console.log('');
  console.log('  [セラー]');
  console.log(`    email    : ${input.vendorUser.email}`);
  console.log(`    password : ${DEMO_PASSWORD}`);
  console.log('');
  console.log('📦 テスト注文');
  console.log(`    order #   : ${input.order.order_number}  (id ${input.order.id})`);
  console.log(`    OS番号    : ${DEMO_OS_NUMBER}`);
  console.log('');
  console.log('🧪 手動確認手順');
  console.log('    1. npm run dev で起動 → http://localhost:3000');
  console.log('    2. 上記のいずれかで /sign-in からログイン');
  console.log('    3. 管理者なら /admin/orders、セラーなら /orders に遷移');
  console.log(`    4. ${input.order.order_number} の行で「納品書」アイコンをクリック`);
  console.log('    5. PDF が新規タブで開き、発送元・宛先・OS番号が印字されていれば OK');
  console.log('');
  console.log('🧹 削除したい場合: npm run seed:packing-slip -- --clean');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// =====================================================================
// エントリポイント
// =====================================================================

async function main() {
  const envPath = loadEnvFiles();
  if (envPath) {
    console.log(`📂 env loaded: ${envPath}`);
  }

  const client = getServiceClient();

  const isClean = process.argv.includes('--clean');

  if (isClean) {
    console.log('🧹 demo データを削除中...');
    await cleanupDemo(client);
    console.log('✓ 削除完了');
    return;
  }

  console.log('🚀 デモデータ seed 開始');

  const vendor = await ensureDemoVendor(client);
  console.log(`✓ vendor: ${vendor.name} (code ${vendor.code}, id ${vendor.id})`);

  const adminUser = await ensureDemoUser(client, {
    email: DEMO_ADMIN_EMAIL,
    role: 'admin',
    vendorId: null
  });
  console.log(`✓ admin user: ${adminUser.email}`);

  const vendorUser = await ensureDemoUser(client, {
    email: DEMO_VENDOR_USER_EMAIL,
    role: 'vendor',
    vendorId: vendor.id
  });
  console.log(`✓ vendor user: ${vendorUser.email}`);

  const order = await ensureDemoOrder(client, vendor.id);
  console.log(`✓ order: ${order.order_number} (id ${order.id})`);

  const lineItem = await ensureDemoLineItem(client, order.id, vendor.id);
  console.log(`✓ line_item: ${lineItem.product_name} (id ${lineItem.id})`);

  const shipment = await ensureDemoShipment(client, order.id, vendor.id, lineItem.id);
  console.log(`✓ shipment: tracking ${shipment.tracking_number} (id ${shipment.id})`);

  printSummary({ adminUser, vendorUser, order });
}

main().catch((error) => {
  console.error('❌ seed 失敗:', error);
  process.exit(1);
});
