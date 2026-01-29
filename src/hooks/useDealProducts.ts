// src/hooks/useDealProducts.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type DealProduct = {
  id: string;
  title?: string | null;
  price?: number | string | null;
  images?: string[] | null;
  created_at?: string | null;
  is_deal?: boolean | null;
  deal_season?: string | null;
  is_active?: boolean | null;
  businesses?: { business_name?: string | null; verification_tier?: string | null } | null;
  states?: { name?: string | null } | null;
  categories?: { name?: string | null } | null;
};

type UseDealProductsOptions = {
  enabled?: boolean;
  seasonLabel?: string | null;
  seasonKeys?: string[];
  pageSize?: number;
};

export function useDealProducts(options?: UseDealProductsOptions) {
  const enabled = !!options?.enabled;
  const seasonLabel = (options?.seasonLabel || "").trim();
  const rawSeasonKeys = options?.seasonKeys;
  const seasonKeys = useMemo(() => {
    return Array.isArray(rawSeasonKeys) ? rawSeasonKeys.filter(Boolean) : [];
  }, [rawSeasonKeys]);
  const pageSize = Number.isFinite(options?.pageSize) ? Number(options?.pageSize) : 24;

  const seasonKeysStable = useMemo(() => {
    // stable string for dependency tracking
    return seasonKeys.join("|");
  }, [seasonKeys]);

  const [deals, setDeals] = useState<DealProduct[]>([]);
  const [page, setPage] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const reset = useCallback(() => {
    setDeals([]);
    setPage(0);
    setHasMore(true);
    setError(null);
  }, []);

  const fetchPage = useCallback(
    async (targetPage: number, mode: "replace" | "append") => {
      if (!enabled) return;
      if (!supabase) {
        setError("Supabase client not configured");
        return;
      }

      setFetching(true);
      setError(null);

      try {
        const from = targetPage * pageSize;
        const to = from + pageSize - 1;

        let q = supabase
          .from("products")
          .select(
            `
              id,
              title,
              price,
              images,
              created_at,
              is_deal,
              deal_season,
              is_active,
              businesses ( business_name, verification_tier ),
              states ( name ),
              categories ( name )
            `
          )
          .eq("is_deal", true)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .range(from, to);

        // ✅ preserve your old behavior: match ANY seasonKey variant
        if (seasonKeys.length > 0) {
          q = q.in("deal_season", seasonKeys);
        } else if (seasonLabel) {
          // fallback if no keys provided
          q = q.eq("deal_season", seasonLabel);
        }

        const { data, error } = await q;
        if (error) throw error;

        const rows = (data || []) as DealProduct[];
        setDeals((prev) => (mode === "replace" ? rows : [...prev, ...rows]));
        setHasMore(rows.length === pageSize);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load deals";
        setError(message);
      } finally {
        setFetching(false);
      }
    },
    [enabled, pageSize, seasonLabel, seasonKeys] // use memoized seasonKeys
  );

  // auto reset and fetch when enabled/season changes
  useEffect(() => {
    reset();
    if (!enabled) return;
    fetchPage(0, "replace");
  }, [enabled, seasonLabel, seasonKeysStable, reset, fetchPage]);

  const loadMore = useCallback(() => {
    if (!enabled) return;
    if (fetching) return;
    if (!hasMore) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, "append");
  }, [enabled, fetching, hasMore, page, fetchPage]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setPage(0);
    setHasMore(true);
    fetchPage(0, "replace");
  }, [enabled, fetchPage]);

  return { deals, fetching, error, hasMore, loadMore, refresh };
}
