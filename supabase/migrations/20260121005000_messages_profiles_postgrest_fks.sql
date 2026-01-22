-- 20260121005000_messages_profiles_postgrest_fks.sql
-- Ensure messages -> profiles/products FKs for PostgREST joins.

do $$
declare
  sender_ref regclass;
  receiver_ref regclass;
  product_ref regclass;
begin
  if to_regclass('public.messages') is null then
    raise exception 'public.messages does not exist';
  end if;

  -- Ensure columns exist
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='sender_id'
  ) then
    alter table public.messages add column sender_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='receiver_id'
  ) then
    alter table public.messages add column receiver_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='product_id'
  ) then
    alter table public.messages add column product_id uuid;
  end if;
  -- sender FK: ensure it references public.profiles
  select confrelid::regclass into sender_ref
  from pg_constraint
  where conrelid='public.messages'::regclass
    and conname='messages_sender_id_fkey'
    and contype='f';

  if sender_ref is null then
    alter table public.messages
      add constraint messages_sender_id_fkey
      foreign key (sender_id) references public.profiles(id)
      on delete set null
      not valid;
  elsif sender_ref <> 'public.profiles'::regclass then
    alter table public.messages drop constraint messages_sender_id_fkey;
    alter table public.messages
      add constraint messages_sender_id_fkey
      foreign key (sender_id) references public.profiles(id)
      on delete set null
      not valid;
  end if;

  -- receiver FK: ensure it references public.profiles
  select confrelid::regclass into receiver_ref
  from pg_constraint
  where conrelid='public.messages'::regclass
    and conname='messages_receiver_id_fkey'
    and contype='f';

  if receiver_ref is null then
    alter table public.messages
      add constraint messages_receiver_id_fkey
      foreign key (receiver_id) references public.profiles(id)
      on delete set null
      not valid;
  elsif receiver_ref <> 'public.profiles'::regclass then
    alter table public.messages drop constraint messages_receiver_id_fkey;
    alter table public.messages
      add constraint messages_receiver_id_fkey
      foreign key (receiver_id) references public.profiles(id)
      on delete set null
      not valid;
  end if;

  -- product FK: ensure it references public.products
  select confrelid::regclass into product_ref
  from pg_constraint
  where conrelid='public.messages'::regclass
    and conname='messages_product_id_fkey'
    and contype='f';

  if product_ref is null then
    alter table public.messages
      add constraint messages_product_id_fkey
      foreign key (product_id) references public.products(id)
      on delete set null
      not valid;
  elsif product_ref <> 'public.products'::regclass then
    alter table public.messages drop constraint messages_product_id_fkey;
    alter table public.messages
      add constraint messages_product_id_fkey
      foreign key (product_id) references public.products(id)
      on delete set null
      not valid;
  end if;

  -- helpful indexes
  create index if not exists messages_sender_id_idx on public.messages(sender_id);
  create index if not exists messages_receiver_id_idx on public.messages(receiver_id);
  create index if not exists messages_product_id_idx on public.messages(product_id);
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='conversation_id'
  ) then
    execute 'create index if not exists messages_conversation_id_idx on public.messages(conversation_id)';
  end if;
  create index if not exists messages_created_at_idx on public.messages(created_at desc);
end $$;

select pg_notify('pgrst', 'reload schema');
