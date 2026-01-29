import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatNairaFromKobo } from "../lib/escrowFee";
import { invokeAuthedFunction } from "../lib/invokeAuthedFunction";

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

export default function EscrowOrdersPage() {
  const [rows, setRows] = useState<EscrowOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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
    if (["paid", "funded"].includes(row.status) && row.delivery_status === "confirmed") return "Awaiting Admin Release";
    if (["paid", "funded"].includes(row.status)) return "Funded (On Hold)";
    return "Not paid";
  };

  const runAction = async (action: string, escrowOrderId: string, payload?: Record<string, unknown>) => {
    setSuccess(null);
    setError(null);
    try {
      const { error: fnErr } = await invokeAuthedFunction("escrow_actions", {
        body: { action, escrow_order_id: escrowOrderId, payload },
      });
      if (fnErr) {
        throw new Error(fnErr.message);
      }
      setSuccess(action === "buyer_confirm_delivery" ? "Delivery confirmed." : "Dispute submitted.");
      await loadRows();
    } catch (e: any) {
      setError(e?.message ?? "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">Your Escrow Orders</h2>
          <p className="text-sm text-slate-600">Track delivery and confirm when you receive items.</p>
        </div>
        <button
          type="button"
          onClick={() => nav("/marketplace")}
          className="px-3 py-2 rounded-lg border text-slate-700 font-bold hover:bg-slate-50"
        >
          Back to Marketplace
        </button>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      {success ? <div className="text-sm text-emerald-700">{success}</div> : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const canConfirm =
            ["paid", "funded"].includes(row.status) &&
            row.delivery_status !== "confirmed" &&
            row.dispute_status === "none";
          const canDispute = ["paid", "funded"].includes(row.status) && row.dispute_status === "none";
          return (
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
              <div className="mt-3 flex flex-wrap gap-2">
                {canConfirm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOrderId(row.id);
                      setConfirmOpen(true);
                    }}
                    disabled={actionLoading}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
                  >
                    Confirm Delivery
                  </button>
                ) : null}
                {canDispute ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOrderId(row.id);
                      setDisputeReason("");
                      setDisputeOpen(true);
                    }}
                    disabled={actionLoading}
                    className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 font-bold text-sm hover:bg-rose-50 disabled:opacity-60"
                  >
                    Open Dispute
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {!loading && rows.length === 0 ? (
          <div className="text-sm text-slate-500">No escrow orders yet.</div>
        ) : null}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full">
            <div className="text-lg font-black text-slate-900">Confirm delivery</div>
            <p className="text-sm text-slate-600 mt-2">
              Confirm you received the item in good condition?
            </p>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border font-bold text-slate-700"
                onClick={() => setConfirmOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-60"
                disabled={actionLoading}
                onClick={async () => {
                  if (!activeOrderId) return;
                  setActionLoading(true);
                  setConfirmOpen(false);
                  await runAction("buyer_confirm_delivery", activeOrderId);
                }}
              >
                {actionLoading ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {disputeOpen ? (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full">
            <div className="text-lg font-black text-slate-900">Open a Dispute</div>
            <p className="text-sm text-slate-600 mt-2">
              Tell us what went wrong (min 10 characters).
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm"
              rows={4}
              maxLength={500}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border font-bold text-slate-700"
                onClick={() => setDisputeOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-rose-600 text-white font-bold disabled:opacity-60"
                disabled={actionLoading || disputeReason.trim().length < 10}
                onClick={async () => {
                  if (!activeOrderId) return;
                  setActionLoading(true);
                  setDisputeOpen(false);
                  const reason = disputeReason.trim();
                  if (reason.length < 10) {
                    setError("Please describe the issue (at least 10 characters).");
                    return;
                  }
                  await runAction("buyer_open_dispute", activeOrderId, { reason });
                }}
              >
                {actionLoading ? "Submitting..." : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
