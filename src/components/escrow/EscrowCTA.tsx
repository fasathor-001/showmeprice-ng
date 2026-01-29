import React, { useCallback, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useEscrow, type EscrowPaymentInitResult } from "../../hooks/useEscrow";

type EscrowCTAProps = {
  productId: string;
  price: number;
  title?: string;
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (_result: EscrowPaymentInitResult) => void;
};

function formatNaira(value: number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "\u20A60";
  return `\u20A6${n.toLocaleString("en-NG")}`;
}

export default function EscrowCTA({ productId, price, title, onSuccess }: EscrowCTAProps) {
  const { createEscrow } = useEscrow();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const amountKobo = useMemo(() => Math.max(1, Math.round(Number(price ?? 0) * 100)), [price]);

  const resolveSellerId = useCallback(async () => {
    if (sellerId) return sellerId;
    const pid = String(productId ?? "").trim();
    if (!pid) return null;

    const { data, error: qErr } = await supabase
      .from("products")
      .select("id,businesses(user_id)")
      .eq("id", pid)
      .limit(1);
    if (qErr) throw qErr;

    const row = (data?.[0] as Record<string, unknown> | null) ?? null;
    const businesses = (row?.businesses as Record<string, unknown> | null) ?? null;
    const uid = String(businesses?.user_id ?? "").trim();
    if (!uid) return null;

    setSellerId(uid);
    return uid;
  }, [productId, sellerId]);

  const handlePay = useCallback(async () => {
    if (!productId) {
      setError("Missing product.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resolvedSellerId = await resolveSellerId();
      if (!resolvedSellerId) {
        throw new Error("Seller account not available.");
      }

      const result = await createEscrow({
        productId: String(productId),
        sellerId: String(resolvedSellerId),
        amountKobo,
        currency: "NGN",
      });

      onSuccess?.(result);
      window.location.href = result.authorizationUrl;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to start escrow payment.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [amountKobo, createEscrow, onSuccess, productId, resolveSellerId]);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 md:p-5">
      <div className="text-sm font-black text-emerald-900">{"\uD83D\uDD12"} Pay with Escrow</div>
      <p className="text-xs text-emerald-800/80 mt-2">
        Your money is held safely until you confirm delivery.
      </p>
      {title ? <div className="text-xs text-emerald-900 mt-2 font-semibold">{title}</div> : null}

      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-emerald-600 text-white text-sm font-black py-3 hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "Starting escrow..." : `Pay ${formatNaira(price)} with Escrow`}
      </button>

      {error ? <div className="text-xs text-rose-700 mt-2">{error}</div> : null}

      <ul className="mt-4 text-xs text-emerald-900/80 space-y-1 list-disc list-inside">
        <li>Buyer protection</li>
        <li>Seller paid after confirmation</li>
        <li>Dispute support</li>
      </ul>
    </div>
  );
}





