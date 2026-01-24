# Supabase migration history alignment

If `db push --include-all` complains about missing/unknown versions, align local history with remote:

1) Fetch remote migrations:
```
npx supabase migration fetch --linked
```

2) Verify versions:
```
npx supabase migration list --linked
```

3) Push local migrations:
```
npx supabase db push --include-all
```

Notes:
- Avoid `.bak` files in `supabase/migrations`.
- If a remote version already exists, create a new migration with a fresh 14-digit timestamp instead of reusing the old prefix.

## Fixing 20260123 name mismatches

If `migration list --linked` shows `20260123` as both local-only and remote-only, check for name/whitespace mismatches in the remote history:

Inspect remote history (length + hex):
```sql
select
  version,
  name,
  length(name) as name_len,
  encode(convert_to(name, 'utf8'), 'hex') as name_hex
from supabase_migrations.schema_migrations
where version = '20260123';
```

Normalize the row (trim + set canonical name):
```sql
update supabase_migrations.schema_migrations
set
  version = trim(version),
  name = 'escrow_events_idempotency'
where trim(version) = '20260123';
```

This resolves whitespace/name mismatches that cause a split row for the same version.

Verify after normalization:
```
npx supabase migration list --linked
npx supabase db push --include-all --dry-run
```

## Legacy 8-digit migrations (bare format)

For legacy 8-digit versions (e.g. `20260123`), keep the migration file as a bare timestamp:
```
supabase/migrations/20260123.sql
```
The CLI treats this as the legacy format for old-style versions.

Normalize the remote row so the name is empty:
```sql
update supabase_migrations.schema_migrations
set name = ''
where version = '20260123';
```
