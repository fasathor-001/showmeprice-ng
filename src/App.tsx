// src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { smpNavigate } from "./lib/smpNavigate";
import { useAuth } from "./hooks/useAuth";
import { useFF } from "./hooks/useFF";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";
import Layout from "./components/layout/Layout";
import AccountShell from "./components/layout/AccountShell";
import ErrorBoundary from "./components/system/ErrorBoundary";

import HomePage from "./pages/HomePage";
import MarketplacePage from "./pages/MarketplacePage";
import PricingPage from "./pages/PricingPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import DashboardPage from "./pages/DashboardPage";
import BuyerDashboardPage from "./pages/BuyerDashboardPage";
import MyShopPage from "./pages/MyShopPage";
import InboxPage from "./pages/InboxPage";
import SavedPage from "./pages/SavedPage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminFeaturesPage from "./pages/AdminFeaturesPage";
import AdminApprovalsPage from "./pages/admin/AdminApprovalsPage";
import AdminEscrowPage from "./pages/admin/AdminEscrowPage";
import DealsPage from "./pages/DealsPage";
import DeliveryPage from "./pages/DeliveryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ReportsPage from "./pages/ReportsPage";
import InstitutionPage from "./pages/InstitutionPage";
import SellerProfileSetupPage from "./pages/SellerProfileSetupPage";
import VerificationPage from "./pages/account/VerificationPage";

type HomeMode = "home" | "marketplace" | "product";
type InboxInit = { chatId?: string; userId?: string; productId?: string } | null;

function useCurrentPath() {
  const [path, setPath] = useState<string>(() => window.location.pathname || "/");
  useEffect(() => {
    const onChange = () => setPath(window.location.pathname || "/");
    const onNavigate = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as { to?: string } | undefined;
      setPath(detail?.to ?? (window.location.pathname || "/"));
    };
    window.addEventListener("popstate", onChange);
    window.addEventListener("smp:navigate", onNavigate as any);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("smp:navigate", onNavigate as any);
    };
  }, []);
  return path;
}

function parseHomeModeFromUrl(): { mode: HomeMode; productId: string | null } {
  const u = new URL(window.location.href);
  const m = (u.searchParams.get("mode") || "").toLowerCase();
  const productId = u.searchParams.get("product") || u.searchParams.get("id");
  if (m === "marketplace") return { mode: "marketplace", productId: null };
  if (m === "product" && productId) return { mode: "product", productId };
  return { mode: "home", productId: null };
}

