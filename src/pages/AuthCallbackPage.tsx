import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function nav(to: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Finishing sign-in...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
        }

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userRes?.user) {
          throw new Error("No session found. Please try signing in again.");
        }

        if (!alive) return;
        nav("/set-password");
      } catch (e: any) {
        if (!alive) return;
        setStatus("Sign-in failed");
        setError(e?.message ?? "Unable to complete sign-in.");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-slate-900 mb-2">{status}</h1>
      <p className="text-sm text-slate-600">Please wait while we finish your sign-in.</p>
      {error ? <div className="mt-4 text-sm text-rose-600">{error}</div> : null}
    </div>
  );
}
