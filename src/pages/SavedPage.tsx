import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Loader2, AlertTriangle, RefreshCw, Search, Trash2, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ProductRow = {
  id: string;
  title: string;
  price: number;
  images: string[] | null;
  city: string | null;
  state_id: number | null;
  created_at: string | null;
};

type Item = {
  id: string;
  created_at: string;
  product: ProductRow;
};

function formatMoney(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-NG");
}

function pickImage(images: any): string | null {
  if (!Array.isArray(images)) return null;
  const first = String(images[0] ?? "").trim();
  if (!first) return null;
  return first;
}

export default function SavedPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);

    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("product_saves")
        .select("id,created_at,product:products(id,title,price,images,city,state_id,created_at)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const rows = (data ?? []) as Array<{ id: string; created_at: string; product: ProductRow | ProductRow[] | null }>;
      const merged = rows
        .map((r) => ({
          id: r.id,
          created_at: r.created_at,
          product: Array.isArray(r.product) ? r.product[0] ?? null : r.product,
        }))
        .filter((r) => !!r.product) as Array<{ id: string; created_at: string; product: ProductRow }>;
      setItems(merged);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Failed to load saved items.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => {
      load();
    };
    window.addEventListener("smp:saved:refresh", onRefresh);
    return () => {
      window.removeEventListener("smp:saved:refresh", onRefresh);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const title = String(it.product.title ?? "").toLowerCase();
      const city = String(it.product.city ?? "").toLowerCase();
      return title.includes(q) || city.includes(q);
    });
  }, [items, query]);

  const openProduct = (productId: string) => {
    // HomePage already supports deep-link product modal (?product=...)
    nav(`/?product=${encodeURIComponent(productId)}`);
  };

  const removeSaved = async (savedId: string) => {
    if (!user?.id) return;
    setRemovingId(savedId);
    try {
      const { error } = await supabase.from("product_saves").delete().eq("id", savedId).eq("user_id", user.id);
      if (error) throw error;

      // optimistic update
      setItems((prev) => prev.filter((x) => x.id !== savedId));
    } catch (e: any) {
      alert(e?.message || "Failed to remove saved item.");
    } finally {
      setRemovingId(null);
    }
  };

  if (!user?.id) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-slate-700" />
          <h2 className="text-xl font-black text-slate-900">Saved Items</h2>
        </div>
        <p className="text-sm text-slate-600 mt-2">Please login to view saved items.</p>
        <button
          type="button"
          onClick={() => (window as any).openAuthModal?.()}
          className="mt-4 w-full py-3 rounded-xl font-black text-white bg-slate-900 hover:opacity-90"
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-slate-700" />
              <h2 className="text-xl font-black text-slate-900">Saved Items</h2>
            </div>
            <p className="text-sm text-slate-600 mt-1">Products you saved for later.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav("/")}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-black"
            >
              Home
            </button>
            <button
              type="button"
              onClick={load}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved items by title or city…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
              <div>
                <div className="font-black text-amber-900">Couldn’t load saved items</div>
                <div className="text-sm text-amber-800 mt-1">{error}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading saved items…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-slate-700">
            <div className="font-black">No saved items yet</div>
            <div className="text-sm text-slate-600 mt-1">Browse the marketplace and tap “Save” on products you like.</div>
            <button
              type="button"
              onClick={() => nav("/marketplace")}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white font-black hover:opacity-90"
            >
              Go to Marketplace
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((it) => {
              const p = it.product;
              const img = pickImage(p.images);
              return (
                <div key={it.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => openProduct(p.id)}
                    className="w-full text-left"
                    title="View product"
                  >
                    <div className="aspect-[4/3] bg-slate-100">
                      {img ? (
                        <img src={img} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                          No image
                        </div>
                      )}
                    </div>
                  </button>

                  <div className="p-4">
                    <div className="font-black text-slate-900 line-clamp-1">{p.title}</div>
                    <div className="text-sm text-slate-700 mt-1">₦{formatMoney(p.price)}</div>
                    <div className="text-xs text-slate-500 mt-1">{p.city ? p.city : "—"}</div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openProduct(p.id)}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-900 text-white font-black hover:opacity-90 inline-flex items-center justify-center gap-2"
                      >
                        View <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeSaved(it.id)}
                        disabled={removingId === it.id}
                        className={cn(
                          "px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-black inline-flex items-center gap-2",
                          removingId === it.id && "opacity-60 cursor-not-allowed"
                        )}
                        title="Remove from saved"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



