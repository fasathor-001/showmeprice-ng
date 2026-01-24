import React, { useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  Tv,
  Laptop,
  HeartPulse,
  Shirt,
  Home,
  Car,
  Gamepad2,
  Building2,
  Sprout,
  Baby,
  PawPrint,
  Hammer,
  Wrench,
  Tag,
  Search,
} from "lucide-react";
import { useHubs } from "../hooks/useCategories";
import { useRecentProducts } from "../hooks/useProducts";
import type { ProductWithRelations } from "../types";
import ProductDetail from "../components/product/ProductDetail";

type Hub = {
  id: number;
  name: string;
  icon_name?: string | null;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

function hashToHue(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 360;
  }
  return hash;
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function categoryVisuals(name: string) {
  const hue = hashToHue(name || "category");
  const { r, g, b } = hslToRgb(hue, 0.75, 0.48);
  const iconColor = `rgb(${r}, ${g}, ${b})`;
  const softBg = `rgba(${r}, ${g}, ${b}, 0.12)`;
  const glow = `rgba(${r}, ${g}, ${b}, 0.35)`;
  return { iconColor, softBg, glow };
}

function formatMoney(value: any) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
}

function getProductImages(product: any): string[] {
  const raw = Array.isArray(product?.images) ? product.images : [];
  const cleaned = raw.map((img: any) => String(img ?? "").trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  const fallback = String(product?.image_url ?? "").trim();
  return fallback ? [fallback] : [];
}

function verificationLabelFor(product: ProductWithRelations) {
  if ((product as any)?.seller_is_verified === true) return "Verified";
  const tier = String((product as any)?.seller_verification_tier ?? "").toLowerCase();
  if (tier === "verified") return "Verified";
  return "";
}

function businessNameFor(product: ProductWithRelations) {
  const b = (product as any)?.businesses ?? {};
  const raw =
    String((product as any)?.seller_business_name ?? "").trim() ||
    String(b.business_name ?? "").trim() ||
    String(b.name ?? "").trim() ||
    String((product as any)?.business_name ?? "").trim();
  return raw || "Seller";
}

export default function MarketplacePage() {
  const { hubs, loading: hubsLoading } = useHubs();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { products, loading: productsLoading, error } = useRecentProducts(24, refreshNonce);

  const [selectedProduct, setSelectedProduct] = useState<ProductWithRelations | null>(null);
  const [selectedHubId, setSelectedHubId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const hubsList = useMemo(() => hubs as Hub[], [hubs]);
  const selectedHub = useMemo(
    () => hubsList.find((hub) => hub.id === selectedHubId) || null,
    [hubsList, selectedHubId]
  );

  const filteredProducts = useMemo(() => {
    if (!selectedHubId) return products;
    const hubName = String(selectedHub?.name ?? "").trim().toLowerCase();
    return products.filter((product) => {
      const categoryId = Number((product as any)?.category_id ?? 0);
      const categoryName = String((product as any)?.categories?.name ?? "").trim().toLowerCase();
      return categoryId === selectedHubId || (hubName && categoryName === hubName);
    });
  }, [products, selectedHubId, selectedHub]);

  const searchedProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredProducts;
    return filteredProducts.filter((product) => {
      const title = String((product as any)?.title ?? "").toLowerCase();
      const city = String((product as any)?.city ?? "").toLowerCase();
      return title.includes(q) || city.includes(q);
    });
  }, [filteredProducts, query]);

  const recentProducts = useMemo(() => searchedProducts.slice(0, 8), [searchedProducts]);
  const newProducts = useMemo(() => searchedProducts.slice(8, 16), [searchedProducts]);

  const openProduct = (product: ProductWithRelations) => setSelectedProduct(product);
  const closeProduct = () => setSelectedProduct(null);

  useEffect(() => {
    const onRefresh = () => setRefreshNonce((n) => n + 1);
    window.addEventListener("smp:products:refresh", onRefresh as EventListener);
    return () => {
      window.removeEventListener("smp:products:refresh", onRefresh as EventListener);
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Marketplace</h1>
          <div className="relative w-48 sm:w-56 md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
          {hubsLoading ? (
            <span className="text-xs text-slate-500">Loading categories...</span>
          ) : null}
        </div>

        <div className="relative overflow-hidden">
          <div className="flex items-center gap-3 marquee-track">
            {[...hubsList, ...hubsList].map((hub, idx) => {
              const Icon = ICONS[String(hub.icon_name ?? "").toLowerCase()] || Tag;
              const visuals = categoryVisuals(hub.name);
              const isActive = selectedHubId === hub.id;
              return (
                <button
                  key={`${hub.id}-${idx}`}
                  type="button"
                  onClick={() => setSelectedHubId((prev) => (prev === hub.id ? null : hub.id))}
                  className="group rounded-2xl border border-slate-200 bg-white px-3 py-2 flex flex-col items-center gap-2 text-center transition hover:-translate-y-0.5 hover:shadow-[0_0_18px_var(--glow)] whitespace-nowrap"
                  style={{ ["--glow" as any]: visuals.glow }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: visuals.softBg, color: visuals.iconColor }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className={`text-xs font-bold ${isActive ? "text-slate-900" : "text-slate-800"}`}>
                    {hub.name}
                  </div>
                </button>
              );
            })}
          </div>
          <style>{`
            .marquee-track {
              width: max-content;
              animation: marketplace-marquee 60s linear infinite;
            }
            @keyframes marketplace-marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
        {selectedHub ? (
          <div className="text-sm text-slate-600">
            Showing: <span className="font-bold text-slate-900">{selectedHub.name}</span>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-black text-slate-900">Recently Added</h2>
          {productsLoading ? <span className="text-xs text-slate-500">Loading...</span> : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        ) : recentProducts.length === 0 && !productsLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No products yet. Check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentProducts.map((product) => {
              const images = getProductImages(product);
              const img = images[0] ?? "";
              const location =
                (product as any)?.states?.name && (product as any)?.city
                  ? `${(product as any)?.city}, ${(product as any)?.states?.name}`
                  : (product as any)?.city || (product as any)?.states?.name || "Nigeria";
              const verificationLabel = verificationLabelFor(product);
              const sellerName = businessNameFor(product);

              return (
                <button
                  key={(product as any).id}
                  type="button"
                  onClick={() => openProduct(product)}
                  className="text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition"
                >
                  <div className="aspect-[4/3] bg-slate-100 relative">
                    {img ? (
                      <img src={img} alt={(product as any).title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                        No image
                      </div>
                    )}
                    {images.length > 1 ? (
                      <>
                        <div className="absolute top-2 right-2 text-[10px] font-bold text-white bg-slate-900/70 px-2 py-0.5 rounded-full">
                          1/{images.length}
                        </div>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1">
                          {Array.from({ length: Math.min(images.length, 3) }).map((_, idx) => (
                            <span
                              key={`recent-dot-${(product as any).id}-${idx}`}
                              className={`h-1.5 w-1.5 rounded-full ${
                                idx === 0 ? "bg-white" : "bg-white/60"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-bold text-slate-900 line-clamp-1">
                      {(product as any).title}
                    </div>
                    <div className="text-sm font-black text-brand mt-1">{formatMoney((product as any).price)}</div>
                    <div className="text-xs text-slate-500 mt-1">{location}</div>
                    <div className="text-xs text-slate-500 mt-1">{sellerName}</div>
                    <div className="text-xs text-slate-500 mt-1">{verificationLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-black text-slate-900">New Products</h2>
          {productsLoading ? <span className="text-xs text-slate-500">Loading...</span> : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        ) : newProducts.length === 0 && !productsLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            New products will appear here.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {newProducts.map((product) => {
              const images = getProductImages(product);
              const img = images[0] ?? "";
              const location =
                (product as any)?.states?.name && (product as any)?.city
                  ? `${(product as any)?.city}, ${(product as any)?.states?.name}`
                  : (product as any)?.city || (product as any)?.states?.name || "Nigeria";
              const verificationLabel = verificationLabelFor(product);
              const sellerName = businessNameFor(product);

              return (
                <button
                  key={(product as any).id}
                  type="button"
                  onClick={() => openProduct(product)}
                  className="text-left rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition"
                >
                  <div className="aspect-[4/3] bg-slate-100 relative">
                    {img ? (
                      <img src={img} alt={(product as any).title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                        No image
                      </div>
                    )}
                    {images.length > 1 ? (
                      <>
                        <div className="absolute top-2 right-2 text-[10px] font-bold text-white bg-slate-900/70 px-2 py-0.5 rounded-full">
                          1/{images.length}
                        </div>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1">
                          {Array.from({ length: Math.min(images.length, 3) }).map((_, idx) => (
                            <span
                              key={`new-dot-${(product as any).id}-${idx}`}
                              className={`h-1.5 w-1.5 rounded-full ${
                                idx === 0 ? "bg-white" : "bg-white/60"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-bold text-slate-900 line-clamp-1">
                      {(product as any).title}
                    </div>
                    <div className="text-sm font-black text-brand mt-1">{formatMoney((product as any).price)}</div>
                    <div className="text-xs text-slate-500 mt-1">{location}</div>
                    <div className="text-xs text-slate-500 mt-1">{sellerName}</div>
                    <div className="text-xs text-slate-500 mt-1">{verificationLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedProduct ? (
        <div
          id="marketplaceProductModal"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeProduct();
          }}
          aria-hidden={!selectedProduct}
        >
          <div className="w-full max-w-6xl">
            <ProductDetail product={selectedProduct as any} onClose={closeProduct} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