export default function App() {
  const { user } = useAuth();
  const FF = useFF() as any;

  const path = useCurrentPath();

  const { mode: initialMode, productId: initialProduct } = useMemo(parseHomeModeFromUrl, []);
  const [homeMode, setHomeMode] = useState<HomeMode>(initialMode);
  const [homeProductId, setHomeProductId] = useState<string | null>(initialProduct);

  const [inboxInit, setInboxInit] = useState<InboxInit>(null);
  const [sellerNeedsSetup, setSellerNeedsSetup] = useState<boolean>(false);
  const [isSellerAccount, setIsSellerAccount] = useState<boolean>(false);
  const authRouteHandledRef = useRef<string | null>(null);

  // Route aliases and redirects (avoid calling smpNavigate during render)
  useEffect(() => {
    let target: string | null = null;

    if (path === "/account" || path === "/account/") target = "/dashboard";
    else if (path === "/account/dashboard") target = "/dashboard";
    else if (path === "/account/inbox") target = "/inbox";
    else if (path === "/account/profile") target = "/profile";
    else if (path === "/account/settings") target = "/settings";
    else if (path === "/account/seller/setup") target = "/seller/setup";
    else if (path === "/account/my-shop") target = "/my-shop";
    else if (path === "/dashboard/") target = "/dashboard";
    else if (path === "/inbox/") target = "/inbox";
    else if (path === "/profile/") target = "/profile";
    else if (path === "/settings/") target = "/settings";
    else if (path === "/seller/setup/") target = "/seller/setup";
    else if (path === "/dashboard" && isSellerAccount) target = "/my-shop";

    if (target) {
      smpNavigate(target, { replace: true });
    }
  }, [path, isSellerAccount]);

  // ✅ CRITICAL: keep App in sync with URL changes (pushState/back/forward/menu clicks)
  useEffect(() => {
    const u = new URL(window.location.href);
    const p = window.location.pathname;

    if (p === "/" || p === "/home") {
      const parsed = parseHomeModeFromUrl();
      setHomeMode(parsed.mode);
      setHomeProductId(parsed.productId);
      return;
    }

    // If you ever link to /marketplace route directly
    if (p === "/marketplace") {
      setHomeMode("marketplace");
      setHomeProductId(null);
      return;
    }

    // Default: no-op; route rendering below handles it.
  }, [path]);

  // ✅ allow deep-link to inbox chat via event
  useEffect(() => {
    const onOpenInbox = (ev: any) => {
      const detail = (ev?.detail || {}) as any;
      setInboxInit({
        chatId: detail.chatId,
        userId: detail.userId,
        productId: detail.productId,
      });
      smpNavigate("/inbox");
    };
    window.addEventListener("smp:view-inbox", onOpenInbox as any);
    return () => window.removeEventListener("smp:view-inbox", onOpenInbox as any);
  }, []);

  // Auth route aliases (/signin, /sign-in, /login)
  useEffect(() => {
    const authPaths = new Set(["/signin", "/sign-in", "/login"]);
    if (!authPaths.has(path)) return;
    if (authRouteHandledRef.current === path) return;
    authRouteHandledRef.current = path;
    setHomeMode("home");
    setHomeProductId(null);
    try {
      window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login" } }));
    } catch {
      window.dispatchEvent(new Event("smp:open-auth"));
    }
    smpNavigate("/");
  }, [path]);

  // seller setup enforcement (ONLY for seller accounts)
  useEffect(() => {
    let alive = true;

    async function doCheck() {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess?.session?.user?.id;
        if (!uid) {
          if (alive) {
            setSellerNeedsSetup(false);
            setIsSellerAccount(false);
          }
          return;
        }

        const { data: profileRow, error } = await supabase
          .from("profiles")
          .select("id, user_type, business_name, business_type, city, state_id")
          .eq("id", uid)
          .maybeSingle();

        if (error) throw error;

        // Resolve user_type using fetched profile first; fall back to cached value (prevents refresh flicker)
        const profileType = profileRow?.user_type ? String(profileRow.user_type).toLowerCase() : "";
        let cachedType = "";
        try {
          cachedType = uid ? String(localStorage.getItem(`smp:user_type:${uid}`) || "") : "";
        } catch {}
        const resolvedType = String(profileType || cachedType || "").toLowerCase();
        const isSeller = resolvedType === "seller";

        // Persist the fetched value for next refresh (only if present)
        if (profileType) {
          try {
            localStorage.setItem(`smp:user_type:${uid}`, profileType);
          } catch {}
        }

        if (alive) setIsSellerAccount(isSeller);

        // ✅ Buyers should NEVER be forced into seller setup
        if (!isSeller) {
          if (alive) setSellerNeedsSetup(false);
          return;
        }

        // Seller needs setup if missing key fields
        const needs =
          !profileRow?.business_name ||
          !profileRow?.business_type ||
          !profileRow?.city ||
          !profileRow?.state_id;

        if (alive) setSellerNeedsSetup(!!needs);
      } catch {
        if (alive) {
          setSellerNeedsSetup(false);
          // keep isSellerAccount as-is (don’t force false on transient network hiccup)
        }
      }
    }

    doCheck();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      doCheck();
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Simple router (keeps existing structure)
  const page = useMemo(() => {
    // PUBLIC
    if (path === "/" || path === "/home") {
      return (
        <HomePage
          viewMode={homeMode}
          productId={homeProductId}
          onSetViewMode={(m: HomeMode, id?: string | null) => {
            setHomeMode(m);
            setHomeProductId(id ?? null);

            // keep URL in sync
            const u = new URL(window.location.href);
            u.pathname = "/";
            u.searchParams.delete("mode");
            u.searchParams.delete("product");
            if (m === "marketplace") u.searchParams.set("mode", "marketplace");
            if (m === "product" && id) {
              u.searchParams.set("mode", "product");
              u.searchParams.set("product", id);
            }
            window.history.pushState({}, "", u.toString());
            window.dispatchEvent(new Event("popstate"));
          }}
        />
      );
    }

    if (path === "/marketplace") return <MarketplacePage />;

    // AUTH PAGES (wrapped with AccountShell) — redirects handled in effect
    if (
      path === "/account" ||
      path === "/account/" ||
      path === "/account/dashboard" ||
      path === "/account/inbox" ||
      path === "/account/profile" ||
      path === "/account/settings" ||
      path === "/account/seller/setup" ||
      path === "/account/my-shop" ||
      path === "/dashboard/" ||
      path === "/inbox/" ||
      path === "/profile/" ||
      path === "/settings/" ||
      path === "/seller/setup/"
    ) {
      return null;
    }


    if (path === "/dashboard") {
      if (isSellerAccount) return null;
      return (
        <AccountShell title="Dashboard">
          {/* If you have role-based dashboards already, keep using your existing logic.
              Here we render BuyerDashboardPage if user_type isn't seller. */}
          <BuyerDashboardPage />
        </AccountShell>
      );
    }

    if (path === "/inbox") {
      return (
        <AccountShell title="Messages">
          <InboxPage initialChat={inboxInit as any} />
        </AccountShell>
      );
    }

    if (path === "/saved") {
      return (
        <AccountShell title="Saved Items">
          <SavedPage />
        </AccountShell>
      );
    }

    if (path === "/notifications") {
      return (
        <AccountShell title="Notifications">
          <NotificationsPage />
        </AccountShell>
      );
    }

    if (path === "/profile") {
      return (
        <AccountShell title="Profile">
          <ProfilePage />
        </AccountShell>
      );
    }

    if (path === "/settings") {
      return (
        <AccountShell title="Settings">
          <SettingsPage />
        </AccountShell>
      );
    }

    if (path === "/help" || path === "/help/") return <HelpPage />;

    if (path === "/my-shop") {
      return (
        <AccountShell title="My Shop">
          <MyShopPage />
        </AccountShell>
      );
    }

    if (path === "/seller/setup") {
      return (
        <AccountShell title="Seller Profile">
          {sellerNeedsSetup ? <SellerProfileSetupPage /> : <ProfilePage />}
        </AccountShell>
      );
    }

    if (path === "/account/verification") {
      return (
        <AccountShell title="Verification">
          <VerificationPage />
        </AccountShell>
      );
    }

    if (path === "/pricing") return <PricingPage onNavigateHome={() => smpNavigate("/")} />

    // Toggles (feature-gated by your existing pages/FF checks)
    if (path === "/deals") {
      return (
        <AccountShell title="Deals">
          <DealsPage />
        </AccountShell>
      );
    }

    if (path === "/delivery") {
      return (
        <AccountShell title="Delivery">
          <DeliveryPage />
        </AccountShell>
      );
    }

    // Admin pages
    if (path === "/admin") {
      return (
        <AccountShell title="Admin">
          <AdminDashboard onNavigateHome={() => smpNavigate("/")} />
        </AccountShell>
      );
    }

    if (path === "/admin/features") {
      return (
        <AccountShell title="Admin Features">
          <AdminFeaturesPage />
        </AccountShell>
      );
    }

    if (path === "/admin/approvals") {
      return (
        <AccountShell title="Admin Approvals">
          <AdminApprovalsPage />
        </AccountShell>
      );
    }

    if (path === "/admin/escrow") {
      return (
        <AccountShell title="Admin Escrow">
          <AdminEscrowPage />
        </AccountShell>
      );
    }

    if (path === "/account/admin/escrow") {
      return (
        <AccountShell title="Admin Escrow">
          <AdminEscrowPage />
        </AccountShell>
      );
    }

    // Other
    if (path === "/analytics") {
      return (
        <AccountShell title="Analytics">
          <AnalyticsPage />
        </AccountShell>
      );
    }

    if (path === "/reports") {
      return (
        <AccountShell title="Reports">
          <ReportsPage />
        </AccountShell>
      );
    }

    if (path === "/institution") {
      return (
        <AccountShell title="Institution">
          <InstitutionPage onNavigateHome={() => smpNavigate("/")} />
        </AccountShell>
      );
    }

    // Fallback
    return (
      <div className="p-6">
        <div className="text-lg font-black text-slate-900">Page not found</div>
        <button
          className="mt-3 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold"
          onClick={() => smpNavigate("/")}
        >
          Go Home
        </button>
      </div>
    );
  }, [path, homeMode, homeProductId, inboxInit, isSellerAccount, sellerNeedsSetup]);

  return (
    <FeatureFlagsProvider>
      <Layout>
        <ErrorBoundary>{page}</ErrorBoundary>
      </Layout>
    </FeatureFlagsProvider>
  );
}
