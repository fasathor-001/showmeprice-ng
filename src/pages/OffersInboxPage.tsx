import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useFF } from "../hooks/useFF";
import { invokeAuthedFunction } from "../lib/invokeAuthedFunction";

function formatMoney(amount: number) {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "?0";
  return `?${n.toLocaleString("en-NG")}`;
}

function emitToast(type: "success" | "error" | "info", message: string) {
  window.dispatchEvent(new CustomEvent("smp:toast", { detail: { type, message } }));
}

export default function OffersInboxPage() {
  const { user } = useAuth();
  const FF = useFF() as any;
  const offersEnabled = !!FF?.isEnabled?.("make_offer_enabled", false);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadOffers = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("offers")
      .select("id, product_id, amount, currency, status, created_at, expires_at, product_title_snapshot")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      setError(error.message);
      setOffers([]);
    } else {
      setOffers((data as any[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!offersEnabled) return;
    loadOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offersEnabled, user?.id]);

  const runAction = async (offerId: string, action: "accept" | "decline" | "counter") => {
    setActioning(offerId);
    try {
      let amount: number | undefined = undefined;
      if (action === "counter") {
        const next = window.prompt("Enter counter offer amount (NGN):", "");
        const parsed = Number(String(next ?? "").replace(/,/g, ""));
        if (!Number.isFinite(parsed) || parsed <= 0) {
          emitToast("info", "Counter amount is required.");
          return;
        }
        amount = Math.round(parsed * 100) / 100;
      }

      const { error } = await invokeAuthedFunction("offer_action", {
        body: { offerId, action, amount: amount ?? null },
      });
      if (error) throw error;
      emitToast("success", `Offer ${action}ed.`);
      await loadOffers();
    } catch (err: any) {
      emitToast("error", err?.message ?? "Action failed.");
    } finally {
      setActioning(null);
    }
  };

  if (!offersEnabled) {
    return <div className="p-6 text-sm text-slate-600">Offers are currently disabled.</div>;
  }

  return (
    <div className="p-6">
      <div className="text-xl font-black text-slate-900">Offers Inbox</div>
      <div className="text-xs text-slate-500 mt-1">Manage offers from buyers.</div>

      {loading ? <div className="text-sm text-slate-500 mt-4">Loading...</div> : null}
      {error ? <div className="text-sm text-rose-600 mt-4">{error}</div> : null}

      {!loading && !error && offers.length === 0 ? (
        <div className="text-sm text-slate-500 mt-4">No offers yet.</div>
      ) : null}

      <div className="mt-4 space-y-3">
        {offers.map((offer) => {
          const status = String(offer.status ?? "").toLowerCase();
          const title = offer.product_title_snapshot || "Offer";
          const canAct = status === "sent" || status === "pending" || status === "countered";
          return (
            <div key={offer.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-slate-900">{title}</div>
                <div className="text-xs font-bold text-slate-500 uppercase">{status || "sent"}</div>
              </div>
              <div className="mt-2 text-sm text-slate-700">
                Amount: <span className="font-black text-slate-900">{formatMoney(offer.amount)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">{offer.created_at}</div>
              {canAct ? (
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => runAction(offer.id, "accept")}
                    disabled={actioning === offer.id}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(offer.id, "decline")}
                    disabled={actioning === offer.id}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(offer.id, "counter")}
                    disabled={actioning === offer.id}
                    className="px-3 py-2 rounded-lg border border-amber-200 text-xs font-black text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                  >
                    Counter
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
