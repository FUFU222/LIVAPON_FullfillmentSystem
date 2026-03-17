alter table public.vendors
add column if not exists notification_emails text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vendors_notification_emails_max_two'
  ) then
    alter table public.vendors
    add constraint vendors_notification_emails_max_two
    check (coalesce(array_length(notification_emails, 1), 0) <= 2);
  end if;
end
$$;
