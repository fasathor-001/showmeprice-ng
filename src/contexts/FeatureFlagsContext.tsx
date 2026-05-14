import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "../hooks/useProfile";

export type FeatureFlagKey =
  | "chat_filtering_enabled"
  | "deals_enabled"
  | "deals_posting_enabled"
  | "delivery_enabled"
  | "escrow_enabled"
  | "in_app_messaging_enabled"
  | "institution_tools_enabled"
  | "make_offer_enabled"
  | "phone_call_enabled"
  | "whatsapp_contact_enabled"
  | string;

export type FeatureFlagRow = {
  key: string;
  enabled: boolean;
  description: string | null;
  visible_to: "all" | "authenticated" | "premium" | "institution" | "admin" | null;
  updated_at?: string | null;
};

type Ctx = {
  flags: FeatureFlagRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getFlag: (key: FeatureFlagKey) => FeatureFlagRow | undefined;
  isEnabled: (key: FeatureFlagKey) => boolean;
  flagList: FeatureFlagRow[];
};

const FeatureFlagsContext = createContext<Ctx | null>(null);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: profileLoading } = useProfile();
  const role = (profile as any)?.role ?? "user";
  const isAuthenticated = !profileLoading && !!profile;

  const isPremium =
    (profile as any)?.is_premium === true ||
    (profile as any)?.membership_tier === "premium";

  const isInstitution =
    (profile as any)?.user_type === "institution" ||
    (profile as any)?.account_type === "institution" ||
    (profile as any)?.role === "institution";

  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSee = useCallback(
    (visible_to: FeatureFlagRow["visible_to"]) => {
      const v = visible_to ?? "all";
      if (v === "all") return true;
      if (v === "authenticated") return isAuthenticated;
      if (v === "premium") return isAuthenticated && isPremium;
      if (v === "institution") return isAuthenticated && isInstitution;
      if (v === "admin") return role === "admin";
      return true;
    },
    [isAuthenticated, isPremium, isInstitution, role]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from("feature_flags")
        .select("key, enabled, description, visible_to, updated_at")
        .order("key", { ascending: true });

      if (fetchErr) throw fetchErr;

      if (!Array.isArray(data)) {
        setFlags([]);
        setError("feature_flags returned unexpected data. Check RLS/policies.");
        return;
      }

      setFlags(data as FeatureFlagRow[]);
    } catch (e: any) {
      console.error("FeatureFlags fetch failed:", e);
      setFlags([]);
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
      try {
        window.dispatchEvent(new Event("smp:flags-updated"));
      } catch {
        // intentionally empty
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flagsByKey = useMemo(() => {
    const m = new Map<string, FeatureFlagRow>();
    for (const f of flags) m.set(f.key, f);
    return m;
  }, [flags]);

  const getFlag = useCallback(
    (key: FeatureFlagKey) => flagsByKey.get(String(key)),
    [flagsByKey]
  );

  const isEnabled = useCallback(
    (key: FeatureFlagKey) => {
      if (key === "in_app_messaging_enabled") return true; // always on
      const f = flagsByKey.get(String(key));
      if (!f) return false;
      if (!f.enabled) return false;
      if (!canSee(f.visible_to)) return false;
      return true;
    },
    [flagsByKey, canSee]
  );

  const value: Ctx = useMemo(
    () => ({ flags, flagList: flags, loading, error, refresh, getFlag, isEnabled }),
    [flags, loading, error, refresh, getFlag, isEnabled]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  return ctx;
}
