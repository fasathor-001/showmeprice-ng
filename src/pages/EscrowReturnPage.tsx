import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

function nav(to: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

export default function EscrowReturnPage() {
  const [status, setStatus] = useState("Confirming payment...");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const inFlight = useRef(false);

  const reference = typeof window !== "undefined"
    ? String(
        new URLSearchParams(window.location.search).get("reference") ??
          new URLSearchParams(window.location.search).get("trxref") ??
          ""
      ).trim()
    : "";

  const verifyNow = useCallback(async () => {
    if (!reference) {
      setError("Missing payment reference.");
      setStatus("Unable to verify payment.");
      return;
    }

    if (inFlight.current) return false;
    inFlight.current = true;
    setChecking(true);
    setError(null);
    setNeedsLogin(false);

    try {
      const callVerify = async (accessToken: string) => {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/escrow-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || ""),
          },
          body: JSON.stringify({ reference }),
        });
        const data = await resp.json().catch(() => ({}));
        return { resp, data };
      };

      const { data: sessRes } = await supabase.auth.getSession();
      const session = sessRes?.session;
      if (!session?.access_token) {
        setNeedsLogin(true);
        setError("Please sign in to verify payment.");
        setStatus("Unable to verify payment.");
        return false;
      }

      let { resp, data } = await callVerify(session.access_token);
      if (resp.status === 401) {
        await supabase.auth.refreshSession();
        const { data: retrySess } = await supabase.auth.getSession();
        const retryToken = retrySess?.session?.access_token;
        if (retryToken) {
          ({ resp, data } = await callVerify(retryToken));
        }
      }

      if (!resp.ok) {
        throw new Error((data as any)?.error || "Failed to verify payment.");
      }

      const ok = Boolean((data as any)?.ok);
      const status = String((data as any)?.status ?? "").toLowerCase();
      if (ok && status === "success") {
        setConfirmed(true);
        setStatus("Payment confirmed.");
        return true;
      }

      return false;
    } catch (e: any) {
      setError(e?.message ?? "Failed to verify payment.");
      setStatus("Unable to verify payment.");
      return false;
    } finally {
      setChecking(false);
      inFlight.current = false;
    }
  }, [reference]);

  useEffect(() => {
    let cancelled = false;
    const maxAttempts = 20;
    const intervalMs = 1500;

    if (!reference) {
      setError("Missing payment reference.");
      setStatus("Unable to verify payment.");
      return;
    }

    setStatus("Confirming payment...");
    setTimedOut(false);
    setConfirmed(false);
    setError(null);

    const run = async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) return;
        const funded = await verifyNow();
        if (funded) return;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      if (!cancelled) {
        setTimedOut(true);
        setStatus("Payment not confirmed yet.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [verifyNow]);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-slate-900 mb-2">Payment Verification</h1>
      <p className="text-sm text-slate-600">{status}</p>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            setTimedOut(false);
            setConfirmed(false);
            setStatus("Confirming payment...");
            verifyNow();
          }}
          disabled={checking}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-black hover:opacity-90 disabled:opacity-60"
        >
          {checking ? "Checking..." : "Try again"}
        </button>
      </div>
      {confirmed ? (
        <div className="mt-4 text-sm text-emerald-700 font-semibold">
          Payment confirmed. You can view your escrow order details now.
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => nav("/escrow")}
              className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
            >
              View Escrow Orders
            </button>
          </div>
        </div>
      ) : null}
      {needsLogin ? (
        <div className="mt-4 text-sm text-slate-700">
          Please sign in to confirm your escrow payment.
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => nav("/signin")}
              className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
            >
              Sign in
            </button>
          </div>
        </div>
      ) : null}
      {timedOut ? (
        <div className="mt-4 text-sm text-slate-600">
          If this takes too long, check your Inbox or return to the marketplace.
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => nav("/inbox")}
              className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
            >
              Go to Inbox
            </button>
            <button
              type="button"
              onClick={() => nav("/")}
              className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
            >
              Back to Home
            </button>
          </div>
        </div>
      ) : null}
      {error ? <div className="mt-4 text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}
