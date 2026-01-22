// src/pages/InboxPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, RefreshCw, SendHorizontal, Image as ImageIcon } from "lucide-react";
import useMessages from "../hooks/useMessages";
import { useAuth } from "../hooks/useAuth";
import { useFF } from "../hooks/useFF";
import { useProfile } from "../hooks/useProfile";
import { supabase } from "../lib/supabase";

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

type InboxInit = {
  partnerId: string;
  productId: string | null;
  partnerName?: string;
  message?: string;
  returnTo?: string;
};

type ProductPreview = {
  id: string;
  title: string | null;
  price: number | string | null;
  images: string[] | null;
  city: string | null;
};

function safeStr(v: any) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function safeLower(v: any) {
  return safeStr(v).toLowerCase();
}

function formatMoney(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "";
  return `₦${n.toLocaleString("en-NG")}`;
}

function formatThreadTime(v?: string | null) {
  if (!v) return "";
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return "";
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d`;
  return new Date(v).toLocaleDateString();
}
function shortId(id: string) {
  const s = safeStr(id);
  return s ? s.slice(0, 6) : "";
}

function cleanPartnerCandidate(v: any) {
  const s = safeStr(v);
  if (!s) return "";
  const lower = safeLower(s);
  if (lower === "unknown user" || lower === "unknown") return "";
  return s;
}

function publicProductImageUrl(pathOrUrl: string) {
  const s = safeStr(pathOrUrl);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;

  const base = safeStr((import.meta as any)?.env?.VITE_SUPABASE_URL);
  if (!base) return "";
  return `${base}/storage/v1/object/public/products/${s}`;
}

function pickImage(images: any): string | null {
  const arr = Array.isArray(images) ? images : [];
  const first = safeStr(arr[0]);
  return first || null;
}

function normalizeInboxInit(v: any): InboxInit | null {
  if (!v) return null;
  const partnerId = safeStr(v.partnerId);
  if (!partnerId) return null;

  const productId = safeStr(v.productId) || null;
  const partnerName = safeStr(v.partnerName) || undefined;
  const message = safeStr(v.message) || undefined;
  const returnTo = safeStr(v.returnTo) || undefined;

  return { partnerId, productId, partnerName, message, returnTo };
}

export default function InboxPage({ initialChat }: { initialChat?: InboxInit }) {
  const { user } = useAuth();
  const { profile, business } = useProfile() as any;
  const FF = useFF();

  const messagingEnabled = !!(FF as any)?.messaging;

  const {
    loading,
    error,
    conversations,
    active,
    activeKey,
    messages,
    refreshConversations,
    loadChat,
    sendMessage,
    setActiveKey,
  } = useMessages({ enabled: messagingEnabled });

  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [showChatMobile, setShowChatMobile] = useState(false);

  const [compose, setCompose] = useState<InboxInit | null>(null);
  const [hasBusiness, setHasBusiness] = useState<boolean | null>(null);

  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [productPreview, setProductPreview] = useState<ProductPreview | null>(null);

  const chatsDisabled = !!(profile as any)?.chats_disabled;

  const isSeller = hasBusiness === true || !!(business as any)?.id;
  const backTo = isSeller ? "/my-shop" : "/dashboard";
  const backLabel = isSeller ? "Back to My Shop" : "Back to Dashboard";

  function fallbackPartnerLabel(pid: string) {
    const sid = shortId(pid);
    if (isSeller) return sid ? `Buyer ${sid}` : "Buyer";
    return sid ? `Seller ${sid}` : "Seller";
  }

  const currentPartnerId =
    (active as any)?.partnerId ? (active as any).partnerId : compose?.partnerId ? compose.partnerId : null;

  const currentProductId =
    (active as any)?.productId !== undefined && (active as any)?.productId !== null
      ? (active as any).productId
      : compose?.productId
      ? compose.productId
      : null;

  const currentPartnerName =
    safeStr(currentPartnerId ? nameById[currentPartnerId] : "") ||
    cleanPartnerCandidate(active?.partnerName) ||
    cleanPartnerCandidate(compose?.partnerName) ||
    (currentPartnerId ? "Unknown" : "Select a conversation");

  const selected = !!currentPartnerId;

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return conversations;
    return (conversations || []).filter((c: any) => {
      const pid = safeStr(c.partnerId);
      const name = (nameById[pid] || cleanPartnerCandidate(c.partnerName) || "").toLowerCase();
      const last = (c.lastMessage || "").toLowerCase();
      const productTitle = safeStr((c as any).productTitle).toLowerCase();
      return name.includes(qq) || last.includes(qq) || productTitle.includes(qq);
    });
  }, [q, conversations, nameById]);

  useEffect(() => {
    const ids = new Set<string>();
    for (const c of conversations || []) {
      const pid = safeStr((c as any)?.partnerId);
      if (pid) ids.add(pid);
    }
    const cp = safeStr(compose?.partnerId);
    if (cp) ids.add(cp);

    const uniq = Array.from(ids);
    if (uniq.length === 0) return;

    let cancelled = false;

    (async () => {
      const profMap: Record<string, { displayName: string; fullName: string; username: string }> = {};
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id,display_name,full_name,username")
          .in("id", uniq);
        for (const row of data || []) {
          const id = safeStr((row as any).id);
          if (!id) continue;
          const displayName = safeStr((row as any).display_name);
          const fullName = safeStr((row as any).full_name);
          const username = safeStr((row as any).username);
          profMap[id] = { displayName, fullName, username };
        }
      } catch {
        // ignore
      }

      if (cancelled) return;

      setNameById((prev) => {
        const next = { ...prev };
        for (const id of uniq) {
          const displayName = safeStr(profMap[id]?.displayName);
          const fullName = safeStr(profMap[id]?.fullName);
          const username = safeStr(profMap[id]?.username);
          const desired = displayName || fullName || username || "Unknown";
          const prevName = safeStr(next[id]);
          if ((safeLower(prevName) === "unknown user" || safeLower(prevName) === "unknown") && !desired) {
            delete next[id];
            continue;
          }
          if (desired && desired !== prevName) next[id] = desired;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [conversations, compose?.partnerId, isSeller]);

  useEffect(() => {
    const pid = safeStr(currentProductId);
    if (!pid) {
      setProductPreview(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase
          .from("products")
          .select("id,title,price,images,city")
          .eq("id", pid)
          .limit(1);

        const row: any = (data as any)?.[0] ?? null;
        if (cancelled) return;

        if (!row) {
          setProductPreview(null);
          return;
        }

        setProductPreview({
          id: safeStr(row.id),
          title: row.title ?? null,
          price: row.price ?? null,
          images: (row.images as any) ?? null,
          city: row.city ?? null,
        });
      } catch {
        if (!cancelled) setProductPreview(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentProductId]);

  const onPickConversation = async (partnerId: string, productId: string | null) => {
    setCompose(null);
    await loadChat(partnerId, productId);
    setShowChatMobile(true);
  };

  const onSend = async () => {
    if (!currentPartnerId) return;
    if (!draft.trim()) return;
    if (chatsDisabled) return;

    await sendMessage(currentPartnerId, currentProductId ?? null, draft);
    setDraft("");
  };

  useEffect(() => {
    if (!user || !messagingEnabled) return;

    const fromProp = normalizeInboxInit(initialChat);
    let init = fromProp;

    if (!init) {
      try {
        const raw = sessionStorage.getItem("smp:view-inbox");
        init = normalizeInboxInit(raw ? JSON.parse(raw) : null);
      } catch {
        init = null;
      }
    }

    if (!init) return;

    setCompose(init);
    loadChat(init.partnerId, init.productId ?? null);

    if (init.message) setDraft(init.message);
    setShowChatMobile(true);
  }, [user?.id, messagingEnabled, initialChat?.partnerId, initialChat?.productId]);

  // Determine whether this account has a seller business (used for correct routing + labels)
  useEffect(() => {
    const uid = safeStr(user?.id);
    if (!uid) {
      setHasBusiness(null);
      return;
    }
    setHasBusiness(null);
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("businesses")
          .select("id")
          .eq("user_id", uid)
          .limit(1);
        if (cancelled) return;
        if (error) {
          setHasBusiness(null);
          return;
        }
        setHasBusiness((data?.length ?? 0) > 0);
      } catch {
        if (!cancelled) setHasBusiness(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-2xl font-black text-slate-900">Inbox</div>
        <p className="text-slate-600 mt-2">Please sign in to view your messages.</p>
      </div>
    );
  }

  if (!messagingEnabled) {
    return (
      <div className="p-6">
        <div className="text-2xl font-black text-slate-900">Inbox</div>
        <p className="text-slate-600 mt-2">Messaging is currently disabled.</p>
      </div>
    );
  }

  const chatShellHeight = "h-[72vh]";

  const previewImg = (() => {
    const imgs = productPreview?.images || [];
    const first = Array.isArray(imgs) ? imgs[0] : "";
    return publicProductImageUrl(String(first || ""));
  })();

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-black text-slate-900">Inbox</div>
            <div className="text-sm text-slate-600">Messages between buyers and sellers.</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshConversations()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border hover:bg-slate-50 text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {error ? <div className="text-sm text-rose-600 mb-4">{error}</div> : null}

        <div className={`grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 ${chatShellHeight}`}>
          {/* Left: conversations */}
          <div
            className={["rounded-2xl border bg-white overflow-hidden shadow-sm", showChatMobile ? "hidden md:block" : ""].join(
              " "
            )}
          >
            <div className="p-3 border-b bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-3 py-2 rounded-xl border bg-white"
                />
              </div>
            </div>

            <div className="h-full overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 rounded-xl border bg-white">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-40 bg-slate-100 rounded animate-pulse" />
                        <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                        <div className="h-3 w-56 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-slate-600">
                  No messages yet. Message a seller from a product to start chatting.
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((c: any) => {
                    const isActive = activeKey === c.key;
                    const pid = safeStr(c.partnerId);
                    const candidate = cleanPartnerCandidate((c as any).partnerName);
                    const name = nameById[pid] || candidate || "Unknown";
                    const productTitle = safeStr((c as any)?.productTitle) || "Product";
                    const productPrice = formatMoney((c as any)?.productPrice);
                    const imgPath = pickImage((c as any)?.productImages);
                    const imgUrl = imgPath ? publicProductImageUrl(imgPath) : "";
                    const timeLabel = formatThreadTime(c.lastAt);
                    return (
                      <button
                        key={c.key}
                        onClick={() => {
                          setActiveKey(c.key);
                          onPickConversation(c.partnerId, c.productId);
                        }}
                        aria-label={`Open chat for ${productTitle}`}
                        className={["w-full text-left p-4 hover:bg-slate-50 transition", isActive ? "bg-emerald-50" : ""].join(
                          " "
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-xl border bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                            {imgUrl ? (
                              <img src={imgUrl} alt={productTitle} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-400" aria-hidden="true" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-black text-slate-900 line-clamp-1">{productTitle}</div>
                            <div className="text-xs text-slate-600 mt-1 line-clamp-1">
                              {productPrice ? `${productPrice} • ` : ""}
                              {name}
                            </div>
                            <div className="text-xs text-slate-600 mt-1 line-clamp-1">{c.lastMessage}</div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="text-[11px] text-slate-500 whitespace-nowrap">{timeLabel}</div>
                            {c.unreadCount > 0 ? (
                              <div className="min-w-[22px] h-[22px] px-2 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">
                                {c.unreadCount}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: chat */}
          <div
            className={["rounded-2xl border bg-white overflow-hidden shadow-sm flex flex-col", !showChatMobile ? "hidden md:flex" : "flex"].join(
              " "
            )}
          >
            <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowChatMobile(false);
                    setActiveKey(null);
                    setCompose(null);
                  }}
                  className="md:hidden inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-50 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl border bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                    {previewImg ? (
                      <img src={previewImg} alt={safeStr(productPreview?.title) || "Product"} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-slate-900 truncate">
                      {safeStr(productPreview?.title) || (selected ? "Product" : "Select a conversation")}
                    </div>
                    <div className="text-xs text-slate-600 truncate">
                      {formatMoney(productPreview?.price)} {formatMoney(productPreview?.price) ? "• " : ""}
                      {selected ? currentPartnerName : "Secure in-app messages"}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => nav(backTo)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-slate-50 text-sm font-semibold"
              >
                {backLabel}
              </button>
            </div>

            

            <div className="flex-1 p-4 overflow-y-auto bg-white">
              {!selected ? (
                <div className="text-slate-600">Choose a conversation on the left to view messages.</div>
              ) : (
                <div className="space-y-3">
                  {messages.length === 0 ? <div className="text-sm text-slate-600">No messages yet. Send the first message.</div> : null}

                  {messages.map((m: any) => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                        <div className={["max-w-[72%] rounded-2xl px-4 py-2 text-sm shadow-sm", mine ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-900"].join(" ")}>
                          {m.content}
                          <div className={["mt-1 text-[10px]", mine ? "text-emerald-100" : "text-slate-500"].join(" ")}>
                            {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t bg-white">
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={!currentPartnerId || chatsDisabled}
                  placeholder={
                    !currentPartnerId ? "Select a conversation to start..." : chatsDisabled ? "Chats are disabled in Settings" : "Type a message…"
                  }
                  className="flex-1 px-4 py-3 rounded-xl border bg-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSend();
                  }}
                />
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!currentPartnerId || chatsDisabled || !draft.trim()}
                  className={[
                    "px-4 py-3 rounded-xl font-black inline-flex items-center gap-2",
                    !currentPartnerId || chatsDisabled || !draft.trim()
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-700",
                  ].join(" ")}
                >
                  <SendHorizontal className="w-4 h-4" />
                  Send
                </button>
              </div>

              <div className="text-[11px] text-slate-500 mt-2">For safety, don’t share phone numbers, bank details, or payment links in chat.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
