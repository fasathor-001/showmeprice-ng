import React from "react";

function nav(to: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

export default function EscrowSuccessPage() {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-slate-900 mb-2">Payment received</h1>
      <p className="text-sm text-slate-600">
        Seller will deliver. After delivery, confirm to release payment.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => nav("/")}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-bold hover:bg-emerald-700"
        >
          Back to Home
        </button>
        <button
          type="button"
          onClick={() => nav("/inbox")}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50"
        >
          Go to Inbox
        </button>
      </div>
    </div>
  );
}
