import React, { useEffect, useMemo, useState } from "react";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useProfile } from "../../hooks/useProfile";

type IconName =
  | "home"
  | "categories"
  | "deals"
  | "delivery"
  | "messages"
  | "account"
  | "admin"
  | "shop";

type Item = {
  label: string;
  path: string;
  icon: IconName;
  /** feature_flags.key (e.g. deals_enabled) */
  flagKey?: string;
  sellerOnly?: boolean;
  adminOnly?: boolean;
};

function Icon({ name, active }: { name: IconName; active: boolean }) {
  const cls = `w-6 h-6 ${active ? "text-brand" : "text-slate-500"}`;

  switch (name) {
    case "home":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
        </svg>
      );

    case "categories":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h7v7H4z" />
          <path d="M13 4h7v7h-7z" />
          <path d="M4 13h7v7H4z" />
          <path d="M13 13h7v7h-7z" />
        </svg>
      );

    case "deals":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41 12 22l-8.59-8.59A2 2 0 0 1 3 12V4h8a2 2 0 0 1 1.41.59l8.18 8.18a2 2 0 0 1 0 2.64z" />
          <path d="M7 7h.01" />
        </svg>
      );

    case "delivery":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 17h4V5H2v12h3" />
          <path d="M14 9h4l4 4v4h-2" />
          <path d="M5 17a2 2 0 1 0 4 0" />
          <path d="M15 17a2 2 0 1 0 4 0" />
        </svg>
      );

    case "messages":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>
      );

    case "account":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );

    case "shop":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2l1.5 6h9L18 2" />
          <path d="M3 8h18l-2 14H5L3 8z" />
        </svg>
      );

    case "admin":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
        </svg>
      );

    default:
      return null;
  }
}

function navigateTo(path: string) {
  if (window.location.pathname === path) return;

  try {
    window.history.pushState({}, "", path);
    // App shells in this project often listen to this to re-render route.
    window.dispatchEvent(new Event("smp:navigate"));
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {
    window.location.href = path;
  }
}

export default function MobileBottomNav() {
  const { profile } = useProfile();
  const { isEnabled } = useFeatureFlags();

  const role = ((profile as any)?.role ?? "user") as string;
  const userType = ((profile as any)?.user_type ?? (profile as any)?.userType ?? "buyer") as string;

  const isAdmin = role === "admin";
  const isSeller = role === "seller" || userType === "seller";

  const [path, setPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);

    window.addEventListener("popstate", onChange);
    window.addEventListener("smp:navigate", onChange as any);

    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("smp:navigate", onChange as any);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const base: Item[] = [
      { label: "Home", path: "/", icon: "home" },
      { label: "Discover", path: "/marketplace", icon: "categories" },
    ];

    if (isSeller) {
      base.push({ label: "My Shop", path: "/my-shop", icon: "shop", sellerOnly: true });
    } else {
      // Buyers: Deals (gated)
      base.push({ label: "Deals", path: "/deals", icon: "deals", flagKey: "deals_enabled" });

      // ✅ Buyers: Delivery (gated) — THIS is what you want to show/hide from Admin Features
      base.push({ label: "Delivery", path: "/delivery", icon: "delivery", flagKey: "delivery_enabled" });
    }

    base.push(
      { label: "Messages", path: "/messages", icon: "messages" },
      { label: "Account", path: "/profile", icon: "account" }
    );

    if (isAdmin) {
      base.push({ label: "Admin", path: "/admin", icon: "admin", adminOnly: true });
    }

    // Visibility rules (sellerOnly/adminOnly + feature flags)
    return base.filter((it) => {
      if (it.sellerOnly && !isSeller) return false;
      if (it.adminOnly && !isAdmin) return false;
      if (it.flagKey) return !!isEnabled(it.flagKey as any);
      return true;
    });
  }, [isSeller, isAdmin, isEnabled]);

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t shadow-sm z-50">
      <div className="max-w-3xl mx-auto flex">
        {items.map((it) => {
          const active =
            path === it.path ||
            (it.path !== "/" && path.startsWith(it.path + "/")) ||
            (it.path === "/marketplace" && (path === "/marketplace" || path.startsWith("/marketplace/")));

          return (
            <button
              key={it.path}
              onClick={() => navigateTo(it.path)}
              className={`flex-1 py-2.5 flex flex-col items-center justify-center gap-1 ${
                active ? "text-brand" : "text-slate-600"
              }`}
            >
              <Icon name={it.icon} active={active} />
              <span className={`text-[11px] ${active ? "font-semibold" : "font-medium"}`}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
