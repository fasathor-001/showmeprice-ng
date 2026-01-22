-- Fix is_admin helper for profiles.id or profiles.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_id'
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $func$
      SELECT COALESCE((
        SELECT p.is_admin
        FROM public.profiles p
        WHERE (p.id = uid OR p.user_id = uid)
        LIMIT 1
      ), false);
    $func$;
  ELSE
    CREATE OR REPLACE FUNCTION public.is_admin(uid uuid DEFAULT auth.uid())
    RETURNS boolean
    LANGUAGE sql
    STABLE
    AS $func$
      SELECT COALESCE((
        SELECT p.is_admin
        FROM public.profiles p
        WHERE p.id = uid
        LIMIT 1
      ), false);
    $func$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
