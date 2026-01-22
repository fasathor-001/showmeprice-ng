// src/components/layout/AccountShell.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../hooks/useProfile";
import { useFF } from "../../hooks/useFF";
import { useUnreadMessagesCount } from "../../hooks/useUnreadMessagesCount";
import { getAccountStatus, setRoleHint } from "../../lib/userRole";
import { smpNavigate } from "../../lib/smpNavigate";
import ToastHost from "../common/ToastHost";
import {
  LayoutDashboard,
  Heart,
  MessageSquare,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Store,
  Tag,
  Truck,
  BarChart3,
  FileText,
  User2,
  Wrench,
  Menu,
  X,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function nav(to: string) {
  smpNavigate(to);
}

function useCurrentPath() {
  const [path, setPath] = useState<string>(() => normalizePath(window.location.pathname || "/"));
  useEffect(() => {
    const onChange = () => setPath(normalizePath(window.location.pathname || "/"));
    const onNavigate = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as { to?: string } | undefined;
      setPath(normalizePath(detail?.to ?? (window.location.pathname || "/")));
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

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

type Item = {
  key: string;
  label: string;
  to?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  show?: boolean;
  badge?: number;
};

function lsGet(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function lsSet(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

export default function AccountShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, authReady, signOut } = useAuth();
  const { profile, business, loading: profileLoading, error: profileError } = useProfile() as any;
  const FF = useFF() as any;

  const path = useCurrentPath();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const didDefaultNav = useRef(false);
  const didProfileNav = useRef(false);

  useEffect(() => {
    console.debug("[BOOTSTRAP]", {
      authReady,
      hasUser: !!user,
      loadingProfile: profileLoading,
      profileError: profileError ? String(profileError) : null,
    });
  }, [authReady, user, profileLoading, profileError]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) nav("/signin");
  }, [authReady, user]);

  // ---------------------------
  //  Stable user_type/role (prevents Buyer->Seller flicker on refresh)
  // ---------------------------
  const profileReady = !!user && !profileLoading;
  const profileRoleRaw = profileReady && (profile as any)?.role ? String((profile as any).role).toLowerCase() : "";
  const profileTypeRaw =
    profileReady && (profile as any)?.user_type ? String((profile as any).user_type).toLowerCase() : "";

  const authRoleRaw = (user as any)?.user_metadata?.role
    ? String((user as any).user_metadata.role).toLowerCase()
    : "";
  const appRoleRaw = (user as any)?.app_metadata?.role
    ? String((user as any).app_metadata.role).toLowerCase()
    : "";

  const cachedRole = user?.id ? lsGet(`smp:role:${user.id}`) : "";

  const role = String(profileRoleRaw || authRoleRaw || appRoleRaw || cachedRole || "").toLowerCase();
  const hasBusiness = profileReady && !!(business as any)?.id;
  const profileIsAdmin =
    profileReady &&
    ((profile as any)?.is_admin === true ||
      String((profile as any)?.role ?? "").toLowerCase() === "admin" ||
      String((profile as any)?.user_type ?? "").toLowerCase() === "admin");
  const isAdminRole = profileReady && (role === "admin" || profileIsAdmin);
  const accountStatus = getAccountStatus({
    profile,
    user,
    hasBusiness,
    isAdminRole,
    profileLoaded: profileReady,
  });
  const userType = accountStatus.effectiveType ?? "";

  const isAdmin = accountStatus.ready && userType === "admin";
  const isSeller = accountStatus.ready && userType === "seller";

  useEffect(() => {
    if (!user?.id) return;
    if (!accountStatus.ready) return;
    if (userType && (profileTypeRaw || hasBusiness)) lsSet(`smp:user_type:${user.id}`, userType);
    const roleSource = profileRoleRaw || authRoleRaw || appRoleRaw;
    if (roleSource) lsSet(`smp:role:${user.id}`, roleSource);
    if (userType) setRoleHint(user.id, userType as any);
  }, [user?.id, accountStatus.ready, profileTypeRaw, hasBusiness, userType, profileRoleRaw, authRoleRaw, appRoleRaw]);

  // Feature flags (useFF already maps to canonical keys)
  const messagingEnabled = !!FF?.messaging;
  const dealsEnabled = !!FF?.deals;
  const dealsPostingEnabled = !!FF?.dealsPosting;
  const deliveryEnabled = !!FF?.delivery;

  const unreadRaw = useUnreadMessagesCount(15000);
  const unread = messagingEnabled ? Number(unreadRaw ?? 0) : 0;

  const logout = () => {
    try {
      (window as any).logout?.();
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("smp:logout"));
    } catch {}
    nav("/");
  };

  const sidebarItems: Item[] = useMemo(() => {
    const common: Item[] = [
      { key: "dashboard", label: "Overview", to: "/dashboard", icon: LayoutDashboard, show: !!user },
      {
        key: "messages",
        label: "Messages",
        to: "/inbox",
        icon: MessageSquare,
        show: !!user && messagingEnabled,
        badge: unread,
      },
      { key: "saved", label: "Saved Items", to: "/saved", icon: Heart, show: !!user },
      { key: "notifications", label: "Notifications", to: "/notifications", icon: Bell, show: !!user },
      { key: "profile", label: "Profile", to: "/profile", icon: User2, show: !!user },
      { key: "escrowBuyer", label: "Escrow", to: "/account/escrow", icon: FileText, show: !!user && !isSeller && !isAdmin },
      { key: "pricing", label: "Plans", to: "/pricing", icon: Tag, show: true },
      { key: "settings", label: "Settings", to: "/settings", icon: Wrench, show: !!user },
      { key: "help", label: "Help & Support", to: "/help", icon: HelpCircle, show: true },
    ];

    const seller: Item[] = [
      { key: "myshop", label: "My Shop", to: "/my-shop", icon: Store, show: !!user && isSeller },
      { key: "analytics", label: "Analytics", to: "/analytics", icon: BarChart3, show: !!user && isSeller },
      { key: "reports", label: "Reports", to: "/reports", icon: FileText, show: !!user && isSeller },
      { key: "sellerSetup", label: "Seller Profile", to: "/seller/setup", icon: User2, show: !!user && isSeller },
    ];

    const toggles: Item[] = [
      { key: "deals", label: "Deals", to: "/deals", icon: Tag, show: !!user && dealsEnabled },
      {
        key: "season",
        label: dealsPostingEnabled
          ? String((FF as any)?.deals_posting_enabled?.description || "Season")
          : "Season",
        to: "/deals",
        icon: Tag,
        show: !!user && dealsEnabled && dealsPostingEnabled,
      },
      { key: "delivery", label: "Delivery", to: "/delivery", icon: Truck, show: !!user && deliveryEnabled },
    ];

    const actions: Item[] = [
      { key: "logout", label: "Log out", onClick: logout, icon: LogOut, show: !!user },
    ];

    return [...common, ...seller, ...toggles, ...actions].filter((x) => x.show !== false);
  }, [
    user,
    isSeller,
    isAdmin,
    messagingEnabled,
    unread,
    dealsEnabled,
    dealsPostingEnabled,
    deliveryEnabled,
    FF,
  ]);

  const sellerSections = useMemo(() => {
    if (!user || !isSeller) return [] as Array<{ key: string; label: string; items: Item[] }>;

    const main: Item[] = [
      { key: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, show: !!user },
      { key: "myListings", label: "My Listings", to: "/my-shop", icon: Store, show: !!user },
      { key: "saved", label: "Saved Items", to: "/saved", icon: Heart, show: !!user },
    ];

    const communication: Item[] = [
      {
        key: "messages",
        label: "Messages",
        to: "/inbox",
        icon: MessageSquare,
        show: !!user && messagingEnabled,
        badge: unread,
      },
      { key: "notifications", label: "Notifications", to: "/notifications", icon: Bell, show: !!user },
    ];

    const sellerTools: Item[] = [
      { key: "sellerSetup", label: "Seller Setup", to: "/seller/setup", icon: User2, show: !!user && isSeller },
      { key: "verification", label: "Verification", to: "/account/verification", icon: ShieldAlert, show: !!user && isSeller },
      { key: "escrowSeller", label: "Escrow Orders", to: "/account/seller/escrow", icon: FileText, show: !!user && isSeller },
      { key: "engagement", label: "Engagement", to: "/seller/engagement", icon: BarChart3, show: !!user && isSeller },
      { key: "analytics", label: "Analytics", to: "/analytics", icon: BarChart3, show: !!user && isSeller },
      { key: "reports", label: "Reports", to: "/reports", icon: FileText, show: !!user && isSeller },
    ];

    const system: Item[] = [
      { key: "myProfile", label: "My Profile", to: "/profile", icon: User2, show: !!user },
      { key: "settings", label: "Settings", to: "/settings", icon: Wrench, show: !!user },
      { key: "help", label: "Help & Support", to: "/help", icon: HelpCircle, show: true },
    ];

    const logoutSection: Item[] = [
      { key: "logout", label: "Log out", onClick: logout, icon: LogOut, show: !!user },
    ];

    const sections = [
      { key: "main", label: "MAIN", items: main },
      { key: "communication", label: "COMMUNICATION", items: communication },
      { key: "sellerTools", label: "SELLER TOOLS", items: sellerTools },
      { key: "system", label: "SYSTEM", items: system },
      { key: "logout", label: "LOGOUT", items: logoutSection },
    ]
      .map((sec) => ({ ...sec, items: sec.items.filter((x) => x.show !== false) }))
      .filter((sec) => sec.items.length > 0);

    return sections;
  }, [user, isSeller, isAdmin, messagingEnabled, unread]);

  const bottomTabs: Item[] = useMemo(() => {
    return [
      { key: "tab_dashboard", label: "Overview", to: "/dashboard", icon: LayoutDashboard, show: !!user },
      {
        key: "tab_messages",
        label: "Messages",
        to: "/inbox",
        icon: MessageSquare,
        show: !!user && messagingEnabled,
        badge: unread,
      },
      { key: "tab_saved", label: "Saved", to: "/saved", icon: Heart, show: !!user },
      { key: "tab_notifs", label: "Alerts", to: "/notifications", icon: Bell, show: !!user },
      { key: "tab_profile", label: "Profile", to: "/profile", icon: User2, show: !!user },
    ].filter((x) => x.show !== false);
  }, [user, messagingEnabled, unread]);

  const adminItems: Item[] = useMemo(() => {
    if (!user || !isAdmin) return [];
    return [
      { key: "admin_overview", label: "Overview", to: "/admin", icon: LayoutDashboard, show: true },
      { key: "admin_approvals", label: "Approvals", to: "/admin/approvals", icon: User2, show: true },
      { key: "admin_violations", label: "Violations", to: "/admin/violations", icon: ShieldAlert, show: true },
      { key: "admin_flags", label: "Feature Flags", to: "/admin/feature-flags", icon: Wrench, show: true },
      {
        key: "admin_escrow",
        label: "Escrow",
        to: "/account/admin/escrow",
        icon: FileText,
        show: true,
        onClick: () => {
          console.debug("ADMIN NAV -> /account/admin/escrow");
          nav("/account/admin/escrow");
        },
      },
    ].filter((x) => x.show !== false);
  }, [user, isAdmin]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    if (!authReady || !user || profileLoading || profileError) return;
    if (didDefaultNav.current) return;
    if (path !== "/account" && path !== "/account/") return;
    didDefaultNav.current = true;
    if (isAdmin) {
      nav("/account/admin");
      return;
    }
    const type = String((profile as any)?.user_type ?? "").toLowerCase();
    if (type === "seller") {
      nav("/account/seller");
      return;
    }
    nav("/account/dashboard");
  }, [authReady, user, profileLoading, profileError, isAdmin, profile, path]);

  const fullNameRaw = String((profile as any)?.full_name ?? "").trim();
  const phoneRaw = String((profile as any)?.phone ?? "").trim();
  const cityRaw = String((profile as any)?.city ?? "").trim();
  const stateIdRaw = (profile as any)?.state_id;
  const fullNameOk =
    !!fullNameRaw &&
    fullNameRaw.toLowerCase() !== "new user" &&
    !/^(user|buyer|seller)\s+[0-9a-f]{4,}$/i.test(fullNameRaw);
  const phoneOk = !!phoneRaw && phoneRaw.toLowerCase() !== "pending";
  const cityOk = !!cityRaw && cityRaw.toLowerCase() !== "pending";
  const baseComplete = fullNameOk && phoneOk && cityOk && Number.isFinite(Number(stateIdRaw));
  const sellerBusinessOk = !isSeller
    ? true
    : !!String((business as any)?.business_name ?? "").trim() &&
      !!String((business as any)?.address ?? "").trim();
  const profileComplete = baseComplete && sellerBusinessOk;
  const needsSellerSetup = isSeller && !sellerBusinessOk;

  useEffect(() => {
    if (!authReady || !user || profileLoading || profileError) return;
    if (profileComplete) return;
    if (didProfileNav.current) return;
    if (needsSellerSetup && path === "/seller/setup") return;
    if (!needsSellerSetup && path === "/profile") return;
    didProfileNav.current = true;
    if (needsSellerSetup) {
      nav("/seller/setup");
      return;
    }
    nav("/profile");
  }, [authReady, user, profileLoading, profileError, profileComplete, path]);

  const goBack = () => {
    try {
      if (window.history.length > 1) window.history.back();
      else nav("/dashboard");
    } catch {
      nav("/dashboard");
    }
  };

  const showAuthLoading = !authReady;
  const mustSignIn = authReady && !user;
  const showProfileLoading = authReady && !!user && profileLoading;
  const showProfileError = !!profileError;

  const loadingCard = (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center max-w-sm w-full">
        <div className="text-lg font-black text-slate-900">Loading your account...</div>
        <div className="text-sm text-slate-600 mt-2">Please wait a moment.</div>
      </div>
    </div>
  );

  const errorCard = (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center max-w-sm w-full">
        <div className="text-lg font-black text-slate-900">We couldn't load your account</div>
        <div className="text-sm text-slate-600 mt-2">Please sign in again.</div>
        <div className="mt-4">
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:opacity-90"
            onClick={async () => {
              try {
                await signOut();
              } catch {}
              nav("/signin");
            }}
          >
            Sign in again
          </button>
        </div>
      </div>
    </div>
  );

  if (showAuthLoading) return loadingCard;
  if (mustSignIn) return null;
  if (showProfileLoading) return loadingCard;
  if (showProfileError) return errorCard;
  if (!profileComplete && path === "/profile") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center max-w-sm w-full">
          <div className="text-lg font-black text-slate-900">Update your profile details</div>
          <div className="text-sm text-slate-600 mt-2">
            Please add your full name, phone number, state, and city to continue.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50">
      <ToastHost />
      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="h-12 px-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-50"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-slate-900 truncate">{title}</div>
          </div>

          <div className="flex items-center gap-1">
            {messagingEnabled && (
              <button
                type="button"
                onClick={() => nav("/inbox")}
                className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-50"
                aria-label="Messages"
                title="Messages"
              >
                <MessageSquare className="w-5 h-5 text-slate-800" />
                {unread > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {unread}
                  </span>
                ) : null}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-50"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5 text-slate-800" /> : <Menu className="w-5 h-5 text-slate-800" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="p-2 grid gap-1">
                {isSeller ? (
                  <div className="grid gap-3">
                    {isAdmin && adminItems.length > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setAdminOpen((v) => !v)}
                          className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between hover:bg-slate-50 text-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            <span>Admin</span>
                          </div>
                          <ChevronRight className={cn("w-4 h-4 opacity-60 transition", adminOpen && "rotate-90")} />
                        </button>
                        {adminOpen ? (
                          <div className="mt-1 grid gap-1 pl-2">
                            {adminItems.map((it) => {
                              const Icon = it.icon;
                              const active = it.to ? path === it.to : false;
                              return (
                                <button
                                  key={it.key}
                                  type="button"
                                  onClick={() => {
                                    setMobileOpen(false);
                                    if (it.onClick) return it.onClick();
                                    if (it.to) return nav(it.to);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between",
                                    active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span>{it.label}</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 opacity-60" />
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {sellerSections.map((sec) => (
                      <div key={sec.key}>
                        <div className="px-3 pt-2 pb-1 text-[11px] font-black tracking-wide text-slate-500">
                          {sec.label}
                        </div>
                        <div className="grid gap-1">
                          {sec.items.map((it) => {
                            const Icon = it.icon;
                            const active = it.to ? path === it.to : false;

                            return (
                              <button
                                key={it.key}
                                type="button"
                                onClick={() => {
                                  setMobileOpen(false);
                                  if (it.onClick) return it.onClick();
                                  if (it.to) return nav(it.to);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between",
                                  active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4" />
                                  <span>{it.label}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {it.badge && it.badge > 0 ? (
                                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black">
                                      {it.badge}
                                    </span>
                                  ) : null}
                                  <ChevronRight className="w-4 h-4 opacity-60" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {isAdmin && adminItems.length > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setAdminOpen((v) => !v)}
                          className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between hover:bg-slate-50 text-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            <span>Admin</span>
                          </div>
                          <ChevronRight className={cn("w-4 h-4 opacity-60 transition", adminOpen && "rotate-90")} />
                        </button>
                        {adminOpen ? (
                          <div className="mt-1 grid gap-1 pl-2">
                            {adminItems.map((it) => {
                              const Icon = it.icon;
                              const active = it.to ? path === it.to : false;
                              return (
                                <button
                                  key={it.key}
                                  type="button"
                                  onClick={() => {
                                    setMobileOpen(false);
                                    if (it.onClick) return it.onClick();
                                    if (it.to) return nav(it.to);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between",
                                    active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span>{it.label}</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 opacity-60" />
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {sidebarItems.map((it) => {
                      const Icon = it.icon;
                      const active = it.to ? path === it.to : false;

                      return (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            if (it.onClick) return it.onClick();
                            if (it.to) return nav(it.to);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between",
                            active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{it.label}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {it.badge && it.badge > 0 ? (
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black">
                                {it.badge}
                              </span>
                            ) : null}
                            <ChevronRight className="w-4 h-4 opacity-60" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <div className="flex gap-4">
          {/* Desktop sidebar */}
          <aside className="hidden md:block w-72 shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 sticky top-20">
              <div className="px-2 py-2">
                <div className="text-xs font-black text-slate-500">ACCOUNT</div>
                <div className="text-lg font-black text-slate-900">{title}</div>
              </div>

              <div className="mt-2 grid gap-1">
                {isSeller ? (
                  <div className="grid gap-3">
                    {isAdmin && adminItems.length > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setAdminOpen((v) => !v)}
                          className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between hover:bg-slate-50 text-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            <span>Admin</span>
                          </div>
                          <ChevronRight className={cn("w-4 h-4 opacity-60 transition", adminOpen && "rotate-90")} />
                        </button>
                        {adminOpen ? (
                          <div className="mt-1 grid gap-1 pl-2">
                            {adminItems.map((it) => {
                              const Icon = it.icon;
                              const active = it.to ? path === it.to : false;
                              return (
                                <button
                                  key={it.key}
                                  type="button"
                                  onClick={() => {
                                    if (it.onClick) return it.onClick();
                                    if (it.to) return nav(it.to);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between",
                                    active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span>{it.label}</span>
                                  </div>
                                  <ChevronRight className="w-4 h-4 opacity-60" />
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {sellerSections.map((sec) => (
                      <div key={sec.key}>
                        <div className="px-3 pt-2 pb-1 text-[11px] font-black tracking-wide text-slate-500">
                          {sec.label}
                        </div>
                        <div className="grid gap-1">
                          {sec.items.map((it) => {
                            const Icon = it.icon;
                            const active = it.to ? path === it.to : false;

                            return (
                              <button
                                key={it.key}
                                type="button"
                                onClick={() => {
                                  if (it.onClick) return it.onClick();
                                  if (it.to) return nav(it.to);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between",
                                  active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4" />
                                  <span>{it.label}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {it.badge && it.badge > 0 ? (
                                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black">
                                      {it.badge}
                                    </span>
                                  ) : null}
                                  <ChevronRight className="w-4 h-4 opacity-60" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-1">
                    {isAdmin && adminItems.length > 0 ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setAdminOpen((v) => !v)}
                          className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-between hover:bg-slate-50 text-slate-800"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            <span>Admin</span>
                          </div>
                          <ChevronRight className={cn("w-4 h-4 opacity-60 transition", adminOpen && "rotate-90")} />
                        </button>
                        {adminOpen ? (
                          <div className="mt-1 grid gap-1 pl-2">
                            {adminItems.map((it) => {
                              const Icon = it.icon;
                              const active = it.to ? path === it.to : false;
                              return (
                                <button
                                  key={it.key}
                                  type="button"
                                  onClick={() => {
                                    if (it.onClick) return it.onClick();
                                    if (it.to) return nav(it.to);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between",
                                    active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span>{it.label}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {sidebarItems.map((it) => {
                      const Icon = it.icon;
                      const active = it.to ? path === it.to : false;

                      return (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => {
                            if (it.onClick) return it.onClick();
                            if (it.to) return nav(it.to);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between",
                            active ? "bg-slate-50 text-brand" : "hover:bg-slate-50 text-slate-800"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{it.label}</span>
                          </div>

                          {it.badge && it.badge > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black">
                              {it.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 pb-24 md:pb-0">{children}</main>
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-2">
          <div className="h-16 grid" style={{ gridTemplateColumns: `repeat(${bottomTabs.length}, minmax(0, 1fr))` }}>
            {bottomTabs.map((it) => {
              const Icon = it.icon;
              const active = it.to ? path === it.to : false;

              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => it.to && nav(it.to)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-xl my-2",
                    active ? "text-brand" : "text-slate-700"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-bold">{it.label}</span>

                  {it.badge && it.badge > 0 ? (
                    <span className="absolute top-1 right-3 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black">
                      {it.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
