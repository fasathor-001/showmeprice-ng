import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export function useProductLike(productId?: string | null) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const pid = String(productId ?? "").trim();
    if (!pid) {
      setLiked(false);
      setCount(0);
      return;
    }

    const run = async () => {
      setLoading(true);
      const countReq = supabase
        .from("product_likes")
        .select("id", { count: "exact", head: true })
        .eq("product_id", pid);

      const likedReq = user?.id
        ? supabase.from("product_likes").select("id").eq("product_id", pid).eq("user_id", user.id).limit(1)
        : Promise.resolve({ data: [] as any[] });

      const [countRes, likedRes] = await Promise.all([countReq, likedReq]);

      if (cancelled) return;
      setLoading(false);
      setCount(countRes.count ?? 0);
      setLiked(!!likedRes?.data?.[0]);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [productId, user?.id]);

  const toggleLike = useCallback(async () => {
    const pid = String(productId ?? "").trim();
    if (!pid) throw new Error("Missing product");
    if (!user?.id) throw new Error("Login required");

    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !prevLiked;

    setMutating(true);
    setLiked(nextLiked);
    setCount(Math.max(0, prevCount + (nextLiked ? 1 : -1)));

    try {
      if (nextLiked) {
        const { error } = await supabase.from("product_likes").insert({
          product_id: pid,
          user_id: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_likes")
          .delete()
          .eq("product_id", pid)
          .eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (err) {
      setLiked(prevLiked);
      setCount(prevCount);
      throw err;
    } finally {
      setMutating(false);
    }
  }, [count, liked, productId, user?.id]);

  return { liked, count, loading, mutating, toggleLike };
}
