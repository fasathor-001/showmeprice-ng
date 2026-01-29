import React, { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAdmin } from "../../hooks/useAdmin";
import { useProfile } from "../../hooks/useProfile";

export default function AdminApprovalsPage() {
  const { profile, loading: profileLoading } = useProfile();
  const isAdmin =
    !!(profile as any)?.is_admin ||
    String((profile as any)?.role ?? "").toLowerCase() === "admin" ||
    String((profile as any)?.user_type ?? "").toLowerCase() === "admin";

  const {
    stats,
    pendingVerifications,
    loading: statsLoading,
    approveSeller,
    approveSellers,
    rejectSeller,
  } = useAdmin(isAdmin);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingVerifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingVerifications.map((v: any) => v.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkApprove = async () => {
    const pendingIds = new Set(pendingVerifications.map((v: any) => String(v.id)));
    const eligibleIds = selectedIds.filter((id) => pendingIds.has(id));
    if (confirm(`Are you sure you want to verify ${eligibleIds.length} sellers?`)) {
      await approveSellers(eligibleIds);
      setSelectedIds([]);
    }
  };

  if (statsLoading || profileLoading) {
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
        <h2 className="text-2xl font-black text-slate-900">Seller Approvals</h2>
        <p className="text-sm text-slate-600">Review and approve seller applications.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-amber-50 border-amber-100 rounded-xl border">
          <div className="text-amber-600 text-xs font-bold uppercase">Pending Sellers</div>
          <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
        </div>
      </div>

      {pendingVerifications.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed">
          <ShieldAlert className="w-12 h-12 text-emerald-300 mx-auto mb-2" />
          <p className="text-slate-500 font-medium">All pending verifications cleared.</p>
        </div>
      ) : (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={selectedIds.length === pendingVerifications.length}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs font-bold text-slate-500 uppercase">Select All</span>
              </div>
            {selectedIds.length > 0 ? (
              <button
                onClick={handleBulkApprove}
                className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-sm flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                Approve Selected ({selectedIds.length})
              </button>
            ) : null}
          </div>

          {pendingVerifications.map((biz: any) => (
            <div
              key={biz.id}
              className={`bg-white border p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition ${
                selectedIds.includes(biz.id) ? "ring-2 ring-emerald-500 bg-emerald-50/10" : ""
              }`}
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-brand rounded"
                    checked={selectedIds.includes(biz.id)}
                    onChange={() => toggleSelect(biz.id)}
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">
                    {biz.profiles?.display_name || biz.profiles?.full_name || biz.profiles?.username || "Seller"}
                  </h4>
                  <div className="text-sm text-slate-500 flex flex-col gap-1 mt-1">
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> {biz.business_name || "Business name pending"}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> {biz.business_address || "Address pending"}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> {biz.id_type || "ID type pending"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pl-9 md:pl-0">
                <button
                  onClick={() => rejectSeller(biz.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100"
                >
                  Reject
                </button>
                <button
                  onClick={() => approveSeller(biz.id)}
                  className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600"
                >
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
