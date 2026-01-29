// src/pages/HomePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useProfile } from "../hooks/useProfile";
import { useHubs } from "../hooks/useCategories";
import { useRecentProducts, useProductSearch, useSingleProduct } from "../hooks/useProducts";
import { useStates } from "../hooks/useStates";
import { ProductWithRelations } from "../types";
import DealsPostingCTA from "../components/deals/DealsPostingCTA";
import ProductDetail from "../components/product/ProductDetail";
import SellerDashboard from "../components/seller/SellerDashboard";
import PricingPage from "./PricingPage";
import ProfilePage from "./ProfilePage";
import InboxPage from "./InboxPage";
import InstitutionPage from "./InstitutionPage";
import AdminDashboard from "./AdminDashboard";
import SEO from "../components/common/SEO";
import { useFF } from "../hooks/useFF";
import {
  ArrowRight,
  BadgeCheck,
  Folder,
  Image as ImageIcon,
  MapPin,
  Search,
  SearchX,
  Store,

  // ✅ Popular category icons (dynamic)
  Smartphone,
  Laptop,
  Tv,
  Headphones,
  Camera,
  Gamepad2,
  Building2,
  Car,
  Bike,
  Home,
  Shirt,
  Watch,
  Gem,
  Sprout,
  PawPrint,
  Wrench,
  Hammer,
  Utensils,
  Briefcase,
  BookOpen,
  Baby,
  HeartPulse,
  ShoppingBag,
  Sofa,
} from "lucide-react";

type ViewMode =
  | "landing"
  | "search"
  | "dashboard"
  | "pricing"
  | "profile"
  | "inbox"
  | "institution"
  | "admin";

const VIEWMODE_KEY = "__smp_viewMode";
const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

// ✅ understands BOTH pathname (/admin) and hash (#admin)
function parseViewModeFromLocation(): ViewMode | null {
  try {
    const path = (window.location.pathname || "/").toLowerCase().trim();
    const rawHash = (window.location.hash || "").replace("#", "").trim().toLowerCase();

    // hash has priority
    if (rawHash) {
      if (rawHash === "admin") return "admin";
      if (rawHash === "dashboard") return "dashboard";
      if (rawHash === "pricing") return "pricing";
      if (rawHash === "profile") return "profile";
      if (rawHash === "inbox" || rawHash === "messages") return "inbox";
      if (rawHash === "institution") return "institution";
      if (rawHash === "search") return "search";
      if (rawHash === "landing" || rawHash === "home") return "landing";
    }

    // pathname support
    if (path === "/admin") return "admin";
    if (path === "/pricing") return "pricing";
    if (path === "/profile") return "profile";
    if (path === "/inbox" || path === "/messages") return "inbox";
    if (path === "/institution") return "institution";
    if (path === "/search") return "search";
    if (path === "/dashboard") return "dashboard";

    return "landing";
  } catch {
    return null;
  }
}

// ✅ keeps URL sane + informs App.tsx to update its `path` state via smp:navigate
function setUrlForMode(mode: ViewMode) {
  try {
    const hash =
      mode === "admin"
        ? "#admin"
        : mode === "dashboard"
        ? "#dashboard"
        : mode === "pricing"
        ? "#pricing"
        : mode === "profile"
        ? "#profile"
        : mode === "inbox"
        ? "#inbox"
        : mode === "institution"
        ? "#institution"
        : mode === "search"
        ? "#search"
        : "";

    const base = "/" + (window.location.search || "");
    const url = hash ? base + hash : base;

    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("smp:navigate"));
  } catch {}
}

function getProductIdFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("product");
  } catch {
    return null;
  }
}

type InboxInitialChat =
  | {
      partnerId: string;
      productId: string | null;
      partnerName?: string;
      message?: string;
    }
  | undefined;

function normalizeInboxDetail(detail: any): InboxInitialChat {
  if (!detail || typeof detail !== "object") return undefined;
  if (!detail.partnerId || typeof detail.partnerId !== "string") return undefined;

  return {
    partnerId: String(detail.partnerId),
    productId: detail.productId ? String(detail.productId) : null,
    partnerName: detail.partnerName ? String(detail.partnerName) : undefined,
    message: detail.message ? String(detail.message) : undefined,
  };
}

