import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type FlagsMap = Record<string, boolean>;

export function useFF() {
  const [ready, setReady] = useState(false);
  const [flags, setFlags] = useState<FlagsMap>({});
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const { data, error } = await supabase.from("feature_flags").select("key, enabled");
      if (error) throw error;
      const map: FlagsMap = {};
      (data || []).forEach((r: any) => {
        map[String(r.key)] = !!r.enabled;
      });
      setFlags(map);
      setReady(true);
    } catch (e: any) {
      setReady(false);
      setError(e?.message || "Failed to load feature flags");
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      if (!alive) return;
    })();

    const channel = supabase
      .channel("ff:feature_flags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feature_flags" },
        () => load()
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEnabled = (key: string, fallback: boolean = false) => {
    const v = flags[key];
    return typeof v === "boolean" ? v : fallback;
  };

  // Compatibility aliases
  const messaging = ready ? isEnabled("in_app_messaging_enabled", false) : false;
  const chatFiltering = ready ? isEnabled("chat_filtering_enabled", false) : false;

  return useMemo(
    () => ({
      ready,
      error,
      flags,
      isEnabled,
      // common keys
      messaging,
      chatFiltering,
      deals: ready ? isEnabled("deals_enabled", false) : false,
      dealsPosting: ready ? isEnabled("deals_posting_enabled", false) : false,
      delivery: ready ? isEnabled("delivery_enabled", false) : false,
    }),
    [ready, error, flags, messaging, chatFiltering]
  );
}
