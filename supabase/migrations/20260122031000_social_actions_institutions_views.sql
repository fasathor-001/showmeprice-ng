-- 20260122031000_social_actions_institutions_views.sql
-- Social actions + institutions + product views (idempotent)

create extension if not exists pgcrypto;

-- Institutions
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  institution_name text,
  institution_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.institutions enable row level security;

do $$
begin
  create policy institutions_select_own
    on public.institutions
    for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy institutions_insert_own
    on public.institutions
    for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy institutions_update_own
    on public.institutions
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Product views
create table if not exists public.product_views (
  id bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists product_views_product_id_idx on public.product_views(product_id);

alter table public.product_views enable row level security;

do $$
begin
  create policy product_views_insert_anon
    on public.product_views
    for insert to anon
    with check (viewer_id is null);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy product_views_insert_auth
    on public.product_views
    for insert to authenticated
    with check (viewer_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Product saves (wishlist)
create table if not exists public.product_saves (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_saves_user_product_key unique (user_id, product_id)
);

alter table public.product_saves enable row level security;

do $$
begin
  create policy product_saves_select
    on public.product_saves
    for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy product_saves_insert
    on public.product_saves
    for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy product_saves_delete
    on public.product_saves
    for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Business follows
create table if not exists public.business_follows (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint business_follows_user_business_key unique (user_id, business_id)
);

alter table public.business_follows enable row level security;

do $$
begin
  create policy business_follows_select
    on public.business_follows
    for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy business_follows_insert
    on public.business_follows
    for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy business_follows_delete
    on public.business_follows
    for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Product comments (ensure exists)
create table if not exists public.product_comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.product_comments enable row level security;

do $$
begin
  create policy product_comments_select
    on public.product_comments
    for select to authenticated
    using (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy product_comments_insert
    on public.product_comments
    for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy product_comments_delete
    on public.product_comments
    for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

select pg_notify('pgrst', 'reload schema');
