// src/hooks/useProfile.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAuthSession } from "../lib/authSession";
import type { Business } from "../types";

export type ProfileRow = {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  username?: string | null;
  user_type?: "buyer" | "seller" | string | null;
  role?: string | null;
  phone?: string | null;
  city?: string | null;
  state_id?: number | null;
  business_name?: string | null;
  business_type?: string | null;
  membership_tier?: string | null;
  language?: string | null;
  notifications_enabled?: boolean | null;
  chats_disabled?: boolean | null;
  feedback_disabled?: boolean | null;
  [key: string]: any;
};

type State = {
  profile: ProfileRow | null;
  business: Business | null;
  loading: boolean;
  error: string | null;
};

type Cache = {
  userId: string;
  profile: ProfileRow | null;
  business: Business | null;
  ts: number;
};

function getCache(): Cache | null {
  try {
    return (window as any).__SMP_PROFILE_CACHE__ ?? null;
  } catch {
    return null;
  }
}

function setCache(c: Cache | null) {
  try {
    (window as any).__SMP_PROFILE_CACHE__ = c;
  } catch {}
}

function getCachedUserType(userId: string): string {
  try {
    return String(localStorage.getItem(`smp:user_type:${userId}`) || "");
  } catch {
    return "";
  }
}

function setCachedUserType(userId: string, t: string) {
  try {
    localStorage.setItem(`smp:user_type:${userId}`, t);
  } catch {}
}

async function getAuthedUserId(): Promise<string | null> {
  return getAuthSession()?.user?.id ?? null;
}

export function useProfile() {
  const requestIdRef = useRef(0);

  const cached = getCache();
  const [state, setState] = useState<State>(() => {
    // Only show cached data briefly; refresh() will verify correct userId.
    if (cached?.userId && (Date.now() - cached.ts) < 2 * 60 * 1000) {
      return { profile: cached.profile, business: cached.business, loading: true, error: null };
    }
    return { profile: null, business: null, loading: true, error: null };
  });

  const refresh = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const userId = await getAuthedUserId();

      // Signed out
      if (!userId) {
        if (reqId !== requestIdRef.current) return;
        setCache(null);
        setState({ profile: null, business: null, loading: false, error: null });
        return;
      }

      // If cache belongs to a different user, clear immediately to prevent buyer/seller mixup
      const c = getCache();
      if (c?.userId && c.userId !== userId) {
        setCache(null);
        if (reqId !== requestIdRef.current) return;
        setState({ profile: null, business: null, loading: true, error: null });
      }

      // 1) Profile
      const { data: profileRow, error: pErr } = await supabase
        .from("profiles")
        .select(
          "id, full_name, display_name, username, user_type, role, is_admin, membership_1, business_name, phone, phone_number, city, state, address, state_id"
        )
        .eq("id", userId)
        .maybeSingle();

      if (pErr) throw pErr;

      let resolvedProfile = (profileRow as any) as ProfileRow | null;
      if (resolvedProfile && !(resolvedProfile as any).membership_tier) {
        (resolvedProfile as any).membership_tier = (resolvedProfile as any).membership_1 ?? null;
      }
      if (!resolvedProfile) {
        let metaType = "";
        let metaRole = "";
        let metaName = "";
        let metaPhone = "";
        let metaCity = "";
        let metaAddress = "";
        let metaStateId: number | null = null;
        let metaBusinessName = "";
        try {
          const { data: userData } = await supabase.auth.getUser();
          metaType = String((userData as any)?.user?.user_metadata?.user_type ?? "").toLowerCase();
          metaRole = String((userData as any)?.user?.user_metadata?.role ?? "").toLowerCase();
          metaName = String((userData as any)?.user?.user_metadata?.full_name ?? "");
          metaPhone = String((userData as any)?.user?.user_metadata?.phone ?? "");
          metaCity = String((userData as any)?.user?.user_metadata?.city ?? "");
          metaAddress = String((userData as any)?.user?.user_metadata?.address ?? "");
          const rawState = (userData as any)?.user?.user_metadata?.state_id;
          const parsedState = Number(rawState);
          metaStateId = Number.isFinite(parsedState) ? parsedState : null;
          metaBusinessName = String((userData as any)?.user?.user_metadata?.business_name ?? "");
        } catch {}

        const cleanName = metaName.trim();
        const baseProfile = {
          id: userId,
          user_type: metaType || "buyer",
          role: metaRole || null,
          full_name: cleanName || null,
          display_name: cleanName || null,
          phone: metaPhone.trim() || null,
          city: metaCity.trim() || null,
          address: metaAddress.trim() || null,
          state_id: metaStateId,
          business_name: metaBusinessName.trim() || null,
        } as any;

        try {
          const { error: upErr } = await supabase.from("profiles").upsert(baseProfile, { onConflict: "id" });
          if (upErr) throw upErr;
        } catch {
          // Fallback: insert minimal safe profile (in case email/full_name columns are missing)
          try {
            await supabase.from("profiles").upsert(
              {
                id: userId,
                user_type: metaType || "buyer",
                role: metaRole || null,
                display_name: cleanName || null,
              },
              { onConflict: "id" }
            );
          } catch {}
        }

        try {
          const { data: p2 } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          resolvedProfile = (p2 as any) || (baseProfile as ProfileRow);
        } catch {
          resolvedProfile = baseProfile as ProfileRow;
        }
      }

      // Persist user_type for refresh (prevents Navbar/AccountShell flicker)
      const profileType = resolvedProfile?.user_type ? String(resolvedProfile.user_type).toLowerCase() : "";
      if (profileType) setCachedUserType(userId, profileType);

      // 2) Seller business record (safe even for buyers; will be null)
      let bizRow: any = null;
      let bErr: any = null;
      const { data: byUserId, error: byUserErr } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      bizRow = byUserId;
      bErr = byUserErr;

      if (!bizRow && !bErr) {
        const { data: byOwnerId, error: byOwnerErr } = await supabase
          .from("businesses")
          .select("*")
          .eq("owner_id", userId)
          .maybeSingle();
        bizRow = byOwnerId;
        bErr = byOwnerErr;
      }

      if (bErr) throw bErr;

      if (reqId !== requestIdRef.current) return;

      let verificationStatus: string | null = null;
      try {
        const { data: vRow, error: vErr } = await supabase
          .from("seller_verifications")
          .select("status")
          .eq("seller_id", userId)
          .maybeSingle();
        if (!vErr && vRow?.status) verificationStatus = String(vRow.status);
      } catch {}

      const mergedProfile = {
        ...(resolvedProfile as any),
        seller_verification_status: verificationStatus,
      };
      const mergedBusiness = (bizRow as any) as Business | null;

      setState({
        profile: mergedProfile,
        business: mergedBusiness,
        loading: false,
        error: null,
      });

      setCache({
        userId,
        profile: mergedProfile,
        business: mergedBusiness,
        ts: Date.now(),
      });
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return;
      console.error("useProfile: fetch failed", e);
      setState({
        profile: null,
        business: null,
        loading: false,
        error: e?.message ?? "Failed to load profile",
      });
    } finally {
      if (reqId !== requestIdRef.current) return;
      setState((s) => (s.loading ? { ...s, loading: false } : s));
    }
  }, []);

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // If auth user changes, refresh will clear stale cache as needed.
      if (!session?.user?.id) setCache(null);
      refresh();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [refresh]);

  return {
    profile: state.profile,
    business: state.business,
    loading: state.loading,
    loadingProfile: state.loading,
    error: state.error,
    profileError: state.error,
    refresh,
    refetchProfile: refresh,
  };
}

export default useProfile;
