// src/hooks/useMembership.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { normalizeTier, type MembershipTier } from "../lib/plans";
import { useAuth } from "./useAuth";

type MembershipState = {
  tier: MembershipTier;
  loading: boolean;
  error: string | null;
};

export function useMembership() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [state, setState] = useState<MembershipState>({
    tier: "free",
    loading: true,
    error: null,
  });

  // Prevent duplicate fetches in React Strict Mode / fast re-renders
  const lastLoadedFor = useRef<string | null>(null);

  const fetchMembership = useCallback(async () => {
    if (!userId) {
      setState({ tier: "free", loading: false, error: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // IMPORTANT:
      // Do NOT select a column that may not exist (membership_tier) or PostgREST will 400.
      // Using select() with no args = select("*") and won't reference missing columns.
      const { data, error } = await supabase
        .from("profiles")
        .select()
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      const tier = normalizeTier(
        (data as any)?.membership_tier ?? (data as any)?.membership_1 ?? (data as any)?.membershipTier
      );
      setState({ tier, loading: false, error: null });
      lastLoadedFor.current = userId;
    } catch (e: any) {
      // Production-safe: don't spam console for schema mismatch
      setState({ tier: "free", loading: false, error: e?.message ?? "Failed to load membership" });
    }
  }, [userId]);

  useEffect(() => {
    // If user changes, reload
    if (!userId) {
      setState({ tier: "free", loading: false, error: null });
      lastLoadedFor.current = null;
      return;
    }

    // Avoid re-fetch loops (especially when ProductDetail re-renders)
    if (lastLoadedFor.current === userId) return;

    let alive = true;
    (async () => {
      if (!alive) return;
      await fetchMembership();
    })();

    return () => {
      alive = false;
    };
  }, [userId, fetchMembership]);

  return {
    tier: state.tier,
    loading: state.loading,
    error: state.error,
    isPremium: state.tier === "premium",
    isPro: state.tier === "pro",
    isInstitution: state.tier === "institution",
    isAdmin: state.tier === "admin",
    refresh: fetchMembership,
  };
}

export default useMembership;
