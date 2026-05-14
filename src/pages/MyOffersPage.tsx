import React, { useEffect, useMemo, useState } from "react";
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
  paid: "bg-emerald-100 text-emerald-900",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Rejected",
  rejected: "Rejected",
  countered: "Countered",
  canceled: "Canceled",
  expired: "Expired",
  paid: "Paid",
};

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
    if (!user?.id || !offersEnabled) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("offers")
        .select(
          `id, product_id, offer_amount_kobo, accepted_amount_kobo, currency,
           status, payment_status, created_at, expires_at, product_title_snapshot`
        )
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
    return () => { cancelled = true; };
  }, [offersEnabled, user?.id]);

  const handlePayWithEscrow = async (offerId: string) => {
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
    return (
      <div className="p-6 text-sm text-slate-600">
        Offers are currently disabled.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900">My Offers</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Track offers you have sent to sellers.
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
          <div className="text-3xl mb-2">🤝</div>
          <div className="text-sm font-bold text-slate-700">No offers yet</div>
          <div className="text-xs text-slate-400 mt-1">
            Browse listings and make an offer on any product.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const status = String(offer.status ?? "").toLowerCase();
            const paymentStatus = String(offer.payment_status ?? "").toLowerCase();
            const title = offer.product_title_snapshot || "Listing";
            const isAccepted = status === "accepted";
            const isPaid = status === "paid" || paymentStatus === "paid";
            const canPay =
              isAccepted && !isPaid && (!paymentStatus || paymentStatus === "unpaid");
            const amountKobo =
              offer.accepted_amount_kobo ?? offer.offer_amount_kobo ?? 0;
            const amountNgn = Number(amountKobo) / 100;
            const statusStyle =
              STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600";
            const statusLabel = STATUS_LABEL[status] ?? status;
            const isBusy = paying === offer.id;

            return (
              <div
                key={offer.id}
                className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition ${
                  isAccepted && canPay
                    ? "border-emerald-300 ring-1 ring-emerald-200"
                    : "border-slate-200"
                }`}
              >
                {/* Accepted banner — most prominent state */}
                {isAccepted && canPay ? (
                  <div className="bg-emerald-600 px-4 py-2.5 flex items-center gap-2">
                    <span className="text-white text-xs font-black">
                      {"✓"} Offer accepted!
                    </span>
                    <span className="text-emerald-200 text-xs">
                      Pay with escrow to secure your order.
                    </span>
                  </div>
                ) : null}

                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-slate-900 truncate">
                        {title}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Sent {formatDate(offer.created_at)}
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${statusStyle}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      {isAccepted ? "Agreed amount" : "Your offer"}
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {formatMoney(amountNgn)}
                    </span>
                  </div>

                  {/* Pay with Escrow CTA */}
                  {canPay ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handlePayWithEscrow(offer.id)}
                        disabled={isBusy}
                        className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 transition shadow-sm flex items-center justify-center gap-2"
                      >
                        {"🔒"}{" "}
                        {isBusy
                          ? "Starting payment..."
                          : `Pay with Escrow Protection (${formatMoney(amountNgn)})`}
                      </button>
                      <p className="text-xs text-center text-slate-400">
                        Secure payment — seller is paid only after you confirm delivery.
                      </p>
                    </div>
                  ) : status === "pending" ? (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      {"⏳"} Waiting for the seller to respond.
                    </div>
                  ) : status === "declined" || status === "rejected" ? (
                    <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                      {"✕"} The seller did not accept this offer.
                    </div>
                  ) : status === "countered" ? (
                    <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      {"↩"} The seller made a counter offer. Check your messages.
                    </div>
                  ) : isPaid ? (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-semibold">
                      {"✓"} Payment complete. Check your escrow dashboard.
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
