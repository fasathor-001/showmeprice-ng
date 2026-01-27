import React, { useEffect, useMemo, useState } from "react";
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

export default function MyOffersPage() {
  const { user } = useAuth();
  const FF = useFF() as any;
  const offersEnabled = !!FF?.isEnabled?.("make_offer_enabled", false);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const idempotencyMap = useMemo(() => new Map<string, string>(), []);

  useEffect(() => {
    if (!user?.id) return;
    if (!offersEnabled) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("offers")
        .select("id, product_id, amount, currency, status, created_at, expires_at, product_title_snapshot")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        setError(error.message);
        setOffers([]);
      } else {
        setOffers((data as any[]) ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [offersEnabled, user?.id]);

  const handlePayNow = async (offerId: string) => {
    if (!offerId || paying) return;
    setPaying(offerId);
    try {
      let key = idempotencyMap.get(offerId);
      if (!key) {
        key = crypto.randomUUID();
        idempotencyMap.set(offerId, key);
      }
      const { data, error } = await invokeAuthedFunction("offer_payment_init", {
        body: { offerId, idempotencyKey: key },
      });
      if (error) throw error;
      const url = String((data as any)?.authorizationUrl ?? "");
      if (!url) throw new Error("Payment link missing.");
      window.location.href = url;
    } catch (err: any) {
      emitToast("error", err?.message ?? "Failed to start payment.");
    } finally {
      setPaying(null);
    }
  };

  if (!offersEnabled) {
    return <div className="p-6 text-sm text-slate-600">Offers are currently disabled.</div>;
  }

  return (
    <div className="p-6">
      <div className="text-xl font-black text-slate-900">My Offers</div>
      <div className="text-xs text-slate-500 mt-1">Track offers you have sent.</div>

      {loading ? <div className="text-sm text-slate-500 mt-4">Loading...</div> : null}
      {error ? <div className="text-sm text-rose-600 mt-4">{error}</div> : null}

      {!loading && !error && offers.length === 0 ? (
        <div className="text-sm text-slate-500 mt-4">No offers yet.</div>
      ) : null}

      <div className="mt-4 space-y-3">
        {offers.map((offer) => {
          const status = String(offer.status ?? "").toLowerCase();
          const title = offer.product_title_snapshot || "Offer";
          const canPay = status === "accepted";
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
              {canPay ? (
                <button
                  type="button"
                  onClick={() => handlePayNow(offer.id)}
                  disabled={paying === offer.id}
                  className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-60"
                >
                  {paying === offer.id ? "Starting..." : "Pay now"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
