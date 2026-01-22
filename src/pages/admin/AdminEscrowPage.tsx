import React, { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { formatNairaFromKobo } from "../../lib/escrowFee";
import { invokeAuthedFunction } from "../../lib/invokeAuthedFunction";
import { useProfile } from "../../hooks/useProfile";
import { useAuth } from "../../hooks/useAuth";

type EscrowRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  buyer_display?: { id?: string | null; name?: string | null; email?: string | null } | null;
  seller_display?: { id?: string | null; name?: string | null; email?: string | null } | null;
  product_snapshot: Record<string, unknown> | null;
  subtotal_kobo: number;
  escrow_fee_kobo: number;
  total_kobo: number;
  dispute_reason: string | null;
  dispute_opened_at: string | null;
  status: string;
  dispute_status: string;
  delivery_status?: string | null;
  settlement_status?: string | null;
  released_at?: string | null;
};

function renderIdentity(display?: { name?: string | null; email?: string | null }, fallbackRole?: string) {
  const name = String(display?.name ?? "").trim();
  const email = String(display?.email ?? "").trim();
  const role = String(fallbackRole ?? "User");
  const primary = name || email || role;

  return (
    <div>
      <div className="font-semibold text-slate-900">{primary}</div>
      {name && email ? <div className="text-xs text-slate-500">{email}</div> : null}
    </div>
  );
}

type ModalAction = "admin_release_to_seller" | "admin_resolve_dispute";

type ModalResolution = "release_to_seller" | "refund_buyer" | null;

