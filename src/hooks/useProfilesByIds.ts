import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ProfileLite = {
  id: string;
  full_name: string | null;
  display_name?: string | null;
  username?: string | null;
};

const cache = new Map<string, ProfileLite>();

export function useProfilesByIds(ids: Array<string | null | undefined>) {
  const key = useMemo(() => {
    const uniq = Array.from(new Set((ids.filter(Boolean) as string[]).map(String)));
    uniq.sort();
    return uniq.join(",");
  }, [ids]);

  const wanted = useMemo(() => {
    if (!key) return [];
    return key.split(",").filter(Boolean);
  }, [key]);

  const [byId, setById] = useState<Record<string, ProfileLite>>(() => {
    const out: Record<string, ProfileLite> = {};
    for (const id of wanted) {
      const hit = cache.get(id);
      if (hit) out[id] = hit;
    }
    return out;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (wanted.length === 0) return;

      const missing = wanted.filter((id) => !cache.has(id));
      if (missing.length === 0) {
        const out: Record<string, ProfileLite> = {};
        for (const id of wanted) {
          const hit = cache.get(id);
          if (hit) out[id] = hit;
        }
        if (!cancelled) setById(out);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, username")
        .in("id", missing);

      if (!cancelled) {
        setLoading(false);
        if (!error && data) {
          for (const row of data) cache.set(row.id, row);
        }
        const out: Record<string, ProfileLite> = {};
        for (const id of wanted) {
          const hit = cache.get(id);
          if (hit) out[id] = hit;
        }
        setById(out);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { byId, loading };
}
