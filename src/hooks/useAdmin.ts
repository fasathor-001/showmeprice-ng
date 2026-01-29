import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAuthSession } from "../lib/authSession";
import { ViolationLog } from "../types";

type AdminStats = {
  users: number;
  products: number;
  pending: number;
  violations: number;
};

async function safeCount(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export function useAdmin(enabled = true) {
  const [stats, setStats] = useState<AdminStats>({
    users: 0,
    products: 0,
    pending: 0,
    violations: 0,
  });

  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [violations, setViolations] = useState<ViolationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setPendingVerifications([]);
      setViolations([]);
      setStats({ users: 0, products: 0, pending: 0, violations: 0 });
      return;
    }

    setLoading(true);

    try {
      // Users & products are stable in your schema
      const [usersCount, productsCount] = await Promise.all([
        safeCount("profiles"),
        safeCount("products"),
      ]);

      const { data: vRows, error: vErr } = await supabase
        .from("seller_verifications")
        .select("*")
        .eq("status", "pending")
        .order("submitted_at", { ascending: false })
        .limit(50);

      if (vErr) throw vErr;

      const verifications = ((vRows as any[]) ?? []) as any[];
      const pendingCount = verifications.length;

      const sellerIds = Array.from(
        new Set(verifications.map((v) => String(v.seller_id ?? "")).filter(Boolean))
      );

      let profilesById: Record<string, any> = {};
      if (sellerIds.length > 0) {
        const { data: profRows, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, display_name, username, business_name")
          .in("id", sellerIds);

        if (pErr) throw pErr;

        profilesById = {};
        (profRows ?? []).forEach((p: any) => {
          if (p?.id) profilesById[String(p.id)] = p;
        });
      }

      const mergedPending = verifications.map((v) => ({
        ...v,
        profiles: profilesById[String(v.seller_id)] ?? null,
      })) as any[];

      // Violations: load only if table exists. If not, don’t break admin.
      let violationRows: any[] = [];
      try {
        const { data: vRows, error: vErr } = await supabase
          .from("violation_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (vErr) throw vErr;
        violationRows = (vRows as any[]) ?? [];
      } catch {
        violationRows = [];
      }

      const violationsCount = violationRows.length;

      // attach user names to violations too (if they have a user_id column)
      const violationUserIds = Array.from(
        new Set(violationRows.map((v) => String(v.user_id ?? "")).filter(Boolean))
      );

      let vProfilesById: Record<string, any> = {};
      if (violationUserIds.length > 0) {
        const { data: vpRows } = await supabase
          .from("profiles")
          .select("id, full_name, display_name, username")
          .in("id", violationUserIds);

        vProfilesById = {};
        (vpRows ?? []).forEach((p: any) => {
          if (p?.id) vProfilesById[String(p.id)] = p;
        });
      }

      const mergedViolations = violationRows.map((v) => ({
        ...v,
        users: vProfilesById[String(v.user_id)] ?? null,
      })) as any as ViolationLog[];

      setStats({
        users: usersCount,
        products: productsCount,
        pending: pendingCount,
        violations: violationsCount,
      });

      setPendingVerifications(mergedPending);
      setViolations(mergedViolations);
    } catch (e) {
      console.error("useAdmin: fetchDashboardData failed", e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const approveSeller = useCallback(
    async (verificationId: string) => {
      if (!enabled) return;
      const adminId = getAuthSession()?.user?.id ?? null;
      const { data: vRow } = await supabase
        .from("seller_verifications")
        .select("id, seller_id")
        .eq("id", verificationId)
        .maybeSingle();

      await supabase
        .from("seller_verifications")
        .update({
          status: "verified",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminId,
        })
        .eq("id", verificationId);

      if (vRow?.seller_id) {
        await supabase
          .from("businesses")
          .update({
            verification_status: "approved",
            verification_tier: "verified",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", vRow.seller_id);
      }

      fetchDashboardData();
    },
    [enabled, fetchDashboardData]
  );

  const approveSellers = useCallback(
    async (verificationIds: string[]) => {
      if (!enabled) return;
      if (!verificationIds?.length) return;
      for (const id of verificationIds) {
        await approveSeller(id);
      }
    },
    [enabled, approveSeller]
  );

  const rejectSeller = useCallback(
    async (verificationId: string) => {
      if (!enabled) return;
      const adminId = getAuthSession()?.user?.id ?? null;
      const { data: vRow } = await supabase
        .from("seller_verifications")
        .select("id, seller_id")
        .eq("id", verificationId)
        .maybeSingle();

      await supabase
        .from("seller_verifications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminId,
        })
        .eq("id", verificationId);

      if (vRow?.seller_id) {
        await supabase
          .from("businesses")
          .update({
            verification_status: "rejected",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", vRow.seller_id);
      }

      fetchDashboardData();
    },
    [enabled, fetchDashboardData]
  );

  const suspendBusiness = useCallback(
    async (businessId: string) => {
      if (!enabled) return;
      await supabase
        .from("businesses")
        .update({
          verification_status: "suspended",
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);
      fetchDashboardData();
    },
    [enabled, fetchDashboardData]
  );

  const dismissViolation = useCallback(
    async (violationId: string) => {
      if (!enabled) return;

      // safest “no guessing” action: try delete the record (if table exists and policy allows)
      try {
        const { error } = await supabase.from("violation_logs").delete().eq("id", violationId);
        if (error) throw error;
      } catch (e) {
        console.warn("dismissViolation failed (table/policy may not allow):", e);
      }

      fetchDashboardData();
    },
    [enabled, fetchDashboardData]
  );

  return {
    stats,
    pendingVerifications,
    violations,
    loading,
    approveSeller,
    approveSellers,
    rejectSeller,
    suspendBusiness,
    dismissViolation,
    refresh: fetchDashboardData,
  };
}
