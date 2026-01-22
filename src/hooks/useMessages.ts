// src/hooks/useMessages.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

export type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  product_id: string | null;
  conversation_id?: string | null;
  product?: { id: string; title: string | null; price: number | string | null; images?: string[] | null } | null;
  sender?: { id: string; display_name: string | null; full_name: string | null; username: string | null } | null;
  receiver?: { id: string; display_name: string | null; full_name: string | null; username: string | null } | null;
};

export type Conversation = {
  key: string;
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
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const active = useMemo(() => {
    if (!activeKey) return null;
    return conversations.find((c) => c.key === activeKey) ?? null;
  }, [activeKey, conversations]);

  const refreshConversations = useCallback(async () => {
    if (!user || !enabled) {
      setConversations([]);
      setActiveKey(null);
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: e } = await supabase
        .from("messages")
        .select(
          "id,sender_id,receiver_id,content:body,created_at,read_at,product_id,product:products!messages_product_id_fkey(id,title,price,images),sender:profiles!messages_sender_id_fkey(id,display_name,full_name,username),receiver:profiles!messages_receiver_id_fkey(id,display_name,full_name,username)"
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
      let nameById: Record<string, string> = {};
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
      if (activeKey && !convs.some((c) => c.key === activeKey)) {
        setActiveKey(null);
        setMessages([]);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [user?.id, enabled, activeKey]);

  const loadChat = useCallback(
    async (partnerId: string, productId: string | null) => {
      if (!user) return;

      const key = convKey(partnerId, productId);
      setActiveKey(key);
      setLoadingChat(true);
      setError(null);

      try {
        let q = supabase
          .from("messages")
          .select(
            "id,sender_id,receiver_id,content:body,created_at,read_at,product_id,product:products!messages_product_id_fkey(id,title,price,images),sender:profiles!messages_sender_id_fkey(id,display_name,full_name,username),receiver:profiles!messages_receiver_id_fkey(id,display_name,full_name,username)"
          )
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true })
          .limit(500);

        if (productId) q = q.eq("product_id", productId);
        else q = q.is("product_id", null);

        const { data, error: e } = await q;
        if (e) throw e;

        const rows = (data ?? []).map((m: any) => ({
          ...m,
          content: normalizeContent(m?.content),
        })) as ChatMessage[];
        setMessages(rows);

        // Mark read (only messages sent to me by partner in this conversation)
        const hasUnread = rows.some(
          (m) => m.receiver_id === user.id && m.sender_id === partnerId && !m.read_at
        );

        if (hasUnread) {
          let uq = supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .eq("receiver_id", user.id)
            .eq("sender_id", partnerId)
            .is("read_at", null);

          uq = productId ? uq.eq("product_id", productId) : uq.is("product_id", null);
          await uq;

          // Refresh conv list counts
          refreshConversations();
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load chat");
      } finally {
        setLoadingChat(false);
      }
    },
    [user?.id, refreshConversations]
  );

  const sendMessage = useCallback(
    async (partnerId: string, productId: string | null, content: string) => {
      if (!user) throw new Error("Not signed in");
      const text = String(content ?? "").trim();
      if (!text) return;

      const payload = {
        sender_id: user.id,
        receiver_id: partnerId,
        body: text,
        product_id: productId,
      };

      const { data, error: e } = await supabase.from("messages").insert(payload).select().limit(1);
      if (e) throw e;

      const inserted = (data?.[0] ?? null) as ChatMessage | null;
      if (inserted) {
        setMessages((prev) => [...prev, inserted]);
        refreshConversations();
      }
    },
    [user?.id, refreshConversations]
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

          refreshConversations();

          // If active chat matches, append + mark read (if needed)
          if (activeKey) {
            const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
            const key = convKey(partnerId, m.product_id ?? null);
            if (key === activeKey) {
              setMessages((prev) => [...prev, m]);

              if (m.receiver_id === user.id && !m.read_at) {
                supabase
                  .from("messages")
                  .update({ read_at: new Date().toISOString() })
                  .eq("id", m.id);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, enabled, refreshConversations, activeKey]);

  return {
    loading,
    loadingChat,
    error,
    conversations,
    active,
    activeKey,
    messages,
    refreshConversations,
    loadChat,
    sendMessage,
    setActiveKey,
  };
}

export default useMessages;
