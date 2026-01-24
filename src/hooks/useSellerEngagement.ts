import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

type ProfileMini = {
  display_name: string | null;
  avatar_url: string | null;
};

type RecentItem = {
  id: string;
  created_at: string;
  product_title?: string | null;
  user?: ProfileMini | null;
};

export function useSellerEngagement(
  businessId?: string | null,
  options?: { recentLimit?: number }
) {
  const { user } = useAuth();
  const recentLimit = options?.recentLimit ?? 10;
  const [loading, setLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [savesCount, setSavesCount] = useState(0);
  const [followersRecent, setFollowersRecent] = useState<RecentItem[]>([]);
  const [viewsRecent, setViewsRecent] = useState<RecentItem[]>([]);
  const [savesRecent, setSavesRecent] = useState<RecentItem[]>([]);

  const fetchFollowers = useCallback(
    async (limit: number) => {
      const { data: rows } = await supabase
        .from("business_follows")
        .select("id,created_at,user_id,profiles(display_name,avatar_url,full_name)")
        .eq("business_id", String(businessId ?? ""))
        .order("created_at", { ascending: false })
        .limit(limit);
      return (rows ?? []).map((row: any) => ({
        id: String(row.id),
        created_at: row.created_at,
        user: row.profiles ?? null,
      })) as RecentItem[];
    },
    [businessId]
  );

  const fetchViews = useCallback(
    async (limit: number) => {
      const { data: productRows } = await supabase
        .from("products")
        .select("id,title")
        .eq("business_id", String(businessId ?? ""))
        .limit(500);
      const productIds = (productRows ?? []).map((p: any) => p.id).filter(Boolean);
      const productTitleById: Record<string, string> = {};
      for (const p of productRows ?? []) {
        if (p?.id) productTitleById[String(p.id)] = String(p.title ?? "");
      }
      if (productIds.length === 0) return [] as RecentItem[];

      const { data: rows } = await supabase
        .from("product_views")
        .select("id,created_at,viewer_id,product_id,profiles(display_name,avatar_url,full_name)")
        .in("product_id", productIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      return (rows ?? []).map((row: any) => ({
        id: String(row.id),
        created_at: row.created_at,
        product_title: productTitleById[String(row.product_id)] ?? "",
        user: row.profiles ?? null,
      })) as RecentItem[];
    },
    [businessId]
  );

  const fetchSaves = useCallback(
    async (limit: number) => {
      const { data: productRows } = await supabase
        .from("products")
        .select("id,title")
        .eq("business_id", String(businessId ?? ""))
        .limit(500);
      const productIds = (productRows ?? []).map((p: any) => p.id).filter(Boolean);
      const productTitleById: Record<string, string> = {};
      for (const p of productRows ?? []) {
        if (p?.id) productTitleById[String(p.id)] = String(p.title ?? "");
      }
      if (productIds.length === 0) return [] as RecentItem[];

      const { data: rows } = await supabase
        .from("product_saves")
        .select("id,created_at,user_id,product_id,profiles(display_name,avatar_url,full_name)")
        .in("product_id", productIds)
        .order("created_at", { ascending: false })
        .limit(limit);

      return (rows ?? []).map((row: any) => ({
        id: String(row.id),
        created_at: row.created_at,
        product_title: productTitleById[String(row.product_id)] ?? "",
        user: row.profiles ?? null,
      })) as RecentItem[];
    },
    [businessId]
  );

  const refresh = useCallback(async () => {
    const bid = String(businessId ?? "").trim();
    if (!bid || !user?.id) {
      setFollowerCount(0);
      setViewsCount(0);
      setSavesCount(0);
      setFollowersRecent([]);
      setViewsRecent([]);
      setSavesRecent([]);
      return;
    }

    setLoading(true);
    try {
      const { count: followersCountRaw } = await supabase
        .from("business_follows")
        .select("id", { count: "exact", head: true })
        .eq("business_id", bid)
        .limit(1);
      setFollowerCount(followersCountRaw ?? 0);

      const { data: productRows } = await supabase
        .from("products")
        .select("id")
        .eq("business_id", bid)
        .limit(500);
      const productIds = (productRows ?? []).map((p: any) => p.id).filter(Boolean);

      if (productIds.length > 0) {
        const { count: viewsCountRaw } = await supabase
          .from("product_views")
          .select("id", { count: "exact", head: true })
          .in("product_id", productIds)
          .limit(1);
        setViewsCount(viewsCountRaw ?? 0);

        const { count: savesCountRaw } = await supabase
          .from("product_saves")
          .select("id", { count: "exact", head: true })
          .in("product_id", productIds)
          .limit(1);
        setSavesCount(savesCountRaw ?? 0);
      } else {
        setViewsCount(0);
        setSavesCount(0);
      }

      const [followersList, viewsList, savesList] = await Promise.all([
        fetchFollowers(recentLimit),
        fetchViews(recentLimit),
        fetchSaves(recentLimit),
      ]);
      setFollowersRecent(followersList);
      setViewsRecent(viewsList);
      setSavesRecent(savesList);
    } finally {
      setLoading(false);
    }
  }, [businessId, user?.id, fetchFollowers, fetchViews, fetchSaves, recentLimit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(
    async (type: "followers" | "views" | "saves", limit = 50) => {
      if (type === "followers") return fetchFollowers(limit);
      if (type === "views") return fetchViews(limit);
      return fetchSaves(limit);
    },
    [fetchFollowers, fetchViews, fetchSaves]
  );

  return {
    loading,
    followerCount,
    viewsCount,
    savesCount,
    followersRecent,
    viewsRecent,
    savesRecent,
    loadMore,
    refresh,
  };
}
