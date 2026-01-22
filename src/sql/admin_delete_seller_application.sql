-- Admin-only: delete seller application (businesses row) and revert to buyer

CREATE OR REPLACE FUNCTION public.admin_delete_seller_application(business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_user_id uuid;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.businesses
  WHERE id = business_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'business not found';
  END IF;

  DELETE FROM public.businesses
  WHERE id = business_id;

  UPDATE public.profiles
  SET user_type = 'buyer',
      updated_at = now()
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_seller_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_seller_application(uuid) TO authenticated;
