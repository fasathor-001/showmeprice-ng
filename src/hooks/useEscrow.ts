import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAccessToken } from "../lib/getAccessToken";
import { useAuth } from "./useAuth";

export type EscrowTransaction = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  amount_product: number;
  amount_fee: number;
  amount_total: number;
  currency?: string | null;
  payment_reference?: string | null;
  shipment_reference?: string | null;
  shipped_at?: string | null;
  buyer_confirmed_at?: string | null;
  admin_decision_type?: string | null;
  admin_decision_by?: string | null;
  admin_decision_at?: string | null;
  admin_decision_note?: string | null;
  admin_released_at?: string | null;
  admin_refunded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EscrowDispute = {
  id: string;
  escrow_id: string;
  opened_by: string;
  reason: string;
  buyer_notes?: string | null;
  seller_notes?: string | null;
  admin_notes?: string | null;
  status: string;
  resolved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CreateEscrowParams = {
  productId: string;
  sellerId: string;
  amountKobo: number;
  currency?: string;
};

export type EscrowPaymentInitResult = {
  authorizationUrl: string;
  orderId: string;
};

function isMissingEscrowTable(err: any) {
  const msg = String(err?.message ?? "");
  return err?.status === 404 || err?.code === "42P01" || msg.includes("Could not find the table");
}

export function useEscrow() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEscrow = useCallback(
    async (params: CreateEscrowParams): Promise<EscrowPaymentInitResult> => {
      if (!user?.id) throw new Error("Not signed in");
      if (!params?.productId) throw new Error("Missing product");
      if (!params?.sellerId) throw new Error("Missing seller");
      if (!Number.isFinite(params?.amountKobo) || params.amountKobo <= 0) {
        throw new Error("Invalid amount");
      }

      setLoading(true);
      setError(null);
      try {
        let token = "";
        try {
          token = await getAccessToken();
        } catch {
          token = "";
        }
        if (!token) {
          throw new Error("Please sign in again.");
        }

        const { data, error: initErr } = await supabase.functions.invoke("paystack-init-escrow", {
          body: {
            product_id: params.productId,
            seller_id: params.sellerId,
            amount_kobo: Number(params.amountKobo),
            currency: params.currency ?? null,
          },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (initErr) throw initErr;
        const authorizationUrl = String(data?.authorization_url ?? "").trim();
        const orderId = String(data?.order_id ?? "").trim();
        if (!authorizationUrl || !orderId) {
          throw new Error("Payment initialization failed");
        }

        return { authorizationUrl, orderId };
      } catch (e: any) {
        setError(e?.message ?? "Failed to initialize escrow payment");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const createEscrowTransaction = createEscrow;

  const getMyEscrowTransactions = useCallback(async (): Promise<EscrowTransaction[]> => {
    if (!user?.id) throw new Error("Not signed in");

    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("escrow_transactions")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (qErr) {
        if (isMissingEscrowTable(qErr)) return [];
        throw qErr;
      }
      return (data ?? []) as EscrowTransaction[];
    } catch (e: any) {
      if (!isMissingEscrowTable(e)) {
        setError(e?.message ?? "Failed to load escrow");
        throw e;
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const listBuyerEscrows = useCallback(async (): Promise<EscrowTransaction[]> => {
    if (!user?.id) throw new Error("Not signed in");

    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("escrow_transactions")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      if (qErr) {
        if (isMissingEscrowTable(qErr)) return [];
        throw qErr;
      }
      return (data ?? []) as EscrowTransaction[];
    } catch (e: any) {
      if (!isMissingEscrowTable(e)) {
        setError(e?.message ?? "Failed to load escrow");
        throw e;
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const listSellerEscrows = useCallback(async (): Promise<EscrowTransaction[]> => {
    if (!user?.id) throw new Error("Not signed in");

    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("escrow_transactions")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });
      if (qErr) {
        if (isMissingEscrowTable(qErr)) return [];
        throw qErr;
      }
      return (data ?? []) as EscrowTransaction[];
    } catch (e: any) {
      if (!isMissingEscrowTable(e)) {
        setError(e?.message ?? "Failed to load escrow");
        throw e;
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const getEscrowById = useCallback(async (id: string): Promise<EscrowTransaction | null> => {
    if (!user?.id) throw new Error("Not signed in");
    if (!id) throw new Error("Missing escrow");

    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase.from("escrow_transactions").select("*").eq("id", id).limit(1);
      if (qErr) throw qErr;
      return (data?.[0] ?? null) as EscrowTransaction | null;
    } catch (e: any) {
      setError(e?.message ?? "Failed to load escrow");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const markAsShipped = useCallback(
    async (escrowId: string, shipmentReference?: string): Promise<EscrowTransaction> => {
      if (!user?.id) throw new Error("Not signed in");
      if (!escrowId) throw new Error("Missing escrow");

      setLoading(true);
      setError(null);
      try {
        const { data: rows, error: fetchErr } = await supabase
          .from("escrow_transactions")
          .select("id,status")
          .eq("id", escrowId)
          .limit(1);
        if (fetchErr) throw fetchErr;
        const current = rows?.[0] ?? null;
        if (!current) throw new Error("Escrow not found");

        const allowed = new Set(["escrow_active", "awaiting_shipment", "payment_received", "funded"]);
        if (!allowed.has(String(current.status))) {
          throw new Error("Invalid status for shipment");
        }

        // Seller marks shipment; RLS enforces seller ownership.
        const updates: Record<string, any> = {
          status: "shipped",
          shipped_at: new Date().toISOString(),
        };
        if (shipmentReference !== undefined) {
          updates.shipment_reference = shipmentReference;
        }

        const { data, error: updateErr } = await supabase
          .from("escrow_transactions")
          .update(updates)
          .eq("id", escrowId)
          .select("*")
          .limit(1);
        if (updateErr) throw updateErr;
        const row = (data?.[0] ?? null) as EscrowTransaction | null;
        if (!row) throw new Error("Escrow update failed");

        const { data: updatedRows, error: followErr } = await supabase
          .from("escrow_transactions")
          .update({ status: "awaiting_buyer_confirmation" })
          .eq("id", escrowId)
          .select("*")
          .limit(1);
        if (followErr) throw followErr;
        const updated = (updatedRows?.[0] ?? null) as EscrowTransaction | null;
        if (!updated) throw new Error("Escrow update failed");
        return updated;
      } catch (e: any) {
        setError(e?.message ?? "Failed to mark shipped");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const markShipped = markAsShipped;

  const confirmReceived = useCallback(
    async (escrowId: string): Promise<EscrowTransaction> => {
      if (!user?.id) throw new Error("Not signed in");
      if (!escrowId) throw new Error("Missing escrow");

      setLoading(true);
      setError(null);
      try {
        const { data: rows, error: fetchErr } = await supabase
          .from("escrow_transactions")
          .select("id,status")
          .eq("id", escrowId)
          .limit(1);
        if (fetchErr) throw fetchErr;
        const current = rows?.[0] ?? null;
        if (!current) throw new Error("Escrow not found");

        const allowed = new Set(["shipped", "awaiting_buyer_confirmation"]);
        if (!allowed.has(String(current.status))) {
          throw new Error("Invalid status for confirmation");
        }

        // Buyer confirms receipt; RLS enforces buyer ownership.
        const now = new Date().toISOString();

        const { data, error: updateErr } = await supabase
          .from("escrow_transactions")
          .update({
            status: "buyer_confirmed",
            buyer_confirmed_at: now,
          })
          .eq("id", escrowId)
          .select("*")
          .limit(1);
        if (updateErr) throw updateErr;
        const row = (data?.[0] ?? null) as EscrowTransaction | null;
        if (!row) throw new Error("Escrow update failed");

        const { data: updatedRows, error: followErr } = await supabase
          .from("escrow_transactions")
          .update({ status: "pending_admin_release" })
          .eq("id", escrowId)
          .select("*")
          .limit(1);
        if (followErr) throw followErr;
        const updated = (updatedRows?.[0] ?? null) as EscrowTransaction | null;
        if (!updated) throw new Error("Escrow update failed");
        return updated;
      } catch (e: any) {
        setError(e?.message ?? "Failed to confirm receipt");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const openDispute = useCallback(
    async (escrowId: string, reason: string, buyerNotes?: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!escrowId) throw new Error("Missing escrow");
      const cleanReason = String(reason ?? "").trim();
      if (!cleanReason) throw new Error("Missing dispute reason");

      setLoading(true);
      setError(null);
      try {
        const { data: rows, error: fetchErr } = await supabase
          .from("escrow_transactions")
          .select("id,status")
          .eq("id", escrowId)
          .limit(1);
        if (fetchErr) throw fetchErr;
        const current = rows?.[0] ?? null;
        if (!current) throw new Error("Escrow not found");

        const blocked = new Set(["buyer_confirmed", "pending_admin_release", "released_to_seller", "refund_to_buyer"]);
        if (blocked.has(String(current.status))) {
          throw new Error("Dispute not allowed at this stage");
        }
        if (String(current.status) === "disputed") {
          throw new Error("Dispute already open");
        }

        const { data: disputeRows, error: disputeErr } = await supabase
          .from("escrow_disputes")
          .insert({
            escrow_id: escrowId,
            opened_by: user.id,
            reason: cleanReason,
            buyer_notes: buyerNotes ?? null,
          })
          .select("*")
          .limit(1);
        if (disputeErr) throw disputeErr;
        const dispute = (disputeRows?.[0] ?? null) as EscrowDispute | null;
        if (!dispute) throw new Error("Dispute create failed");

        // Mark escrow as disputed; RLS enforces buyer ownership.
        const { data: escrowRows, error: escrowErr } = await supabase
          .from("escrow_transactions")
          .update({ status: "disputed" })
          .eq("id", escrowId)
          .select("*")
          .limit(1);
        if (escrowErr) throw escrowErr;
        const escrow = (escrowRows?.[0] ?? null) as EscrowTransaction | null;
        if (!escrow) throw new Error("Escrow update failed");

        return { dispute, escrow };
      } catch (e: any) {
        setError(e?.message ?? "Failed to open dispute");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  return {
    createEscrow,
    createEscrowTransaction,
    getMyEscrowTransactions,
    listBuyerEscrows,
    listSellerEscrows,
    getEscrowById,
    markAsShipped,
    markShipped,
    confirmReceived,
    openDispute,
    loading,
    error,
  };
}

export default useEscrow;
