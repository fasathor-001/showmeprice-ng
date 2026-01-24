import { useCallback, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";
import { canBuyerRevealContact } from "../lib/plans";
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

  const viewerPaid = useMemo(() => canBuyerRevealContact(profile), [profile]);
  const canReveal = useMemo(() => viewerPaid && (whatsappEnabled || phoneEnabled), [viewerPaid, whatsappEnabled, phoneEnabled]);

  const reveal = useCallback(
    async (sellerUserId: string): Promise<SellerContact | null> => {
      setError(null);

      if (!sellerUserId) {
        setError("Seller not found.");
        return null;
      }

      if (!whatsappEnabled && !phoneEnabled) {
        setError("Contact reveal is currently unavailable.");
        return null;
      }

      setLoading(true);
      try {
        const { data: rpcData, error: rpcErr } = await supabase
          .rpc("reveal_seller_contact", { seller_owner_id: sellerUserId });

        if (rpcErr) throw rpcErr;

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const whatsapp = whatsappEnabled ? cleanPhone((row as any)?.whatsapp) : "";
        const phone = phoneEnabled ? cleanPhone((row as any)?.phone) : "";

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
        if (String(e?.message ?? "").includes("upgrade_required")) {
          setError("upgrade_required");
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
