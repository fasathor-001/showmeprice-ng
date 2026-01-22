import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useHubs, useSubcategories } from "../../hooks/useCategories";

interface ProductCategorySelectorProps {
  onCategorySelect: (subcategoryId: number) => void;
  /**
   * Optional: if you are editing a listing and want to preset a subcategory.
   * Note: we still need the user to pick the hub again if we don't know it.
   */
  initialSubcategoryId?: number | null;
}

export default function ProductCategorySelector({
  onCategorySelect,
  initialSubcategoryId = null,
}: ProductCategorySelectorProps) {
  const { hubs, loading: hubsLoading, error: hubsError } = useHubs() as any;

  const [selectedHubId, setSelectedHubId] = useState<string>("");
  const { subcategories, loading: subsLoading, error: subsError } = useSubcategories(
    selectedHubId || null
  ) as any;

  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");

  // Optional preset (best-effort)
  useEffect(() => {
    if (initialSubcategoryId && !selectedSubcategoryId) {
      setSelectedSubcategoryId(String(initialSubcategoryId));
      // We cannot infer hubId from subcategory without an index; user can re-pick hub if needed.
    }
  }, [initialSubcategoryId, selectedSubcategoryId]);

  const hubOptions = useMemo(() => {
    return (hubs || []).map((h: any) => ({
      id: String(h.id),
      name: String(h.name ?? "Untitled"),
    }));
  }, [hubs]);

  const subOptions = useMemo(() => {
    return (subcategories || []).map((s: any) => ({
      id: String(s.id),
      name: String(s.name ?? "Untitled"),
    }));
  }, [subcategories]);

  const handleHubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedHubId(e.target.value);
    setSelectedSubcategoryId("");
  };

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedSubcategoryId(id);
    const parsed = parseInt(id, 10);
    if (Number.isFinite(parsed)) onCategorySelect(parsed);
  };

  return (
    <div className="space-y-3">
      {/* Hub */}
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Hub</label>
        <div className="relative">
          <select
            value={selectedHubId}
            onChange={handleHubChange}
            disabled={hubsLoading}
            className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-3 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 disabled:opacity-60"
          >
            <option value="">{hubsLoading ? "Loading hubs..." : "Select a hub"}</option>
            {hubOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            {hubsLoading ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>
        {hubsError ? <div className="text-xs text-rose-600 mt-1">{String(hubsError)}</div> : null}
      </div>

      {/* Subcategory */}
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Subcategory</label>

        <div className="relative">
          <select
            value={selectedSubcategoryId}
            onChange={handleSubcategoryChange}
            disabled={!selectedHubId || subsLoading}
            className="w-full appearance-none border border-slate-200 rounded-xl px-4 py-3 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 disabled:opacity-60"
          >
            <option value="">
              {!selectedHubId
                ? "Select a hub first"
                : subsLoading
                  ? "Loading subcategories..."
                  : "Select a subcategory"}
            </option>
            {subOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            {subsLoading ? (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {subsError ? <div className="text-xs text-rose-600 mt-1">{String(subsError)}</div> : null}

        <p className="text-xs text-slate-500 mt-2">
          Products must be listed under a specific subcategory for better discovery.
        </p>
      </div>
    </div>
  );
}
