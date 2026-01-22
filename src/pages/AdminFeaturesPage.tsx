import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useProfile } from "../hooks/useProfile";

type FeatureFlagRow = {
  key: string;
  enabled: boolean;
  description: string | null;
  visible_to: "all" | "authenticated" | "premium" | "institution" | "admin" | null;
  updated_at?: string | null;
};

type AuditRow = {
  id: string;
  flag_key: string;
  changed_by: string | null;
  from_enabled: boolean | null;
  to_enabled: boolean | null;
  note: string | null;
  created_at: string;
};

const VISIBLE_TO: NonNullable<FeatureFlagRow["visible_to"]>[] = [
  "all",
  "authenticated",
  "premium",
  "institution",
  "admin",
];

const AUDIT_TABLE = "feature_flag_audit";

function clsx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function formatWhen(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function AdminFeaturesPage() {
  
  const navigateToPath = (to: string) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("smp:navigate"));
    window.scrollTo(0, 0);
  };

  const goHome = () => navigateToPath("/");
const { profile, loading: profileLoading } = useProfile();
  const role = (profile as any)?.role ?? "user";
  const isAdmin = !profileLoading && role === "admin";

  const [tab, setTab] = useState<"flags" | "audit">("flags");

  // --- Feature Flags ---
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [flagsError, setFlagsError] = useState<string | null>(null);

  // draft edits per key (ONLY fields user changed)
  const [draft, setDraft] = useState<Record<string, Partial<FeatureFlagRow>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  // UI helpers
  const [flagQuery, setFlagQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"any" | NonNullable<FeatureFlagRow["visible_to"]>>("any");

  // --- Audit Log ---
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [deletingAudits, setDeletingAudits] = useState(false);

  // show 20 in audit tab, last 5 under flags
  const visibleAudits = useMemo(() => (Array.isArray(audits) ? audits.slice(0, 20) : []), [audits]);
  const last5Audits = useMemo(() => (Array.isArray(audits) ? audits.slice(0, 5) : []), [audits]);

  const visibleAuditIds = useMemo(() => visibleAudits.map((a) => a.id), [visibleAudits]);

  const selectedVisibleCount = useMemo(() => {
    const set = new Set(visibleAuditIds);
    return selectedAuditIds.filter((id) => set.has(id)).length;
  }, [selectedAuditIds, visibleAuditIds]);

  const allSelected = useMemo(() => {
    return visibleAuditIds.length > 0 && visibleAuditIds.every((id) => selectedAuditIds.includes(id));
  }, [visibleAuditIds, selectedAuditIds]);

  const toggleSelectAll = () => {
    setSelectedAuditIds((prev) => {
      if (allSelected) {
        const visibleSet = new Set(visibleAuditIds);
        return prev.filter((id) => !visibleSet.has(id));
      }
      return Array.from(new Set([...prev, ...visibleAuditIds]));
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedAuditIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setDraftField = (key: string, patch: Partial<FeatureFlagRow>) => {
    setDraft((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  };

  const effective = (row: FeatureFlagRow) => {
    const d = draft[row.key] || {};
    return {
      enabled: typeof d.enabled === "boolean" ? d.enabled : row.enabled,
      description: typeof d.description === "string" ? d.description : (row.description ?? ""),
      visible_to: (d.visible_to ?? row.visible_to ?? "all") as NonNullable<FeatureFlagRow["visible_to"]>,
    };
  };

  const dirtyKeys = useMemo(() => Object.keys(draft), [draft]);
  const dirtyCount = dirtyKeys.length;

  // -----------------------
  // Fetch Flags
  // -----------------------
  const refreshFlags = async () => {
    if (!isAdmin) return;
    setFlagsLoading(true);
    setFlagsError(null);

    try {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, enabled, description, visible_to, updated_at")
        .order("key", { ascending: true });

      if (error) throw error;

      if (!Array.isArray(data)) {
        setFlags([]);
        setFlagsError("Unexpected response for feature_flags (not an array). Check RLS/policies.");
        return;
      }

      setFlags(data as FeatureFlagRow[]);
    } catch (e: any) {
      console.error("Fetch feature flags failed:", e);
      setFlags([]);
      setFlagsError(e?.message ?? String(e));
    } finally {
      setFlagsLoading(false);
    }
  };

  // Save ONLY changed fields (prevents accidental wiping)
  const saveFlag = async (row: FeatureFlagRow) => {
    if (!isAdmin) return;

    const d = draft[row.key];
    if (!d || Object.keys(d).length === 0) return;

    const payload: Partial<FeatureFlagRow> = {};
    if (typeof d.enabled === "boolean") payload.enabled = d.enabled;
    if (typeof d.description === "string") payload.description = d.description;
    if (d.visible_to) payload.visible_to = d.visible_to;

    setSavingKey(row.key);
    setFlagsError(null);

    try {
      const { error } = await supabase.from("feature_flags").update(payload).eq("key", row.key);
      if (error) throw error;

      setDraft((prev) => {
        const copy = { ...prev };
        delete copy[row.key];
        return copy;
      });

      await refreshFlags();
      await refreshAudits();
    } catch (e: any) {
      console.error("Save flag failed:", e);
      setFlagsError(`Save failed: ${e?.message ?? e}`);
    } finally {
      setSavingKey(null);
    }
  };

  const saveAllFlags = async () => {
    if (!isAdmin) return;
    const keys = Object.keys(draft);
    if (keys.length === 0) return;

    const ok = window.confirm(`Save ${keys.length} change(s)?`);
    if (!ok) return;

    setSavingAll(true);
    setFlagsError(null);

    try {
      // Save sequentially for clarity + easier debugging
      for (const key of keys) {
        const row = flags.find((f) => f.key === key);
        if (!row) continue;

        const d = draft[key];
        if (!d || Object.keys(d).length === 0) continue;

        const payload: Partial<FeatureFlagRow> = {};
        if (typeof d.enabled === "boolean") payload.enabled = d.enabled;
        if (typeof d.description === "string") payload.description = d.description;
        if (d.visible_to) payload.visible_to = d.visible_to;

        const { error } = await supabase.from("feature_flags").update(payload).eq("key", key);
        if (error) throw error;

        // clear draft as we go
        setDraft((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }

      await refreshFlags();
      await refreshAudits();
    } catch (e: any) {
      console.error("Save all failed:", e);
      setFlagsError(`Save all failed: ${e?.message ?? e}`);
    } finally {
      setSavingAll(false);
    }
  };

  // -----------------------
  // Fetch Audits
  // -----------------------
  const refreshAudits = async () => {
    if (!isAdmin) return;
    setAuditLoading(true);
    setAuditError(null);

    try {
      const { data, error } = await supabase
        .from(AUDIT_TABLE)
        .select("id, flag_key, changed_by, from_enabled, to_enabled, note, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      if (!Array.isArray(data)) {
        setAudits([]);
        setAuditError("Unexpected response for audit table (not an array). Check RLS/policies.");
        return;
      }

      const rows = data as AuditRow[];
      setAudits(rows);

      // Keep only selections that are still visible
      const rowSet = new Set(rows.map((r) => r.id));
      setSelectedAuditIds((prev) => prev.filter((id) => rowSet.has(id)));
    } catch (e: any) {
      console.error("Fetch audits failed:", e);
      setAudits([]);
      setAuditError(e?.message ?? String(e));
    } finally {
      setAuditLoading(false);
    }
  };

  const deleteAuditsByIds = async (ids: string[]) => {
    if (!isAdmin) return;
    if (ids.length === 0) return;

    const ok = window.confirm(`Delete ${ids.length} audit row(s)?`);
    if (!ok) return;

    setDeletingAudits(true);
    setAuditError(null);

    try {
      const { error } = await supabase.from(AUDIT_TABLE).delete().in("id", ids);
      if (error) throw error;

      setSelectedAuditIds((prev) => prev.filter((x) => !ids.includes(x)));
      await refreshAudits(); // updates last-5 under flags automatically
    } catch (e: any) {
      console.error("Delete audits failed:", e);
      setAuditError(`Delete failed: ${e?.message ?? e}`);
    } finally {
      setDeletingAudits(false);
    }
  };

  const deleteOneAudit = async (id: string) => deleteAuditsByIds([id]);
  const deleteVisible = async () => deleteAuditsByIds(visibleAuditIds);
  const deleteSelectedVisible = async () => {
    const visibleSet = new Set(visibleAuditIds);
    const ids = selectedAuditIds.filter((id) => visibleSet.has(id));
    return deleteAuditsByIds(ids);
  };

  // -----------------------
  // Derived UI data
  // -----------------------
  const filteredFlags = useMemo(() => {
    const q = flagQuery.trim().toLowerCase();
    return (Array.isArray(flags) ? flags : []).filter((row) => {
      const eff = effective(row);
      const matchesQuery =
        q.length === 0 ||
        row.key.toLowerCase().includes(q) ||
        (eff.description ?? "").toLowerCase().includes(q);

      const matchesVisibility = visibilityFilter === "any" ? true : eff.visible_to === visibilityFilter;

      return matchesQuery && matchesVisibility;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags, flagQuery, visibilityFilter, draft]);

  // On entry load both
  useEffect(() => {
    if (!isAdmin) return;
    refreshFlags();
    refreshAudits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (profileLoading) return <div className="p-6 text-slate-600">Loading…</div>;

  if (!isAdmin) {
    return (
    <div className="min-h-screen flex flex-col p-10 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-black text-slate-900">Admin</h1>
          <p className="text-sm text-slate-600 mt-2">Access denied.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col min-h-[70vh] bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Admin Feature Controls</h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage feature flags and audit history (latest 20).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {dirtyCount > 0 && (
                <div className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                  {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
                </div>
              )}

              <button
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
                onClick={() => {
                  refreshFlags();
                  refreshAudits();
                }}
              >
                Refresh
              </button>

              <button
                className={clsx(
                  "px-4 py-2 rounded-xl font-semibold",
                  dirtyCount === 0 || savingAll
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                )}
                disabled={dirtyCount === 0 || savingAll}
                onClick={saveAllFlags}
              >
                {savingAll ? "Saving…" : "Save all"}
              </button>
            </div>
          </div>

          {(flagsError || auditError) && (
            <div className="px-5 sm:px-6 pb-5">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {flagsError ? <div className="font-semibold">Flags: {flagsError}</div> : null}
                {auditError ? <div className="font-semibold mt-1">Audit: {auditError}</div> : null}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="px-5 sm:px-6 pb-4">
            <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-slate-200">
              <button
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-bold transition",
                  tab === "flags" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setTab("flags")}
              >
                Feature Flags
              </button>
              <button
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-bold transition",
                  tab === "audit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
                onClick={() => setTab("audit")}
              >
                Audit Log
              </button>
            </div>
          </div>
        </div>

        {/* FLAGS TAB */}
        {tab === "flags" && (
          <div className="mt-6 space-y-6">
            {/* Filters */}
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Search</label>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="Search by key or description…"
                    value={flagQuery}
                    onChange={(e) => setFlagQuery(e.target.value)}
                  />
                </div>

                <div className="w-full lg:w-64">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Visibility</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    value={visibilityFilter}
                    onChange={(e) => setVisibilityFilter(e.target.value as any)}
                  >
                    <option value="any">Any</option>
                    {VISIBLE_TO.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full lg:w-auto lg:self-end">
                  <button
                    className="w-full lg:w-auto px-4 py-3 rounded-2xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200 border border-slate-200"
                    onClick={() => {
                      setFlagQuery("");
                      setVisibilityFilter("any");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </div>

            {/* Flags table */}
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-slate-900">Flags</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {flagsLoading ? "Loading…" : `${filteredFlags.length} flag(s)`}
                  </div>
                </div>

                {flagsLoading ? (
                  <div className="text-xs text-slate-500">Fetching data…</div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr className="text-left">
                      <th className="p-3 w-28">Enabled</th>
                      <th className="p-3 min-w-[360px]">Description</th>
                      <th className="p-3 w-52">Visibility</th>
                      <th className="p-3 w-[360px]">Key</th>
                      <th className="p-3 w-32">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {filteredFlags.map((row) => {
                      const eff = effective(row);
                      const dirty = !!draft[row.key];
                      const isSaving = savingKey === row.key;

                      return (
                        <tr key={row.key} className={clsx("align-top", dirty && "bg-amber-50/40")}>
                          <td className="p-3">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!eff.enabled}
                                onChange={(e) => setDraftField(row.key, { enabled: e.target.checked })}
                              />
                              <span className={clsx("text-xs font-bold", eff.enabled ? "text-emerald-700" : "text-slate-500")}>
                                {eff.enabled ? "ON" : "OFF"}
                              </span>
                            </label>
                          </td>

                          <td className="p-3">
                            <textarea
                              className="w-full min-h-[54px] rounded-2xl border border-slate-200 p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-300"
                              value={eff.description ?? ""}
                              onChange={(e) => setDraftField(row.key, { description: e.target.value })}
                              placeholder="Describe what this flag does…"
                            />
                            {dirty ? (
                              <div className="mt-1 text-[11px] font-semibold text-amber-700">Unsaved changes</div>
                            ) : (
                              <div className="mt-1 text-[11px] text-slate-400">Saved</div>
                            )}
                          </td>

                          <td className="p-3">
                            <select
                              className="w-full rounded-2xl border border-slate-200 px-3 py-3 bg-white text-sm outline-none focus:ring-2 focus:ring-slate-300"
                              value={eff.visible_to}
                              onChange={(e) => setDraftField(row.key, { visible_to: e.target.value as any })}
                            >
                              {VISIBLE_TO.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3">
                            <div className="font-mono text-xs text-slate-800 break-all">{row.key}</div>
                            {row.updated_at ? (
                              <div className="text-[11px] text-slate-400 mt-1">Updated: {formatWhen(String(row.updated_at))}</div>
                            ) : null}
                          </td>

                          <td className="p-3">
                            <button
                              className={clsx(
                                "w-full px-3 py-2 rounded-2xl font-bold text-sm",
                                !dirty || isSaving
                                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              )}
                              disabled={!dirty || isSaving}
                              onClick={() => saveFlag(row)}
                            >
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredFlags.length === 0 && !flagsLoading ? (
                      <tr>
                        <td className="p-5 text-slate-500" colSpan={5}>
                          No flags match your filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Last 5 changes UNDER the table */}
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-slate-900">Last 5 changes</div>
                  <div className="text-xs text-slate-500 mt-0.5">From audit table: {AUDIT_TABLE}</div>
                </div>
                {auditLoading ? <div className="text-xs text-slate-500">Loading…</div> : null}
              </div>

              {last5Audits.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">No audit rows yet.</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {last5Audits.map((a) => (
                    <div key={a.id} className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="text-sm font-bold text-slate-900">{a.flag_key}</div>
                        <div className="text-xs text-slate-500">{formatWhen(a.created_at)}</div>
                      </div>

                      <div className="mt-2 text-xs text-slate-600">
                        {String(a.from_enabled)} → {String(a.to_enabled)}
                        {a.note ? <span className="ml-2 text-slate-500">• {a.note}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUDIT TAB */}
        {tab === "audit" && (
          <div className="mt-6 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-900">Audit Log</div>
                <div className="text-xs text-slate-500 mt-0.5">Latest 20 rows • {AUDIT_TABLE}</div>
              </div>
              {auditLoading ? <div className="text-xs text-slate-500">Loading…</div> : null}
            </div>

            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                Select all (visible)
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className={clsx(
                    "px-4 py-2 rounded-2xl text-sm font-bold border",
                    visibleAuditIds.length === 0 || deletingAudits
                      ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                      : "bg-white text-red-700 border-red-200 hover:bg-red-50"
                  )}
                  disabled={visibleAuditIds.length === 0 || deletingAudits}
                  onClick={deleteVisible}
                >
                  {deletingAudits ? "Deleting…" : "Delete visible (20)"}
                </button>

                <button
                  className={clsx(
                    "px-4 py-2 rounded-2xl text-sm font-bold",
                    selectedVisibleCount === 0 || deletingAudits
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                  )}
                  disabled={selectedVisibleCount === 0 || deletingAudits}
                  onClick={deleteSelectedVisible}
                >
                  {deletingAudits ? "Deleting…" : `Delete selected (${selectedVisibleCount})`}
                </button>
              </div>
            </div>

            {visibleAudits.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No audit rows yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr className="text-left">
                      <th className="p-3 w-12"></th>
                      <th className="p-3 w-56">Time</th>
                      <th className="p-3 w-[360px]">Flag</th>
                      <th className="p-3 w-56">Change</th>
                      <th className="p-3">Note</th>
                      <th className="p-3 w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleAudits.map((a) => (
                      <tr key={a.id} className="align-top">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedAuditIds.includes(a.id)}
                            onChange={() => toggleSelectOne(a.id)}
                          />
                        </td>

                        <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{formatWhen(a.created_at)}</td>

                        <td className="p-3">
                          <div className="font-mono text-xs text-slate-900 break-all">{a.flag_key}</div>
                        </td>

                        <td className="p-3 text-xs text-slate-700 whitespace-nowrap">
                          {String(a.from_enabled)} → {String(a.to_enabled)}
                        </td>

                        <td className="p-3 text-xs text-slate-600">{a.note ?? "—"}</td>

                        <td className="p-3">
                          <button
                            className={clsx(
                              "px-3 py-2 rounded-2xl text-xs font-bold",
                              deletingAudits
                                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                : "bg-red-50 text-red-700 hover:bg-red-100"
                            )}
                            disabled={deletingAudits}
                            onClick={() => deleteOneAudit(a.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


