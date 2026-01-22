import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatNairaFromKobo } from "../lib/escrowFee";

type EscrowOrder = {
  id: string;
  status: string;
  delivery_status: string;
  dispute_status: string;
  subtotal_kobo: number;
  escrow_fee_kobo: number;
  total_kobo: number;
  settlement_status?: string | null;
  released_at?: string | null;
  refunded_at?: string | null;
  created_at: string;
};

function nav(to: string) {
  try {
    if (window.location.pathname !== to) window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("smp:navigate"));
  } catch {
    window.location.href = to;
  }
}

export default function EscrowSalesPage() {
  const [rows, setRows] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("escrow_orders")
        .select(
          "id,status,delivery_status,dispute_status,subtotal_kobo,escrow_fee_kobo,total_kobo,settlement_status,released_at,refunded_at,created_at"
        )
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setRows((data ?? []) as EscrowOrder[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load escrow orders.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const getSettlementLabel = (row: EscrowOrder) => {
    if (row.refunded_at) return "Refunded";
    if (row.released_at) return "Released to Seller";
    if (row.status === "paid" && row.delivery_status === "confirmed") return "Awaiting Admin Release";
    if (row.status === "paid") return "Paid (On Hold)";
    return "Not paid";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">Escrow Orders</h2>
          <p className="text-sm text-slate-600">Monitor delivery and dispute status.</p>
        </div>
        <button
          type="button"
          onClick={() => nav("/my-shop")}
          className="px-3 py-2 rounded-lg border text-slate-700 font-bold hover:bg-slate-50"
        >
          Back to My Shop
        </button>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="border rounded-xl p-4 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-bold text-slate-900">Escrow #{row.id.slice(0, 8)}</div>
              <div className="text-xs text-slate-500">
                {new Date(row.created_at).toLocaleDateString("en-NG")}
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-700">
              Status: <span className="font-bold">{row.status}</span> ?? Delivery:{" "}
              <span className="font-bold">{row.delivery_status}</span> ?? Dispute:{" "}
              <span className="font-bold">{row.dispute_status}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Settlement: <span className="font-bold text-slate-700">{getSettlementLabel(row)}</span>
            </div>
            {row.released_at ? (
              <div className="mt-1 text-xs text-slate-500">
                Admin released on {new Date(row.released_at).toLocaleDateString("en-NG")}
              </div>
            ) : null}
            {row.refunded_at ? (
              <div className="mt-1 text-xs text-slate-500">
                Admin refunded on {new Date(row.refunded_at).toLocaleDateString("en-NG")}
              </div>
            ) : null}
            <div className="mt-2 text-sm text-slate-700">
              Item: {formatNairaFromKobo(row.subtotal_kobo)} ?? Fee: {formatNairaFromKobo(row.escrow_fee_kobo)} ?? Total:{" "}
              {formatNairaFromKobo(row.total_kobo)}
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 ? (
          <div className="text-sm text-slate-500">No escrow orders yet.</div>
        ) : null}
      </div>
    </div>
  );
}
