insert into public.feature_flags (key, description, enabled)
values ('make_offer_enabled', 'Enable Make Offer (Pro/Premium buyers only)', false)
on conflict (key) do update
  set description = excluded.description;
