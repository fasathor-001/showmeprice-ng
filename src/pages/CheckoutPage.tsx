import React, { useEffect, useState } from "react";
import { invokeAuthedFunction } from "../lib/invokeAuthedFunction";

export default function CheckoutPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const u = new URL(window.location.href);
        const intent = String(u.searchParams.get("intent") || "").trim();
        const targetId = String(u.searchParams.get("targetId") || "").trim();
        if (!intent || !targetId) {
          setError("Missing checkout details.");
          setLoading(false);
          return;
        }

        const { data, error } = await invokeAuthedFunction("payments_init", {
          body: { intent, targetId },
        });
        if (error) throw error;
        const url = String((data as any)?.authorization_url ?? "");
        if (!url) throw new Error("Payment link missing.");
        window.location.href = url;
      } catch (err: any) {
        setError(err?.message ?? "Failed to start payment.");
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <div className="p-6">
      <div className="text-xl font-black text-slate-900">Checkout</div>
      {loading ? <div className="text-sm text-slate-500 mt-2">Preparing payment...</div> : null}
      {error ? <div className="text-sm text-rose-600 mt-2">{error}</div> : null}
    </div>
  );
}
