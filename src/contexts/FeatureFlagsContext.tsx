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
};

const FeatureFlagsContext = createContext<Ctx | null>(null);

function safeBool(v: any) {
  return v === true;
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: profileLoading } = useProfile();
  const role = (profile as any)?.role ?? "user";
  const isAuthenticated = !profileLoading && !!profile;

  // best-effort premium/institution detection (doesn't break if your schema differs)
  const isPremium =
    safeBool((profile as any)?.is_premium) ||
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
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, enabled, description, visible_to, updated_at")
        .order("key", { ascending: true });

      if (error) throw error;

      if (!Array.isArray(data)) {
        setFlags([]);
        
try { window.dispatchEvent(new Event("smp:flags-updated")); } catch {}
try { window.dispatchEvent(new Event("smp:flags-updated")); try { window.dispatchEvent(new Event("smp:flags-updated")); } catch {}
} catch {}
setError("feature_flags returned unexpected data (not an array). Check RLS/policies.");
        return;
      }

      setFlags(data as FeatureFlagRow[]);
    try { window.dispatchEvent(new Event("smp:flags-updated")); try { window.dispatchEvent(new Event("smp:flags-updated")); } catch {}
} catch {}
} catch (e: any) {
      console.error("FeatureFlags fetch failed:", e);
      setFlags([]);
      try { window.dispatchEvent(new Event("smp:flags-updated")); try { window.dispatchEvent(new Event("smp:flags-updated")); } catch {}
} catch {}
setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load once; re-fetch when profile becomes available is optional
    refresh();
  }, [refresh]);

  const flagsByKey = useMemo(() => {
    const m = new Map<string, FeatureFlagRow>();
    for (const f of flags) m.set(f.key, f);
    return m;
  }, [flags]);

  const getFlag = useCallback((key: FeatureFlagKey) => flagsByKey.get(String(key)), [flagsByKey]);

  const isEnabled = useCallback(
    (key: FeatureFlagKey) => {
      const f = flagsByKey.get(String(key));
      if (!f) return false;
      if (!f.enabled) return false;
      if (!canSee(f.visible_to)) return false;
      return true;
    },
    [flagsByKey, canSee]
  );

  const value: Ctx = useMemo(
    () => ({ flags, loading, error, refresh, getFlag, isEnabled }),
    [flags, loading, error, refresh, getFlag, isEnabled]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error("useFeatureFlags must be used within FeatureFlagsProvider");
  return ctx;
}



