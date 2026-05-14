import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ProductWithRelations } from "../types";

const NON_DEAL_OR_FILTER = "is_deal.is.null,is_deal.eq.false"; // show normal products only

type BaseResult<T> = {
  data: T;
  // Backward compatible aliases
  products?: T;
  loading: boolean;
  error: string | null;
};

function toErrorMessage(err: any): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.message) return String(err.message);
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

/**
 * ✅ IMPORTANT:
 * We must fetch relations used by UI:
 * - states(name) for location
 * - categories(name) for label
 * - businesses(id, user_id, business_name, verification_tier) for seller display + badge
 *
 * If your database relationship is not recognized, Supabase might require:
 * businesses!products_business_id_fkey(...)
 *
 * If you see an error like:
 * "Could not find a relationship between products and businesses"
 * then replace `businesses(...)` below with:
 * `businesses!products_business_id_fkey(business_name, verification_tier)`
 */
const PRODUCT_WITH_BUSINESS_SELECT = `
  *,
  states(name),
  categories(name),
  businesses(id, user_id, business_name, verification_tier, verification_status)
`;

function imageToPublicUrl(img: string): string {
  const s = (img ?? "").trim();
  if (!s) return "";
  // Already a full URL
  if (/^https?:\/\//i.test(s)) return s;

  // Some rows may store "products/<path>" even though bucket is "products"
  const path = s.startsWith("products/") ? s.slice("products/".length) : s;

  try {
    if (!supabase) return s;
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    return data?.publicUrl || s;
  } catch {
    return s;
  }
}

function normalizeProduct(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;

  // Ensure images is always an array (some schemas store json/text)
  let images: any = raw.images;

  if (typeof images === "string") {
    // Try JSON first
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      // fallback: comma separated
      images = images
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(images)) images = [];

  images = images
    .map((img: any) => imageToPublicUrl(String(img ?? "")))
    .filter(Boolean);

  return { ...raw, images };
}

function normalizeProducts(list: any[]): any[] {
  return (list || []).map(normalizeProduct);
}

async function attachSellerBadges(rows: any[]): Promise<any[]> {
  if (!rows.length) return rows;
  const ids = Array.from(
    new Set(
      rows
        .map((r) => String(r?.owner_id ?? "").trim())
        .filter(Boolean)
    )
  );
  if (!ids.length) return rows;
  try {
    const { data, error } = await supabase.rpc("public_get_seller_badges", { owner_ids: ids });
    if (error || !Array.isArray(data)) return rows;
    const map = new Map<string, any>();
    data.forEach((row: any) => {
      const id = String(row?.owner_id ?? "");
      if (id) map.set(id, row);
    });
    return rows.map((r) => {
      const badge = map.get(String(r?.owner_id ?? ""));
      if (!badge) return r;
      return {
        ...r,
        seller_is_verified: badge.seller_is_verified === true,
        seller_verification_tier: badge.seller_verification_tier ?? null,
        seller_membership_tier: String(badge.seller_membership_tier ?? "").toLowerCase() || null,
      };
    });
  } catch {
    return rows;
  }
}

async function attachSellerNames(rows: any[]): Promise<any[]> {
  if (!rows.length) return rows;
  try {
    // Separate rows that already have a usable name from those that need a lookup
    const needsName = rows.filter(
      (r) =>
        !String(r?.businesses?.business_name ?? "").trim() &&
        !String(r?.seller_business_name ?? "").trim() &&
        !String(r?.business_name ?? "").trim() &&
        !String(r?.seller_display_name ?? "").trim()
    );
    if (!needsName.length) return rows;

    // --- Primary path: business_id → businesses.id (direct PK lookup) ---
    // This is the most reliable because business_id is the actual FK column on products.
    const businessIds = Array.from(
      new Set(needsName.map((r) => String(r?.business_id ?? "").trim()).filter(Boolean))
    );

    // --- Secondary path: owner_id → businesses.user_id (for rows with no business_id) ---
    const ownerIds = Array.from(
      new Set(
        needsName
          .filter((r) => !String(r?.business_id ?? "").trim())
          .map((r) => String(r?.owner_id ?? "").trim())
          .filter(Boolean)
      )
    );

    // Maps for resolved names
    const nameByBizId = new Map<string, string>();  // businesses.id → name
    const nameByOwnerId = new Map<string, string>(); // businesses.user_id / profiles.id → name

    // Query businesses by PK
    if (businessIds.length > 0) {
      const { data } = await supabase
        .from("businesses")
        .select("id, user_id, business_name")
        .in("id", businessIds);
      for (const row of data ?? []) {
        const id = String(row?.id ?? "");
        const uid = String(row?.user_id ?? "");
        const name = String(row?.business_name ?? "").trim();
        if (id && name) nameByBizId.set(id, name);
        // Also register by user_id as bonus so owner_id path benefits too
        if (uid && name) nameByOwnerId.set(uid, name);
      }
    }

    // Query businesses by user_id for the secondary path
    if (ownerIds.length > 0) {
      const { data } = await supabase
        .from("businesses")
        .select("user_id, business_name")
        .in("user_id", ownerIds);
      for (const row of data ?? []) {
        const uid = String(row?.user_id ?? "");
        const name = String(row?.business_name ?? "").trim();
        if (uid && name) nameByOwnerId.set(uid, name);
      }

      // Legacy path: some businesses rows use owner_id instead of user_id
      const stillNeedLegacy = ownerIds.filter((id) => !nameByOwnerId.has(id));
      if (stillNeedLegacy.length > 0) {
        const { data: legacyRows } = await supabase
          .from("businesses")
          .select("owner_id, business_name")
          .in("owner_id", stillNeedLegacy);
        for (const row of legacyRows ?? []) {
          const oid = String((row as any)?.owner_id ?? "");
          const name = String(row?.business_name ?? "").trim();
          if (oid && name) nameByOwnerId.set(oid, name);
        }
      }

      // Fall back to profiles for any owner_ids still unresolved
      const stillNeed = ownerIds.filter((id) => !nameByOwnerId.has(id));
      if (stillNeed.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, display_name, full_name")
          .in("id", stillNeed);
        for (const row of profRows ?? []) {
          const id = String(row?.id ?? "");
          const name =
            String(row?.display_name ?? "").trim() ||
            String(row?.full_name ?? "").trim();
          if (id && name) nameByOwnerId.set(id, name);
        }
      }
    }

    return rows.map((r) => {
      const existing =
        String(r?.businesses?.business_name ?? "").trim() ||
        String(r?.seller_business_name ?? "").trim() ||
        String(r?.business_name ?? "").trim() ||
        String(r?.seller_display_name ?? "").trim();
      if (existing) return r;

      const bizId = String(r?.business_id ?? "").trim();
      const ownerId = String(r?.owner_id ?? "").trim();
      const name =
        (bizId && nameByBizId.get(bizId)) ||
        (ownerId && nameByOwnerId.get(ownerId)) ||
        "";
      return name ? { ...r, seller_display_name: name } : r;
    });
  } catch {
    return rows;
  }
}

/**
 * Recent feed (non-deals by default)
 */
export function useRecentProducts(limit = 24, refreshKey?: number): BaseResult<ProductWithRelations[]> {
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecent() {
      setLoading(true);
      setError(null);

      if (!supabase) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      const { data, error: e } = await supabase
        .from("products")
        .select(PRODUCT_WITH_BUSINESS_SELECT)
        .or(NON_DEAL_OR_FILTER)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cancelled) return;

      if (e) {
        setError(toErrorMessage(e));
        setProducts([]);
      } else {
        const normalized = normalizeProducts((data ?? []) as any) as any;
        const productsWithBadges = await attachSellerBadges(normalized);
        const productsWithNames = await attachSellerNames(productsWithBadges);
        if (process.env.NODE_ENV !== "production" && productsWithNames.length > 0) {
          const s = productsWithNames[0] as any;
          console.log("[SMP seller debug] first product seller fields:", {
            business_id: s.business_id,
            businesses: s.businesses,
            seller_business_name: s.seller_business_name,
            business_name: s.business_name,
            seller_display_name: s.seller_display_name,
            seller_name: s.seller_name,
          });
        }
        setProducts(productsWithNames as any);
      }

      setLoading(false);
    }

    fetchRecent();
    const onRefresh = () => fetchRecent();
    window.addEventListener("smp:products:refresh", onRefresh as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener("smp:products:refresh", onRefresh as EventListener);
    };
  }, [limit, refreshKey]);

  return { products, data: products, loading, error } as any;
}

