import React, { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { invokeAuthedFunction } from "../lib/invokeAuthedFunction";
import { useAdmin } from "../hooks/useAdmin";
import { useProfile } from "../hooks/useProfile";

interface AdminDashboardProps {
  onNavigateHome: () => void;
}

export default function AdminDashboard({ onNavigateHome }: AdminDashboardProps) {
  const { profile, loading: profileLoading } = useProfile();
  const isAdmin = profile?.role === "admin";

  const { stats, loading: statsLoading } = useAdmin(isAdmin);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [revokeEmail, setRevokeEmail] = useState("");
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeNotice, setRevokeNotice] = useState<string | null>(null);

  const handleInviteAdmin = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setInviteNotice("Enter a valid email.");
      return;
    }
    setInviteLoading(true);
    setInviteNotice(null);
    try {
      const { data, error } = await invokeAuthedFunction("invite-admin", {
        body: { email, redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error("Invite failed");
      setInviteNotice(`Invite sent to ${email}`);
      setInviteEmail("");
    } catch (e: any) {
      const status = e?.status ? `status ${e.status}` : "";
      const detail = e?.message ?? "Invite failed";
      const msg = status ? `Invite failed (${status}): ${detail}` : `Invite failed: ${detail}`;
      setInviteNotice(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRevokeAdmin = async () => {
    const email = revokeEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setRevokeNotice("Enter a valid email.");
      return;
    }
    if (!confirm(`Revoke admin access for ${email}?`)) return;
    setRevokeLoading(true);
    setRevokeNotice(null);
    try {
      const { data, error } = await invokeAuthedFunction("revoke-admin", {
        body: { email },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error("Revoke failed");
      setRevokeNotice(`Admin access revoked for ${email}`);
      setRevokeEmail("");
    } catch (e: any) {
      const status = e?.status ? `status ${e.status}` : "";
      const detail = e?.message ?? "Revoke failed";
      const msg = status ? `Revoke failed (${status}): ${detail}` : `Revoke failed: ${detail}`;
      setRevokeNotice(msg);
    } finally {
      setRevokeLoading(false);
    }
  };

  if (statsLoading || profileLoading) {
    return (
      <div className="w-full min-w-0 overflow-x-hidden">
        <div className="w-full max-w-6xl mx-auto px-4 py-6">
          <div className="skeleton w-full h-96 rounded-xl"></div>
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
          <p className="text-slate-500 mb-8">You do not have permission to view the Admin Panel.</p>
          <button onClick={onNavigateHome} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold">
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-50 w-full min-w-0 overflow-x-hidden">
      <div className="bg-slate-900 text-white py-6">
        <div className="w-full max-w-6xl mx-auto px-4 flex justify-between items-center">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-3 text-left hover:opacity-90"
            title="Go to Home"
          >
            <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Admin Overview</h1>
            </div>
          </button>

          <button
            onClick={onNavigateHome}
            className="text-sm font-bold text-slate-300 hover:text-white flex items-center gap-2"
          >
            Exit <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-lg border p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-4">System Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border">
                <div className="text-slate-500 text-xs font-bold uppercase">Total Users</div>
                <div className="text-2xl font-black text-slate-900">{stats.users}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border">
                <div className="text-slate-500 text-xs font-bold uppercase">Active Products</div>
                <div className="text-2xl font-black text-slate-900">{stats.products}</div>
              </div>
              <div className="p-4 bg-amber-50 border-amber-100 rounded-xl border">
                <div className="text-amber-600 text-xs font-bold uppercase">Pending Sellers</div>
                <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
              </div>
              <div className="p-4 bg-red-50 border-red-100 rounded-xl border">
                <div className="text-red-600 text-xs font-bold uppercase">Active Reports</div>
                <div className="text-2xl font-black text-red-700">{stats.violations}</div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-white border rounded-xl p-5">
              <h3 className="text-lg font-black text-slate-900 mb-4">Admin Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-sm font-black text-slate-800 mb-2">Invite Admin</div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="admin@email.com"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleInviteAdmin}
                      disabled={inviteLoading}
                      className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {inviteLoading ? "Sending..." : "Send Invite"}
                    </button>
                  </div>
                  {inviteNotice ? <div className="mt-2 text-xs text-slate-600">{inviteNotice}</div> : null}
                </div>

                <div className="rounded-lg border p-4">
                  <div className="text-sm font-black text-slate-800 mb-2">Revoke Admin</div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="email"
                      value={revokeEmail}
                      onChange={(e) => setRevokeEmail(e.target.value)}
                      placeholder="admin@email.com"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleRevokeAdmin}
                      disabled={revokeLoading}
                      className="w-full px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-60"
                    >
                      {revokeLoading ? "Revoking..." : "Revoke"}
                    </button>
                  </div>
                  {revokeNotice ? <div className="mt-2 text-xs text-slate-600">{revokeNotice}</div> : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
