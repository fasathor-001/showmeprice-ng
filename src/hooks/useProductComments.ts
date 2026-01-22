import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type ProductComment = {
  id: string;
  product_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export function useProductComments(productId?: string | null) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadComments = useCallback(async () => {
    const pid = String(productId ?? "").trim();
    if (!pid) {
      setComments([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("product_comments")
      .select("id,product_id,user_id,body,created_at")
      .eq("product_id", pid)
      .order("created_at", { ascending: false });
    setLoading(false);

    if (!error) {
      setComments((data ?? []) as ProductComment[]);
    }
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadComments();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadComments]);

  const addComment = useCallback(
    async (body: string) => {
      const pid = String(productId ?? "").trim();
      if (!pid) throw new Error("Missing product");
      if (!user?.id) throw new Error("Login required");

      const text = String(body ?? "").trim();
      if (!text) throw new Error("Comment cannot be empty");

      const { data, error } = await supabase
        .from("product_comments")
        .insert({
          product_id: pid,
          user_id: user.id,
          body: text,
        })
        .select("id,product_id,user_id,body,created_at")
        .limit(1);
      if (error) throw error;

      const row = (data?.[0] ?? null) as ProductComment | null;
      if (row) {
        setComments((prev) => [row, ...prev]);
      }
      return row;
    },
    [productId, user?.id]
  );

  return { comments, loading, addComment, reload: loadComments };
}
