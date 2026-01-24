-- Secure RPC to reveal seller contact for eligible buyers
create or replace function public.reveal_seller_contact(business_id uuid)
returns table (phone text, whatsapp text)
language plpgsql
security definer
set search_path = public
as $$
declare
  tier text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select lower(coalesce(p.membership_tier, p.membership_1, 'free'))
    into tier
  from public.profiles p
  where p.id = auth.uid();

  if tier not in ('pro', 'premium', 'institution') then
    raise exception 'upgrade_required';
  end if;

  return query
  select b.phone_number, b.whatsapp_number
  from public.businesses b
  where b.id = business_id
  limit 1;
end;
$$;

grant execute on function public.reveal_seller_contact(uuid) to authenticated;
