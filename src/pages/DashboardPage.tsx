// src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import {
  Heart,
  MessageSquare,
  Bell,
  Settings,
  Store,
  User2,
  CheckCircle2,
  AlertTriangle,
  BadgeCheck,
} from "lucide-react";
import { useFF } from "../hooks/useFF";

function nav(to: string) {
  try {
    if (window.location.pathname !== to) window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("popstate"));
    window.dispatchEvent(new Event("smp:navigate"));
  } catch {
    window.location.href = to;
  }
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const PENDING_BECOME_SELLER_KEY = "smp:pending_become_seller";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isBusinessComplete(biz: any) {
  const b = biz || {};
  const whatsapp = safeStr(b.whatsapp_number ?? b.whatsapp);
  const stateOk = b.state_id !== null && b.state_id !== undefined && String(b.state_id).trim() !== "";
  return (
    safeStr(b.business_name).length > 0 &&
    safeStr(b.business_type).length > 0 &&
    safeStr(b.city).length > 0 &&
    safeStr(b.address).length > 0 &&
    whatsapp.length > 0 &&
    stateOk
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile, business, loading: profileLoading } = useProfile() as any;
  const FF = useFF() as any;

  const profileReady = !!user && !profileLoading;
  const userType = profileReady ? String((profile as any)?.user_type ?? "").toLowerCase() : "";
  const businessTier = profileReady ? String((business as any)?.seller_membership_tier ?? "").toLowerCase() : "";
  const buyerTier = profileReady ? String((profile as any)?.membership_tier ?? (profile as any)?.membership_1 ?? "free").toLowerCase() : "free";
  const membership = isSeller && businessTier ? businessTier : buyerTier;
  const isSeller = profileReady && userType === "seller";

  const messagingEnabled = !!FF?.messaging;

  const name = useMemo(() => {
    const p = profile as any;
    const b = business as any;

    // For sellers, show the business name if present (prevents "Welcome back, Welcome!")
    if (isSeller) {
      const bn = b?.business_name ? String(b.business_name).trim() : "";
      if (bn) return bn;
    }

    const n =
      (p?.display_name && String(p.display_name).trim()) ||
      (p?.full_name && String(p.full_name).trim()) ||
      (p?.username && String(p.username).trim()) ||
      "Account";
    return n;
  }, [profile, business, isSeller]);

  const [unread, setUnread] = useState<number>(0);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [listingsCount, setListingsCount] = useState<number>(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user) {
        if (alive) {
          setUnread(0);
          setSavedCount(0);
        }
        return;
      }

      // Unread messages
      try {
        if (messagingEnabled) {
          const { count } = await supabase
            .from("messages")
            .select("id", { head: true, count: "exact" })
            .eq("receiver_id", user.id)
            .is("read_at", null);

          if (alive) setUnread(Number(count ?? 0));
        } else {
          if (alive) setUnread(0);
        }
      } catch {
        if (alive) setUnread(0);
      }

      // Saved items (optional table; ignore if not present)
      try {
        const { count, error } = await supabase
          .from("product_saves")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", user.id);

        if (!error && alive) setSavedCount(Number(count ?? 0));
      } catch {
        if (alive) setSavedCount(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, messagingEnabled]);

  useEffect(() => {
    if (!user?.id) return;
    const onRefresh = async () => {
      try {
        const { count, error } = await supabase
          .from("product_saves")
          .select("id", { head: true, count: "exact" })
          .eq("user_id", user.id);

        if (!error) setSavedCount(Number(count ?? 0));
      } catch {
        setSavedCount(0);
      }
    };

    window.addEventListener("smp:saved:refresh", onRefresh);
    return () => {
      window.removeEventListener("smp:saved:refresh", onRefresh);
    };
  }, [user?.id]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!isSeller || !(business as any)?.id) {
        if (alive) setListingsCount(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from("products")
          .select("id", { head: true, count: "exact" })
          .eq("business_id", (business as any).id);

        if (!error && alive) setListingsCount(Number(count ?? 0));
      } catch {
        if (alive) setListingsCount(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isSeller, (business as any)?.id]);

  if (user && !profileReady) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="text-lg font-black text-slate-900">Loading your account...</div>
          <div className="text-sm text-slate-600 mt-2">Please wait a moment.</div>
        </div>
      </div>
    );
  }

  if (isSeller) {
    const b = business as any;
    const tierRaw = safeStr(b?.verification_tier).toLowerCase();
    const verification =
      (tierRaw === "verified" ? "verified" : "") ||
      safeStr(b?.verification_status) ||
      safeStr((profile as any)?.seller_verification_status) ||
      "unverified";
    const verificationTone =
      verification === "verified"
        ? "text-emerald-600"
        : verification === "pending" || verification === "in review"
        ? "text-amber-600"
        : "text-red-600";
    const profileOk = isBusinessComplete(b);

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          {profileOk ? (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-black text-emerald-900">Seller profile complete</div>
                <div className="text-sm text-emerald-700">Your shop is ready to sell.</div>
              </div>
            </div>
          ) : (
            <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-black text-amber-900">Complete your seller profile</div>
                <div className="text-sm text-amber-700">Add missing business details to start selling.</div>
              </div>
              <button
                type="button"
                onClick={() => nav("/seller/setup")}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white font-black hover:bg-amber-700"
              >
                Finish setup
              </button>
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Seller Dashboard</h2>
              <p className="text-sm text-slate-600 mt-1">Overview of your shop and activity.</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-black text-slate-700">Total Listings</div>
              <div className="text-3xl font-black text-slate-900 mt-2">{listingsCount}</div>
              <div className="text-sm text-slate-500 mt-1">Active in your shop</div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-black text-slate-700">Account Level</div>
              <div className="text-3xl font-black text-slate-900 mt-2 capitalize">{membership}</div>
              <div className="text-sm text-slate-500 mt-1">Seller membership</div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-black text-slate-700">Verification</div>
              <div className={`text-3xl font-black mt-2 capitalize ${verificationTone}`}>{verification}</div>
              <div className="text-sm text-slate-500 mt-1">Business status</div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-black text-slate-700">Profile Status</div>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {profileOk ? "Complete" : "Incomplete"}
              </div>
              <div className="text-sm text-slate-500 mt-1">Required info</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-slate-700">Engagement</div>
              <div className="text-xs text-slate-500">Track followers, views, and saves.</div>
            </div>
            <button
              type="button"
              onClick={() => nav("/seller/engagement")}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-black hover:bg-slate-50"
            >
              View Engagement
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-lg font-black text-slate-900">Shop Details</div>
              <div className="text-xs text-slate-500">Manage your public shop information.</div>
            </div>
            <button
              type="button"
              onClick={() => nav("/my-shop")}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl"
            >
              <Store className="w-4 h-4" />
              Go to Your Listings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-black text-slate-500">Business Name</div>
              <div className="text-sm font-black text-slate-900 mt-1">{safeStr(b?.business_name) || "—"}</div>
              <div className="text-xs text-slate-500 mt-3">Business Type</div>
              <div className="text-sm font-black text-slate-900 mt-1">{safeStr(b?.business_type) || "—"}</div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-black text-slate-500">City / Area</div>
              <div className="text-sm font-black text-slate-900 mt-1">{safeStr(b?.city) || "—"}</div>
              <div className="text-xs text-slate-500 mt-3">Address</div>
              <div className="text-sm font-black text-slate-900 mt-1">{safeStr(b?.address) || "—"}</div>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50">
            <BadgeCheck className="w-3.5 h-3.5 text-slate-700" />
            <span>
              Verification:{" "}
              <span className={`font-black ${verificationTone}`}>{verification || "unverified"}</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  const startSelling = () => {
    if (!user) {
      (window as any).openAuthModal?.();
      return;
    }
    // ✅ Do NOT change user_type yet. Let user confirm on Seller setup screen.
    try {
      localStorage.setItem(PENDING_BECOME_SELLER_KEY, "1");
    } catch {
      // intentionally empty
    }
    nav("/seller/setup?intent=become-seller");
  };

  const topRightCTA = isSeller ? (
    <div className="flex flex-col items-end gap-2">
      <div className="text-xs font-bold text-slate-500">Manage your shop</div>
      <button
        type="button"
        onClick={() => nav("/my-shop")}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:opacity-90 text-white font-black px-4 py-2.5 rounded-xl"
      >
        <Store className="w-4 h-4" />
        Go to Your Listings
      </button>
      <button
        type="button"
        onClick={() => nav("/pricing")}
        className="inline-flex items-center gap-2 border border-slate-200 bg-white text-slate-800 font-black px-4 py-2.5 rounded-xl hover:bg-slate-50"
      >
        Upgrade plan
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-end gap-2">
      <div className="text-xs font-bold text-slate-500">Set up your shop in 2 minutes</div>
      <button
        type="button"
        onClick={startSelling}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:opacity-90 text-white font-black px-4 py-2.5 rounded-xl"
      >
        <Store className="w-4 h-4" />
        Start selling
      </button>
      <button
        type="button"
        onClick={() => nav("/pricing")}
        className="inline-flex items-center gap-2 border border-slate-200 bg-white text-slate-800 font-black px-4 py-2.5 rounded-xl hover:bg-slate-50"
      >
        Upgrade plan
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Welcome back, {name}!</h2>
            <p className="text-sm text-slate-600 mt-1">Manage your account, messages, and activity.</p>
          </div>

          {topRightCTA}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-sm font-black text-slate-700">Saved Items</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{savedCount}</div>
            <div className="text-sm text-slate-500 mt-1">Items in wishlist</div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-sm font-black text-slate-700">Unread Messages</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{messagingEnabled ? unread : 0}</div>
            <div className="text-sm text-slate-500 mt-1">
              {messagingEnabled ? "Require attention" : "Messaging is currently disabled"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-sm font-black text-slate-700">Account</div>
            <div className="text-3xl font-black text-slate-900 mt-2 capitalize">{membership}</div>
            <div className="text-sm text-slate-500 mt-1">Membership tier</div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="text-sm font-black text-slate-700">User Type</div>
            <div className="text-3xl font-black text-slate-900 mt-2 capitalize">{userType}</div>
            <div className="text-sm text-slate-500 mt-1">Buyer / Seller</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => nav("/saved")}
            className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
          >
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-slate-700" />
              <div>
                <div className="font-black text-slate-900">Saved Items</div>
                <div className="text-sm text-slate-600">View wishlist</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => nav("/inbox")}
            className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-slate-700" />
              <div>
                <div className="font-black text-slate-900">Messages</div>
                <div className="text-sm text-slate-600">Chat with sellers/buyers</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => (isSeller ? nav("/my-shop") : startSelling())}
            className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
          >
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-slate-700" />
              <div>
                <div className="font-black text-slate-900">Seller Tools</div>
                <div className="text-sm text-slate-600">
                  {isSeller ? "Manage your shop" : "Start selling with a verified shop"}
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => nav("/settings")}
            className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-700" />
              <div>
                <div className="font-black text-slate-900">Settings</div>
                <div className="text-sm text-slate-600">Profile & account</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => nav("/notifications")}
            className={cn("rounded-2xl border border-slate-200 p-4 text-left hover:bg-slate-50 transition")}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-slate-700" />
              <div>
                <div className="font-black text-slate-900">Notifications</div>
                <div className="text-sm text-slate-600">Updates & alerts</div>
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
                <div className="text-sm text-slate-600">Personal info</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
