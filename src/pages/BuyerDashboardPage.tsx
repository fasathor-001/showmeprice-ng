import React, { useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useFF } from "../hooks/useFF";
import { useMembership } from "../hooks/useMembership";
import { Heart, MessageSquare, Search, Settings, User2 } from "lucide-react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function nav(to: string) {
  try {
    if (window.location.pathname !== to) window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("popstate"));
    window.dispatchEvent(new Event("smp:navigate"));
  } catch {
    window.location.href = to;
  }
}

export default function BuyerDashboardPage() {
  const { user } = useAuth();
  const { profile, loading } = useProfile() as any;
  const FF = useFF() as any;
  const { tier, loading: membershipLoading } = useMembership();

  const messagingEnabled = !!FF?.messaging;
  const profileReady = !!user && !loading;
  const premiumLike = tier === "premium" || tier === "institution" || tier === "admin";
  const canUpgrade = !membershipLoading && !premiumLike;

  const name = useMemo(() => {
    const p = profile || {};
    return (
      p.display_name ||
      p.full_name ||
      p.username ||
      "Account"
    );
  }, [profile, user?.email]);

  if (!user) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-lg font-black text-slate-900">Please sign in</div>
          <div className="text-sm text-slate-600 mt-1">You need to be logged in to view your dashboard.</div>
          <button
            type="button"
            onClick={() => nav("/login")}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-white font-bold"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (user && !profileReady) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <div className="text-lg font-black text-slate-900">Loading your account...</div>
          <div className="text-sm text-slate-600 mt-1">Please wait a moment.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="text-sm font-bold text-slate-500">Welcome</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {loading ? "Loading..." : `Hi, ${name}`}
          </div>
          <div className="text-sm text-slate-600 mt-2">
            Find verified prices, save products, and message sellers (if enabled).
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => nav("/pricing?view=buyer")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              {canUpgrade ? "Upgrade plan" : "Manage plan"}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => nav("/")}
              className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
            >
              <div className="flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-700" />
                <div>
                  <div className="font-black text-slate-900">Browse</div>
                  <div className="text-sm text-slate-600">Find products</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => nav("/saved")}
              className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
            >
              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-slate-700" />
                <div>
                  <div className="font-black text-slate-900">Saved</div>
                  <div className="text-sm text-slate-600">Wishlist</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={!messagingEnabled}
              onClick={() => messagingEnabled && nav("/inbox")}
              className={cn(
                "rounded-2xl border border-slate-200 p-4 text-left transition",
                messagingEnabled ? "hover:bg-slate-50" : "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-slate-700" />
                <div>
                  <div className="font-black text-slate-900">Messages</div>
                  <div className="text-sm text-slate-600">{messagingEnabled ? "Chat" : "Disabled"}</div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => nav("/profile")}
              className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
            >
              <div className="flex items-center gap-3">
                <User2 className="w-5 h-5 text-slate-700" />
                <div>
                  <div className="font-black text-slate-900">Profile</div>
                  <div className="text-sm text-slate-600">Your account</div>
                </div>
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => nav("/settings")}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
        </div>
      </div>
    </div>
  );
}
