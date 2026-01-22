import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useFF } from "../hooks/useFF";
import { useEscrow, type EscrowTransaction } from "../hooks/useEscrow";
import { canBuyerUseEscrow } from "../lib/plans";

function formatDate(v?: string | null) {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function EscrowPage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile() as any;
  const FF = useFF();
  const { listBuyerEscrows, confirmReceived, openDispute } = useEscrow();

  const escrowEnabled = !!FF?.isEnabled?.("escrow_enabled", false);

  const eligible = canBuyerUseEscrow(profile, escrowEnabled);

  const [rows, setRows] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );

  const load = useCallback(async () => {
    if (!user?.id || !eligible) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listBuyerEscrows();
      setRows(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load escrow");
    } finally {
      setLoading(false);
    }
  }, [eligible, listBuyerEscrows, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("reference") || params.get("trxref");
      const status = String(params.get("status") ?? "").toLowerCase();
      const pendingRaw = sessionStorage.getItem("smp:escrow_pending");

      if (ref) {
        setPaymentNotice({
          type: "success",
          text: "Payment received. Your escrow will appear shortly.",
        });
        sessionStorage.removeItem("smp:escrow_pending");
        window.history.replaceState({}, "", "/escrow");
        load();
        return;
      }

      if (status === "failed" || status === "cancelled") {
        setPaymentNotice({
          type: "error",
          text: "Payment was cancelled or failed. You can retry from the product page.",
        });
        sessionStorage.removeItem("smp:escrow_pending");
        window.history.replaceState({}, "", "/escrow");
        return;
      }

      if (pendingRaw) {
        setPaymentNotice({
          type: "info",
          text: "Payment pending. Complete checkout or retry from the product page.",
        });
      }
    } catch {
      // ignore
    }
  }, [load]);

  const terminalStatuses = useMemo(
    () => new Set(["released_to_seller", "refund_to_buyer"]),
    []
  );

  if (!user?.id) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-slate-900 font-black text-lg">Sign in required</div>
          <div className="text-slate-600 text-sm mt-1">Please sign in to view escrow orders.</div>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-slate-900 font-black text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-slate-900 font-black text-lg">Escrow unavailable</div>
          <div className="text-slate-600 text-sm mt-1">
            Escrow is available for Premium and Institution buyers only.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="text-lg font-black text-slate-900 mb-4">Your Escrow Orders</div>

        {paymentNotice ? (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-xs font-bold ${
              paymentNotice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : paymentNotice.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {paymentNotice.text}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-600">Loading escrow orders...</div>
        ) : error ? (
          <div className="text-sm text-rose-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-600">No escrow orders yet.</div>
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => {
              const status = String(row.status ?? "");
              const canConfirm = status === "shipped" || status === "awaiting_buyer_confirmation";
              const canDispute =
                !terminalStatuses.has(status) &&
                status !== "buyer_confirmed" &&
                status !== "pending_admin_release" &&
                status !== "disputed";

              return (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-500">Escrow</div>
                      <div className="text-sm font-black text-slate-900">{status || "unknown"}</div>
                    </div>
                    <div className="text-xs text-slate-500">Created: {formatDate(row.created_at)}</div>
                  </div>

                  <div className="mt-2 text-xs text-slate-600 flex flex-wrap gap-3">
                    {row.shipped_at ? <span>Shipped: {formatDate(row.shipped_at)}</span> : null}
                    {row.buyer_confirmed_at ? (
                      <span>Confirmed: {formatDate(row.buyer_confirmed_at)}</span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {canConfirm ? (
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black"
                        onClick={async () => {
                          await confirmReceived(row.id);
                          await load();
                        }}
                      >
                        Confirm Received
                      </button>
                    ) : null}

                    {canDispute ? (
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg border text-xs font-black"
                        onClick={async () => {
                          const reason = window.prompt("Dispute reason");
                          if (!reason) return;
                          const notes = window.prompt("Buyer notes (optional)") ?? undefined;
                          await openDispute(row.id, reason, notes);
                          await load();
                        }}
                      >
                        Open Dispute
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
