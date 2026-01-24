import { useCallback, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";
import { useFF } from "./useFF";

export type SellerContact = {
  whatsapp: string | null;
  phone: string | null;
};

function cleanPhone(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.replace(/[^\d+]/g, "");
}

export function useContactReveal() {
  const { profile } = useProfile() as any;
  const FF = useFF();

  const whatsappEnabled = !!FF.whatsapp_number;
  const phoneEnabled = !!FF.phoneCall;

  const [data, setData] = useState<SellerContact | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerTier = useMemo(
    () => String((profile as any)?.membership_tier ?? (profile as any)?.membership_1 ?? "free").toLowerCase(),
    [profile]
  );
  const viewerPaid = useMemo(
    () => ["pro", "premium", "institution"].includes(viewerTier),
    [viewerTier]
  );
  const canReveal = useMemo(() => viewerPaid && (whatsappEnabled || phoneEnabled), [viewerPaid, whatsappEnabled, phoneEnabled]);

  const reveal = useCallback(
    async (businessId: string): Promise<SellerContact | null> => {
      setError(null);

      if (!businessId) {
        setError("Seller not found.");
        return null;
      }

      if (!whatsappEnabled && !phoneEnabled) {
        setError("Contact reveal is currently unavailable.");
        return null;
      }

      setLoading(true);
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        if (!sessionRes?.session?.access_token) {
          setError("auth_required");
          window.dispatchEvent(
            new CustomEvent("smp:toast", { detail: { type: "error", message: "Please sign in to reveal contact." } })
          );
          window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login", reason: "contact" } }));
          return null;
        }

        const { data: rpcData, error: rpcErr } = await supabase
          .rpc("reveal_seller_contact", { business_id: businessId });

        if (rpcErr) throw rpcErr;

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const whatsapp = whatsappEnabled ? cleanPhone((row as any)?.whatsapp_number ?? (row as any)?.whatsapp) : "";
        const phone = phoneEnabled ? cleanPhone((row as any)?.phone ?? (row as any)?.phone_number) : "";

        const contact: SellerContact = {
          whatsapp: whatsapp || null,
          phone: phone || null,
        };

        if (!contact.whatsapp && !contact.phone) {
          setData(null);
          setRevealed(false);
          setError("Contact information unavailable.");
          return null;
        }

        setData(contact);
        setRevealed(true);
        return contact;
      } catch (e: any) {
        const message = String(e?.message ?? "");
        if (message.includes("auth_required")) {
          setError("auth_required");
          window.dispatchEvent(
            new CustomEvent("smp:toast", { detail: { type: "error", message: "Please sign in to reveal contact." } })
          );
          window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login", reason: "contact" } }));
        } else if (message.includes("upgrade_required")) {
          setError("upgrade_required");
          window.dispatchEvent(
            new CustomEvent("smp:toast", { detail: { type: "error", message: "Upgrade required to view seller contact." } })
          );
          try {
            const url = "/pricing?reason=contact";
            window.history.pushState({}, "", url);
            window.dispatchEvent(new Event("smp:navigate"));
          } catch {
            window.location.href = "/pricing?reason=contact";
          }
        } else {
          console.error("useContactReveal: reveal failed", e);
          setError(e?.message ?? "Failed to reveal contact.");
        }
        setData(null);
        setRevealed(false);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [viewerPaid, whatsappEnabled, phoneEnabled]
  );

  return { reveal, data, revealed, loading, error, canReveal };
}

export default useContactReveal;
