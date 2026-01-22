import React from "react";
import { ShieldAlert } from "lucide-react";
import { useAdmin } from "../../hooks/useAdmin";
import { useProfile } from "../../hooks/useProfile";

function parseContext(context: string) {
  try {
    return JSON.parse(context);
  } catch {
    return { raw: context };
  }
}

export default function AdminViolationsPage() {
  const { profile, loading: profileLoading } = useProfile();
  const isAdmin = profile?.role === "admin";

  const {
    stats,
    violations,
    loading: statsLoading,
    suspendBusiness,
    dismissViolation,
  } = useAdmin(isAdmin);

  const handleSuspend = async (log: any) => {
    const parsed = parseContext(log.context);
    const businessId = parsed.businessId;

    if (!businessId) {
      alert(`Cannot auto-suspend: Business ID missing. Context: ${log.context}`);
      return;
    }

    if (confirm(`SUSPEND ${parsed.sellerName || "Seller"}? This deactivates all products.`)) {
      const success = await suspendBusiness(businessId);
      if (success) {
        alert("Business suspended.");
        dismissViolation(log.id);
      }
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

  if (!profile || profile.role !== "admin") {
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
        <h2 className="text-2xl font-black text-slate-900">Violations</h2>
        <p className="text-sm text-slate-600">Review reports and enforce platform safety.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-red-50 border-red-100 rounded-xl border">
          <div className="text-red-600 text-xs font-bold uppercase">Active Reports</div>
          <div className="text-2xl font-black text-red-700">{stats.violations}</div>
        </div>
      </div>

      {violations.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed">
          <ShieldAlert className="w-12 h-12 text-blue-300 mx-auto mb-2" />
          <p className="text-slate-500 font-medium">No active violations detected.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-xl bg-white">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3">Violation</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {violations.map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{log.users?.full_name || "System"}</div>
                    <div className="text-xs text-slate-400">{new Date(log.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold border mb-1 inline-block ${
                        log.type === "chat_contact_leak"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-red-100 text-red-700 border-red-200"
                      }`}
                    >
                      {log.type === "product_report" ? "Product Flag" : "Chat Policy"}
                    </span>
                    <div className="text-xs text-slate-600 font-mono bg-slate-100 p-1 rounded max-w-xs truncate">
                      {log.original_content}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {log.type === "product_report" && (
                        <button
                          onClick={() => handleSuspend(log)}
                          className="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold border border-transparent hover:border-red-100"
                        >
                          Suspend
                        </button>
                      )}
                      <button
                        onClick={() => dismissViolation(log.id)}
                        className="text-slate-500 hover:bg-slate-100 px-3 py-1 rounded text-xs font-bold"
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
