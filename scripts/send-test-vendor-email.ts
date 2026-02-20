import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { sendVendorNewOrderEmail } from '../lib/notifications/vendor-new-order';

const projectRoot = join(__dirname, '..');
const candidateEnvFiles = [
  process.env.DOTENV_CONFIG_PATH,
  join(projectRoot, '.env.local'),
  join(projectRoot, '.env')
].filter((value): value is string => Boolean(value));

for (const envPath of candidateEnvFiles) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function main() {
  const to = parseArg('--to') ?? process.env.TEST_VENDOR_EMAIL;
  if (!to) {
    console.error('Usage: npm run test:vendor-email -- --to=recipient@example.com');
    process.exit(1);
  }

  const vendorName = parseArg('--vendor-name') ?? 'テストセラー株式会社';
  const orderNumber = parseArg('--order-number') ?? 'TEST-ORDER-001';
  const orderCreatedAt = new Date().toISOString();

  await sendVendorNewOrderEmail({
    to,
    vendorName,
    orderNumber,
    orderCreatedAt,
    customerName: 'テスト購入者',
    shipping: {
      postalCode: '100-0001',
      address1: '東京都千代田区千代田1-1',
      address2: 'テストビル3F',
      city: '千代田区',
      state: '東京都'
    },
    lineItems: [
      { productName: 'テスト商品A', quantity: 1, sku: 'TEST-SKU-A' },
      { productName: 'テスト商品B', quantity: 2, variantTitle: 'サイズM' }
    ]
  });

  console.log(`✅ Sent test vendor email to ${to} using Gmail helper.`);
}

main().catch((error) => {
  console.error('Failed to send test vendor email:', error);
  process.exit(1);
});
