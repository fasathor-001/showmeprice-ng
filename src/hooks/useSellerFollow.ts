import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export function useSellerFollow(sellerId?: string | null) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sid = String(sellerId ?? "").trim();
    if (!sid) {
      setFollowing(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      const res = user?.id
        ? await supabase
            .from("seller_follows")
            .select("id")
            .eq("seller_id", sid)
            .eq("user_id", user.id)
            .limit(1)
        : { data: [] as any[] };
      if (!cancelled) {
        setLoading(false);
        setFollowing(!!res?.data?.[0]);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [sellerId, user?.id]);

  const toggleFollow = useCallback(async () => {
    const sid = String(sellerId ?? "").trim();
    if (!sid) throw new Error("Missing seller");
    if (!user?.id) throw new Error("Login required");

    const prev = following;
    const next = !prev;

    setMutating(true);
    setFollowing(next);
    try {
      if (next) {
        const { error } = await supabase.from("seller_follows").insert({
          seller_id: sid,
          user_id: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("seller_follows")
          .delete()
          .eq("seller_id", sid)
          .eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (err) {
      setFollowing(prev);
      throw err;
    } finally {
      setMutating(false);
    }
  }, [following, sellerId, user?.id]);

  return { following, loading, mutating, toggleFollow };
}
