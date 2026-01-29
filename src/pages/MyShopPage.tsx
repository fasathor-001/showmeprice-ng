import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useFF } from "../hooks/useFF";
import { useEscrow } from "../hooks/useEscrow";
import { Plus, Eye, Pencil } from "lucide-react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

type BusinessRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  business_type: string | null;
  description?: string | null;
  verification_tier?: any;
  verification_status?: any;
  state_id: number | null;
  city: string | null;
  address: string | null;
  whatsapp_number: string | null;
  phone_number: string | null;
  links?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ListingRow = {
  id: string;
  title: string;
  price: any;
  city: string | null;
  created_at: string;
  images?: string[] | null;
  status?: string | null;
  condition?: any;
  view_count?: number | null;
  business_id?: string | null;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function formatNairaPrice(v: any) {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
      ? Number(String(v).replace(/,/g, ""))
      : 0;
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

function toPublicProductImageUrl(img: any) {
  const s = String(img ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.startsWith("products/") ? s.slice("products/".length) : s;
  try {
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    return data?.publicUrl || s;
  } catch {
    return s;
  }
}

function getProductImages(product: any): string[] {
  const raw = Array.isArray(product?.images) ? product.images : [];
  const cleaned = raw
    .map((img: any) => String(img ?? "").trim())
    .filter(Boolean)
    .map((img: string) => toPublicProductImageUrl(img));
  if (cleaned.length > 0) return cleaned;
  const fallback = toPublicProductImageUrl((product as any)?.image_url);
  return fallback ? [fallback] : [];
}

function toStoragePath(raw: string) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("products/")) return s.slice("products/".length);
  const marker = "/storage/v1/object/public/products/";
  const idx = s.indexOf(marker);
  if (idx >= 0) return s.slice(idx + marker.length);
  return s;
}

function getImageObjectPaths(product: any): string[] {
  const raw = Array.isArray(product?.images) ? product.images : [];
  return raw
    .map((img: any) => toStoragePath(img))
    .filter((p: string) => p);
}


function openCreateListingModal() {
  try {
    (window as any).__smp_edit_product = null;
    window.dispatchEvent(new CustomEvent("smp:post-product:open"));
  } catch {
    // intentionally empty
  }
  (window as any).openPostItemModal?.();
}

function openEditListingModal(product: any) {
  try {
    (window as any).__smp_edit_product = product;
    window.dispatchEvent(new CustomEvent("smp:post-product:open"));
  } catch {
    // intentionally empty
  }
  (window as any).openPostItemModal?.();
}

export default function MyShopPage() {
  const { user } = useAuth();
  const profileHook = useProfile() as any;
  const profile = profileHook?.profile ?? null;
  const profileLoading = !!profileHook?.loading;
  const profileReady = !!user && !profileLoading;

  const FF = useFF() as any;
  const { listSellerEscrows, markShipped } = useEscrow();

  const escrowEnabled = !!FF?.isEnabled?.("escrow_enabled", false);
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [shipmentRefs, setShipmentRefs] = useState<Record<string, string>>({});

  const [biz, setBiz] = useState<BusinessRow | null>(null);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [shopTab, setShopTab] = useState<"listings" | "escrow">("listings");

  const [refreshNonce, setRefreshNonce] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ListingRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const userType = useMemo(() => {
    const t = (profile as any)?.user_type ?? null;
    return String(t || "buyer").toLowerCase();
  }, [profile]);

  const isSeller = profileReady && userType === "seller";

  useEffect(() => {
    if (!escrowEnabled && shopTab === "escrow") setShopTab("listings");
  }, [escrowEnabled, shopTab]);

  const emitToast = (type: "success" | "error" | "info", message: string) => {
    window.dispatchEvent(new CustomEvent("smp:toast", { detail: { type, message } }));
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const paths = getImageObjectPaths(deleteTarget);
      if (paths.length) {
        try {
          await supabase.storage.from("products").remove(paths);
        } catch {
          // ignore storage delete errors
        }
      }

      const { error } = await supabase.from("products").delete().eq("id", deleteTarget.id);
      if (error) {
        emitToast("error", error.message || "Failed to delete product.");
        return;
      }

      emitToast("success", "? Product deleted.");
      window.dispatchEvent(
        new CustomEvent("smp:products:refresh", {
          detail: { businessId: String((biz as any)?.id ?? "") },
        })
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const toggleStatus = async (product: ListingRow) => {
    const current = String(product.status ?? "active");
    const next = current === "sold" ? "active" : "sold";
    const { data, error } = await supabase
      .from("products")
      .update({ status: next })
      .eq("id", product.id)
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      emitToast("error", error?.message || "Failed to update product status.");
      return;
    }

    emitToast("success", next === "sold" ? "? Marked as sold." : "? Marked as available.");
    window.dispatchEvent(
      new CustomEvent("smp:products:refresh", {
        detail: { businessId: String((biz as any)?.id ?? "") },
      })
    );
  };


  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!profileReady) return;

      if (!user?.id) {
        setBiz(null);
        setListings([]);
        setListingsLoading(false);
        return;
      }

      if (!isSeller) {
        setBiz(null);
        setListings([]);
        return;
      }

      try {
        const { data: bizRows, error: bizErr } = await supabase
          .from("businesses")
          .select(
            "id,user_id,business_name,business_type,description,verification_tier,verification_status,state_id,city,address,whatsapp_number,phone_number,links,created_at,updated_at"
          )
          .or(`owner_id.eq.${user.id},user_id.eq.${user.id}`)
          .limit(1);

        if (!alive) return;

        if (bizErr) {
          console.warn("MyShop: business fetch error", bizErr);
          setBiz(null);
        } else {
          setBiz((bizRows?.[0] as any) ?? null);
        }
        const b = (bizRows?.[0] as any) ?? null;
        if (!b?.id) {
          setListings([]);
          setListingsLoading(false);
          return;
        }

        setListingsLoading(true);
        const { data: prodRows, error: prodErr } = await supabase
          .from("products")
          .select("id,title,price,city,created_at,images,condition,view_count,business_id,status")
          .eq("business_id", b.id)
          .order("created_at", { ascending: false })
          .limit(60);

        if (!alive) return;

        if (prodErr) {
          console.warn("MyShop: listings fetch error", prodErr);
          setListings([]);
        } else {
          setListings(Array.isArray(prodRows) ? (prodRows as any) : []);
        }
        setListingsLoading(false);
      } catch (e) {
        console.warn("MyShop: load error", e);
        if (!alive) return;
        setBiz(null);
        setListings([]);
        setListingsLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [user?.id, isSeller, refreshNonce, profileReady]);

  useEffect(() => {
    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail;
      const incoming = String(detail?.businessId ?? "");
      const current = String((biz as any)?.id ?? "");
      if (incoming && current && incoming !== current) return;
      setRefreshNonce((n) => n + 1);
    };
    window.addEventListener("smp:products:refresh", onRefresh as EventListener);
    return () => {
      window.removeEventListener("smp:products:refresh", onRefresh as EventListener);
    };
  }, [(biz as any)?.id]);

  useEffect(() => {
    if (!isSeller) return;
    const bizId = (biz as any)?.id ? String((biz as any).id) : "";
    if (!bizId) return;

    const channel = supabase
      .channel(`smp_products_${bizId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "products", filter: `business_id=eq.${bizId}` },
        (payload: any) => {
          const row = payload?.new;
          if (!row?.id) return;
          setListings((prev) => {
            const exists = prev.some((p) => String((p as any).id) === String(row.id));
            if (exists) return prev;
            return [row as any, ...prev].slice(0, 60);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products", filter: `business_id=eq.${bizId}` },
        (payload: any) => {
          const row = payload?.new;
          if (!row?.id) return;
          setListings((prev) =>
            prev.map((p) => (String((p as any).id) === String(row.id) ? ({ ...(p as any), ...(row as any) } as any) : p))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "products", filter: `business_id=eq.${bizId}` },
        (payload: any) => {
          const oldRow = payload?.old;
          if (!oldRow?.id) return;
          setListings((prev) => prev.filter((p) => String((p as any).id) !== String(oldRow.id)));
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [isSeller, (biz as any)?.id]);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!escrowEnabled || !isSeller || !user?.id) {
        setEscrowOrders([]);
        setEscrowLoading(false);
        return;
      }

      setEscrowLoading(true);
      try {
        const rows = await listSellerEscrows();
        if (!alive) return;
        setEscrowOrders(Array.isArray(rows) ? rows : []);
      } catch {
        if (!alive) return;
        setEscrowOrders([]);
      } finally {
        if (alive) setEscrowLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [escrowEnabled, isSeller, listSellerEscrows, user?.id, refreshNonce]);

  if (user && !profileReady) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-slate-900 font-black text-lg">Loading your account...</div>
          <div className="text-slate-600 text-sm mt-1">Please wait a moment.</div>
        </div>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-slate-900 font-black text-lg">Sign in required</div>
          <div className="text-slate-600 text-sm mt-1">Please sign in to access seller tools.</div>
          <div className="mt-4">
            <button className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold" onClick={openCreateListingModal}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="p-6 text-slate-700">
        <div className="font-black text-slate-900 text-lg">Seller tools</div>
        <div className="text-sm text-slate-600 mt-1">
          My Shop is for sellers. Start selling with a verified shop profile.
        </div>

        <div className="mt-4 flex gap-2">
          <button className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold" onClick={() => nav("/dashboard")}
          >
            Back to Dashboard
          </button>
          <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold" onClick={() => nav("/seller/setup")}
          >
            Start selling
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-black text-slate-900">My Shop</div>
        <div className="inline-flex rounded-xl border bg-white overflow-hidden">
          <button
            type="button"
            className={cn(
              "px-4 py-2 text-sm font-black",
              shopTab === "listings" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"
            )}
            onClick={() => setShopTab("listings")}
          >
            Listings
          </button>
          {escrowEnabled ? (
            <button
              type="button"
              className={cn(
                "px-4 py-2 text-sm font-black border-l",
                shopTab === "escrow" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"
              )}
              onClick={() => setShopTab("escrow")}
            >
              Escrow Orders
            </button>
          ) : null}
        </div>
      </div>

      {shopTab === "listings" ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-black text-slate-900">Your Listings</div>
            <button className="text-emerald-700 font-black hover:underline" onClick={openCreateListingModal}
            >
              + Add listing
            </button>
          </div>

      <div className="rounded-2xl border bg-white p-4">
        {listingsLoading ? (
          <div className="text-sm text-slate-600">Loading listings...</div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border p-4">
            <div className="font-black text-slate-900">No listings yet</div>
            <div className="text-sm text-slate-600 mt-1">Post your first item to start getting buyers.</div>
            <button
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-black inline-flex items-center gap-2 hover:bg-emerald-700"
              onClick={openCreateListingModal}
            >
              <Plus className="w-4 h-4" />
              Post New Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {listings.map((p) => {
              const images = getProductImages(p);
              const thumb = images[0] ?? "";
              return (
                <div
                  key={p.id}
                  className="text-left rounded-2xl border p-4 hover:bg-slate-50"
                  onClick={() => nav("/?product=" + encodeURIComponent(p.id))}
                  title="Open product"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") nav("/?product=" + encodeURIComponent(p.id));
                  }}
                >
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl border bg-slate-50 overflow-hidden flex-shrink-0 relative">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={safeStr(p.title)}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-black">
                        SMP
                      </div>
                    )}
                    {images.length > 1 ? (
                      <>
                        <div className="absolute top-1 right-1 text-[10px] font-bold text-white bg-slate-900/70 px-1.5 py-0.5 rounded-full">
                          1/{images.length}
                        </div>
                        <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
                          {Array.from({ length: Math.min(images.length, 3) }).map((_, idx) => (
                            <span
                              key={`shop-dot-${p.id}-${idx}`}
                              className={`h-1.5 w-1.5 rounded-full ${idx === 0 ? "bg-white" : "bg-white/60"}`}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-900 line-clamp-1">{p.title}</div>
                    <div className="text-sm text-slate-700 mt-1">\u20A6{formatNairaPrice(p.price)}</div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {Number((p as any).view_count ?? 0).toLocaleString()} views
                      </span>
                      <span>-</span>
                      <span>{safeStr(p.city) ? safeStr(p.city) + " - " : ""}{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border bg-white text-slate-900 font-bold text-xs inline-flex items-center gap-1 hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditListingModal(p);
                    }}
                    aria-label="Edit product"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border bg-white text-slate-900 font-bold text-xs inline-flex items-center gap-1 hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus(p);
                    }}
                    aria-label={String(p.status ?? "active") === "sold" ? "Mark available" : "Mark sold"}
                  >
                    {String(p.status ?? "active") === "sold" ? "Mark Available" : "Mark Sold"}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-bold text-xs inline-flex items-center gap-1 hover:bg-rose-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    aria-label="Delete product"
                  >
                    Delete
                  </button>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-5 shadow-xl">
            <div className="text-lg font-black text-slate-900">Delete product?</div>
            <div className="mt-2 text-sm text-slate-600">
              This will permanently remove the listing from the marketplace.
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border bg-white text-slate-700 font-bold hover:bg-slate-50"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shopTab === "escrow" && escrowEnabled ? (
        <div className="mt-6 rounded-2xl border bg-white p-4">
          <div className="text-sm font-black text-slate-700 mb-3">Escrow Orders</div>
          {escrowLoading ? (
            <div className="text-sm text-slate-600">Loading escrow orders...</div>
          ) : escrowOrders.length === 0 ? (
            <div className="text-sm text-slate-600">No escrow activity yet.</div>
          ) : (
            <div className="grid gap-3">
              {escrowOrders.map((o: any) => {
                const status = String(o?.status ?? "");
                const canShip = status === "awaiting_shipment";
                return (
                  <div key={o.id} className="rounded-xl border p-3">
                    <div className="text-xs font-black text-slate-500">Escrow Order</div>
                    <div className="text-sm font-black text-slate-900 mt-1">{status || "unknown"}</div>
                    <div className="text-xs text-slate-600 mt-1">Funds held in escrow - ship to proceed.</div>

                    {canShip ? (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={shipmentRefs[o.id] ?? ""}
                          onChange={(e) => setShipmentRefs((prev) => ({ ...prev, [o.id]: e.target.value }))}
                          placeholder="Shipment reference (optional)"
                          className="flex-1 rounded-lg border px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await markShipped(String(o.id), shipmentRefs[o.id] || undefined);
                            const rows = await listSellerEscrows();
                            setEscrowOrders(Array.isArray(rows) ? rows : []);
                          }}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-black"
                        >
                          Mark Shipped
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
