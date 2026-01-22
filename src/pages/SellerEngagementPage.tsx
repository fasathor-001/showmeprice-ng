import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useSellerEngagement } from "../hooks/useSellerEngagement";

type ModalType = "followers" | "views" | "saves" | null;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatWhen(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function labelForType(type: ModalType) {
  if (type === "followers") return "Followers";
  if (type === "views") return "Views";
  if (type === "saves") return "Saves";
  return "";
}

export default function SellerEngagementPage() {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [bizName, setBizName] = useState<string>("");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const {
    loading,
    followerCount,
    viewsCount,
    savesCount,
    followersRecent,
    viewsRecent,
    savesRecent,
    loadMore,
    refresh,
  } = useSellerEngagement(businessId, { recentLimit: 10 });

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!user?.id) {
        setBusinessId(null);
        setBizName("");
        return;
      }
      const { data, error } = await supabase
        .from("businesses")
        .select("id,business_name")
        .eq("user_id", user.id)
        .limit(1);
      if (!alive) return;
      if (error) {
        setBusinessId(null);
        setBizName("");
        return;
      }
      const row = (data?.[0] as any) ?? null;
      setBusinessId(row?.id ?? null);
      setBizName(String(row?.business_name ?? "").trim());
    };
    run();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const openModal = useCallback(
    async (type: ModalType) => {
      if (!type) return;
      setModalType(type);
      setModalLoading(true);
      try {
        const rows = await loadMore(type, 50);
        setModalItems(Array.isArray(rows) ? rows : []);
      } finally {
        setModalLoading(false);
      }
    },
    [loadMore]
  );

  const closeModal = useCallback(() => {
    setModalType(null);
    setModalItems([]);
  }, []);

  useEffect(() => {
    if (!modalType) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [modalType, closeModal]);

  const subtitle = bizName ? `Tracking ${bizName}` : "Track who followed, viewed, and saved your listings.";

  const renderRow = useCallback((row: any, showProduct: boolean) => {
    const name = row?.user?.display_name || "Buyer";
    const product = showProduct ? row?.product_title || "Product" : null;
    return (
      <div key={row.id} className="text-sm text-slate-700">
        <div className="font-semibold">{name}</div>
        {product ? <div className="text-xs text-slate-500">{product}</div> : null}
        <div className="text-xs text-slate-500">{formatWhen(row.created_at)}</div>
      </div>
    );
  }, []);

  const modalTitle = useMemo(() => {
    const label = labelForType(modalType);
    return label ? `Last 50 ${label}` : "";
  }, [modalType]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-2xl font-black text-slate-900">Engagement</div>
        <div className="text-sm text-slate-600">{subtitle}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-600 font-bold">Followers</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{followerCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-600 font-bold">Views</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{viewsCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm text-slate-600 font-bold">Saved</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{savesCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-black text-slate-800">Recent Followers</div>
            <button
              type="button"
              className="text-xs font-bold text-emerald-700 hover:underline"
              onClick={() => openModal("followers")}
            >
              View more
            </button>
          </div>
          {loading ? (
            <div className="text-xs text-slate-500">Loading...</div>
          ) : followersRecent.length === 0 ? (
            <div className="text-xs text-slate-500">No activity yet.</div>
          ) : (
            <div className="space-y-2">
              {followersRecent.map((row) => renderRow(row, false))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-black text-slate-800">Recent Views</div>
            <button
              type="button"
              className="text-xs font-bold text-emerald-700 hover:underline"
              onClick={() => openModal("views")}
            >
              View more
            </button>
          </div>
          {loading ? (
            <div className="text-xs text-slate-500">Loading...</div>
          ) : viewsRecent.length === 0 ? (
            <div className="text-xs text-slate-500">No activity yet.</div>
          ) : (
            <div className="space-y-2">
              {viewsRecent.map((row) => renderRow(row, true))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-black text-slate-800">Recent Saves</div>
            <button
              type="button"
              className="text-xs font-bold text-emerald-700 hover:underline"
              onClick={() => openModal("saves")}
            >
              View more
            </button>
          </div>
          {loading ? (
            <div className="text-xs text-slate-500">Loading...</div>
          ) : savesRecent.length === 0 ? (
            <div className="text-xs text-slate-500">No activity yet.</div>
          ) : (
            <div className="space-y-2">
              {savesRecent.map((row) => renderRow(row, true))}
            </div>
          )}
        </div>
      </div>

      {modalType ? (
        <div
          className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl rounded-2xl bg-white border shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-black text-slate-900">{modalTitle}</div>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-slate-100"
                aria-label="Close"
                onClick={closeModal}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-auto">
              {modalLoading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : modalItems.length === 0 ? (
                <div className="text-sm text-slate-500">No activity yet.</div>
              ) : (
                <div className="space-y-3">
                  {modalItems.map((row) =>
                    renderRow(row, modalType !== "followers")
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "px-4 py-2 rounded-xl border bg-white font-black text-slate-900 hover:bg-slate-50",
          loading && "opacity-60 cursor-not-allowed"
        )}
        onClick={() => refresh()}
        disabled={loading}
      >
        Refresh
      </button>
    </div>
  );
}
