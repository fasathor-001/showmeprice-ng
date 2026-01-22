import React, { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import PostProductForm from "../seller/PostProductForm";
import GlobalAuthModals from "../auth/GlobalAuthModals";

type LayoutProps = React.PropsWithChildren;

function useCurrentPath() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onNav = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onNav);
    window.addEventListener("smp:navigate", onNav as any);
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("smp:navigate", onNav as any);
    };
  }, []);

  return path;
}

export default function Layout({ children }: LayoutProps) {
  const [isPostItemOpen, setIsPostItemOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>(
    []
  );
  const toastTimersRef = useRef<Record<string, ReturnType<typeof window.setTimeout>>>({});
  const path = useCurrentPath();

  // ✅ Keep this ONLY for deciding MobileBottomNav + spacing (not for Navbar/Footer)
  const isAccountRoute = useMemo(() => {
    return (
      path.startsWith("/my-shop") ||
      path.startsWith("/seller") ||
      path.startsWith("/inbox") ||
      path.startsWith("/saved") ||
      path.startsWith("/notifications") ||
      path.startsWith("/profile") ||
      path.startsWith("/analytics") ||
      path.startsWith("/reports") ||
      path.startsWith("/escrow") ||
      path.startsWith("/admin")
    );
  }, [path]);

  const openPostItemModal = () => setIsPostItemOpen(true);
  const closePostItemModal = () => setIsPostItemOpen(false);

  useEffect(() => {
    (window as any).openPostItemModal = openPostItemModal;
    (window as any).closePostItemModal = closePostItemModal;
    (window as any).__smp_toast_global = true;

    return () => {
      try {
        delete (window as any).openPostItemModal;
        delete (window as any).closePostItemModal;
        delete (window as any).__smp_toast_global;
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail ?? {};
      const message = String(detail.message ?? "").trim();
      if (!message) return;
      const type =
        detail.type === "success" || detail.type === "info" || detail.type === "error" ? detail.type : "info";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      toastTimersRef.current[id] = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete toastTimersRef.current[id];
      }, 3500);
    };

    window.addEventListener("smp:toast", onToast as EventListener);
    return () => {
      window.removeEventListener("smp:toast", onToast as EventListener);
      Object.values(toastTimersRef.current).forEach((t) => window.clearTimeout(t));
      toastTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePostItemModal();
    };

    if (isPostItemOpen) {
      document.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isPostItemOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-emerald-50">
      {/* ✅ ALWAYS show main header */}
      <Navbar />

      <main className={isAccountRoute ? "flex-1" : "flex-1 pb-20 md:pb-0"}>
        {children}
      </main>

      {/* ✅ ALWAYS show main footer */}
      <Footer />

      {/* Keep this behavior: only show bottom nav on non-account routes */}
      {!isAccountRoute ? <MobileBottomNav /> : null}

      <GlobalAuthModals />

      {toasts.length > 0 ? (
        <div
          className="fixed top-4 right-4 z-[9999] max-w-[92vw] sm:max-w-md space-y-2"
          data-smp-toast-host="1"
        >
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
      ) : null}


      {/* ✅ Post Product Modal (Global) */}
      <div
        id="postProductModal"
        className={`fixed inset-0 z-[100] items-center justify-center p-4 ${
          isPostItemOpen ? "flex" : "hidden"
        } bg-gradient-to-b from-slate-50/95 via-slate-50/85 to-white/95 backdrop-blur-sm`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closePostItemModal();
        }}
        aria-hidden={!isPostItemOpen}
      >
        <div className="w-full max-w-2xl relative">
          <PostProductForm onClose={closePostItemModal} />
        </div>
      </div>
    </div>
  );
}
