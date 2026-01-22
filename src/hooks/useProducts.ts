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
  businesses:businesses!products_business_id_fkey(id, user_id, business_name, verification_tier, verification_status)
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
        setProducts(normalizeProducts((data ?? []) as any) as any);
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
        setProducts(normalizeProducts((data ?? []) as any) as any);
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

        setTotal(typeof count === "number" ? count : null);
        setHasMore(((p.page + 1) * p.pageSize) < (count ?? 0));

        setResults((prev) => {
          if (p.page === 0) return normalized as any;
          return [...(prev as any), ...(normalized as any)] as any;
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
        setProduct((row ? normalizeProduct(row) : null) as any);
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
