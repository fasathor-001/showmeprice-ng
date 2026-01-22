import React, { useEffect, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: string; message: string; type: ToastType };

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof window.setTimeout>>>({});

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail ?? {};
      const message = String(detail.message ?? "").trim();
      if (!message) return;
      const type: ToastType =
        detail.type === "success" || detail.type === "error" || detail.type === "info" ? detail.type : "info";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      timersRef.current[id] = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete timersRef.current[id];
      }, 3500);
    };

    window.addEventListener("smp:toast", onToast as EventListener);
    return () => {
      window.removeEventListener("smp:toast", onToast as EventListener);
      Object.values(timersRef.current).forEach((t) => window.clearTimeout(t));
      timersRef.current = {};
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[99999] max-w-[92vw] sm:max-w-md space-y-2" data-smp-toast-host="1">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "rounded-2xl border px-4 py-3 shadow-xl backdrop-blur",
            t.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500/40"
              : t.type === "error"
              ? "bg-slate-900 text-white border-slate-700/40"
              : "bg-white text-slate-900 border-slate-200",
          ].join(" ")}
        >
          <div className="text-sm font-semibold">{t.message}</div>
        </div>
      ))}
    </div>
  );
}