/**
 * Deals feed (deals only)
 * Optional: pass a season label (deal_season) to filter the current season.
 */
export function useDealProducts(opts?: { season?: string | null; limit?: number }): BaseResult<ProductWithRelations[]> {
  const season = opts?.season ?? null;
  const limit = opts?.limit ?? 24;

  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDeals() {
      setLoading(true);
      setError(null);

      if (!supabase) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      let q = supabase
        .from("products")
        .select(PRODUCT_WITH_BUSINESS_SELECT)
        .eq("is_deal", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (season) q = q.eq("deal_season", season);

      const { data, error: e } = await q;
      if (cancelled) return;

      if (e) {
        setError(toErrorMessage(e));
        setProducts([]);
      } else {
        const normalized = normalizeProducts((data ?? []) as any) as any;
        const productsWithBadges = await attachSellerBadges(normalized);
        const productsWithNames = await attachSellerNames(productsWithBadges);
        setProducts(productsWithNames as any);
      }

      setLoading(false);
    }

    fetchDeals();
    return () => {
      cancelled = true;
    };
  }, [season, limit]);

  return { products, data: products, loading, error } as any;
}

export type SearchParams = {
  query: string;
  state_id: number | null;
  category_id: number | null;
  sort: "recent" | "price_low" | "price_high";
  page: number;
  pageSize: number;
  includeDeals: boolean;
};