/** -----------------------------
 * ✅ Popular Categories: dynamic icon + dynamic color + glow on hover
 * ------------------------------*/
type LucideIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

function hashToHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return { R, G, B };
}

const ICON_BY_KEY: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  tv: Tv,
  laptop: Laptop,
  heart: HeartPulse,
  shirt: Shirt,
  home: Home,
  car: Car,
  "gamepad-2": Gamepad2,
  "building-2": Building2,
  sprout: Sprout,
  baby: Baby,
  "paw-print": PawPrint,
  hammer: Hammer,
  wrench: Wrench,
};

function pickCategoryIcon(name: string): LucideIcon {
  const n = (name || "").toLowerCase();

  // Electronics
  if (/(phone|mobile|smartphone|tablet)/.test(n)) return Smartphone;
  if (/(laptop|computer|pc|macbook)/.test(n)) return Laptop;
  if (/(tv|television|smart|oled|screen)/.test(n)) return Tv;
  if (/(audio|headphone|earphone|speaker)/.test(n)) return Headphones;
  if (/(camera|photography|drone)/.test(n)) return Camera;
  if (/(game|console|playstation|ps|xbox|nintendo)/.test(n)) return Gamepad2;

  // Auto / transport
  if (/(car|vehicle|auto|automobile|truck|bus)/.test(n)) return Car;
  if (/(bike|bicycle|motorcycle)/.test(n)) return Bike;

  // Home
  if (/(home|house|real estate|property|rent|apartment)/.test(n)) return Home;
  if (/(furniture|sofa|chair|table|interior)/.test(n)) return Sofa;

  // Fashion / accessories
  if (/(fashion|clothes|wear|shirt|shoe)/.test(n)) return Shirt;
  if (/(watch|clock)/.test(n)) return Watch;
  if (/(jewel|jewelry|gold|diamond|gem)/.test(n)) return Gem;

  // Tools / services
  if (/(repair|mechanic|tools|workshop)/.test(n)) return Wrench;
  if (/(construction|building|cement|block)/.test(n)) return Hammer;

  // Food / business / misc
  if (/(food|restaurant|kitchen|grocer)/.test(n)) return Utensils;
  if (/(job|business|office|corporate|services)/.test(n)) return Briefcase;
  if (/(book|education|school|course)/.test(n)) return BookOpen;
  if (/(baby|kids|children)/.test(n)) return Baby;
  if (/(health|medical|pharmacy|fitness)/.test(n)) return HeartPulse;
  if (/(shopping|market|store|bag)/.test(n)) return ShoppingBag;

  return Folder;
}

function categoryVisuals(name: string, iconName?: string | null) {
  const hue = hashToHue(name || "category");
  const { R, G, B } = hslToRgb(hue, 82, 45);

  const iconColor = `rgb(${R}, ${G}, ${B})`;
  const softBg = `rgba(${R}, ${G}, ${B}, 0.10)`;
  const glow = `rgba(${R}, ${G}, ${B}, 0.30)`;
  const key = String(iconName || "").toLowerCase();
  const Icon = ICON_BY_KEY[key] || pickCategoryIcon(name);

  return { iconColor, softBg, glow, Icon };
}

