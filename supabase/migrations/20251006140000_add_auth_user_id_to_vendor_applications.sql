alter table public.vendor_applications
  add column if not exists auth_user_id uuid;