const DEFAULT_PARAMS: SearchParams = {
  query: "",
  state_id: null,
  category_id: null,
  sort: "recent",
  page: 0,
  pageSize: 24,
  includeDeals: false,
};

/**
 * Product search used by HomePage (supports filters + pagination)
 */
export function useProductSearch(initial?: Partial<SearchParams>) {
  const [params, setParams] = useState<SearchParams>({ ...DEFAULT_PARAMS, ...(initial ?? {}) });

  const [results, setResults] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const buildQuery = useCallback(async (p: SearchParams) => {
    if (!supabase) throw new Error("Supabase is not configured.");

    const from = p.page * p.pageSize;
    const to = from + p.pageSize - 1;

    let q = supabase.from("products").select(PRODUCT_WITH_BUSINESS_SELECT, { count: "exact" });

    if (!p.includeDeals) {
      q = q.or(NON_DEAL_OR_FILTER);
    }
    q = q.eq("status", "active");

    if (p.query.trim()) {
      const needle = `%${p.query.trim()}%`;
      q = q.or(`title.ilike.${needle},description.ilike.${needle}`);
    }

    if (p.state_id) q = q.eq("state_id", p.state_id);
    if (p.category_id) q = q.eq("category_id", p.category_id);

    if (p.sort === "price_low") q = q.order("price", { ascending: true });
    else if (p.sort === "price_high") q = q.order("price", { ascending: false });
    else q = q.order("created_at", { ascending: false });

    q = q.range(from, to);
    return q;
  }, []);

  const run = useCallback(
    async (p: SearchParams) => {
      setLoading(true);
      setError(null);

      try {
        const q = await buildQuery(p);
        const { data, error: e, count } = await q;

        if (e) throw e;

        const normalized = normalizeProducts((data ?? []) as any) as any;
        const pageWithBadges = await attachSellerBadges(normalized);
        const pageWithNames = await attachSellerNames(pageWithBadges);

        setTotal(typeof count === "number" ? count : null);
        setHasMore(((p.page + 1) * p.pageSize) < (count ?? 0));

        setResults((prev) => {
          if (p.page === 0) return pageWithNames as any;
          return [...(prev as any), ...(pageWithNames as any)] as any;
        });
      } catch (e: any) {
        setError(toErrorMessage(e));
        if (p.page === 0) setResults([]);
        setHasMore(false);
        setTotal(null);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    run(params);
  }, [params, run]);

  useEffect(() => {
    const onRefresh = () => {
      setParams((prev) => ({ ...prev, page: 0 }));
    };
    window.addEventListener("smp:products:refresh", onRefresh as EventListener);
    return () => {
      window.removeEventListener("smp:products:refresh", onRefresh as EventListener);
    };
  }, []);

  const updateParams = (newParams: Partial<SearchParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...newParams };

      const filterKeys: (keyof SearchParams)[] = ["query", "state_id", "category_id", "sort", "pageSize", "includeDeals"];
      const changedFilter = filterKeys.some((k) => (k in newParams) && (newParams as any)[k] !== (prev as any)[k]);
      if (changedFilter) next.page = 0;

      return next;
    });
  };

  const triggerSearch = () => {
    setParams((prev) => ({ ...prev, page: 0 }));
  };

  const loadMore = () => {
    if (loading || !hasMore) return;
    setParams((prev) => ({ ...prev, page: prev.page + 1 }));
  };

  return {
    results,
    loading,
    error,
    hasMore,
    total,
    params,
    updateParams,
    triggerSearch,
    loadMore,
  };
}

