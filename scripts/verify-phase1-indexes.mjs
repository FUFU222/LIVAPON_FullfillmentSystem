import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function resolveProjectRef() {
  const fromUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const match = fromUrl.match(/^https:\/\/([^.]+)\.supabase\.co$/);
  if (!match?.[1]) {
    throw new Error('Could not resolve Supabase project ref from SUPABASE_URL');
  }
  return match[1];
}

function resolvePoolerUrl() {
  const poolerPath = path.join(process.cwd(), 'supabase', '.temp', 'pooler-url');
  return fs.readFileSync(poolerPath, 'utf8').trim();
}

function withPassword(connectionString, password) {
  const url = new URL(connectionString);
  url.password = password;
  return url.toString();
}

async function connect() {
  const password = requireEnv('SUPABASE_DB_PASSWORD');
  const projectRef = resolveProjectRef();
  const candidates = [
    {
      config: {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        user: 'postgres',
        password,
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      config: {
        connectionString: withPassword(resolvePoolerUrl(), password),
        ssl: { rejectUnauthorized: false }
      }
    }
  ];

  for (const candidate of candidates) {
    const client = new Client(candidate.config);
    try {
      await client.connect();
      return client;
    } catch {
      try {
        await client.end();
      } catch {
        // ignore cleanup failures
      }
    }
  }

  throw new Error('Failed to connect to Supabase');
}

async function maybeExplain(client, label, seedSql, explainSqlBuilder) {
  const seed = await client.query(seedSql);
  if (seed.rowCount === 0) {
    console.log(`skip=${label}`);
    return;
  }

  const row = seed.rows[0];
  const explainSql = explainSqlBuilder(row);
  const result = await client.query(`explain ${explainSql.text}`, explainSql.values);
  console.log(`\n### ${label}`);
  for (const line of result.rows) {
    console.log(line['QUERY PLAN']);
  }
}

async function main() {
  const client = await connect();
  try {
    await maybeExplain(
      client,
      'orders lookup by vendor_id + order_number',
      `select vendor_id, order_number
       from public.orders
       where vendor_id is not null
         and order_number is not null
       limit 1`,
      (row) => ({
        text: `select id
               from public.orders
               where vendor_id = $1
                 and order_number = $2`,
        values: [row.vendor_id, row.order_number]
      })
    );

    await maybeExplain(
      client,
      'shipments history by vendor',
      `select vendor_id
       from public.shipments
       where vendor_id is not null
       limit 1`,
      (row) => ({
        text: `select id
               from public.shipments
               where vendor_id = $1
               order by shipped_at desc, created_at desc
               limit 20`,
        values: [row.vendor_id]
      })
    );

    await maybeExplain(
      client,
      'shipments resync queue',
      `select 1`,
      () => ({
        text: `select id
               from public.shipments
               where sync_status in ('pending', 'error')
                 and (sync_pending_until is null or sync_pending_until <= now())
               order by sync_pending_until asc nulls first
               limit 20`,
        values: []
      })
    );

    await maybeExplain(
      client,
      'shipment adjustment by vendor',
      `select vendor_id
       from public.shipment_adjustment_requests
       where vendor_id is not null
       limit 1`,
      (row) => ({
        text: `select id
               from public.shipment_adjustment_requests
               where vendor_id = $1
               order by created_at desc
               limit 20`,
        values: [row.vendor_id]
      })
    );

    await maybeExplain(
      client,
      'shipment adjustment by status',
      `select status
       from public.shipment_adjustment_requests
       where status is not null
       limit 1`,
      (row) => ({
        text: `select id
               from public.shipment_adjustment_requests
               where status = $1
               order by created_at desc
               limit 20`,
        values: [row.status]
      })
    );

    await maybeExplain(
      client,
      'shipment import job items by job_id + status',
      `select job_id, status
       from public.shipment_import_job_items
       where job_id is not null
         and status is not null
       limit 1`,
      (row) => ({
        text: `select id
               from public.shipment_import_job_items
               where job_id = $1
                 and status = $2
               order by id asc
               limit 50`,
        values: [row.job_id, row.status]
      })
    );

    await maybeExplain(
      client,
      'line_items existence by order_id + vendor_id',
      `select order_id, vendor_id
       from public.line_items
       where order_id is not null
         and vendor_id is not null
       limit 1`,
      (row) => ({
        text: `select 1
               from public.line_items
               where order_id = $1
                 and vendor_id = $2
               limit 1`,
        values: [row.order_id, row.vendor_id]
      })
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
