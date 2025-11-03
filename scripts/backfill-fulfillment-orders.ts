#!/usr/bin/env ts-node

import 'dotenv/config';
import { getShopifyServiceClient } from '@/lib/shopify/service-client';
import { syncFulfillmentOrderMetadata } from '@/lib/data/orders';

const BATCH_SIZE = 200;
const SLEEP_BETWEEN_REQUEST_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = getShopifyServiceClient();
  let lastId: number | null = null;
  let processed = 0;
  let updated = 0;
  let pending = 0;
  let failed = 0;

  while (true) {
    let query = client
      .from('orders')
      .select('id, shopify_order_id, shop_domain')
      .is('shopify_fulfillment_order_id', null)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (typeof lastId === 'number') {
      query = query.gt('id', lastId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const row of data) {
      const result = await syncFulfillmentOrderMetadata(row.shop_domain, row.shopify_order_id);

      processed += 1;
      if (result.status === 'synced') {
        updated += 1;
      } else if (result.status === 'pending') {
        pending += 1;
      } else {
        failed += 1;
        console.warn('Fulfillment order backfill failed', {
          orderId: row.shopify_order_id,
          shopDomain: row.shop_domain,
          error: result.error
        });
      }

      await sleep(SLEEP_BETWEEN_REQUEST_MS);
      lastId = row.id;
    }
  }

  console.log('Fulfillment order backfill finished', {
    processed,
    updated,
    pending,
    failed
  });
}

main().catch((error) => {
  console.error('Fulfillment order backfill aborted', { error });
  process.exitCode = 1;
});
