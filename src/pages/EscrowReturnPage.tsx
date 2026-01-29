import React, { useCallback, useEffect, useRef, useState } from "react";
import { invokeAuthedFunction } from "../lib/invokeAuthedFunction";

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
  const [lastReference, setLastReference] = useState<string>("");
  const inFlight = useRef(false);

  const reference =
    typeof window !== "undefined"
      ? (() => {
          const params = new URLSearchParams(window.location.search);
          const refs = params.getAll("reference").filter(Boolean);
          const trxrefs = params.getAll("trxref").filter(Boolean);
          const ref = refs.length ? refs[refs.length - 1] : trxrefs[trxrefs.length - 1] || "";
          return String(ref).trim();
        })()
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
    setLastReference(reference);

    try {
      const { data, error: verifyErr } = await invokeAuthedFunction("escrow-verify", {
        body: { reference },
      });
      if (verifyErr) {
        const message = String(verifyErr?.message ?? "");
        if (message.toLowerCase().includes("session expired") || message.toLowerCase().includes("sign in")) {
          setNeedsLogin(true);
          setError("Please sign in to verify payment.");
          setStatus("Unable to verify payment.");
          return false;
        }
        if (message.toLowerCase().includes("500")) return "server_error";
        throw verifyErr;
      }

      const ok = Boolean((data as any)?.ok);
      const verifyStatus = String((data as any)?.status ?? "").toLowerCase();
      if (ok && (verifyStatus === "success" || verifyStatus === "funded")) {
        setConfirmed(true);
        setStatus("Payment confirmed.");
        return true;
      }
      if (verifyStatus === "abandoned" || verifyStatus === "failed") {
        setStatus("Payment not completed.");
        return false;
      }

      setStatus("Payment pending confirmation.");
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
    const serverRetryDelays = [800, 1500, 2500];
    let serverRetries = 0;

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
        const result = await verifyNow();
        if (result === "server_error") {
          if (serverRetries < serverRetryDelays.length) {
            const delay = serverRetryDelays[serverRetries];
            serverRetries += 1;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          setStatus("Still confirming payment…");
          setTimedOut(true);
          return;
        }
        const funded = result === true;
        if (funded) return;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      if (!cancelled) {
        setTimedOut(true);
        setStatus("Payment pending / not found yet.");
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
      {!reference ? (
        <div className="mt-4 text-sm text-slate-600">
          We couldn&apos;t find your payment reference. Please return to the marketplace or your dashboard.
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => nav("/")}
              className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
            >
              Back to Home
            </button>
            <button
              type="button"
              onClick={() => nav("/dashboard")}
              className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      ) : null}
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
          Payment confirmed.
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
          Payment pending / not found yet.
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTimedOut(false);
                setConfirmed(false);
                setStatus("Confirming payment...");
                verifyNow();
              }}
              className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
            >
              Try again
            </button>
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
      {!confirmed && !timedOut && reference ? (
        <div className="mt-4 text-sm text-slate-600">
          <button
            type="button"
            onClick={() => nav("/escrow")}
            className="px-3 py-2 rounded-lg border text-slate-700 font-semibold hover:bg-slate-50"
          >
            View Escrow Orders
          </button>
        </div>
      ) : null}
      {error ? <div className="mt-4 text-sm text-rose-600">{error}</div> : null}
      {lastReference ? (
        <div className="mt-4 text-xs text-slate-400">Reference: {lastReference}</div>
      ) : null}
    </div>
  );
}
