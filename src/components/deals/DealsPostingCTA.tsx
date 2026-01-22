import React, { useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../hooks/useProfile";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";

export default function DealsPostingCTA() {
  const { user } = useAuth();
  const { profile } = useProfile();

  const { isEnabled, loading, getFlag } = useFeatureFlags();

  const isSeller =
    (user?.user_metadata as any)?.user_type === "seller" ||
    (profile as any)?.user_type === "seller" ||
    (profile as any)?.role === "seller";

  const dealsLive = !loading && !!isEnabled?.("deals_enabled");
  const dealsPostingOpen = !loading && !!isEnabled?.("deals_posting_enabled");

  const seasonLabel = useMemo(() => {
    return (getFlag?.("deals_posting_enabled")?.description || "").trim();
  }, [getFlag]);

  if (!user || !isSeller) return null;
  if (!dealsLive || !dealsPostingOpen) return null;

  const openPostDeal = () => {
    // mark as deal post
    (window as any).__smp_post_kind = "deal";

    const fn = (window as any).openPostItemModal;
    if (typeof fn === "function") {
      fn();
      return;
    }

    // âœ… Fallback: go to "/" so HomePage mounts and registers openPostItemModal
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new Event("smp:navigate"));
    window.scrollTo(0, 0);

    // try again after route switch
    setTimeout(() => {
      const retry = (window as any).openPostItemModal;
      if (typeof retry === "function") retry();
    }, 50);
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div className="font-black text-emerald-900">
          Seasonal Deals Posting is OPEN{seasonLabel ? ` - ${seasonLabel}` : ""} 
        </div>
        <div className="text-emerald-800 text-sm mt-1">
          Post your deal product now. Buyers will see it on the Deals page during the active season.
        </div>
      </div>

      <button
        onClick={openPostDeal}
        type="button"
        className="shrink-0 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-emerald-700"
      >
        Post a Deal
      </button>
    </div>
  );
}

