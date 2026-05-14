import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Business } from "../types";
import { useAuth } from "./useAuth";

export function useSeller() {
  const { user } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (!user?.id) {
        setBusiness(null);
        setLoading(false);
        return;
      }

      try {
        // IMPORTANT FIX:
        // businesses uses user_id, whatsapp_number, phone_number
        let data: any = null;
        let error: any = null;
        const byUser = await supabase
          .from("businesses")
          .select("*, verification_tier, verification_status")
          .eq("user_id", user.id)
          .maybeSingle();
        data = byUser.data;
        error = byUser.error;

        // Legacy owner_id fallback removed — businesses.user_id is the canonical key
        // (businesses_user_id_key unique constraint exists in production).

        if (error) throw error;

        if (!cancelled) {
          setBusiness((data as any) ?? null);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("useSeller: load failed", e);
          setBusiness(null);
          setLoading(false);
          setError(e?.message ?? "Failed to load seller business");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { business, loading, error };
}

export function useCurrentBusiness() {
  return useSeller();
}
