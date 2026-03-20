import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const INDEXES = [
  {
    name: 'idx_orders_vendor_id_order_number',
    statement: `
      create index concurrently if not exists idx_orders_vendor_id_order_number
      on public.orders (vendor_id, order_number)
    `
  },
  {
    name: 'idx_shipments_vendor_id_shipped_at_created_at',
    statement: `
      create index concurrently if not exists idx_shipments_vendor_id_shipped_at_created_at
      on public.shipments (vendor_id, shipped_at desc, created_at desc)
    `
  },
  {
    name: 'idx_shipments_sync_status_pending_until',
    statement: `
      create index concurrently if not exists idx_shipments_sync_status_pending_until
      on public.shipments (sync_status, sync_pending_until)
    `
  },
  {
    name: 'idx_shipment_adjustment_requests_vendor_id_created_at',
    statement: `
      create index concurrently if not exists idx_shipment_adjustment_requests_vendor_id_created_at
      on public.shipment_adjustment_requests (vendor_id, created_at desc)
    `
  },
  {
    name: 'idx_shipment_adjustment_requests_status_created_at',
    statement: `
      create index concurrently if not exists idx_shipment_adjustment_requests_status_created_at
      on public.shipment_adjustment_requests (status, created_at desc)
    `
  },
  {
    name: 'idx_shipment_import_job_items_job_id_status_id',
    statement: `
      create index concurrently if not exists idx_shipment_import_job_items_job_id_status_id
      on public.shipment_import_job_items (job_id, status, id)
    `
  },
  {
    name: 'idx_line_items_order_id_vendor_id',
    statement: `
      create index concurrently if not exists idx_line_items_order_id_vendor_id
      on public.line_items (order_id, vendor_id)
    `
  }
];

const ANALYZE_TABLES = [
  'public.orders',
  'public.shipments',
  'public.shipment_adjustment_requests',
  'public.shipment_import_job_items',
  'public.line_items'
];

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
  if (!fs.existsSync(poolerPath)) {
    throw new Error(`Missing pooler URL file: ${poolerPath}`);
  }

  const raw = fs.readFileSync(poolerPath, 'utf8').trim();
  if (!raw) {
    throw new Error(`Empty pooler URL file: ${poolerPath}`);
  }

  return raw;
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
      label: 'direct',
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
      label: 'pooler',
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
      console.log(`connected_via=${candidate.label}`);
      return client;
    } catch (error) {
      console.error(`connection_failed=${candidate.label}`, error instanceof Error ? error.message : error);
      try {
        await client.end();
      } catch {
        // ignore cleanup failures for unsuccessful connections
      }
    }
  }

  throw new Error('Could not connect to Supabase database using direct or pooler connection');
}

async function fetchIndexDefinitions(client) {
  const names = INDEXES.map((index) => index.name);
  const result = await client.query(
    `
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
        and indexname = any($1::text[])
      order by indexname
    `,
    [names]
  );

  return result.rows;
}

async function main() {
  const client = await connect();

  try {
    await client.query(`set lock_timeout = '5s'`);
    await client.query(`set statement_timeout = '0'`);

    const before = await fetchIndexDefinitions(client);
    console.log(`indexes_present_before=${before.length}`);

    for (const index of INDEXES) {
      console.log(`creating=${index.name}`);
      await client.query(index.statement);
      console.log(`created=${index.name}`);
    }

    for (const table of ANALYZE_TABLES) {
      console.log(`analyze=${table}`);
      await client.query(`analyze ${table}`);
    }

    const after = await fetchIndexDefinitions(client);
    console.log(`indexes_present_after=${after.length}`);
    for (const row of after) {
      console.log(`${row.indexname}: ${row.indexdef}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
