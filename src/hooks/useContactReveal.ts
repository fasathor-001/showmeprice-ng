import { useCallback, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";
import { canBuyerRevealContact } from "../lib/plans";
import { useFF } from "./useFF";

export type SellerContact = {
  whatsapp_number: string | null;
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

  const viewerPaid = useMemo(() => canBuyerRevealContact(profile), [profile]);
  const canReveal = useMemo(() => viewerPaid && (whatsappEnabled || phoneEnabled), [viewerPaid, whatsappEnabled, phoneEnabled]);

  const reveal = useCallback(
    async (sellerUserId: string): Promise<SellerContact | null> => {
      setError(null);

      if (!sellerUserId) {
        setError("Seller not found.");
        return null;
      }

      // Free users cannot reveal WhatsApp/Phone (but can still message)
      if (!viewerPaid) {
        setError("Upgrade required to view seller contact.");
        return null;
      }

      if (!whatsappEnabled && !phoneEnabled) {
        setError("Contact reveal is currently unavailable.");
        return null;
      }

      setLoading(true);
      try {
        // ✅ FIXED: businesses uses user_id, whatsapp_number, phone_number
        const { data: biz, error: bizErr } = await supabase
          .from("businesses")
          .select("whatsapp_number, phone_number")
          .eq("user_id", sellerUserId)
          .maybeSingle();

        if (bizErr) throw bizErr;

        const whatsapp = whatsappEnabled ? cleanPhone((biz as any)?.whatsapp_number) : "";
        const phone = phoneEnabled ? cleanPhone((biz as any)?.phone_number) : "";

        const contact: SellerContact = {
          whatsapp_number: whatsapp || null,
          phone: phone || null,
        };

        if (!contact.whatsapp_number && !contact.phone) {
          setData(null);
          setRevealed(false);
          setError("Contact information unavailable.");
          return null;
        }

        setData(contact);
        setRevealed(true);
        return contact;
      } catch (e: any) {
        console.error("useContactReveal: reveal failed", e);
        setData(null);
        setRevealed(false);
        setError(e?.message ?? "Failed to reveal contact.");
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
