import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function nav(to: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Track whether Supabase has fired the PASSWORD_RECOVERY event
  const [recoveryReady, setRecoveryReady] = useState(false);
  // Track whether we have confirmed there is NO recovery session (invalid/expired link)
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    // Check immediately — if the user already has an active recovery session
    // (e.g. they refreshed the page), getSession will have it.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setRecoveryReady(true);
        return;
      }

      // Also listen for the PASSWORD_RECOVERY event that fires when the user
      // arrives via the reset email link (token in the URL hash).
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          setRecoveryReady(true);
        }
      });

      // If no session arrives after 4 seconds, treat as invalid/expired link.
      const timer = setTimeout(() => {
        supabase.auth.getSession().then(({ data: d }) => {
          if (!d.session) {
            setInvalidLink(true);
          }
        });
      }, 4000);

      return () => {
        sub.subscription.unsubscribe();
        clearTimeout(timer);
      };
    });
  }, []);

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
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;

      setSuccess("Password updated successfully. Redirecting you home...");
      setPassword("");
      setConfirm("");
      setTimeout(() => nav("/"), 2000);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error("Failed to update password.");
      setError(err.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  const openForgotPassword = () => {
    window.dispatchEvent(
      new CustomEvent("smp:open-auth", { detail: { mode: "reset" } })
    );
    nav("/");
  };

  // Invalid / expired link state
  if (invalidLink) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-10 text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Link expired</h1>
        <p className="text-sm text-slate-600 mb-6">
          This reset link is invalid or has expired. Request a new one to continue.
        </p>
        <button
          type="button"
          onClick={openForgotPassword}
          className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-sm font-bold hover:opacity-90 transition"
        >
          Request a new reset link
        </button>
        <button
          type="button"
          onClick={() => nav("/")}
          className="mt-3 text-sm text-brand font-bold hover:underline block mx-auto"
        >
          Back to Homepage
        </button>
      </div>
    );
  }

  // Loading / waiting for recovery session
  if (!recoveryReady) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-10 text-center">
        <div className="text-sm text-slate-500">Verifying reset link...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-10">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          SMP
        </div>
        <span className="font-bold text-slate-900">ShowMePrice.ng</span>
      </div>

      <h1 className="text-2xl font-black text-slate-900 mb-2">Set a new password</h1>
      <p className="text-sm text-slate-600 mb-6">
        Choose a strong password of at least 8 characters.
      </p>

      {error ? (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg font-bold">
          {success}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-white"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-white"
            placeholder="Repeat your new password"
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving || !!success}
          className="w-full rounded-lg bg-slate-900 text-white px-4 py-3 text-sm font-bold hover:opacity-90 transition disabled:opacity-60"
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => nav("/")}
          className="text-sm text-brand font-bold hover:underline"
        >
          Back to Homepage
        </button>
      </div>
    </div>
  );
}
