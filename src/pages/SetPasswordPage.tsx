import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { getAuthSession } from "../lib/authSession";

function nav(to: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const session = getAuthSession();
      if (!session) {
        setError("Please sign in again.");
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      setSuccess("Password set. Redirecting...");
      const role = String(
        (session.user as any)?.app_metadata?.role ??
          (session.user as any)?.user_metadata?.role ??
          ""
      ).toLowerCase();
      const next = role === "admin" ? "/admin" : "/dashboard";
      setTimeout(() => nav(next), 700);
    } catch (e: any) {
      setError(e?.message ?? "Failed to set password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-slate-900 mb-2">Set your password</h1>
      <p className="text-sm text-slate-600 mb-6">Create a new password to finish setup.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          {saving ? "Saving..." : "Set Password"}
        </button>
      </form>

      {error ? <div className="mt-4 text-sm text-rose-600">{error}</div> : null}
      {success ? <div className="mt-4 text-sm text-emerald-600">{success}</div> : null}
    </div>
  );
}