/**
 * Single product (details view)
 */
export function useSingleProduct(productId: string | number | null) {
  const [product, setProduct] = useState<ProductWithRelations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOne() {
      if (!productId) {
        setProduct(null);
        return;
      }

      setLoading(true);
      setError(null);

      if (!supabase) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      const { data, error: e } = await supabase
        .from("products")
        .select(PRODUCT_WITH_BUSINESS_SELECT)
        .eq("id", productId)
        .limit(1);

      if (cancelled) return;

      if (e) {
        setError(toErrorMessage(e));
        setProduct(null);
      } else {
        const row = Array.isArray(data) ? data[0] : (data as any);
        if (!row) {
          setProduct(null);
        } else {
          const normalized = normalizeProduct(row);
          const productWithBadges = await attachSellerBadges([normalized]);
          const productWithNames = await attachSellerNames(productWithBadges);
          setProduct((productWithNames[0] ?? null) as any);
        }
      }

      setLoading(false);
    }

    fetchOne();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { product, loading, error };
}

/**
 * Seller products (dashboard inventory)
 */
export function useSellerProducts(businessId: string | number | null) {
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!businessId) {
      setProducts([]);
      return;
    }

    setLoading(true);
    setError(null);

    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { data, error: e } = await supabase
      .from("products")
      .select(PRODUCT_WITH_BUSINESS_SELECT)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (e) {
      setError(toErrorMessage(e));
      setProducts([]);
    } else {
      setProducts(normalizeProducts((data ?? []) as any) as any);
    }

    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch();
  }, [fetch]);

  useEffect(() => {
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail;
      if (detail?.businessId && String(detail.businessId) !== String(businessId)) return;
      fetch();
    };
    window.addEventListener("smp:products:refresh", onRefresh as EventListener);
    return () => {
      window.removeEventListener("smp:products:refresh", onRefresh as EventListener);
    };
  }, [fetch, businessId]);

  return {
    products,
    loading,
    error,
    refresh: fetch,
  };
}

/**
 * Mutations for listings
 */
export function useProductManagement() {
  const deleteProduct = useCallback(async (productId: string | number) => {
    if (!supabase) return { error: "Supabase is not configured." };

    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return { error: toErrorMessage(error) };

    return { ok: true };
  }, []);

  const updateProduct = useCallback(async (productId: string | number, patch: any) => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.from("products").update(patch).eq("id", productId);
    if (error) return { error: toErrorMessage(error) };
    return { ok: true };
  }, []);

  return { deleteProduct, updateProduct };
}
