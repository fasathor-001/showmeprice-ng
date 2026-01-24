import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import "./lib/lucideRefresh";
import { FeatureFlagsProvider } from "./contexts/FeatureFlagsContext";

console.log("BOOT: React starting");
if (import.meta.env.DEV) {
  console.log("SUPABASE ENV OK", {
    urlPresent: !!import.meta.env.VITE_SUPABASE_URL,
    anonKeyLen: import.meta.env.VITE_SUPABASE_ANON_KEY?.length ?? 0,
  });
}

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("BOOT ERROR: Could not find root element");
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <FeatureFlagsProvider>
        <App />
      </FeatureFlagsProvider>
    </HelmetProvider>
  </React.StrictMode>
);

console.log("BOOT: React rendered");

/**
 * SMP: Lucide refresh
 * If you render <i data-lucide="..."> conditionally (feature flags, menus, etc),
 * you must re-run createIcons after React updates.
 */
const smpRefreshLucide = () => {
  try {
    const w: any = window as any;
    const luc = w?.lucide;
    if (luc && typeof luc?.createIcons === "function") {
      luc.createIcons();
    }
  } catch {}
};

// After initial render
requestAnimationFrame(() => smpRefreshLucide());

// After in-app navigation + feature flag changes
window.addEventListener("smp:navigate", () => requestAnimationFrame(() => smpRefreshLucide()));
window.addEventListener("smp:flags-updated", () => requestAnimationFrame(() => smpRefreshLucide()));



