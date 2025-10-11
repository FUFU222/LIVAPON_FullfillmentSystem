create table if not exists public.shopify_connections (
  id uuid primary key default gen_random_uuid(),
  shop text not null unique,
  access_token text not null,
  scopes text,
  installed_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
