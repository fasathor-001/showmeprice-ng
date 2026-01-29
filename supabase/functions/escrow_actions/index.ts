import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ActionPayload = {
  action?: string;
  escrow_order_id?: string;
  payload?: Record<string, unknown>;
};

function normalizeId(input: unknown) {
  return String(input ?? "").trim();
}

function bestName(row: Record<string, unknown> | null | undefined) {
  const display = String((row as any)?.display_name ?? "").trim();
  const full = String((row as any)?.full_name ?? "").trim();
  return display || full || "";
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(500, { ok: false, error: "Server misconfigured." });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return jsonResponse(401, { ok: false, error: "Unauthorized", detail: "Missing access token" });
    }

    let input: ActionPayload | null = null;
    try {
      input = (await req.json()) as ActionPayload;
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid request.", detail: "Invalid JSON payload." });
    }

    const action = String(input?.action ?? "").trim();
    const escrowOrderId = normalizeId(input?.escrow_order_id);
    const payload = (input?.payload ?? {}) as Record<string, unknown>;
    const allowed = new Set([
      "buyer_confirm_delivery",
      "buyer_open_dispute",
      "admin_resolve_dispute",
      "admin_list_open_disputes",
      "admin_list_pending_releases",
      "admin_release_to_seller",
    ]);

    if (!action) {
      return jsonResponse(400, { ok: false, error: "Invalid request.", detail: "Missing action." });
    }
    if (!allowed.has(action)) {
      return jsonResponse(400, { ok: false, error: "Invalid request.", detail: "Unsupported action." });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(token);
    const user = authData?.user ?? null;
    if (authErr || !user) {
      return jsonResponse(401, {
        ok: false,
        error: "Unauthorized",
        detail: "Invalid or expired session. Please sign in again.",
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const userId = String(user.id);

    const buildDisplayMap = async (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (!uniqueIds.length) return { nameById: {}, emailById: {} };

      const { data: profRows, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, full_name")
        .in("id", uniqueIds);
      if (profErr) {
        console.error("[escrow_actions] profile lookup failed", {
          message: profErr.message,
          code: profErr.code,
        });
      }

      const nameById: Record<string, string> = {};
      (profRows ?? []).forEach((p: any) => {
        const name = bestName(p);
        if (p?.id && name) nameById[String(p.id)] = name;
      });

      const emailById: Record<string, string> = {};
      const missingNameIds = uniqueIds.filter((id) => !nameById[id]);
      if (missingNameIds.length > 0) {
        await Promise.all(
          missingNameIds.map(async (id) => {
            try {
              const { data } = await supabaseAdmin.auth.admin.getUserById(id);
              const email = String(data?.user?.email ?? "").trim();
              if (email) emailById[id] = email;
            } catch {}
          })
        );
      }

      return { nameById, emailById };
    };

    if (action === "admin_list_open_disputes") {
      const { data: prof, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();
      if (pErr) {
        console.error("[escrow_actions] admin check failed", {
          message: pErr.message,
          code: pErr.code,
        });
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to verify admin." });
      }
      if (!prof?.is_admin) {
        return jsonResponse(403, { ok: false, error: "Forbidden", detail: "Admin only." });
      }

      const { data: disputes, error: listErr } = await supabaseAdmin
        .from("escrow_orders")
        .select(
          "id,status,subtotal_kobo,escrow_fee_kobo,total_kobo,dispute_status,dispute_reason,dispute_opened_at,buyer_id,seller_id,product_snapshot,created_at"
        )
        .eq("dispute_status", "open")
        .order("dispute_opened_at", { ascending: false })
        .limit(100);
      if (listErr) {
        console.error("[escrow_actions] disputes list failed", {
          message: listErr.message,
          code: listErr.code,
        });
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to load disputes." });
      }

      const rows = (disputes ?? []) as any[];
      const ids = rows.flatMap((r) => [String(r.buyer_id ?? ""), String(r.seller_id ?? "")]);
      const { nameById, emailById } = await buildDisplayMap(ids);

      const mapped = rows.map((r) => ({
        ...r,
        buyer_display: {
          id: String(r.buyer_id ?? ""),
          name: nameById[String(r.buyer_id ?? "")] || "",
          email: emailById[String(r.buyer_id ?? "")] || "",
        },
        seller_display: {
          id: String(r.seller_id ?? ""),
          name: nameById[String(r.seller_id ?? "")] || "",
          email: emailById[String(r.seller_id ?? "")] || "",
        },
      }));

      console.log("[escrow_actions] admin_list_open_disputes ok", { userId });
      return jsonResponse(200, { ok: true, disputes: mapped });
    }

    if (action === "admin_list_pending_releases") {
      const { data: prof, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();
      if (pErr) {
        console.error("[escrow_actions] admin check failed", {
          message: pErr.message,
          code: pErr.code,
        });
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to verify admin." });
      }
      if (!prof?.is_admin) {
        return jsonResponse(403, { ok: false, error: "Forbidden", detail: "Admin only." });
      }

      const { data: releases, error: listErr } = await supabaseAdmin
        .from("escrow_orders")
        .select(
          "id,status,delivery_status,dispute_status,subtotal_kobo,escrow_fee_kobo,total_kobo,settlement_status,released_at,buyer_id,seller_id,product_snapshot,created_at"
        )
        .in("status", ["paid", "funded"])
        .eq("delivery_status", "confirmed")
        .eq("dispute_status", "none")
        .is("released_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (listErr) {
        console.error("[escrow_actions] releases list failed", {
          message: listErr.message,
          code: listErr.code,
        });
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to load releases." });
      }

      const rows = (releases ?? []) as any[];
      const ids = rows.flatMap((r) => [String(r.buyer_id ?? ""), String(r.seller_id ?? "")]);
      const { nameById, emailById } = await buildDisplayMap(ids);

      const mapped = rows.map((r) => ({
        ...r,
        buyer_display: {
          id: String(r.buyer_id ?? ""),
          name: nameById[String(r.buyer_id ?? "")] || "",
          email: emailById[String(r.buyer_id ?? "")] || "",
        },
        seller_display: {
          id: String(r.seller_id ?? ""),
          name: nameById[String(r.seller_id ?? "")] || "",
          email: emailById[String(r.seller_id ?? "")] || "",
        },
      }));

      console.log("[escrow_actions] admin_list_pending_releases ok", { userId });
      return jsonResponse(200, { ok: true, releases: mapped });
    }

    if (!escrowOrderId) {
      return jsonResponse(400, { ok: false, error: "Invalid request.", detail: "Missing escrow_order_id." });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("escrow_orders")
      .select("id,buyer_id,seller_id,status,delivery_status,dispute_status")
      .eq("id", escrowOrderId)
      .maybeSingle();
    if (orderErr) {
      console.error("[escrow_actions] load order failed", {
        message: orderErr.message,
        code: orderErr.code,
      });
      return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to load escrow order." });
    }
    if (!order?.id) {
      return jsonResponse(404, { ok: false, error: "Not found.", detail: "Escrow order not found." });
    }

    const buyerId = String(order.buyer_id ?? "");
    const sellerId = String(order.seller_id ?? "");

    if (action === "buyer_confirm_delivery") {
      const { data: profRow, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("full_name, phone, city")
        .eq("id", userId)
        .maybeSingle();
      if (profErr) {
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to load profile." });
      }
      const fullName = String((profRow as any)?.full_name ?? "").trim();
      const phone = String((profRow as any)?.phone ?? "").trim();
      const city = String((profRow as any)?.city ?? "").trim();
      const nameOk = !!fullName && !/^(user|buyer|seller)\s+[0-9a-f]{4,}$/i.test(fullName);
      if (!nameOk || !phone || !city) {
        return jsonResponse(403, {
          ok: false,
          error: "Profile incomplete",
          detail: "Please update your profile details to continue.",
        });
      }

      if (userId !== buyerId) {
        return jsonResponse(403, { ok: false, error: "Forbidden", detail: "This order is not yours." });
      }
      if (!["paid", "funded"].includes(String(order.status))) {
        return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Only paid orders can be confirmed." });
      }
      if (String(order.dispute_status) !== "none") {
        return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Dispute already open." });
      }
      if (String(order.delivery_status) === "confirmed") {
        return jsonResponse(400, { ok: false, error: "Already confirmed", detail: "Delivery already confirmed." });
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from("escrow_orders")
        .update({ delivery_status: "confirmed", confirmed_at: now })
        .eq("id", escrowOrderId);
      if (updateErr) {
        console.error("[escrow_actions] confirm failed", {
          message: updateErr.message,
          code: updateErr.code,
        });
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to confirm delivery." });
      }

      await supabaseAdmin.from("escrow_events").insert({
        escrow_order_id: escrowOrderId,
        type: "delivery_confirmed",
        payload: { confirmed_at: now },
      });

      console.log("[escrow_actions] buyer_confirm_delivery ok", { userId, escrowOrderId });
      return jsonResponse(200, {
        ok: true,
        escrow_order_id: escrowOrderId,
        delivery_status: "confirmed",
        dispute_status: String(order.dispute_status ?? "none"),
      });
    }

    if (action === "buyer_open_dispute") {
      const { data: profRow, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("full_name, phone, city")
        .eq("id", userId)
        .maybeSingle();
      if (profErr) {
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to load profile." });
      }
      const fullName = String((profRow as any)?.full_name ?? "").trim();
      const phone = String((profRow as any)?.phone ?? "").trim();
      const city = String((profRow as any)?.city ?? "").trim();
      const nameOk = !!fullName && !/^(user|buyer|seller)\s+[0-9a-f]{4,}$/i.test(fullName);
      if (!nameOk || !phone || !city) {
        return jsonResponse(403, {
          ok: false,
          error: "Profile incomplete",
          detail: "Please update your profile details to continue.",
        });
      }

      if (userId !== buyerId) {
        return jsonResponse(403, { ok: false, error: "Forbidden", detail: "This order is not yours." });
      }
      if (!["paid", "funded"].includes(String(order.status))) {
        return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Only paid orders can be disputed." });
      }
      if (String(order.delivery_status) === "confirmed") {
        return jsonResponse(400, {
          ok: false,
          error: "Invalid state",
          detail: "You can only open a dispute on a paid order that is not yet confirmed.",
        });
      }
      if (String(order.dispute_status) !== "none") {
        return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Dispute already open." });
      }

      const reason = String(payload?.reason ?? payload?.dispute_reason ?? "").trim();
      if (!reason || reason.length < 10) {
        return jsonResponse(400, {
          ok: false,
          error: "Bad Request",
          detail: "Dispute reason must be at least 10 characters.",
        });
      }

      const now = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from("escrow_orders")
        .update({
          dispute_status: "open",
          dispute_reason: reason,
          dispute_opened_at: now,
        })
        .eq("id", escrowOrderId);
      if (updateErr) {
        console.error("[escrow_actions] dispute failed", {
          message: updateErr.message,
          code: updateErr.code,
        });
        return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to open dispute." });
      }

      await supabaseAdmin.from("escrow_events").insert({
        escrow_order_id: escrowOrderId,
        type: "dispute_opened",
        payload: { reason, opened_at: now },
      });

      console.log("[escrow_actions] buyer_open_dispute ok", { userId, escrowOrderId });
      return jsonResponse(200, {
        ok: true,
        escrow_order_id: escrowOrderId,
        delivery_status: String(order.delivery_status ?? "pending"),
        dispute_status: "open",
      });
    }

    if (action === "admin_resolve_dispute") {
      try {
        const { data: prof, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("is_admin")
          .eq("id", userId)
          .maybeSingle();
        if (pErr) {
          return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to verify admin." });
        }
        if (!prof?.is_admin) {
          return jsonResponse(403, { ok: false, error: "Forbidden", detail: "Admin access required." });
        }

        const { data: orderRow, error: orderLoadErr } = await supabaseAdmin
          .from("escrow_orders")
          .select("id,dispute_status")
          .eq("id", escrowOrderId)
          .maybeSingle();
        if (orderLoadErr) {
          return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to load escrow order." });
        }
        if (!orderRow?.id) {
          return jsonResponse(404, { ok: false, error: "Not found.", detail: "Escrow order not found." });
        }
        if (String(orderRow.dispute_status) !== "open") {
          return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Dispute is not open." });
        }

        const resolution = String(payload?.resolution ?? "").trim();
        const note = String(payload?.note ?? "").trim();
        if (!["release_to_seller", "refund_buyer"].includes(resolution)) {
          return jsonResponse(400, { ok: false, error: "Invalid resolution." });
        }
        if (note && note.length < 5) {
          return jsonResponse(400, {
            ok: false,
            error: "Bad Request",
            detail: "Admin note must be at least 5 characters.",
          });
        }

        const now = new Date().toISOString();
        const updates: Record<string, unknown> = {
          dispute_status: "resolved",
          dispute_resolved_at: now,
          resolution,
          settlement_admin_id: userId,
          dispute_resolution_note: note || null,
        };
        if (resolution === "release_to_seller") {
          updates.released_at = now;
          updates.settlement_status = "released";
        }
        if (resolution === "refund_buyer") {
          updates.refunded_at = now;
          updates.settlement_status = "refunded";
        }
        if (note) {
          updates.settlement_note = note;
        }

        const { data: updated, error: upErr } = await supabaseAdmin
          .from("escrow_orders")
          .update(updates)
          .eq("id", escrowOrderId)
          .select("id,dispute_status,resolution,released_at,refunded_at,dispute_resolved_at")
          .maybeSingle();
        if (upErr) {
          return jsonResponse(500, { ok: false, error: "DB error", detail: upErr.message });
        }

        const { error: eventErr } = await supabaseAdmin.from("escrow_events").insert({
          escrow_order_id: escrowOrderId,
          type: "dispute_resolved",
          payload: { resolution, resolved_at: now },
        });
        if (eventErr) {
          console.error("[escrow_actions] event insert failed", {
            message: eventErr.message,
            code: eventErr.code,
          });
        }

        console.log("[escrow_actions] admin_resolve_dispute ok", { userId, escrowOrderId, resolution });
        return jsonResponse(200, {
          ok: true,
          escrow_order_id: escrowOrderId,
          dispute_status: "resolved",
          resolution,
          released_at: (updated as any)?.released_at ?? null,
          refunded_at: (updated as any)?.refunded_at ?? null,
        });
      } catch (err: any) {
        console.error("admin_resolve_dispute failed", err);
        return jsonResponse(500, {
          ok: false,
          error: "Internal error",
          detail: String(err?.message ?? err),
        });
      }
    }

    if (action === "admin_release_to_seller") {
      try {
        const { data: prof, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("is_admin")
          .eq("id", userId)
          .maybeSingle();
        if (pErr) {
          return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to verify admin." });
        }
        if (!prof?.is_admin) {
          return jsonResponse(403, { ok: false, error: "Forbidden", detail: "Admin access required." });
        }

        const { data: orderRow, error: orderLoadErr } = await supabaseAdmin
          .from("escrow_orders")
          .select("id,status,delivery_status,dispute_status,released_at,settlement_status")
          .eq("id", escrowOrderId)
          .maybeSingle();
        if (orderLoadErr) {
          return jsonResponse(500, { ok: false, error: "Server error.", detail: "Failed to load escrow order." });
        }
        if (!orderRow?.id) {
          return jsonResponse(404, { ok: false, error: "Not found.", detail: "Escrow order not found." });
        }
        if (!["paid", "funded"].includes(String(orderRow.status))) {
          return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Only paid orders can be released." });
        }
        if (String(orderRow.delivery_status) !== "confirmed") {
          return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Delivery not confirmed." });
        }
        if (String(orderRow.dispute_status) !== "none") {
          return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Dispute is open." });
        }
        if (orderRow.released_at) {
          return jsonResponse(400, { ok: false, error: "Invalid state", detail: "Already released." });
        }

        const note = String(payload?.note ?? "").trim();
        if (note && note.length < 5) {
          return jsonResponse(400, {
            ok: false,
            error: "Bad Request",
            detail: "Admin note must be at least 5 characters.",
          });
        }

        const now = new Date().toISOString();
        const updates: Record<string, unknown> = {
          settlement_status: "released",
          released_at: now,
          settlement_admin_id: userId,
        };
        if (note) {
          updates.settlement_note = note;
        }

        const { data: updated, error: upErr } = await supabaseAdmin
          .from("escrow_orders")
          .update(updates)
          .eq("id", escrowOrderId)
          .select("id,settlement_status,released_at,settlement_admin_id")
          .maybeSingle();
        if (upErr) {
          return jsonResponse(500, { ok: false, error: "DB error", detail: upErr.message });
        }

        const { error: eventErr } = await supabaseAdmin.from("escrow_events").insert({
          escrow_order_id: escrowOrderId,
          type: "funds_released_to_seller",
          payload: { released_at: now },
        });
        if (eventErr) {
          console.error("[escrow_actions] release event insert failed", {
            message: eventErr.message,
            code: eventErr.code,
          });
        }

        console.log("[escrow_actions] admin_release_to_seller ok", { userId, escrowOrderId });
        return jsonResponse(200, {
          ok: true,
          escrow_order_id: escrowOrderId,
          settlement_status: "released",
          released_at: (updated as any)?.released_at ?? null,
        });
      } catch (err: any) {
        console.error("admin_release_to_seller failed", err);
        return jsonResponse(500, {
          ok: false,
          error: "Internal error",
          detail: String(err?.message ?? err),
        });
      }
    }

    return jsonResponse(400, { ok: false, error: "Invalid request.", detail: "Unsupported action." });
  } catch (err: any) {
    console.error("escrow_actions failed", err);
    return jsonResponse(500, {
      ok: false,
      error: "Internal error",
      detail: String(err?.message ?? err),
    });
  }
});
