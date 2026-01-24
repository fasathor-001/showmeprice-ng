-- 20260121004000_saved_items.sql
-- Add saved_items table + RLS for PostgREST access.

create extension if not exists "pgcrypto";
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now()
);
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'saved_items_user_product_key'
  ) then
    alter table public.saved_items
      add constraint saved_items_user_product_key unique (user_id, product_id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'saved_items_user_id_fkey'
  ) then
    alter table public.saved_items
      add constraint saved_items_user_id_fkey
      foreign key (user_id) references public.profiles(id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'saved_items_product_id_fkey'
  ) then
    alter table public.saved_items
      add constraint saved_items_product_id_fkey
      foreign key (product_id) references public.products(id)
      on delete cascade;
  end if;
end $$;
create index if not exists saved_items_user_id_idx on public.saved_items(user_id);
create index if not exists saved_items_product_id_idx on public.saved_items(product_id);
create index if not exists saved_items_created_at_idx on public.saved_items(created_at desc);
alter table public.saved_items enable row level security;
do $$
begin
  create policy "saved_items_select_own"
    on public.saved_items
    for select
    to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy "saved_items_insert_own"
    on public.saved_items
    for insert
    to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy "saved_items_delete_own"
    on public.saved_items
    for delete
    to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
select pg_notify('pgrst', 'reload schema');
