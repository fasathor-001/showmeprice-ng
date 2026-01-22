import React, { useCallback, useEffect, useMemo } from "react";
import { ArrowRight, BadgePercent, Info, RefreshCw, Slash } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useFeatureFlags } from "../contexts/FeatureFlagsContext";
import { useDealProducts } from "../hooks/useDealProducts";

const PAGE_SIZE = 24;

function navigateToPath(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
  window.scrollTo(0, 0);
}

function formatPrice(v: any) {
  if (v == null || v === "") return "Price";
  const n = Number(v);
  if (Number.isFinite(n)) return `${n.toLocaleString()}`;
  return `${String(v)}`;
}

function scrollToPostDeal() {
  const el = document.getElementById("post-deal");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function DealsPage() {
  const { user } = useAuth();
  const { profile } = useProfile();

  // Feature flags (context)
  const ff: any = useFeatureFlags();
  const isEnabled: ((k: string) => boolean) | undefined = ff?.isEnabled;
  const getFlag: ((k: string) => any) | undefined = ff?.getFlag;
  const flagList: any[] | undefined = ff?.flagList;
  const flagsLoading: boolean = !!ff?.loading;
  const flagsError: any = ff?.error;

  // Normalize user type + role
  const role = String((profile as any)?.role ?? "").toLowerCase();
  const userType =
    String((profile as any)?.user_type ?? (profile as any)?.userType ?? (user?.user_metadata as any)?.user_type ?? "buyer")
      .toLowerCase();

  const isAdmin = role === "admin" || userType === "admin";
  const isSeller = userType === "seller";

  const dealsOn = !flagsLoading && !flagsError && !!isEnabled?.("deals_enabled");
  const dealsPostingOn = !flagsLoading && !flagsError && !!isEnabled?.("deals_posting_enabled");

  // --- Deal Season label (KEEP your existing logic) ---
  const seasonLabel = useMemo(() => {
    const row: any =
      (typeof getFlag === "function" ? getFlag("deals_posting_enabled") : undefined) ??
      flagList?.find((f: any) => f?.key === "deals_posting_enabled") ??
      flagList?.find((f: any) => f?.flag_key === "deals_posting_enabled");

    const label = (row?.description || row?.label || "").trim();
    return label || "Seasonal Deals";
  }, [getFlag, flagList]);

  // --- Keep your seasonKeys variant matching (IMPORTANT) ---
  const seasonKeys = useMemo(() => {
    const label = (seasonLabel || "").trim();
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const seasonKey = slug ? `deals_season_${slug}` : "";
    return Array.from(new Set([label, seasonKey, "deals_posting_enabled"].filter(Boolean))) as string[];
  }, [seasonLabel]);

  /**
   *  Post-deal focus support
   * - sidebar can link to /deals#post-deal
   * - we also support event: window.dispatchEvent(new Event("smp:open-post-deal"))
   */
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#post-deal") {
        setTimeout(scrollToPostDeal, 50);
      }
    };

    const onOpen = () => {
      // ensure hash is set (nice UX + back button)
      try {
        if (window.location.hash !== "#post-deal") {
          window.history.replaceState({}, "", window.location.pathname + "#post-deal");
        }
      } catch {}
      setTimeout(scrollToPostDeal, 50);
    };

    window.addEventListener("hashchange", onHash);
    window.addEventListener("smp:open-post-deal", onOpen as any);

    // initial
    onHash();

    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("smp:open-post-deal", onOpen as any);
    };
  }, []);

  //  Buyer/Admin can browse deals. Sellers (non-admin) see the posting section.
  const canBrowse = !isSeller || isAdmin;

  // Buyers/admins only fetch the deal feed
  const enabled = !flagsLoading && !flagsError && dealsOn && dealsPostingOn && canBrowse;

  const { deals, fetching, error, hasMore, loadMore, refresh } = useDealProducts({
    enabled,
    seasonLabel,
    seasonKeys,
    pageSize: PAGE_SIZE,
  });

  const openDealProduct = useCallback((productId: string) => {
    navigateToPath(`/product/${productId}`);
  }, []);

  // ---------------- UI states ----------------
  if (flagsLoading) {
    return (
      <div className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="h-7 w-40 bg-slate-200 rounded mb-3 animate-pulse" />
            <div className="h-4 w-72 bg-slate-200 rounded mb-8 animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-slate-100 border border-slate-200 rounded-2xl h-56 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dealsOn) {
    return (
      <div className="bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white border border-slate-100 rounded-2xl p-10 shadow-sm text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Slash className="w-7 h-7 text-slate-500" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Deals Closed</h1>
            <p className="text-slate-600 mt-2">Deals are currently not available. Please check again later.</p>
          </div>
        </div>
      </div>
    );
  }

  //  Seller view (non-admin): show Post Deal focus section
  if (isSeller && !isAdmin) {
    return (
      <div className="bg-slate-50 pb-16">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 text-brand font-black text-xs tracking-widest">
                  SELLER  DEAL SEASON
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 mt-3">{seasonLabel}</h1>
                <p className="text-slate-600 mt-2">
                  Buyers will see deals when the admin opens a Deal Season. Use the section below to post your deal.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border ${
                      dealsPostingOn
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${dealsPostingOn ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {dealsPostingOn ? "Season Live" : "Season Closed"}
                  </span>
                </div>
              </div>

              <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100">
                <BadgePercent className="w-6 h-6 text-slate-600" />
              </div>
            </div>

            {/*  Focus target for sidebar: /deals#post-deal */}
            <div id="post-deal" className="mt-8 border border-slate-200 rounded-2xl p-5 md:p-6 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                  <Info className="w-5 h-5 text-slate-700" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-black text-slate-900">Post Deal</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {dealsPostingOn
                      ? "Deal Season is live. Post your discounted listing so buyers can find it on the Deals page."
                      : "Deal Season is currently closed. When admin opens it, you can post deals here."}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!dealsPostingOn}
                      onClick={() => {
                        // Optional: let your PostProductForm read this later if you want "deal mode"
                        try { sessionStorage.setItem("smp_post_mode", "deal"); } catch {}
                        (window as any).openPostItemModal?.();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-sm disabled:opacity-60"
                    >
                      <BadgePercent className="w-4 h-4" />
                      Post a Deal
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToPath("/dashboard")}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-black text-sm hover:bg-slate-50"
                    >
                      Go to Overview
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToPath("/my-shop")}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 font-black text-sm hover:bg-slate-50"
                    >
                      Seller Dashboard
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Small helper note */}
            <div className="mt-6 text-xs text-slate-500 font-semibold">
              Tip: your sidebar Post Deal should link to <span className="font-black">/deals#post-deal</span>.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Buyer/Admin view
  return (
    <div className="bg-slate-50 pb-16">
      {/* Professional header band */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 text-brand font-black text-xs tracking-widest">
                SHOWMEPRICE.NG DEALS
              </div>

              {/*  KEEP showing the deal season title */}
              <h1 className="text-2xl md:text-4xl font-black text-slate-900 mt-3">{seasonLabel}</h1>

              <p className="text-slate-600 mt-2">
                Limited-time discounts from sellers during Deal Seasons. Only deal listings show here.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border ${
                    dealsPostingOn
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dealsPostingOn ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {dealsPostingOn ? "Season Live" : "Season Closed"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-sm font-black"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* content card */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm">
          {flagsError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-semibold">
              Failed to load feature flags. Deals may not display correctly.
            </div>
          )}

          {!dealsPostingOn ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-3">
                <Info className="w-6 h-6 text-slate-600" />
              </div>
              <div className="text-xl font-black text-slate-900">Deal Season is Closed</div>
              <div className="text-slate-600 mt-1">Please check back when the next Deal Season starts.</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 font-semibold">
              {String(error?.message ?? error)}
            </div>
          ) : deals?.length ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {deals.map((p: any) => {
                  const img = Array.isArray(p.images) ? p.images[0] : p.images;
                  const bizName = (p.businesses?.business_name || p.business_name || "").toString().trim();
                  const catName = (p.subcategories?.name || p.category_name || "").toString().trim();
                  const stateName = (p.states?.name || p.state || "").toString().trim();

                  return (
                    <button
                      key={String(p.id)}
                      onClick={() => openDealProduct(String(p.id))}
                      className="text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition"
                    >
                      <div className="relative h-36 bg-slate-100 overflow-hidden">
                        {img ? (
                          <img src={img} alt={p.title || "Deal"} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                            No Image
                          </div>
                        )}

                        {/* deal pill */}
                        <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          DEAL
                        </span>

                        {/* season pill */}
                        <span className="absolute top-2 right-2 text-[10px] font-black px-2 py-1 rounded-full bg-white/90 text-slate-700 border border-slate-200">
                          {(p.deal_season || seasonLabel || "Deals").toString()}
                        </span>
                      </div>

                      <div className="p-3">
                        <div className="text-slate-900 font-black text-sm line-clamp-2">{p.title || "Deal Product"}</div>

                        <div className="text-xs text-slate-500 mt-1">
                          {catName ? `${catName}  ` : ""}
                          {bizName}
                          {stateName ? `  ${stateName}` : ""}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-slate-900 font-black text-sm">{formatPrice(p.price)}</div>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-center">
                {hasMore ? (
                  <button
                    onClick={loadMore}
                    disabled={fetching}
                    className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black text-sm disabled:opacity-60"
                  >
                    {fetching ? "Loading..." : "Load more"}
                  </button>
                ) : (
                  <div className="text-xs text-slate-500 font-semibold">No more deals</div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
              <div className="text-xl font-black text-slate-900">No deals found</div>
              <div className="text-slate-600 mt-1">When sellers post deals, they will appear here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
