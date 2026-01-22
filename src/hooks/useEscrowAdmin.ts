import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";

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

type EscrowFilters = {
  status?: string;
  buyerId?: string;
  sellerId?: string;
  productId?: string;
};

export function useEscrowAdmin() {
  const { user } = useAuth();
  const { profile } = useProfile() as any;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assertAdmin = () => {
    const role = String((profile as any)?.role ?? "").toLowerCase();
    if (role !== "admin") throw new Error("Admin access required");
  };

  const getAllEscrowTransactions = useCallback(
    async (filters?: EscrowFilters): Promise<EscrowTransaction[]> => {
      if (!user?.id) throw new Error("Not signed in");
      assertAdmin();

      setLoading(true);
      setError(null);
      try {
        let q = supabase.from("escrow_transactions").select("*").order("created_at", { ascending: false });
        if (filters?.status) q = q.eq("status", filters.status);
        if (filters?.buyerId) q = q.eq("buyer_id", filters.buyerId);
        if (filters?.sellerId) q = q.eq("seller_id", filters.sellerId);
        if (filters?.productId) q = q.eq("product_id", filters.productId);

        const { data, error: qErr } = await q;
        if (qErr) throw qErr;
        return (data ?? []) as EscrowTransaction[];
      } catch (e: any) {
        setError(e?.message ?? "Failed to load escrow");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, profile]
  );

  const getEscrowDisputes = useCallback(async (): Promise<EscrowDispute[]> => {
    if (!user?.id) throw new Error("Not signed in");
    assertAdmin();

    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("escrow_disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      return (data ?? []) as EscrowDispute[];
    } catch (e: any) {
      setError(e?.message ?? "Failed to load disputes");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile]);

  const listAdminQueue = useCallback(async (): Promise<EscrowTransaction[]> => {
    return getAllEscrowTransactions({ status: undefined }).then((rows) =>
      rows.filter((r) => r.status === "pending_admin_release" || r.status === "disputed")
    );
  }, [getAllEscrowTransactions]);

  const resolveDisputeRelease = useCallback(
    async (escrowId: string, note?: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!escrowId) throw new Error("Missing escrow");
      assertAdmin();

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
        if (current.status === "released_to_seller" || current.status === "refund_to_buyer") {
          throw new Error("Escrow already resolved");
        }

        const now = new Date().toISOString();

        // Admin resolves dispute in favor of seller.
        const { data: escrowRows, error: updateErr } = await supabase
          .from("escrow_transactions")
          .update({
            status: "released_to_seller",
            admin_decision_type: "release",
            admin_decision_by: user.id,
            admin_decision_at: now,
            admin_decision_note: note ?? null,
            admin_released_at: now,
          })
          .eq("id", escrowId)
          .select("id,status")
          .limit(1);
        if (updateErr) throw updateErr;
        const escrow = escrowRows?.[0] ?? null;
        if (!escrow) throw new Error("Escrow update failed");

        const { data: disputeRows, error: disputeErr } = await supabase
          .from("escrow_disputes")
          .update({
            status: "resolved_release",
            admin_notes: note ?? null,
            resolved_at: now,
          })
          .eq("escrow_id", escrowId)
          .select("id,status")
          .limit(1);
        if (disputeErr) throw disputeErr;
        const dispute = disputeRows?.[0] ?? null;

        return { escrow, dispute };
      } catch (e: any) {
        setError(e?.message ?? "Failed to resolve dispute");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, profile]
  );

  const resolveDisputeRefund = useCallback(
    async (escrowId: string, note?: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!escrowId) throw new Error("Missing escrow");
      assertAdmin();

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
        if (current.status === "released_to_seller" || current.status === "refund_to_buyer") {
          throw new Error("Escrow already resolved");
        }

        const now = new Date().toISOString();

        // Admin resolves dispute in favor of buyer.
        const { data: escrowRows, error: updateErr } = await supabase
          .from("escrow_transactions")
          .update({
            status: "refund_to_buyer",
            admin_decision_type: "refund",
            admin_decision_by: user.id,
            admin_decision_at: now,
            admin_decision_note: note ?? null,
            admin_refunded_at: now,
          })
          .eq("id", escrowId)
          .select("id,status")
          .limit(1);
        if (updateErr) throw updateErr;
        const escrow = escrowRows?.[0] ?? null;
        if (!escrow) throw new Error("Escrow update failed");

        const { data: disputeRows, error: disputeErr } = await supabase
          .from("escrow_disputes")
          .update({
            status: "resolved_refund",
            admin_notes: note ?? null,
            resolved_at: now,
          })
          .eq("escrow_id", escrowId)
          .select("id,status")
          .limit(1);
        if (disputeErr) throw disputeErr;
        const dispute = disputeRows?.[0] ?? null;

        return { escrow, dispute };
      } catch (e: any) {
        setError(e?.message ?? "Failed to resolve dispute");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, profile]
  );

  const releaseFunds = useCallback(
    async (escrowId: string, note?: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!escrowId) throw new Error("Missing escrow");
      assertAdmin();

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
        if (current.status === "released_to_seller" || current.status === "refund_to_buyer") {
          throw new Error("Escrow already resolved");
        }

        const now = new Date().toISOString();

        // Admin releases funds after buyer confirmation.
        const { data, error: updateErr } = await supabase
          .from("escrow_transactions")
          .update({
            status: "released_to_seller",
            admin_decision_type: "release",
            admin_decision_by: user.id,
            admin_decision_at: now,
            admin_released_at: now,
            admin_decision_note: note ?? null,
          })
          .eq("id", escrowId)
          .select("id,status")
          .limit(1);
        if (updateErr) throw updateErr;
        const row = data?.[0] ?? null;
        if (!row) throw new Error("Escrow update failed");
        return row;
      } catch (e: any) {
        setError(e?.message ?? "Failed to release funds");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, profile]
  );

  const releaseEscrow = releaseFunds;

  const refundEscrow = useCallback(
    async (escrowId: string, note?: string) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!escrowId) throw new Error("Missing escrow");
      assertAdmin();

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
        if (current.status === "released_to_seller" || current.status === "refund_to_buyer") {
          throw new Error("Escrow already resolved");
        }

        const now = new Date().toISOString();
        const { data, error: updateErr } = await supabase
          .from("escrow_transactions")
          .update({
            status: "refund_to_buyer",
            admin_decision_type: "refund",
            admin_decision_by: user.id,
            admin_decision_at: now,
            admin_decision_note: note ?? null,
            admin_refunded_at: now,
          })
          .eq("id", escrowId)
          .select("id,status")
          .limit(1);
        if (updateErr) throw updateErr;
        const row = data?.[0] ?? null;
        if (!row) throw new Error("Escrow update failed");
        return row;
      } catch (e: any) {
        setError(e?.message ?? "Failed to refund");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [user?.id, profile]
  );

  return {
    getAllEscrowTransactions,
    listAdminQueue,
    getEscrowDisputes,
    resolveDisputeRelease,
    resolveDisputeRefund,
    releaseFunds,
    releaseEscrow,
    refundEscrow,
    loading,
    error,
  };
}

export default useEscrowAdmin;
