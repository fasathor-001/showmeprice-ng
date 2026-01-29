import React, { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  Plus,
  Tag,
  Trash2,
  Pencil,
  Search,
  X,
  Save,
} from "lucide-react";
import { useCurrentBusiness } from "../../hooks/useSeller";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../hooks/useProfile";
import { useFF } from "../../hooks/useFF";
import { useEscrow } from "../../hooks/useEscrow";
import { useSellerProducts, useProductManagement } from "../../hooks/useProducts";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useStates } from "../../hooks/useStates";
import ProductCategorySelector from "./ProductCategorySelector";

interface SellerDashboardProps {
  onNavigateHome: () => void;
  onPostProduct: () => void;
}

type ListingKindFilter = "all" | "products" | "deals";

function formatMoneyNGN(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "₦—";
  try {
    return n.toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
  } catch {
    return `₦${Math.round(n).toLocaleString()}`;
  }
}

function getFirstImage(listing: any): string | null {
  const imgs = listing?.images;
  if (Array.isArray(imgs) && imgs.length > 0 && typeof imgs[0] === "string") return imgs[0];
  if (typeof listing?.image === "string") return listing.image;
  if (typeof listing?.image_url === "string") return listing.image_url;
  return null;
}

export default function SellerDashboard({ onNavigateHome, onPostProduct }: SellerDashboardProps) {
  const { user } = useAuth();
  const { profile } = useProfile() as any;
  const { business, loading: businessLoading } = useCurrentBusiness();
  const { products, loading: productsLoading, refresh } = useSellerProducts((business as any)?.id);
  const { deleteProduct, updateProduct } = useProductManagement();
  const { getMyEscrowTransactions, markAsShipped } = useEscrow();
  const FF = useFF();

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<ListingKindFilter>("all");

  // Deals flags (gated HARD)
  const ff = useFeatureFlags() as any;
  const flagsLoading = !!ff?.loading;
  const flagList = (ff?.flags ?? ff?.flagList ?? []) as any[];
  const isEnabled =
    ff?.isEnabled ??
    ((key: string) => {
      const row = flagList.find((f: any) => f?.key === key);
      return !!row?.enabled;
    });

  // ✅ If deals_enabled is OFF, seller must NOT see deals features at all.
  const dealsLive = !flagsLoading && !!isEnabled?.("deals_enabled");
  const dealsPostingOpen = dealsLive && !flagsLoading && !!isEnabled?.("deals_posting_enabled");
  const canPostDeal = dealsLive && dealsPostingOpen;

  const membership = String((business as any)?.seller_membership_tier ?? (profile as any)?.membership_tier ?? "free")
    .toLowerCase();
  const escrowEnabled = !!FF?.isEnabled?.("escrow_enabled", false);
  const escrowEligible = escrowEnabled && (membership === "premium" || membership === "institution");
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowLoading, setEscrowLoading] = useState(false);

  const seasonLabel = useMemo(() => {
    const desc =
      (flagList.find((f: any) => f?.key === "deals_posting_enabled")?.description || "").trim();
    return desc || "Seasonal Deals";
  }, [flagList]);

  // ✅ If deals are OFF, force filter away from "deals"
  useEffect(() => {
    if (!dealsLive && kindFilter === "deals") setKindFilter("all");
  }, [dealsLive, kindFilter]);

  // Edit modal state
  const [editing, setEditing] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState<any>({});
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const statesHook = useStates() as any;
  const statesLoading = !!statesHook?.loading;
  const states = (statesHook?.states ?? statesHook?.data ?? []) as any[];

  useEffect(() => {
    refresh?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!escrowEligible || !user?.id) {
        if (alive) setEscrowOrders([]);
        return;
      }
      setEscrowLoading(true);
      try {
        const rows = await getMyEscrowTransactions();
        if (!alive) return;
        const mine = (rows || []).filter((r: any) => String(r?.seller_id ?? "") === String(user.id));
        setEscrowOrders(mine);
      } catch {
        if (alive) setEscrowOrders([]);
      } finally {
        if (alive) setEscrowLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [escrowEligible, getMyEscrowTransactions, user?.id]);

  const openPostAd = () => {
    try {
      delete (window as any).__smp_post_kind;
    } catch {
      // intentionally empty
    }
    onPostProduct();
  };

  const openPostDeal = () => {
    // HARD GATE: if deals are OFF or season is closed, do nothing.
    if (!dealsLive || !canPostDeal) return;
    (window as any).__smp_post_kind = "deal";
    onPostProduct();
  };

  const openEdit = (listing: any) => {
    setEditing(listing);
    setEditCategoryId(null);
    setEditDraft({
      title: listing?.title ?? "",
      price: listing?.price ?? "",
      description: listing?.description ?? "",
      condition: listing?.condition ?? "used",
      state_id: listing?.state_id ? String(listing.state_id) : "",
      city: listing?.city ?? "",
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditDraft({});
    setEditCategoryId(null);
    setSaving(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (products || [])
      // ✅ If deals are OFF, strip deal listings from seller view
      .filter((p: any) => (dealsLive ? true : !p?.is_deal))
      .filter((p: any) => {
        if (kindFilter === "products") return !p?.is_deal;
        if (kindFilter === "deals") return dealsLive ? !!p?.is_deal : false;
        return true;
      })
      .filter((p: any) => {
        if (!q) return true;
        const hay = `${p?.title ?? ""} ${p?.description ?? ""} ${p?.deal_season ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [products, query, kindFilter, dealsLive]);

  const handleDelete = async (id: any) => {
    if (!id) return;
    const ok = window.confirm("Delete this listing? This cannot be undone.");
    if (!ok) return;

    const res = await deleteProduct(id);
    if (res?.error) {
      alert(res.error);
      return;
    }
    await refresh?.();
  };

  const handleSaveEdit = async () => {
    if (!editing?.id) return;

    const title = String(editDraft.title ?? "").trim();
    const description = String(editDraft.description ?? "").trim();
    const priceNum = Number(String(editDraft.price ?? "").replace(/,/g, "").trim());
    const stateId = editDraft.state_id ? parseInt(String(editDraft.state_id), 10) : null;

    if (!title || title.length < 4) {
      alert("Title is required (min 4 characters).");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      alert("Enter a valid price.");
      return;
    }
    if (!description || description.length < 10) {
      alert("Description is required (min 10 characters).");
      return;
    }

    setSaving(true);

    const patch: any = {
      title,
      price: priceNum,
      description,
      condition: editDraft.condition,
      state_id: stateId,
      city: String(editDraft.city ?? "").trim() || null,
    };

    // If user picked a new category in modal, apply it
    if (editCategoryId) patch.category_id = editCategoryId;

    const res = await updateProduct(editing.id, patch);
    setSaving(false);

    if (res?.error) {
      alert(res.error);
      return;
    }

    await refresh?.();
    closeEdit();
  };

  if (businessLoading) {
    return (
      <div className="p-8">
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <CircleAlert className="w-7 h-7 text-slate-500" />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-900">Seller profile missing</h2>
          <p className="mt-2 text-slate-600">Create a seller profile before managing listings.</p>
          <button
            onClick={onNavigateHome}
            className="mt-5 inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Shop Listing</h1>
            <p className="text-slate-600 mt-1">
              Manage your listings.
            </p>

            {/* ✅ If deals are OFF, show message instead of deal tooling */}
            {!flagsLoading && !dealsLive ? (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black">
                No Deals currently
              </div>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={openPostAd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Post Product
            </button>

            {/* ✅ HARD GATE: hide Post Deal entirely when deals are OFF */}
            {dealsLive ? (
              <button
                onClick={openPostDeal}
                disabled={!canPostDeal}
                title={!canPostDeal ? "Deal posting is closed by admin" : ""}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Tag className="w-4 h-4 text-teal-700" />
                Post Deal
                <span className="text-xs text-slate-500 font-semibold">
                  {canPostDeal ? `(${seasonLabel})` : "(closed)"}
                </span>
              </button>
            ) : null}

            <button
              onClick={onNavigateHome}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-semibold"
            >
              Back
            </button>
          </div>
        </div>

        {/* Escrow Orders */}
        {escrowEligible ? (
          <div className="p-5 sm:p-6 border-t border-slate-100">
            <div className="text-sm font-black text-slate-700 mb-3">Escrow Orders</div>
            {escrowLoading ? (
              <div className="text-sm text-slate-600">Loading escrow orders...</div>
            ) : escrowOrders.length === 0 ? (
              <div className="text-sm text-slate-600">No escrow orders yet.</div>
            ) : (
              <div className="grid gap-3">
                {escrowOrders.map((o) => {
                  const status = String(o?.status ?? "");
                  return (
                    <div key={o.id} className="rounded-xl border border-slate-200 p-4 bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-slate-500">Escrow Order</div>
                          <div className="text-sm font-semibold text-slate-800">Status: {status || "unknown"}</div>
                          <div className="text-xs text-slate-600 mt-1">Funds held in escrow — ship to proceed.</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const ref = window.prompt("Shipment reference (optional):", "");
                            await markAsShipped(String(o.id), ref || undefined);
                            const rows = await getMyEscrowTransactions();
                            const mine = (rows || []).filter((r: any) => String(r?.seller_id ?? "") === String(user?.id ?? ""));
                            setEscrowOrders(mine);
                          }}
                          disabled={status !== "escrow_active" && status !== "awaiting_shipment" && status !== "payment_received"}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                            status !== "escrow_active" && status !== "awaiting_shipment" && status !== "payment_received"
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          Mark Shipped
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* Toolbar */}
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your listings..."
              className="w-full border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setKindFilter("all")}
              className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                kindFilter === "all" ? "border-teal-600 text-teal-700 bg-teal-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setKindFilter("products")}
              className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                kindFilter === "products"
                  ? "border-teal-600 text-teal-700 bg-teal-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              Products
            </button>

            {/* ✅ HARD GATE: hide Deals filter entirely when deals are OFF */}
            {dealsLive ? (
              <button
                onClick={() => setKindFilter("deals")}
                className={`px-3 py-2 rounded-xl border text-sm font-semibold transition ${
                  kindFilter === "deals"
                    ? "border-teal-600 text-teal-700 bg-teal-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                Deals
              </button>
            ) : null}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton h-56 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="mx-auto w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4">
                <CircleAlert className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-slate-800">No listings found</h3>
              <p className="text-slate-600 mt-1 mb-6">
                {query.trim() ? "Try a different search." : "Post your first product to start selling faster."}
              </p>
              <button
                onClick={openPostAd}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" /> Post Product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p: any) => {
                const img = getFirstImage(p);
                return (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition"
                  >
                    <div className="h-40 bg-slate-100 relative">
                      {img ? (
                        <img src={img} alt={p?.title ?? "Listing"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-semibold">
                          No image
                        </div>
                      )}

                      {/* ✅ Only show deal badge if deals are LIVE */}
                      {dealsLive && p?.is_deal ? (
                        <div className="absolute top-3 left-3 bg-teal-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                          Deal
                        </div>
                      ) : null}
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-slate-900 truncate">
                            {p?.title ?? "Untitled"}
                          </div>
                          <div className="text-sm text-slate-600 mt-1">
                            {formatMoneyNGN(p?.price)}

                            {/* ✅ Only show season chip if deals are LIVE */}
                            {dealsLive && p?.is_deal && p?.deal_season ? (
                              <span className="ml-2 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
                                {String(p.deal_season)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                            title="Edit listing"
                          >
                            <Pencil className="w-4 h-4 text-slate-700" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-2 rounded-xl border border-slate-200 hover:bg-rose-50 hover:border-rose-200 transition"
                            title="Delete listing"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 mt-3 overflow-hidden">
                        {p?.description ?? "No description"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editing ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-500">Edit Listing</div>
                <div className="text-lg font-black text-slate-900">{editing?.title ?? "Listing"}</div>
              </div>
              <button
                onClick={closeEdit}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Title</label>
                  <input
                    value={editDraft.title}
                    onChange={(e) => setEditDraft((p: any) => ({ ...p, title: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Price (₦)</label>
                  <input
                    value={editDraft.price}
                    onChange={(e) => setEditDraft((p: any) => ({ ...p, price: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">Description</label>
                <textarea
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((p: any) => ({ ...p, description: e.target.value }))}
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">Condition</label>
                  <select
                    value={editDraft.condition}
                    onChange={(e) => setEditDraft((p: any) => ({ ...p, condition: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                  >
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 block mb-2">State</label>
                  <select
                    value={editDraft.state_id}
                    onChange={(e) => setEditDraft((p: any) => ({ ...p, state_id: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                    disabled={statesLoading}
                  >
                    <option value="">{statesLoading ? "Loading states..." : "Select a state"}</option>
                    {states.map((s: any) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">
                  City / Area <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  value={editDraft.city}
                  onChange={(e) => setEditDraft((p: any) => ({ ...p, city: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">
                  Change Category <span className="text-slate-400">(optional)</span>
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <ProductCategorySelector onCategorySelect={(id) => setEditCategoryId(id)} />
                  <div className="text-xs text-slate-500 mt-2">
                    If you don’t select a new subcategory, your current category remains unchanged.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={closeEdit}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition font-semibold"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Save className="w-4 h-4" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
