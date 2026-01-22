import React from "react";
import { ArrowLeft } from "lucide-react";

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

export default function DeliveryPage() {
  const goBack = () => {
    // Use browser history when possible
    if (window.history.length > 1) window.history.back();
    else nav("/");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 font-black"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-right">
          <div className="font-black text-slate-900">Delivery</div>
          <div className="text-xs text-slate-500">Delivery features are planned and will roll out later.</div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <div className="font-black text-slate-900">Coming soon</div>
        <div className="text-sm text-slate-600 mt-1">
          We'll add delivery quotes, tracking, and delivery partner options here when enabled.
        </div>
      </div>
    </div>
  );
}
