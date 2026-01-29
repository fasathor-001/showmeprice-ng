import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatNairaFromKobo } from "../lib/escrowFee";

type EscrowRow = {
  id: string;
  status: string | null;
  amount_kobo?: number | null;
  subtotal_kobo?: number | null;
  escrow_fee_kobo?: number | null;
  total_kobo?: number | null;
  paid_at?: string | null;
};

export default function EscrowStatusPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escrow, setEscrow] = useState<EscrowRow | null>(null);

  useEffect(() => {
    let alive = true;
    let intervalId: any = null;
    let timeoutId: any = null;

    const load = async () => {
      try {
        const u = new URL(window.location.href);
        const reference = String(u.searchParams.get("reference") || "").trim();
        let escrowId = String(u.searchParams.get("escrow_order_id") || "").trim();

        if (!escrowId && reference) {
          const { data: pi } = await supabase
            .from("payment_intents")
            .select("target_id")
            .eq("reference", reference)
            .maybeSingle();
          escrowId = String((pi as any)?.target_id ?? "");
        }

        if (!escrowId) {
          if (alive) {
            setError("Missing escrow reference.");
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("escrow_orders")
          .select("id,status,amount_kobo,subtotal_kobo,escrow_fee_kobo,total_kobo,paid_at")
          .eq("id", escrowId)
          .maybeSingle();

        if (!alive) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        const nextEscrow = (data as any) ?? null;
        setEscrow(nextEscrow);
        setLoading(false);
        const nextStatus = String(nextEscrow?.status ?? "").toLowerCase();
        if (nextStatus === "funded" && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message ?? "Failed to load escrow status.");
          setLoading(false);
        }
      }
    };

    load();
    intervalId = setInterval(load, 4000);
    timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId);
    }, 60000);

    return () => {
      alive = false;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const status = String(escrow?.status ?? "pending").toLowerCase();
  const subtotalKobo = Number(escrow?.amount_kobo ?? escrow?.subtotal_kobo ?? 0);
  const feeKobo = Number(escrow?.escrow_fee_kobo ?? 0);
  const totalKobo = Number(escrow?.total_kobo ?? 0);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="text-2xl font-black text-slate-900">Escrow Status</div>
      {loading ? <div className="text-sm text-slate-500 mt-2">Payment pending, refreshing...</div> : null}
      {error ? <div className="text-sm text-rose-600 mt-2">{error}</div> : null}

      {escrow ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">Status</div>
          <div className="text-lg font-black text-slate-900 mt-1">{status}</div>
          <div className="text-xs text-slate-500 mt-2">Escrow ID: {escrow.id}</div>

          <div className="mt-4 text-sm text-slate-700 space-y-1">
            <div>Item: {formatNairaFromKobo(subtotalKobo)}</div>
            <div>Fee: {formatNairaFromKobo(feeKobo)}</div>
            <div className="font-black">Total: {formatNairaFromKobo(totalKobo)}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
