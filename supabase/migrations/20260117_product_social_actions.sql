-- Product social actions: likes, follows, reports, comments

create table if not exists public.product_likes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
alter table public.product_likes enable row level security;
do $$
begin
  create policy "product_likes_select"
    on public.product_likes
    for select
    to public
    using (true);
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "product_likes_insert"
    on public.product_likes
    for insert
    to authenticated
    with check (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "product_likes_delete"
    on public.product_likes
    for delete
    to authenticated
    using (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;
create table if not exists public.seller_follows (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seller_id, user_id)
);
alter table public.seller_follows enable row level security;
do $$
begin
  create policy "seller_follows_select"
    on public.seller_follows
    for select
    to public
    using (true);
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "seller_follows_insert"
    on public.seller_follows
    for insert
    to authenticated
    with check (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "seller_follows_delete"
    on public.seller_follows
    for delete
    to authenticated
    using (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;
create table if not exists public.product_comments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint product_comments_body_min check (char_length(trim(body)) > 0)
);
alter table public.product_comments enable row level security;
do $$
begin
  create policy "product_comments_select"
    on public.product_comments
    for select
    to public
    using (true);
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "product_comments_insert"
    on public.product_comments
    for insert
    to authenticated
    with check (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "product_comments_update"
    on public.product_comments
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;
do $$
begin
  create policy "product_comments_delete"
    on public.product_comments
    for delete
    to authenticated
    using (auth.uid() = user_id);
exception
  when duplicate_object then
    null;
end $$;
create table if not exists public.product_reports (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text null,
  created_at timestamptz not null default now()
);
alter table public.product_reports enable row level security;
do $$
begin
  create policy "product_reports_insert"
    on public.product_reports
    for insert
    to authenticated
    with check (auth.uid() = reporter_id);
exception
  when duplicate_object then
    null;
end $$;
