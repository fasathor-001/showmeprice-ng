-- Ensure products -> categories (and subcategories if present) relationships exist

do $$
declare
  cat_id_type text;
  sub_id_type text;
begin
  select c.data_type
    into cat_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'categories'
    and c.column_name = 'id';

  if cat_id_type = 'bigint' then
    alter table public.products
      alter column category_id type bigint
      using category_id::bigint;
  end if;

  if to_regclass('public.subcategories') is not null then
    select c.data_type
      into sub_id_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'subcategories'
      and c.column_name = 'id';

    if sub_id_type = 'bigint' then
      alter table public.products
        alter column subcategory_id type bigint
        using subcategory_id::bigint;
    end if;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_category_id_fkey'
  ) then
    alter table public.products
      add constraint products_category_id_fkey
      foreign key (category_id) references public.categories(id)
      on delete set null;
  end if;

  if to_regclass('public.subcategories') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'products_subcategory_id_fkey'
    ) then
      alter table public.products
        add constraint products_subcategory_id_fkey
        foreign key (subcategory_id) references public.subcategories(id)
        on delete set null;
    end if;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
