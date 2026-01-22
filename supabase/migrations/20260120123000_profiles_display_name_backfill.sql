alter table public.profiles
  add column if not exists display_name text;

update public.profiles
set display_name = coalesce(nullif(display_name,''), nullif(full_name,''), nullif(business_name,''), nullif(username,''))
where display_name is null or display_name = '';

update public.profiles
set display_name =
  case
    when coalesce(user_type,'') = 'seller' then 'Seller ' || left(id::text, 6)
    when coalesce(user_type,'') = 'buyer' then 'Buyer ' || left(id::text, 6)
    else 'User ' || left(id::text, 6)
  end
where display_name is null or display_name = '';

notify pgrst, 'reload schema';
