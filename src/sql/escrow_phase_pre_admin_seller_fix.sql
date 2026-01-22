-- Escrow Phase Pre: Admin menu + seller activation fixes
-- Promote buyer -> seller when a businesses row is inserted

CREATE OR REPLACE FUNCTION public.promote_to_seller_on_business_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET user_type = 'seller'
  WHERE id = NEW.user_id
    AND (user_type IS DISTINCT FROM 'seller');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_to_seller ON public.businesses;

CREATE TRIGGER trg_promote_to_seller
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.promote_to_seller_on_business_insert();
