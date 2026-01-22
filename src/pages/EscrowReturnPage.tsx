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

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("verify_escrow_status", {
        body: { reference },
      });

      if (fnErr) throw fnErr;
      const funded = Boolean((data as any)?.funded);

      if (funded) {
        nav(`/escrow/success?reference=${encodeURIComponent(reference)}`);
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
        setStatus("Payment pending. Please refresh in a moment.");
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
            setStatus("Confirming payment...");
            verifyNow();
          }}
          disabled={checking}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white font-black hover:opacity-90 disabled:opacity-60"
        >
          {checking ? "Checking..." : "Refresh status"}
        </button>
      </div>
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
