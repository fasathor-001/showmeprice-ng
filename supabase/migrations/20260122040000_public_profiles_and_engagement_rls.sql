-- 20260122040000_public_profiles_and_engagement_rls.sql
-- Safe public profiles surface + engagement visibility for sellers.

create extension if not exists "pgcrypto";
create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.public_profiles enable row level security;
do $$
begin
  create policy public_profiles_read_auth
    on public.public_profiles
    for select
    to authenticated
    using (true);
exception when duplicate_object then null;
end $$;
do $$
declare
  avatar_expr text;
begin
  select case
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url'
    ) then 'p.avatar_url'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar'
    ) then 'p.avatar'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_path'
    ) then 'p.avatar_path'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'photo_url'
    ) then 'p.photo_url'
    when exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'profile_photo_url'
    ) then 'p.profile_photo_url'
    else 'NULL'
  end into avatar_expr;

  execute format($sql$
    insert into public.public_profiles (user_id, display_name, avatar_url)
    select
      p.id as user_id,
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.full_name), ''),
        nullif(trim(p.username), ''),
        nullif(trim(split_part(p.email, '@', 1)), ''),
        'User'
      ) as display_name,
      %s
    from public.profiles p
    on conflict (user_id) do update
    set
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now()
  $sql$, avatar_expr);
end $$;
create or replace function public.sync_public_profile()
returns trigger
language plpgsql
as $$
begin
  insert into public.public_profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.display_name), ''),
      nullif(trim(new.full_name), ''),
      nullif(trim(new.username), ''),
      nullif(trim(split_part(new.email, '@', 1)), ''),
      'User'
    ),
    coalesce(
      nullif(trim(to_jsonb(new)->>'avatar_url'), ''),
      nullif(trim(to_jsonb(new)->>'avatar'), ''),
      nullif(trim(to_jsonb(new)->>'avatar_path'), ''),
      nullif(trim(to_jsonb(new)->>'photo_url'), ''),
      nullif(trim(to_jsonb(new)->>'profile_photo_url'), '')
    )
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_sync_public_profile'
  ) then
    create trigger trg_sync_public_profile
      after insert or update on public.profiles
      for each row
      execute function public.sync_public_profile();
  end if;
end $$;
-- Ensure FK relationships to public.public_profiles for PostgREST embeds
do $$
begin
  if to_regclass('public.product_comments') is not null then
    if not exists (select 1 from pg_constraint where conname = 'product_comments_user_id_public_profiles_fkey') then
      alter table public.product_comments
        add constraint product_comments_user_id_public_profiles_fkey
        foreign key (user_id) references public.public_profiles(user_id)
        on delete cascade;
    end if;
    create index if not exists product_comments_user_id_idx on public.product_comments(user_id);
  end if;

  if to_regclass('public.product_views') is not null then
    if not exists (select 1 from pg_constraint where conname = 'product_views_user_id_public_profiles_fkey') then
      alter table public.product_views
        add constraint product_views_user_id_public_profiles_fkey
        foreign key (viewer_id) references public.public_profiles(user_id)
        on delete set null;
    end if;
    create index if not exists product_views_user_id_idx on public.product_views(viewer_id);
  end if;

  if to_regclass('public.product_saves') is not null then
    if not exists (select 1 from pg_constraint where conname = 'product_saves_user_id_public_profiles_fkey') then
      alter table public.product_saves
        add constraint product_saves_user_id_public_profiles_fkey
        foreign key (user_id) references public.public_profiles(user_id)
        on delete cascade;
    end if;
    create index if not exists product_saves_user_id_idx on public.product_saves(user_id);
  end if;

  if to_regclass('public.business_follows') is not null then
    if not exists (select 1 from pg_constraint where conname = 'business_follows_user_id_public_profiles_fkey') then
      alter table public.business_follows
        add constraint business_follows_user_id_public_profiles_fkey
        foreign key (user_id) references public.public_profiles(user_id)
        on delete cascade;
    end if;
    create index if not exists business_follows_user_id_idx on public.business_follows(user_id);
  end if;
end $$;
-- RLS policies for engagement visibility
alter table public.product_views enable row level security;
alter table public.product_saves enable row level security;
alter table public.business_follows enable row level security;
alter table public.product_comments enable row level security;
do $$
begin
  create policy product_views_insert_auth
    on public.product_views for insert to authenticated
    with check (viewer_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_views_select_owner_or_seller
    on public.product_views for select to authenticated
    using (
      viewer_id = auth.uid()
      or exists (
        select 1
        from public.products p
        where p.id = product_views.product_id
          and (
            p.owner_id = auth.uid()
            or p.business_id in (select id from public.businesses where user_id = auth.uid())
          )
      )
    );
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_saves_select_own
    on public.product_saves for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_saves_insert_own
    on public.product_saves for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_saves_delete_own
    on public.product_saves for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_saves_select_seller
    on public.product_saves for select to authenticated
    using (
      exists (
        select 1 from public.products p
        where p.id = product_saves.product_id
          and (
            p.owner_id = auth.uid()
            or p.business_id in (select id from public.businesses where user_id = auth.uid())
          )
      )
    );
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy business_follows_select_own
    on public.business_follows for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy business_follows_insert_own
    on public.business_follows for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy business_follows_delete_own
    on public.business_follows for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy business_follows_select_seller
    on public.business_follows for select to authenticated
    using (business_id in (select id from public.businesses where user_id = auth.uid()));
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_comments_select_auth
    on public.product_comments for select to authenticated
    using (true);
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_comments_insert_own
    on public.product_comments for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_comments_update_own
    on public.product_comments for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
do $$
begin
  create policy product_comments_delete_own
    on public.product_comments for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
select pg_notify('pgrst', 'reload schema');