export default function HomePage() {
  // --- Hooks ---
  const { profile, loading: profileLoading } = useProfile();
  const FF: any = useFF();

  const signedIn = !!(profile as any)?.id;
  const role = (profile as any)?.role ?? null;
  const userType = (profile as any)?.user_type ?? null;

  const isAdmin = signedIn && role === "admin";

  // --- Product Modal ---
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRelations | null>(null);

  // Track ?product=ID for deep links + back/forward
  const [productIdFromUrl, setProductIdFromUrl] = useState<string | null>(() => getProductIdFromUrl());
  const { product: deepLinkedProduct } = useSingleProduct(productIdFromUrl);

  // Restore viewMode (pathname/hash first, then sessionStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const fromLoc = parseViewModeFromLocation();
    if (fromLoc) return fromLoc;

    try {
      const saved = sessionStorage.getItem(VIEWMODE_KEY) as ViewMode | null;
      return saved ?? "landing";
    } catch {
      return "landing";
    }
  });
  const [pricingContext, setPricingContext] = useState<{ reason?: string | null } | null>(null);

  // Persist viewMode + sync URL (and tell App.tsx)
  useEffect(() => {
    try {
      sessionStorage.setItem(VIEWMODE_KEY, viewMode);
    } catch {}
    setUrlForMode(viewMode);
  }, [viewMode]);

  // ✅ Follow URL changes
  useEffect(() => {
    const onChange = () => {
      const m = parseViewModeFromLocation();
      if (m) setViewMode((prev) => (prev === m ? prev : m));
      setProductIdFromUrl(getProductIdFromUrl());
    };

    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    window.addEventListener("smp:navigate", onChange as any);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("smp:navigate", onChange as any);
    };
  }, []);

  // Open modal when deep-linked product loads
  useEffect(() => {
    if (!productIdFromUrl) return;
    if (!deepLinkedProduct) return;
    setSelectedProduct(deepLinkedProduct as any);
    setIsProductOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdFromUrl, deepLinkedProduct]);

  const messagingEnabled = FF?.messaging !== false;
  const institutionEnabled = FF?.institution !== false;

  // Guard: feature flags prevent disabled views
  // ✅ Only block when the flag is explicitly false (don’t block while loading/undefined)
  useEffect(() => {
    if (viewMode === "inbox" && FF?.messaging === false) setViewMode("landing");
    if (viewMode === "institution" && FF?.institution === false) setViewMode("landing");
  }, [viewMode, FF?.messaging, FF?.institution]);

  // Validate admin after profile loads
  useEffect(() => {
    if (viewMode !== "admin") return;
    if (profileLoading) return;
    if (!isAdmin) setViewMode("landing");
  }, [viewMode, profileLoading, isAdmin]);

  // --- Inbox State ---
  const [inboxInitialChat, setInboxInitialChat] = useState<InboxInitialChat>(undefined);

  // --- Search Filter State ---
  const [priceInputs, setPriceInputs] = useState({ min: "", max: "" });

  // --- Data Hooks ---
  const { hubs, loading: hubsLoading } = useHubs();
  const { states, loading: statesLoading } = useStates();
  const { products: recentProducts, loading: recentLoading } = useRecentProducts();

  const {
    results: searchResults,
    loading: searchLoading,
    hasMore,
    params: searchParams,
    updateParams,
    triggerSearch,
    loadMore,
  } = useProductSearch();

  // ✅ SAFETY: avoid blank screen when params are briefly undefined
  const hubsSafe = Array.isArray(hubs) ? hubs : [];
  const statesSafe = Array.isArray(states) ? states : [];
  const recentSafe = Array.isArray(recentProducts) ? recentProducts : [];
  const resultsSafe = Array.isArray(searchResults) ? searchResults : [];

  const sp: any = searchParams ?? {};
  const hubIdsSafe: number[] = Array.isArray(sp.hubIds) ? sp.hubIds : [];
  const querySafe: string = typeof sp.query === "string" ? sp.query : "";
  const stateSafe: string = typeof sp.state === "string" ? sp.state : "";
  const sortSafe: string = typeof sp.sort === "string" ? sp.sort : "newest";

  // --- Event Listeners for Custom Navigation ---
  useEffect(() => {
    const handleDashboardNav = () => {
      setIsProductOpen(false);
      setViewMode("dashboard");
      window.scrollTo(0, 0);
    };
    const handlePricingNav = (e?: Event) => {
      const detail = (e as CustomEvent)?.detail ?? {};
      const reason = detail?.reason ? String(detail.reason) : "";
      setPricingContext(reason ? { reason } : null);
      setIsProductOpen(false);
      setViewMode("pricing");
      window.scrollTo(0, 0);
    };
    const handleProfileNav = () => {
      setIsProductOpen(false);
      setViewMode("profile");
      window.scrollTo(0, 0);
    };
    const handleInstitutionNav = () => {
      setIsProductOpen(false);
      setViewMode("institution");
      window.scrollTo(0, 0);
    };
    const handleAdminNav = () => {
      if (!isAdmin) {
        alert("Access denied: Admins only.");
        return;
      }
      setIsProductOpen(false);
      setViewMode("admin");
      window.scrollTo(0, 0);
    };

    const handleInboxNav = (e: Event) => {
      // If not signed in, bounce to login (don’t silently fail)
      if (!profileLoading && !signedIn) {
        try {
          window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login" } }));
        } catch {}
        setViewMode("landing");
        return;
      }

      setIsProductOpen(false);
      const detail = (e as CustomEvent)?.detail;
      setInboxInitialChat(normalizeInboxDetail(detail));
      setViewMode("inbox");
      window.scrollTo(0, 0);
    };

    window.addEventListener("smp:view-dashboard", handleDashboardNav);
    window.addEventListener("smp:view-pricing", handlePricingNav);
    window.addEventListener("smp:view-profile", handleProfileNav);
    window.addEventListener("smp:view-institution", handleInstitutionNav);
    window.addEventListener("smp:view-admin", handleAdminNav);
    window.addEventListener("smp:view-inbox", handleInboxNav);

    return () => {
      window.removeEventListener("smp:view-dashboard", handleDashboardNav);
      window.removeEventListener("smp:view-pricing", handlePricingNav);
      window.removeEventListener("smp:view-profile", handleProfileNav);
      window.removeEventListener("smp:view-institution", handleInstitutionNav);
      window.removeEventListener("smp:view-admin", handleAdminNav);
      window.removeEventListener("smp:view-inbox", handleInboxNav);
    };
  }, [isAdmin, profileLoading, signedIn]);

  // Product modal open/close
  const openProductModal = (product: ProductWithRelations) => {
    setSelectedProduct(product);
    setIsProductOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.set("product", String((product as any).id));
    window.history.pushState({}, "", url);

    setProductIdFromUrl(String((product as any).id));
    window.dispatchEvent(new Event("smp:navigate"));
  };

  const closeProductModal = () => {
    setIsProductOpen(false);
    setTimeout(() => setSelectedProduct(null), 300);

    const url = new URL(window.location.href);
    url.searchParams.delete("product");
    window.history.pushState({}, "", url);

    setProductIdFromUrl(null);
    window.dispatchEvent(new Event("smp:navigate"));
  };

  // Search actions
  const performHeroSearch = () => {
    setViewMode("search");
    triggerSearch();
    window.scrollTo(0, 0);
  };

  const handleHubClick = (hubId: number) => {
    updateParams({ hubIds: [hubId] } as any);
    setViewMode("search");
    triggerSearch();
    window.scrollTo(0, 0);
  };

  const applyPriceFilter = () => {
    updateParams({ minPrice: priceInputs.min, maxPrice: priceInputs.max } as any);
    triggerSearch();
  };

  const sortResults = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParams({ sort: e.target.value } as any);
    setTimeout(triggerSearch, 0);
  };

  const handleCategoryCheckbox = (e: React.ChangeEvent<HTMLInputElement>, hubId: number) => {
    const isChecked = e.target.checked;
    let newHubIds = [...hubIdsSafe];
    if (isChecked) {
      if (!newHubIds.includes(hubId)) newHubIds.push(hubId);
    } else {
      newHubIds = newHubIds.filter((id) => id !== hubId);
    }
    updateParams({ hubIds: newHubIds } as any);
    setTimeout(triggerSearch, 0);
  };

  const handleMainSearch = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSearch();
  };

  const handleViewAll = () => {
    updateParams({ query: "", hubIds: [], state: "" } as any);
    setViewMode("search");
    setTimeout(() => {
      triggerSearch();
      window.scrollTo(0, 0);
    }, 0);
  };

  // ✅ embossed fields (reduced height + no “lines” look)
  const embossedField =
    "bg-white/90 border border-transparent shadow-[inset_0_1px_2px_rgba(0,0,0,0.10)] shadow-sm rounded-xl px-4 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/25";

  const renderProductCard = (product: ProductWithRelations) => {
    const tier = (product as any)?.businesses?.verification_tier || "basic";
    const verificationStatus = String((product as any)?.businesses?.verification_status ?? "").toLowerCase();
    const isVerified =
      verificationStatus === "verified" ||
      verificationStatus === "approved" ||
      tier === "verified" ||
      tier === "premium";

    const hasDiscount =
      (product as any).original_price && (product as any).original_price > (product as any).price;

    const discountPercentage = hasDiscount
      ? Math.round(
          (((product as any).original_price - (product as any).price) / (product as any).original_price) * 100
        )
      : 0;

    const stateName = (product as any)?.states?.name ? String((product as any).states.name).trim() : "";
    const city = (product as any)?.city ? String((product as any).city).trim() : "";

    const businessName =
      (product as any)?.businesses?.business_name ||
      (product as any)?.business?.business_name ||
      (product as any)?.business_name ||
      "";

    const createdAtRaw = (product as any)?.created_at ?? (product as any)?.createdAt;
    const createdAtDate = createdAtRaw ? new Date(createdAtRaw) : null;
    const isNew48h =
      !!createdAtDate &&
      Number.isFinite(createdAtDate.getTime()) &&
      Date.now() - createdAtDate.getTime() <= NEW_WINDOW_MS;

    return (
      <div
        key={(product as any).id}
        onClick={() => openProductModal(product)}
        className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition cursor-pointer group flex flex-col h-full"
      >
        <div className="h-44 md:h-48 bg-slate-200 relative overflow-hidden flex-shrink-0">
          {(product as any).images && Array.isArray((product as any).images) && (product as any).images.length > 0 ? (
            <img
              src={(product as any).images[0]}
              alt={(product as any).title}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <ImageIcon className="w-8 h-8" />
            </div>
          )}

          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-slate-700 shadow-sm capitalize">
            {(product as any).condition}
          </div>

          {isNew48h ? (
            <div
              className={`absolute left-2 bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold shadow-sm ${
                hasDiscount ? "top-10" : "top-2"
              }`}
            >
              NEW
            </div>
          ) : null}

          {hasDiscount ? (
            <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">
              -{discountPercentage}%
            </div>
          ) : null}
        </div>

        <div className="p-4 flex flex-col flex-1">
          <div className="text-xs text-brand font-bold mb-1 uppercase tracking-wider truncate">
            {(product as any)?.categories?.name || "Item"}
          </div>

          <h3 className="font-bold text-slate-900 truncate mb-2 leading-tight">{(product as any).title}</h3>

          <div className="mb-3">
            <p className="text-brand font-black text-lg">₦{Number((product as any).price).toLocaleString()}</p>

            {hasDiscount ? (
              <p className="text-xs text-slate-400 line-through">
                ₦{Number((product as any).original_price).toLocaleString()}
              </p>
            ) : null}
          </div>

          {/* ✅ Bottom rows: Location + Verified (top), Seller (bottom) */}
          <div className="mt-auto pt-3 border-t border-slate-50 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-1 min-w-0">
                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 leading-tight">
                  <div className="truncate max-w-[160px] font-semibold text-slate-700">{stateName || "Location"}</div>
                  {city ? <div className="truncate max-w-[160px] text-slate-500">{city}</div> : null}
                </div>
              </div>
              {isVerified ? (
                <div className="flex items-center gap-1 text-emerald-600 text-[11px] font-bold">
                  <BadgeCheck className="w-3 h-3" />
                  Verified
                </div>
              ) : null}
            </div>

            <div className="flex items-start gap-1 min-w-0">
              <Store className="w-3 h-3 flex-shrink-0 mt-0.5 text-slate-400" />
              <div className="min-w-0 leading-tight">
                <div className="truncate max-w-[160px] font-semibold text-slate-700">{businessName || "Seller"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const popularHubs = useMemo(() => (hubsSafe || []).slice(0, 8), [hubsSafe]);

  return (
    <>
      {/* SEO */}
      {viewMode === "landing" && <SEO />}
      {viewMode === "search" && <SEO title={`Search Results: ${querySafe || "All Products"}`} />}

      {/* LANDING VIEW */}
      <div id="landingView" className={viewMode === "landing" ? "animate-view" : "hidden"}>
        <div className="bg-white pt-6 md:pt-10 pb-10 md:pb-14 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col gap-5 md:gap-6">
              {/* Search (top on mobile) */}
              <div className="order-1 md:order-2">
                <div className="bg-white rounded-2xl shadow-md p-2 max-w-4xl mx-auto">
                  {/* MOBILE */}
                  <div className="md:hidden flex flex-col gap-2">
                    <div className="flex gap-2">
                      <select
                        id="heroStateSelect_mobile"
                        className={embossedField + " w-1/2"}
                        value={stateSafe}
                        onChange={(e) => updateParams({ state: e.target.value } as any)}
                        disabled={statesLoading}
                      >
                        <option value="">All Nigeria</option>
                        {statesSafe.map((state: any) => (
                          <option key={state.id} value={state.name}>
                            {state.name}
                          </option>
                        ))}
                      </select>

                      <select
                        id="heroCategorySelect_mobile"
                        className={embossedField + " w-1/2"}
                        value={hubIdsSafe?.[0] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) updateParams({ hubIds: [] } as any);
                          else updateParams({ hubIds: [Number(v)] } as any);
                        }}
                        disabled={hubsLoading}
                      >
                        <option value="">All Categories</option>
                        {hubsSafe.map((hub: any) => (
                          <option key={hub.id} value={hub.id}>
                            {hub.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="heroSearchInput_mobile"
                        placeholder="What are you looking for?"
                        className={embossedField + " flex-1 min-w-0"}
                        value={querySafe}
                        onChange={(e) => updateParams({ query: e.target.value } as any)}
                      />
                      <button
                        onClick={performHeroSearch}
                        className="bg-brand text-white px-5 py-2 rounded-xl font-extrabold text-sm hover:opacity-90 whitespace-nowrap shadow-sm"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {/* DESKTOP/TABLET */}
                  <div className="hidden md:flex gap-2 items-center">
                    <select
                      id="heroStateSelect"
                      className={embossedField + " w-44"}
                      value={stateSafe}
                      onChange={(e) => updateParams({ state: e.target.value } as any)}
                      disabled={statesLoading}
                    >
                      <option value="">All Nigeria</option>
                      {statesSafe.map((state: any) => (
                        <option key={state.id} value={state.name}>
                          {state.name}
                        </option>
                      ))}
                    </select>

                    <select
                      id="heroCategorySelect"
                      className={embossedField + " w-56"}
                      value={hubIdsSafe?.[0] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) updateParams({ hubIds: [] } as any);
                        else updateParams({ hubIds: [Number(v)] } as any);
                      }}
                      disabled={hubsLoading}
                    >
                      <option value="">All Categories</option>
                      {hubsSafe.map((hub: any) => (
                        <option key={hub.id} value={hub.id}>
                          {hub.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      id="heroSearchInput"
                      placeholder="What are you looking for?"
                      className={embossedField + " flex-1 min-w-0"}
                      value={querySafe}
                      onChange={(e) => updateParams({ query: e.target.value } as any)}
                    />

                    <button
                      onClick={performHeroSearch}
                      className="bg-brand text-white px-6 py-2 rounded-xl font-extrabold text-sm hover:opacity-90 whitespace-nowrap shadow-sm"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>

              {/* Slogan + headline */}
              <div className="order-2 md:order-1 text-center">
                <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-brand/10 text-brand font-extrabold text-xs tracking-widest mb-3">
                  NG REAL-TIME PRICES ACROSS NIGERIA
                </div>

                <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-3">
                  Find <span className="text-brand">Real Prices</span> from <br className="hidden md:block" />
                  <span className="text-brand">Verified</span> Nigerian Sellers
                </h1>

                <p className="text-slate-600 text-base md:text-lg max-w-2xl mx-auto">
                  No more "DM for price". See actual prices, contact sellers directly, and shop with confidence.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* HIDE Popular Categories on MOBILE */}
        <div className="hidden md:block">
          <div className="max-w-6xl mx-auto px-4 pb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl md:text-2xl font-black text-slate-900">Browse Popular Categories</h2>
            </div>

            <div id="featuredCategories" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {!hubsLoading &&
                popularHubs.map((hub: any) => {
                  const v = categoryVisuals(hub.name, (hub as any)?.icon_name);
                  const HubIcon = v.Icon;

                  return (
                    <div
                      key={hub.id}
                      onClick={() => handleHubClick(hub.id)}
                      className="bg-white p-4 rounded-2xl shadow-sm cursor-pointer transition flex flex-col items-center text-center gap-3 group
                                 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[0_16px_40px_var(--glow)]"
                      style={{ ["--glow" as any]: v.glow }}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition group-hover:shadow-[0_0_18px_var(--glow)]"
                        style={{ ["--glow" as any]: v.glow }}
                        aria-hidden="true"
                      >
                        <HubIcon
                          className="w-7 h-7 transition group-hover:drop-shadow-[0_0_16px_var(--glow)]"
                          style={{ color: v.iconColor }}
                        />
                      </div>

                      <span className="font-bold text-xs text-slate-700 leading-tight group-hover:text-brand transition">
                        {hub.name}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Recent Listings */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl md:text-2xl font-black text-slate-900">Recently Added</h2>
            <button onClick={handleViewAll} className="text-brand font-bold text-sm hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div id="recentListings" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentLoading && (
              <div className="col-span-full flex justify-center py-10">
                <div className="skeleton w-32 h-32 rounded-lg"></div>
              </div>
            )}

            {!recentLoading && recentSafe.length === 0 && (
              <div className="col-span-full text-center py-10 text-slate-500">No products found. Be the first to sell!</div>
            )}

            {recentSafe.map(renderProductCard)}
          </div>
        </div>
      </div>

      {/* SEARCH VIEW */}
      <div id="searchView" className={viewMode === "search" ? "container mx-auto px-4 py-8 animate-view" : "hidden"}>
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-72">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-900">Filters</h3>
                <button onClick={() => setViewMode("landing")} className="text-xs text-brand font-bold hover:underline md:hidden">
                  Back
                </button>
              </div>

              <div className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter results..."
                    className={embossedField + " w-full pl-10"}
                    value={querySafe}
                    onChange={(e) => updateParams({ query: e.target.value } as any)}
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Location</h4>
                <select
                  id="filterState"
                  className={embossedField + " w-full"}
                  value={stateSafe}
                  onChange={(e) => {
                    updateParams({ state: e.target.value } as any);
                    setTimeout(triggerSearch, 0);
                  }}
                  disabled={statesLoading}
                >
                  <option value="">All States</option>
                  {statesSafe.map((state: any) => (
                    <option key={state.id} value={state.name}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Category</h4>
                <div id="categoryFilter" className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {!hubsLoading &&
                    hubsSafe.map((hub: any) => (
                      <label key={hub.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-xl">
                        <input
                          type="checkbox"
                          className="rounded text-brand focus:ring-brand w-4 h-4"
                          checked={hubIdsSafe.includes(hub.id)}
                          onChange={(e) => handleCategoryCheckbox(e, hub.id)}
                          value={hub.id}
                        />
                        <span className="text-sm text-slate-600">{hub.name}</span>
                      </label>
                    ))}
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Price Range</h4>
                <div className="flex gap-2">
                  <input
                    type="number"
                    id="minPrice"
                    placeholder="Min ₦"
                    className={embossedField + " w-1/2"}
                    value={priceInputs.min}
                    onChange={(e) => setPriceInputs((p) => ({ ...p, min: e.target.value }))}
                  />
                  <input
                    type="number"
                    id="maxPrice"
                    placeholder="Max ₦"
                    className={embossedField + " w-1/2"}
                    value={priceInputs.max}
                    onChange={(e) => setPriceInputs((p) => ({ ...p, max: e.target.value }))}
                  />
                </div>
                <button
                  onClick={applyPriceFilter}
                  className="w-full mt-3 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-bold"
                >
                  Apply Price
                </button>
              </div>

              <button onClick={() => setViewMode("landing")} className="w-full text-slate-400 text-sm hover:text-slate-600">
                Clear & Go Home
              </button>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="bg-white p-4 rounded-2xl shadow-sm mb-6">
              <form onSubmit={handleMainSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search products..."
                    className={embossedField + " w-full pl-10"}
                    value={querySafe}
                    onChange={(e) => updateParams({ query: e.target.value } as any)}
                  />
                  <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <button type="submit" className="bg-brand text-white px-6 py-2 rounded-xl font-extrabold text-sm hover:opacity-90 shadow-sm">
                  Search
                </button>
              </form>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h3 id="resultsTitle" className="text-xl font-black text-slate-900 truncate">
                {searchLoading ? "Searching..." : `Found ${resultsSafe.length} Results`}
              </h3>
              <div className="flex items-center gap-4">
                <select id="sortBy" className={embossedField} onChange={sortResults} value={sortSafe}>
                  <option value="newest">Newest First</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {searchLoading && resultsSafe.length === 0 ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
              </div>
            ) : (
              <div id="resultsArea" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {resultsSafe.map(renderProductCard)}
              </div>
            )}

            {!searchLoading && resultsSafe.length === 0 && (
              <div className="text-center py-16 bg-slate-50 rounded-2xl">
                <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <SearchX className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">No products found</h3>
                <p className="text-slate-500">Try adjusting your filters or search term.</p>
              </div>
            )}

            <div id="loadMoreContainer" className={`text-center mt-8 ${hasMore ? "" : "hidden"}`}>
              <button
                onClick={loadMore}
                disabled={searchLoading}
                className="bg-brand text-white px-6 py-3 rounded-xl font-extrabold hover:opacity-90 disabled:opacity-50 shadow-sm"
              >
                {searchLoading ? "Loading..." : "Load More Listings"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD VIEW */}
      {viewMode === "dashboard" && (
        <>
          <SellerDashboard
            onNavigateHome={() => setViewMode("landing")}
            onPostProduct={() => {
              try {
                delete (window as any).__smp_post_kind;
              } catch {}
              const fn = (window as any).openPostItemModal;
              if (typeof fn === "function") fn();
            }}
          />
          <div className="mt-4">{FF?.dealsPosting && <DealsPostingCTA />}</div>
        </>
      )}

      {/* PRICING VIEW */}
      {viewMode === "pricing" && (
        <PricingPage onNavigateHome={() => setViewMode("landing")} pricingReason={pricingContext?.reason ?? null} />
      )}

      {/* PROFILE VIEW */}
      {viewMode === "profile" && <ProfilePage onNavigateHome={() => setViewMode("landing")} />}

      {/* INSTITUTION VIEW */}
      {viewMode === "institution" && institutionEnabled && (
        <InstitutionPage onNavigateHome={() => setViewMode("landing")} />
      )}

      {/* ADMIN DASHBOARD VIEW */}
      {viewMode === "admin" && <AdminDashboard onNavigateHome={() => setViewMode("landing")} />}

      {/* INBOX VIEW */}
      {viewMode === "inbox" && messagingEnabled && <InboxPage initialChat={inboxInitialChat} />}

      {/* Product Detail Modal */}
      <div
        id="productModal"
        className={`fixed inset-0 z-[100] modal-overlay items-center justify-center p-4 ${isProductOpen ? "flex" : "hidden"}`}
        onClick={closeProductModal}
      >
        <div
          className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl animate-view max-h-[92vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {selectedProduct ? <ProductDetail product={selectedProduct} onClose={closeProductModal} /> : null}
        </div>
      </div>

      {/* Debug info (safe) */}
      {process.env.NODE_ENV !== "production" ? (
        <div className="hidden">
          {/* keep these referenced so TS doesn’t strip imports in dev */}
          {String(userType || "")}
        </div>
      ) : null}
    </>
  );
}
