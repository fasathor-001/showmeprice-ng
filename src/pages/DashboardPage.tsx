// src/pages/DashboardPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { Heart, MessageSquare, Bell, Settings, Store, User2, Plus } from "lucide-react";
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

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile, business, loading: profileLoading } = useProfile() as any;
  const FF = useFF() as any;

  const profileReady = !!user && !profileLoading;
  const userType = profileReady ? String((profile as any)?.user_type ?? "").toLowerCase() : "";
  const membership = profileReady ? String((profile as any)?.membership_tier ?? "free").toLowerCase() : "free";
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
          .from("saved_items")
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

  const startSelling = () => {
    if (!user) {
      (window as any).openAuthModal?.();
      return;
    }
    // ✅ Do NOT change user_type yet. Let user confirm on Seller setup screen.
    try {
      localStorage.setItem(PENDING_BECOME_SELLER_KEY, "1");
    } catch {}
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
        Seller account active
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
