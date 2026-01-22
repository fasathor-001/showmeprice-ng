// src/hooks/useUnreadMessagesCount.ts
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type UnreadCountOptions = {
  enabled?: boolean;
  pollMs?: number;
};

function toOptions(arg: number | UnreadCountOptions): Required<UnreadCountOptions> {
  if (typeof arg === "number") return { enabled: true, pollMs: arg };
  return {
    enabled: arg.enabled ?? true,
    pollMs: arg.pollMs ?? 15000,
  };
}

export function useUnreadMessagesCount(arg: number | UnreadCountOptions = 15000) {
  const { user } = useAuth();
  const { enabled, pollMs } = useMemo(() => toOptions(arg), [arg]);

  const [count, setCount] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !enabled) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { count: c, error } = await supabase
          .from("messages")
          .select("id", { head: true, count: "exact" })
          .eq("receiver_id", user.id)
          .is("read_at", null);

        if (error) throw error;
        if (!cancelled) setCount(Number(c ?? 0));
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    // Initial
    fetchCount();

    // Poll
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(fetchCount, pollMs);

    // Realtime (insert/update can change unread)
    const channel = supabase
      .channel(`unread-count:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload: any) => {
          const row = payload?.new ?? payload?.old;
          if (!row) return;

          // Only refresh if it affects me as receiver (unread count is receiver-based)
          if (row.receiver_id === user.id) fetchCount();
        }
      )
      .subscribe();

    const onFocus = () => fetchCount();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user?.id, enabled, pollMs]);

  return count;
}

export default useUnreadMessagesCount;
