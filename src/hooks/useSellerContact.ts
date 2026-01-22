import { useCallback, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "./useProfile";
import { useFF } from "./useFF";

export type SellerContact = {
  phone_number: string | null;
  whatsapp_number: string | null;
};

function normalize(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function cleanPhone(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.replace(/[^\d+]/g, "");
}

function isPaidTier(tier: string) {
  return tier === "premium" || tier === "pro" || tier === "admin" || tier === "institution";
}

export function useSellerContact() {
  const { profile } = useProfile() as any;
  const FF = useFF();

  const viewerTier = useMemo(() => normalize((profile as any)?.membership_tier ?? "free"), [profile]);
  const viewerRole = useMemo(() => normalize((profile as any)?.role ?? ""), [profile]);
  const viewerPaid = useMemo(() => viewerRole === "admin" || isPaidTier(viewerTier), [viewerRole, viewerTier]);

  const whatsappEnabled = !!FF.whatsapp_number;
  const phoneEnabled = !!FF.phoneCall;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SellerContact | null>(null);

  const fetchContact = useCallback(
    async (sellerUserId: string): Promise<SellerContact | null> => {
      setError(null);

      if (!sellerUserId) {
        setError("Seller not found.");
        return null;
      }

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
        const { data: biz, error: bizErr } = await supabase
          .from("businesses")
          .select("whatsapp_number, phone_number")
          .eq("user_id", sellerUserId)
          .maybeSingle();

        if (bizErr) throw bizErr;

        const contact: SellerContact = {
          whatsapp_number: whatsappEnabled ? (cleanPhone((biz as any)?.whatsapp_number) || null) : null,
          phone_number: phoneEnabled ? (cleanPhone((biz as any)?.phone_number) || null) : null,
        };

        if (!contact.whatsapp_number && !contact.phone_number) {
          setData(null);
          setError("Contact information unavailable.");
          return null;
        }

        setData(contact);
        return contact;
      } catch (e: any) {
        console.error("useSellerContact: fetchContact failed", e);
        setData(null);
        setError(e?.message ?? "Failed to load contact.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [viewerPaid, whatsappEnabled, phoneEnabled]
  );

  return { fetchContact, loading, error, data };
}

export default useSellerContact;
