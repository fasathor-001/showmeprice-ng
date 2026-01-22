import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type FeatureFlagAuditRow = {
  id: string;
  flag_key: string | null;
  changed_by: string | null;
  from_enabled: boolean | null;
  to_enabled: boolean | null;
  note: string | null;
  created_at: string;
};

export type FeatureFlagSaveInput = {
  key: string;
  enabled: boolean;
  description?: string | null;
  visible_to?: string | null;
};

export function useFeatureFlagAdmin() {
  const { user } = useAuth();

  const [audit, setAudit] = useState<FeatureFlagAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const loadAudit = useCallback(async () => {
    if (!supabase) return;
    setAuditLoading(true);
    setAuditError(null);

    try {
      const { data, error } = await supabase
        .from("feature_flag_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setAudit((data ?? []) as FeatureFlagAuditRow[]);
    } catch (e: any) {
      console.error("Audit load failed:", e);
      setAuditError(e?.message ?? "Failed to load audit.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const saveFlag = useCallback(
    async (input: FeatureFlagSaveInput, note?: string) => {
      if (!supabase) throw new Error("Database not available");
      if (!user) throw new Error("Not authenticated");

      // Read current state (NO .single)
      const { data: rows, error: readErr } = await supabase
        .from("feature_flags")
        .select("enabled, description, visible_to")
        .eq("key", input.key)
        .limit(1);

      if (readErr) throw readErr;

      const prev = rows && rows.length > 0 ? (rows[0] as any) : null;
      const prevEnabled: boolean | null = prev ? (prev.enabled as boolean) : null;

      // Upsert full row
      const { error: upsertErr } = await supabase
        .from("feature_flags")
        .upsert(
          {
            key: input.key,
            enabled: input.enabled,
            description: input.description ?? null,
            visible_to: input.visible_to ?? "all",
          },
          { onConflict: "key" }
        );

      if (upsertErr) throw upsertErr;

      // Audit: record enabled change if changed; otherwise still log with nulls + note.
      const enabledChanged = prevEnabled === null ? true : prevEnabled !== input.enabled;

      const { error: auditErr } = await supabase
        .from("feature_flag_audit")
        .insert({
          flag_key: input.key,
          changed_by: user.id,
          from_enabled: enabledChanged ? prevEnabled : null,
          to_enabled: enabledChanged ? input.enabled : null,
          note: note ?? null,
        });

      if (auditErr) throw auditErr;

      await loadAudit();
    },
    [user, loadAudit]
  );

  const deleteAuditRow = useCallback(
    async (id: string) => {
      if (!supabase) throw new Error("Database not available");
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("feature_flag_audit")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await loadAudit();
    },
    [user, loadAudit]
  );

  return { audit, auditLoading, auditError, loadAudit, saveFlag, deleteAuditRow };
}