export default function AdminEscrowPage() {
  const { authReady, user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const isAdmin =
    !!(profile as any)?.is_admin ||
    String((profile as any)?.role ?? "").toLowerCase() === "admin" ||
    String((profile as any)?.user_type ?? "").toLowerCase() === "admin";

  const [rows, setRows] = useState<EscrowRow[]>([]);
  const [pendingReleases, setPendingReleases] = useState<EscrowRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [modalOrderId, setModalOrderId] = useState<string | null>(null);
  const [modalResolution, setModalResolution] = useState<ModalResolution>(null);
  const [noteText, setNoteText] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: disputesData, error: disputesErr }, { data: releasesData, error: releasesErr }] =
        await Promise.all([
          invokeAuthedFunction("escrow_actions", { body: { action: "admin_list_open_disputes" } }),
          invokeAuthedFunction("escrow_actions", { body: { action: "admin_list_pending_releases" } }),
        ]);

      if (disputesErr) throw new Error(disputesErr.message);
      if (releasesErr) throw new Error(releasesErr.message);

      const list = ((disputesData as any)?.disputes ?? []) as EscrowRow[];
      const releases = ((releasesData as any)?.releases ?? []) as EscrowRow[];
      setRows(list);
      setPendingReleases(releases);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load escrow data.");
      setRows([]);
      setPendingReleases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady || !user) return;
    if (!isAdmin) return;
    loadRows();
  }, [authReady, user, isAdmin]);

  const openModal = (action: ModalAction, orderId: string, resolution?: ModalResolution) => {
    setModalAction(action);
    setModalOrderId(orderId);
    setModalResolution(resolution ?? null);
    setNoteText("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAction(null);
    setModalOrderId(null);
    setModalResolution(null);
    setNoteText("");
  };

  const confirmModal = async () => {
    if (!modalAction || !modalOrderId) return;
    setNotice(null);
    setActionId(modalOrderId);
    const note = noteText.trim();
    const noteRequired = modalResolution === "refund_buyer";

    if (noteRequired && note.length < 5) {
      setError("Admin note must be at least 5 characters.");
      return;
    }
    if (!noteRequired && note && note.length < 5) {
      setError("Admin note must be at least 5 characters.");
      return;
    }

    try {
      const payload: Record<string, unknown> = {};
      if (modalResolution) payload.resolution = modalResolution;
      if (note) payload.note = note;

      const { error: fnErr } = await invokeAuthedFunction("escrow_actions", {
        body: {
          action: modalAction,
          escrow_order_id: modalOrderId,
          payload,
        },
      });
      if (fnErr) throw new Error(fnErr.message);

      if (modalAction === "admin_release_to_seller") {
        setPendingReleases((prev) => prev.filter((row) => row.id !== modalOrderId));
        setNotice("Funds released to seller.");
      } else {
        setRows((prev) => prev.filter((row) => row.id !== modalOrderId));
        setNotice("Dispute resolved.");
      }
      closeModal();
      await loadRows();
    } catch (e: any) {
      setError(e?.message ?? "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  const displayRows = useMemo(() => rows, [rows]);
  const displayReleases = useMemo(() => pendingReleases, [pendingReleases]);

  if (profileLoading) {
    return (
      <div className="w-full min-w-0 overflow-x-hidden">
        <div className="w-full max-w-6xl mx-auto px-4 py-6">
          <div className="skeleton w-full h-80 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!profile || !isAdmin) {
    return (
      <div className="w-full min-w-0 overflow-x-hidden">
        <div className="w-full max-w-6xl mx-auto px-4 py-6 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-8">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Escrow</h2>
        <p className="text-sm text-slate-600">Manage releases and disputes.</p>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading escrow...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      {notice ? <div className="text-sm text-emerald-700">{notice}</div> : null}

      <div className="space-y-4">
        <div>
          <div className="text-sm font-black text-slate-900">Pending Releases</div>
          <div className="text-xs text-slate-500">Paid + delivery confirmed, awaiting admin release.</div>
        </div>

        {displayReleases.length === 0 && !loading ? (
          <div className="text-sm text-slate-500">No pending releases.</div>
        ) : (
          <div className="overflow-x-auto border rounded-xl bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Amounts</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayReleases.map((row) => {
                  const snapshot = row.product_snapshot || {};
                  const title = String((snapshot as any)?.title ?? "(no snapshot)");

                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">#{row.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500">Paid, confirmed</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{title}</div>
                      </td>
                      <td className="px-4 py-3">
                        {renderIdentity(row.buyer_display, "Buyer")}
                      </td>
                      <td className="px-4 py-3">
                        {renderIdentity(row.seller_display, "Seller")}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>Item: {formatNairaFromKobo(row.subtotal_kobo)}</div>
                        <div>Fee: {formatNairaFromKobo(row.escrow_fee_kobo)}</div>
                        <div className="font-bold">Total: {formatNairaFromKobo(row.total_kobo)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={actionId === row.id}
                          onClick={() => openModal("admin_release_to_seller", row.id)}
                          className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-60"
                        >
                          {actionId === row.id ? "Releasing..." : "Release to Seller"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-sm font-black text-slate-900">Open Disputes</div>
          <div className="text-xs text-slate-500">Resolve buyer disputes.</div>
        </div>

        {displayRows.length === 0 && !loading ? (
          <div className="text-sm text-slate-500">No open disputes.</div>
        ) : (
          <div className="overflow-x-auto border rounded-xl bg-white">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Amounts</th>
                  <th className="px-4 py-3">Dispute</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayRows.map((row) => {
                  const snapshot = row.product_snapshot || {};
                  const title = String((snapshot as any)?.title ?? "(no snapshot)");

                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">#{row.id.slice(0, 8)}</div>
                        <div className="text-xs text-slate-500">{row.status}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{title}</div>
                      </td>
                      <td className="px-4 py-3">
                        {renderIdentity(row.buyer_display, "Buyer")}
                      </td>
                      <td className="px-4 py-3">
                        {renderIdentity(row.seller_display, "Seller")}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>Item: {formatNairaFromKobo(row.subtotal_kobo)}</div>
                        <div>Fee: {formatNairaFromKobo(row.escrow_fee_kobo)}</div>
                        <div className="font-bold">Total: {formatNairaFromKobo(row.total_kobo)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div className="font-bold">{row.dispute_reason || "No reason"}</div>
                        {row.dispute_opened_at ? (
                          <div className="text-[11px] text-slate-500">
                            {new Date(row.dispute_opened_at).toLocaleDateString("en-NG")}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => openModal("admin_resolve_dispute", row.id, "release_to_seller")}
                            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-60"
                          >
                            {actionId === row.id ? "Working..." : "Release to Seller"}
                          </button>
                          <button
                            type="button"
                            disabled={actionId === row.id}
                            onClick={() => openModal("admin_resolve_dispute", row.id, "refund_buyer")}
                            className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold disabled:opacity-60"
                          >
                            {actionId === row.id ? "Working..." : "Refund Buyer"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full">
            <div className="text-lg font-black text-slate-900">Admin Note</div>
            <p className="text-sm text-slate-600 mt-2">
              Admin note (required for refund, optional for release).
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm"
              rows={4}
              maxLength={500}
            />
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border font-bold text-slate-700"
                onClick={closeModal}
                disabled={actionId === modalOrderId}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-slate-900 text-white font-bold disabled:opacity-60"
                disabled={actionId === modalOrderId}
                onClick={confirmModal}
              >
                {actionId === modalOrderId ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
