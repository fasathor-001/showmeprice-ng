import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export function useReportProduct(productId?: string | null) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const submitReport = useCallback(
    async (reason: string, details?: string | null) => {
      const pid = String(productId ?? "").trim();
      if (!pid) throw new Error("Missing product");
      if (!user?.id) throw new Error("Login required");

      const cleanReason = String(reason ?? "").trim();
      if (!cleanReason) throw new Error("Missing reason");

      const cleanDetails = details ? String(details).trim() : "";

      setLoading(true);
      const { error } = await supabase.from("product_reports").insert({
        product_id: pid,
        reporter_id: user.id,
        reason: cleanReason,
        details: cleanDetails || null,
      });
      setLoading(false);

      if (error) throw error;
    },
    [productId, user]
  );

  return { submitReport, loading };
}
