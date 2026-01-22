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
    const bid = String(sellerId ?? "").trim();
    if (!bid) {
      setFollowing(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      const res = user?.id
        ? await supabase
            .from("business_follows")
            .select("id")
            .eq("business_id", bid)
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
    const bid = String(sellerId ?? "").trim();
    if (!bid) throw new Error("Missing business");
    if (!user?.id) throw new Error("Login required");

    const prev = following;
    const next = !prev;

    setMutating(true);
    setFollowing(next);
    try {
      if (next) {
        const { error } = await supabase.from("business_follows").insert({
          business_id: bid,
          user_id: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_follows")
          .delete()
          .eq("business_id", bid)
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
