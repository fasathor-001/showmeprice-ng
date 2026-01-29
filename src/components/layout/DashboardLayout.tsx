import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../hooks/useProfile";
import { getAccountStatus, setRoleHint } from "../../lib/userRole";
import GlobalAuthModals from "../auth/GlobalAuthModals";
import PostProductForm from "../seller/PostProductForm";
import {
  LayoutDashboard,
  Grid3X3,
  Tags,
  Store,
  Truck,
  MessageSquare,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Plus,
  ChevronRight,
} from "lucide-react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

function titleForPath(path: string) {
  if (path === "/") return "Dashboard Overview";
  if (path === "/marketplace") return "Marketplace";
  if (path === "/deals") return "Deals";
  if (path === "/delivery") return "Delivery";
  if (path === "/my-shop") return "My Shop";
  if (path === "/seller/setup") return "Seller Profile Setup";
  if (path === "/settings") return "Settings";
  return "Dashboard";
}

function initials(name: string) {
  const s = String(name || "").trim();
  if (!s) return "U";
  const bits = s.split(/\s+/).filter(Boolean);
  const a = bits[0]?.[0] ?? "U";
  const b = bits.length > 1 ? bits[bits.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { profile, business, loading: profileLoading } = useProfile() as any;

  const [mobileOpen, setMobileOpen] = useState(false);

  // Keep your "global post item modal" behavior (same contract as Layout)
  const [isPostItemOpen, setIsPostItemOpen] = useState(false);
  const openPostItemModal = () => setIsPostItemOpen(true);
  const closePostItemModal = () => setIsPostItemOpen(false);

  useEffect(() => {
    (window as any).openPostItemModal = openPostItemModal;
    (window as any).closePostItemModal = closePostItemModal;
    return () => {
      try {
        delete (window as any).openPostItemModal;
        delete (window as any).closePostItemModal;
      } catch {
        // intentionally empty
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePostItemModal();
    };

    if (isPostItemOpen) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isPostItemOpen]);

  const pathname = typeof window !== "undefined" ? normalizePath(window.location.pathname) : "/";
  const pageTitle = titleForPath(pathname);

  const profileReady = !!user && !profileLoading;
  const hasBusiness = profileReady && !!(business as any)?.id;
  const isAdminRole = profileReady && String((profile as any)?.role ?? "").toLowerCase() === "admin";
  const accountStatus = getAccountStatus({
    profile,
    user,
    hasBusiness,
    isAdminRole,
    profileLoaded: profileReady,
  });
  const userType = accountStatus.ready ? accountStatus.effectiveType : null;
  const membership = String((profile as any)?.membership_tier ?? "free").toLowerCase();
  const tierLabel =
    membership === "premium" ? "Premium Member" : membership === "institution" ? "Institution" : "Free Member";

  const displayName = useMemo(() => {
    const n = String((profile as any)?.full_name ?? "").trim();
    if (n) return n;
    if (user?.email) return String(user.email).split("@")[0];
    return "User";
  }, [profile, user]);

  useEffect(() => {
    if (user?.id && accountStatus.ready && userType) {
      setRoleHint(user.id, userType);
    }
  }, [user?.id, accountStatus.ready, userType]);

  const menu = useMemo(() => {
    const common = [
      { label: "Overview", to: "/", icon: LayoutDashboard },
      { label: "Marketplace", to: "/marketplace", icon: Grid3X3 },
      { label: "Deals", to: "/deals", icon: Tags },
      { label: "Delivery", to: "/delivery", icon: Truck },
      { label: "Messages", to: "/inbox", icon: MessageSquare }, // if /inbox isn't routed yet, it will fall back to Home
      { label: "Plans", to: "/pricing", icon: Tags },
      { label: "Settings", to: "/settings", icon: Settings },
      { label: "Help & Support", to: "/help", icon: HelpCircle },
    ];

    if (profileReady && userType === "seller") {
      common.splice(3, 0, { label: "My Shop", to: "/my-shop", icon: Store });
      common.splice(5, 0, { label: "Seller Setup", to: "/seller/setup", icon: Store });
    }

    return common;
  }, [userType]);

  const Sidebar = (
    <aside className="h-full w-[280px] bg-gradient-to-b from-slate-900 to-slate-950 text-white border-r border-white/10">
      <div className="px-4 py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/20 flex items-center justify-center font-black">
            SMP
          </div>
          <div className="leading-tight">
            <div className="font-black text-lg">Dashboard</div>
          <div className="text-xs font-bold text-white/50 capitalize">
            {accountStatus.ready && userType ? userType : "loading"}
          </div>
        </div>
      </div>

        <div className="mt-6 space-y-1">
          {menu.map((it) => {
            const Icon = it.icon;
            const active = pathname === it.to;
            return (
              <button
                key={it.label}
                type="button"
                onClick={() => {
                  nav(it.to);
                  setMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition",
                  active ? "bg-white/10 ring-1 ring-white/10" : "hover:bg-white/5"
                )}
              >
                <Icon className="w-4 h-4 text-white/80" />
                <span className="font-bold text-sm text-white/90 flex-1">{it.label}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>
            );
          })}
        </div>

        <div className="mt-8 border-t border-white/10 pt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              // Use your global post product modal contract
              (window as any).openPostItemModal?.();
              setMobileOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:opacity-90 text-white font-black py-3 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Post New Item
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await signOut();
              } finally {
                nav("/");
                setMobileOpen(false);
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5"
          >
            <LogOut className="w-4 h-4 text-white/70" />
            <span className="font-bold text-sm text-white/80">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">{Sidebar}</div>

        {/* Mobile sidebar overlay */}
        {mobileOpen ? (
          <div className="lg:hidden fixed inset-0 z-[200]">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[280px]">{Sidebar}</div>
          </div>
        ) : null}

        {/* Main */}
        <div className="flex-1">
          {/* Top header */}
          <div className="bg-white border-b">
            <div className="px-4 lg:px-8 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-xl border bg-white hover:bg-slate-50"
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>

                <div>
                  <div className="font-black text-slate-900">{pageTitle}</div>
                  <div className="text-xs font-bold text-slate-500">{tierLabel}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="font-black text-slate-900">{displayName}</div>
                  <div className="text-xs font-bold text-slate-500">{tierLabel}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black">
                  {initials(displayName)}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 lg:px-8 py-6">{children}</div>

          <GlobalAuthModals />

          {/*  Post Product Modal (Global) */}
          <div
            id="postProductModal"
            className={`fixed inset-0 z-[210] items-center justify-center p-4 ${
              isPostItemOpen ? "flex" : "hidden"
            } bg-gradient-to-b from-slate-50/95 via-slate-50/85 to-white/95 backdrop-blur-sm`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closePostItemModal();
            }}
            aria-hidden={!isPostItemOpen}
          >
            <div className="w-full max-w-2xl relative">
              <PostProductForm onClose={closePostItemModal} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
