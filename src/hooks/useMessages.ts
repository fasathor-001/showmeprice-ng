// src/hooks/useMessages.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type ChatMessage = {
  id: string;
  conversation_id?: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  product_id: string | null;
  product?: { id: string; title: string | null; price: number | string | null; images?: string[] | null } | null;
  sender?: { id: string; display_name: string | null; full_name: string | null; username: string | null } | null;
  receiver?: { id: string; display_name: string | null; full_name: string | null; username: string | null } | null;
};

export type Conversation = {
  key: string;
  conversationId: string | null;
  partnerId: string;
  partnerName: string;
  productId: string | null;
  productTitle?: string | null;
  productPrice?: number | string | null;
  productImages?: string[] | null;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
};

function cleanDisplayName(p: any) {
  const raw =
    String(p?.display_name || "").trim() ||
    String(p?.full_name || "").trim() ||
    String(p?.username || "").trim();
  const lower = raw.toLowerCase();
  if (!raw || lower === "unknown" || lower === "unknown user") return "";
  return raw;
}

function normalizeContent(v: any) {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function convKey(partnerId: string, productId: string | null) {
  return `${partnerId}::${productId ?? ""}`;
}

function nameFromProfile(p: any) {
  return (
    String(p?.display_name || "").trim() ||
    String(p?.full_name || "").trim() ||
    String(p?.username || "").trim()
  );
}

export function useMessages(opts?: { enabled?: boolean }) {
  const { user } = useAuth();
  const enabled = opts?.enabled ?? true;

  const [loading, setLoading] = useState(false);
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesByConversationId, setMessagesByConversationId] = useState<
    Record<string, ChatMessage[]>
  >({});

  const active = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find((c) => c.conversationId === activeConversationId) ?? null;
  }, [activeConversationId, conversations]);

  const updateConversationMeta = useCallback(
    (params: {
      conversationId?: string | null;
      partnerId?: string;
      productId?: string | null;
      lastMessage?: string;
      lastAt?: string;
      unreadDelta?: number;
      unreadCount?: number;
      forceUnreadZero?: boolean;
    }) => {
      const convId = params.conversationId ? String(params.conversationId) : "";
      if (!convId) return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c.conversationId || "") === convId);
        if (idx >= 0) {
          const current = prev[idx];
          let unread = current.unreadCount;
          if (params.forceUnreadZero) unread = 0;
          else if (typeof params.unreadCount === "number") unread = params.unreadCount;
          else if (typeof params.unreadDelta === "number") unread = Math.max(0, unread + params.unreadDelta);

          const updated = {
            ...current,
            lastMessage: params.lastMessage ?? current.lastMessage,
            lastAt: params.lastAt ?? current.lastAt,
            unreadCount: unread,
          };
          const next = [...prev];
          next[idx] = updated;
          return next;
        }

        const partnerId = params.partnerId || "";
        const newConv: Conversation = {
          key: `conv:${convId}`,
          conversationId: convId,
          partnerId,
          partnerName: "",
          productId: params.productId ?? null,
          productTitle: null,
          productPrice: null,
          productImages: null,
          lastMessage: params.lastMessage ?? "",
          lastAt: params.lastAt ?? new Date().toISOString(),
          unreadCount: params.forceUnreadZero ? 0 : Math.max(0, params.unreadDelta ?? 0),
        };
        return [newConv, ...prev];
      });
    },
    []
  );

  const refreshConversations = useCallback(async () => {
    if (!user || !enabled) {
      setConversations([]);
      setActiveConversationId(null);
      setMessagesByConversationId({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: e } = await supabase
        .from("messages")
        .select(
          "id,conversation_id,sender_id,receiver_id,content:body,created_at,read_at,product_id,product:products!messages_product_id_fkey(id,title,price,images),sender:profiles!messages_sender_id_fkey(id,display_name,full_name,username),receiver:profiles!messages_receiver_id_fkey(id,display_name,full_name,username)"
        )
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(400);

      if (e) throw e;

      const rows = (data ?? []).map((m: any) => ({
        ...m,
        content: normalizeContent(m?.content),
      })) as ChatMessage[];

      // Build convs
      const map = new Map<string, Omit<Conversation, "partnerName"> & { partnerName?: string }>();

      for (const m of rows) {
        const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        const convId = (m as any)?.conversation_id ? String((m as any).conversation_id) : "";
        const key = convId ? `conv:${convId}` : convKey(partnerId, m.product_id ?? null);
        const partnerProfile = m.sender_id === user.id ? m.receiver : m.sender;

        if (!map.has(key)) {
          map.set(key, {
            key,
            conversationId: convId || null,
            partnerId,
            productId: m.product_id ?? null,
            productTitle: (m as any)?.product?.title ?? null,
            productPrice: (m as any)?.product?.price ?? null,
            productImages: (m as any)?.product?.images ?? null,
            lastMessage: m.content,
            lastAt: m.created_at,
            unreadCount: 0,
            partnerName: nameFromProfile(partnerProfile),
          });
        }

        // unread count for this conversation
        if (m.receiver_id === user.id && !m.read_at) {
          map.get(key)!.unreadCount += 1;
        }
      }

      const convsRaw = Array.from(map.values());

      // Fetch profile names
      const partnerIds = Array.from(new Set(convsRaw.map((c) => c.partnerId)));
      const nameById: Record<string, string> = {};
      if (partnerIds.length) {
        // Prefer business_name for sellers when available
        try {
          const { data: bizRows } = await supabase
            .from("businesses")
            .select("user_id,business_name")
            .in("user_id", partnerIds);

          for (const b of bizRows ?? []) {
            const uid = String((b as any)?.user_id ?? "");
            const bn = String((b as any)?.business_name ?? "").trim();
            if (uid && bn) nameById[uid] = bn;
          }
        } catch {
          // ignore (RLS / table missing / etc.)
        }

        const { data: profs } = await supabase
          .from("profiles")
          .select("id,display_name,full_name,username")
          .in("id", partnerIds);

        for (const p of profs ?? []) {
          const id = String((p as any).id ?? "").trim();
          const n = cleanDisplayName(p);
          if (id && n && !nameById[id]) nameById[id] = n;
        }
      }

      function fallbackName(id: string) {
        const v = String(id || "").trim();
        return v ? `User • ${v.slice(0, 6)}` : "User";
      }

      const convs: Conversation[] = convsRaw
        .map((c) => ({
          ...c,
          partnerName: c.partnerName || nameById[c.partnerId] || fallbackName(c.partnerId),
        }))
        .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

      setConversations(convs);

      // keep activeKey if still exists
      if (activeConversationId && !convs.some((c) => c.conversationId === activeConversationId)) {
        setActiveConversationId(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [user?.id, enabled, activeConversationId]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      if (!conversationId) return;

      setLoadingThreadId(conversationId);
      setError(null);

      try {
        let q = supabase
          .from("messages")
          .select(
            "id,conversation_id,sender_id,receiver_id,content:body,created_at,read_at,product_id,product:products!messages_product_id_fkey(id,title,price,images),sender:profiles!messages_sender_id_fkey(id,display_name,full_name,username),receiver:profiles!messages_receiver_id_fkey(id,display_name,full_name,username)"
          )
          .order("created_at", { ascending: true })
          .limit(500);

        q = q.eq("conversation_id", conversationId);

        const { data, error: e } = await q;
        if (e) throw e;

        const rows = (data ?? []).map((m: any) => ({
          ...m,
          content: normalizeContent(m?.content),
        })) as ChatMessage[];
        setMessagesByConversationId((prev) => ({ ...prev, [conversationId]: rows }));

        // Mark read (only messages sent to me by partner in this conversation)
        const hasUnread = rows.some((m) => m.receiver_id === user.id && !m.read_at);

        if (hasUnread) {
          let uq = supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("receiver_id", user.id)
            .is("read_at", null);
          uq = uq.eq("conversation_id", conversationId);
          await uq;
          updateConversationMeta({ conversationId, forceUnreadZero: true });
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load chat");
      } finally {
        setLoadingThreadId(null);
      }
    },
    [user?.id, updateConversationMeta]
  );

  const sendMessage = useCallback(
    async (args: { conversationId: string; otherUserId: string; productId?: string | null; body: string }) => {
      if (!user) throw new Error("Not signed in");
      const text = String(args.body ?? "").trim();
      if (!text) return;
      if (!args.conversationId) throw new Error("Missing conversation.");

      const payload = {
        sender_id: user.id,
        receiver_id: args.otherUserId,
        body: text,
        product_id: args.productId ?? null,
        conversation_id: args.conversationId,
      };

      setSending(true);
      try {
        const { data, error: e } = await supabase.from("messages").insert(payload).select("*").single();
        if (e) throw e;

        const inserted = (data ?? null) as ChatMessage | null;
        if (inserted) {
          const normalized = {
            ...inserted,
            content: normalizeContent((inserted as any)?.content ?? (inserted as any)?.body),
          } as ChatMessage;
          const convId = String(args.conversationId);
          setMessagesByConversationId((prev) => {
            const list = prev[convId] ?? [];
            if (list.some((m) => m.id === normalized.id)) return prev;
            return { ...prev, [convId]: [...list, normalized] };
          });
          updateConversationMeta({
            conversationId: args.conversationId,
            lastMessage: normalized.content,
            lastAt: normalized.created_at,
            forceUnreadZero: true,
          });
          await loadThread(args.conversationId);
        }
      } finally {
        setSending(false);
      }
    },
    [user?.id, loadThread, updateConversationMeta]
  );

  // Initial + realtime updates
  useEffect(() => {
    if (!user || !enabled) return;

    refreshConversations();

    const channel = supabase
      .channel(`messages:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: any) => {
          const mRaw = payload?.new as any;
          const m = mRaw
            ? ({ ...mRaw, content: normalizeContent(mRaw.content ?? mRaw.body) } as ChatMessage)
            : undefined;
          if (!m) return;
          if (m.sender_id !== user.id && m.receiver_id !== user.id) return;

          // If active chat matches, append + mark read (if needed)
          const convId = m.conversation_id ? String(m.conversation_id) : "";
          if (convId) {
            setMessagesByConversationId((prev) => {
              const list = prev[convId] ?? [];
              if (list.some((msg) => msg.id === m.id)) return prev;
              return { ...prev, [convId]: [...list, m] };
            });
            updateConversationMeta({
              conversationId: convId,
              partnerId: m.sender_id === user.id ? m.receiver_id : m.sender_id,
              productId: m.product_id ?? null,
              lastMessage: normalizeContent(m.content),
              lastAt: m.created_at,
              unreadDelta:
                m.receiver_id === user.id && (!activeConversationId || convId !== activeConversationId) ? 1 : 0,
              forceUnreadZero: convId === activeConversationId,
            });
          }

          if (activeConversationId && convId === activeConversationId) {
            if (m.receiver_id === user.id && !m.read_at) {
              supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, enabled, activeConversationId, updateConversationMeta]);

  return {
    loading,
    loadingThreadId,
    sending,
    error,
    conversations,
    active,
    activeConversationId,
    messagesByConversationId,
    refreshConversations,
    loadThread,
    sendMessage,
    setActiveConversationId,
  };
}

export default useMessages;
