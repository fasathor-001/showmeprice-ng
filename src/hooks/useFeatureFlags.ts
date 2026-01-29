import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type FeatureFlagRow = {
  key: string;
  enabled: boolean;
  description: string | null;
  visible_to: "all" | "authenticated" | "premium" | "institution" | "admin";
  created_at: string;
  updated_at: string;
};

export type UserContext = {
  isAuthenticated: boolean;
  role?: string | null; // "admin" etc
  plan?: "free" | "premium" | "institution";
};

type Cache = {
  fetchedAt: number;
  list: FeatureFlagRow[];
  byKey: Record<string, FeatureFlagRow>;
};

let CACHE: Cache | null = null;
let INFLIGHT: Promise<Cache> | null = null;

const LOCKED_ALWAYS_ON = new Set<string>(["in_app_messaging_enabled"]);

function hardIsEnabled(key: string, enabled: boolean | undefined): boolean {
  if (LOCKED_ALWAYS_ON.has(key)) return true;
  return Boolean(enabled);
}

export function useFeatureFlags() {
  const mountedRef = useRef(true);

  // ✅ Safety: make messaging true even before first fetch (in case any code reads flags directly)
  const [flags, setFlags] = useState<Record<string, boolean>>({
    in_app_messaging_enabled: true,
  });

  const [flagList, setFlagList] = useState<FeatureFlagRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!supabase) {
      setError("Supabase client not initialized");
      setLoading(false);
      return;
    }

    try {
      if (!INFLIGHT) {
        INFLIGHT = (async () => {
          const { data, error: qErr } = await supabase
            .from("feature_flags")
            .select("key, enabled, description, visible_to, updated_at")
            .order("key", { ascending: true });

          if (qErr) throw qErr;

          const list = (data ?? []) as FeatureFlagRow[];
          const byKey: Record<string, FeatureFlagRow> = {};
          for (const f of list) byKey[f.key] = f;

          const next: Cache = { fetchedAt: Date.now(), list, byKey };
          CACHE = next;
          return next;
        })().finally(() => {
          INFLIGHT = null;
        });
      }

      const next = await INFLIGHT;
      if (!mountedRef.current) return;

      setFlagList(next.list);

      const enabledMap: Record<string, boolean> = {};
      for (const f of next.list) enabledMap[f.key] = Boolean(f.enabled);

      // ✅ enforce always-on
      enabledMap["in_app_messaging_enabled"] = true;

      setFlags(enabledMap);
      setLoading(false);
    } catch (e: any) {
      console.error("useFeatureFlags: fetch failed", e);
      if (!mountedRef.current) return;
      setError(e?.message ?? "Failed to load feature flags");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const isEnabled = useCallback((key: string) => hardIsEnabled(key, flags[key]), [flags]);

  const getFlag = useCallback(
    (key: string) => {
      return CACHE?.byKey?.[key] ?? flagList.find((f) => f.key === key) ?? null;
    },
    [flagList]
  );

  const canUserSee = useCallback(
    (key: string, userContext: UserContext) => {
      if (LOCKED_ALWAYS_ON.has(key)) return true;

      const flag = getFlag(key);
      if (!flag) return false;

      const v = flag.visible_to;
      switch (v) {
        case "all":
          return true;
        case "authenticated":
          return userContext.isAuthenticated;
        case "premium":
          return userContext.isAuthenticated && userContext.plan === "premium";
        case "institution":
          return userContext.isAuthenticated && userContext.plan === "institution";
        case "admin":
          return userContext.isAuthenticated && userContext.role === "admin";
        default:
          return false;
      }
    },
    [getFlag]
  );

  const cacheInfo = useMemo(() => {
    return { fetchedAt: CACHE?.fetchedAt ?? null, count: flagList.length };
  }, [flagList.length]);

  return {
    flags,
    flagList,
    loading,
    error,
    refresh,
    isEnabled,
    canUserSee,
    getFlag,
    cacheInfo,
  };
}
