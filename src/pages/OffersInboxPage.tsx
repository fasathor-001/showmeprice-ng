import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useFF } from "../hooks/useFF";
import { invokeAuthedFunction } from "../lib/invokeAuthedFunction";

function formatMoney(amountNgn: number) {
  const n = Number(amountNgn ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function emitToast(type: "success" | "error" | "info", message: string) {
  window.dispatchEvent(new CustomEvent("smp:toast", { detail: { type, message } }));
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-800",
  rejected: "bg-rose-100 text-rose-800",
  countered: "bg-blue-100 text-blue-800",
  canceled: "bg-slate-100 text-slate-600",
  expired: "bg-slate-100 text-slate-500",
};

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
      .select(
        `id, product_id, offer_amount_kobo, accepted_amount_kobo, currency,
         status, created_at, expires_at, product_title_snapshot,
         buyer:buyer_id ( full_name, display_name )`
      )
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
          setActioning(null);
          return;
        }
        amount = Math.round(parsed * 100) / 100;
      }

      const { error } = await invokeAuthedFunction("offer_action", {
        body: { offerId, action, amount: amount ?? null },
      });
      if (error) throw error;

      const label = action === "decline" ? "rejected" : `${action}ed`;
      emitToast("success", `Offer ${label}.`);
      await loadOffers();
    } catch (err: any) {
      emitToast("error", err?.message ?? "Action failed.");
    } finally {
      setActioning(null);
    }
  };

  if (!offersEnabled) {
    return (
      <div className="p-6 text-sm text-slate-600">
        Offers are currently disabled.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Offers Inbox</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Review and respond to offers from buyers.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading offers...</div>
      ) : error ? (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {error}
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
          <div className="text-3xl mb-2">📬</div>
          <div className="text-sm font-bold text-slate-700">No offers yet</div>
          <div className="text-xs text-slate-400 mt-1">
            When buyers make offers on your listings, they'll appear here.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const status = String(offer.status ?? "").toLowerCase();
            const title = offer.product_title_snapshot || "Listing";
            const isPending = status === "pending";
            const amountKobo =
              offer.accepted_amount_kobo ?? offer.offer_amount_kobo ?? 0;
            const amountNgn = Number(amountKobo) / 100;
            const buyerName =
              String(
                (offer.buyer as any)?.full_name ??
                  (offer.buyer as any)?.display_name ??
                  ""
              ).trim() || "Buyer";
            const statusStyle =
              STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
            const isBusy = actioning === offer.id;

            return (
              <div
                key={offer.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm space-y-3 transition ${
                  isPending ? "border-amber-200" : "border-slate-200"
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 truncate">
                      {title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      From{" "}
                      <span className="font-semibold text-slate-700">
                        {buyerName}
                      </span>{" "}
                      · {formatDate(offer.created_at)}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${statusStyle}`}
                  >
                    {status === "declined" ? "rejected" : status || "sent"}
                  </span>
                </div>

                {/* Offer amount */}
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Offer amount
                  </span>
                  <span className="text-lg font-black text-slate-900">
                    {formatMoney(amountNgn)}
                  </span>
                </div>

                {/* Actions — only for pending offers */}
                {isPending ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => runAction(offer.id, "accept")}
                      disabled={isBusy}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 disabled:opacity-60 transition"
                    >
                      {isBusy ? "Working..." : "Accept Offer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(offer.id, "decline")}
                      disabled={isBusy}
                      className="flex-1 py-2.5 rounded-xl border-2 border-rose-200 text-sm font-black text-rose-600 hover:bg-rose-50 disabled:opacity-60 transition"
                    >
                      Reject Offer
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(offer.id, "counter")}
                      disabled={isBusy}
                      className="px-3 py-2.5 rounded-xl border border-amber-200 text-sm font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-60 transition"
                      title="Counter offer"
                    >
                      Counter
                    </button>
                  </div>
                ) : status === "accepted" ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-semibold">
                    {"✓"} Accepted — awaiting buyer payment
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
