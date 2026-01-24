// src/hooks/useProductSubmission.ts
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { TIER_LIMITS } from "../constants";
import { MembershipTier } from "../types";

interface ProductSubmitData {
  business_id: string;
  category_id: number;
  title: string;
  price: number;
  description?: string;
  condition?: "new" | "used" | "refurbished";
  state_id?: number | null;

  // ✅ NEW: City/Area (free text)
  city: string;

  images?: string[];

  // Deals support
  is_deal?: boolean;
  deal_season?: string | null;
}

export function useProductSubmission() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);

  const submitProduct = async (data: ProductSubmitData): Promise<string | null> => {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    setLastInsertedId(null);

    if (!supabase) {
      setError("Database connection failed. Cannot submit product.");
      setSubmitting(false);
      return null;
    }

    try {
      const {
        data: { user },
      } = await (supabase.auth as any).getUser();

      if (!user) throw new Error("Not authenticated");

      // ---- Membership tier fetch ----
      let plan: MembershipTier = "free";
      const { data: bizRow, error: bizErr } = await supabase
        .from("businesses")
        .select("seller_membership_tier")
        .eq("id", data.business_id)
        .maybeSingle();

      if (bizErr) console.error("Error fetching membership tier:", bizErr);

      const tier = String((bizRow as any)?.seller_membership_tier ?? "").toLowerCase();
      if (tier) {
        plan = tier === "premium" ? ("business" as MembershipTier) : (tier as MembershipTier);
      }

      // ---- Enforce listing limit (TIER_LIMITS is a number in your project) ----
      const { count, error: countError } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("business_id", data.business_id)
        .eq("is_active", true);

      if (countError) throw countError;

      const limit: number =
        Number((TIER_LIMITS as any)[plan] ?? (TIER_LIMITS as any).free ?? 999999);

      if ((count ?? 0) >= limit) {
        throw new Error("LIMIT_REACHED");
      }

      // ✅ INSERT (includes city)
      const { data: inserted, error: insertError } = await supabase
        .from("products")
        .insert({
          business_id: data.business_id,
          category_id: data.category_id,
          title: data.title,
          price: data.price,
          description: data.description || "",
          condition: data.condition || "new",
          state_id: data.state_id ?? null,

          // ✅ SAVE CITY
          city: (data.city ?? "").trim(),

          images: data.images || [],

          // Deals support
          is_deal: !!data.is_deal,
          deal_season: data.deal_season ?? null,
        })
        .select("id")
        .limit(1);

      if (insertError) throw insertError;

      const newId = (inserted as any[] | null)?.[0]?.id ?? null;
      setLastInsertedId(newId);
      setSuccess(true);
      return newId;
    } catch (err: any) {
      console.error("Error submitting product:", err);

      // Optional: friendlier message for this specific error
      if (err?.message === "LIMIT_REACHED") {
        setError("Listing limit reached for your current plan.");
        return null;
      }

      setError(err?.message || "Unknown error");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return { submitProduct, submitting, error, success, lastInsertedId };
}

