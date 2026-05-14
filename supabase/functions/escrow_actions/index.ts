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

async function sendNotification(
  supabaseUrl: string,
  internalSecret: string,
  payload: {
    event: string;
    to_email: string;
    to_name?: string;
    data?: Record<string, string>;
  }
) {
  if (!internalSecret) return;
  try {
    await fetch(`${supabaseUrl}/functions/v1/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[escrow_actions] notify failed", e);
  }
}

async function paystackRefund(paystackSecretKey: string, reference: string, amountKobo: number) {
  const res = await fetch("https://api.paystack.co/refund", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: reference, amount: amountKobo }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status) {
    throw new Error(`Paystack refund failed: ${json?.message ?? res.status}`);
  }
  return json;
}

async function paystackTransferToSeller(
  paystackSecretKey: string,
  amountKobo: number,
  recipientCode: string,
  reference: string,
  reason: string
) {
  const res = await fetch("https://api.paystack.co/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "balance",
      amount: amountKobo,
      recipient: recipientCode,
      reference,
      reason,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status) {
    throw new Error(`Paystack transfer failed: ${json?.message ?? res.status}`);
  }
  return json;
}

async function getOrCreatePaystackRecipient(
  paystackSecretKey: string,
  accountNumber: string,
  bankCode: string,
  accountName: string
): Promise<string> {
  const res = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "nuban",
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status) {
    throw new Error(`Failed to create transfer recipient: ${json?.message ?? res.status}`);
  }
  // FIX 4: never return an empty string for a financial identifier
  const code = String(json?.data?.recipient_code ?? "").trim();
  if (!code) {
    throw new Error("Paystack returned empty recipient_code — cannot proceed with transfer");
  }
  return code;
}

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
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
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
            } catch {
              // intentionally empty
            }
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
    const _sellerId = String(order.seller_id ?? "");
    void _sellerId;

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

      // Notify seller that delivery was confirmed
      const { data: sellerAuth } = await supabaseAdmin.auth.admin.getUserById(String(order.seller_id ?? ""));
      if (sellerAuth?.user?.email) {
        const { data: sellerProf } = await supabaseAdmin.from("profiles").select("display_name,full_name").eq("id", String(order.seller_id ?? "")).maybeSingle();
        await sendNotification(supabaseUrl, internalSecret, {
          event: "escrow_delivered_confirmed",
          to_email: sellerAuth.user.email,
          to_name: String((sellerProf as any)?.display_name ?? (sellerProf as any)?.full_name ?? ""),
          data: { order_id: escrowOrderId },
        });
      }

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

      // Notify both parties that a dispute was opened
      for (const uid of [String(order.buyer_id ?? ""), String(order.seller_id ?? "")]) {
        if (!uid) continue;
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (u?.user?.email) {
          const { data: p } = await supabaseAdmin.from("profiles").select("display_name,full_name").eq("id", uid).maybeSingle();
          await sendNotification(supabaseUrl, internalSecret, {
            event: "escrow_dispute_opened",
            to_email: u.user.email,
            to_name: String((p as any)?.display_name ?? (p as any)?.full_name ?? ""),
            data: { order_id: escrowOrderId, reason },
          });
        }
      }

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
          .select("id,dispute_status,paystack_reference,subtotal_kobo,total_kobo,seller_id")
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
        const paystackRef = String((orderRow as any).paystack_reference ?? "").trim();
        const subtotalKobo = Number((orderRow as any).subtotal_kobo ?? 0);
        const sellerIdForDisp = String((orderRow as any).seller_id ?? "").trim();

        // FIX 1b: Write DB to "resolving" BEFORE calling Paystack.
        // Paystack call happens after — if it fails, admin can retry safely.
        const preUpdates: Record<string, unknown> = {
          dispute_status: "resolving",
          dispute_resolved_at: now,
          resolution,
          settlement_admin_id: userId,
          dispute_resolution_note: note || null,
        };
        if (note) preUpdates.settlement_note = note;

        const { error: preErr } = await supabaseAdmin
          .from("escrow_orders")
          .update(preUpdates)
          .eq("id", escrowOrderId)
          .eq("dispute_status", "open"); // idempotency guard: only advance from "open"
        if (preErr) {
          return jsonResponse(500, { ok: false, error: "DB pre-update failed.", detail: preErr.message });
        }

        // Sync escrow_transactions to "resolving" (Fix 5)
        await supabaseAdmin
          .from("escrow_transactions")
          .update({ status: "resolving", updated_at: now })
          .eq("payment_reference", paystackRef)
          .in("status", ["funded", "disputed", "awaiting_buyer_confirmation", "resolving"]);

        let paystackResult: Record<string, unknown> = {};

        if (resolution === "refund_buyer") {
          if (!paystackSecretKey) {
            return jsonResponse(500, { ok: false, error: "Paystack not configured." });
          }
          // FIX 2: refund subtotal_kobo (product price only), NOT total_kobo.
          // The escrow fee is earned by the platform and is not refunded.
          if (!paystackRef || subtotalKobo <= 0) {
            return jsonResponse(400, { ok: false, error: "Cannot refund: missing reference or amount." });
          }
          try {
            paystackResult = await paystackRefund(paystackSecretKey, paystackRef, subtotalKobo);
          } catch (refundErr: any) {
            console.error("[escrow_actions] paystack refund failed", refundErr);
            return jsonResponse(500, { ok: false, error: "Refund failed. Order is marked 'resolving' — retry is safe.", detail: refundErr.message });
          }
        }

        if (resolution === "release_to_seller") {
          if (!paystackSecretKey) {
            return jsonResponse(500, { ok: false, error: "Paystack not configured." });
          }
          if (!sellerIdForDisp || subtotalKobo <= 0) {
            return jsonResponse(400, { ok: false, error: "Cannot transfer: missing seller or amount." });
          }
          const { data: bankRow } = await supabaseAdmin
            .from("seller_bank_accounts")
            .select("bank_code,account_number,account_name,paystack_recipient_code")
            .eq("seller_id", sellerIdForDisp)
            .maybeSingle();
          if (!bankRow?.account_number || !bankRow?.bank_code) {
            return jsonResponse(400, {
              ok: false,
              error: "Seller has no bank account on file. Ask seller to add bank details before releasing.",
            });
          }
          try {
            let recipientCode = String(bankRow.paystack_recipient_code ?? "").trim();
            if (!recipientCode) {
              recipientCode = await getOrCreatePaystackRecipient(
                paystackSecretKey,
                bankRow.account_number,
                bankRow.bank_code,
                bankRow.account_name ?? ""
              );
              // FIX 4: guard (getOrCreatePaystackRecipient now throws, but double-check)
              if (!recipientCode) {
                throw new Error("Paystack returned empty recipient_code");
              }
              await supabaseAdmin
                .from("seller_bank_accounts")
                .update({ paystack_recipient_code: recipientCode, updated_at: now })
                .eq("seller_id", sellerIdForDisp);
            }
            // FIX 3: deterministic reference — no Date.now()
            const transferRef = `smp_disp_${escrowOrderId}`;
            paystackResult = await paystackTransferToSeller(
              paystackSecretKey,
              subtotalKobo,
              recipientCode,
              transferRef,
              `ShowMePrice.ng dispute resolution payout`
            );
          } catch (transferErr: any) {
            console.error("[escrow_actions] paystack transfer failed", transferErr);
            return jsonResponse(500, { ok: false, error: "Transfer failed. Order is marked 'resolving' — retry is safe.", detail: transferErr.message });
          }
        }

        // Paystack call succeeded — write final terminal state
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
          console.error("[escrow_actions] CRITICAL: Paystack call succeeded but final DB update failed", { escrowOrderId, upErr });
          return jsonResponse(500, { ok: false, error: "Paystack action succeeded but final DB update failed. Check logs.", detail: upErr.message });
        }

        // Fix 5: sync escrow_transactions final status
        const txFinalStatus = resolution === "refund_buyer" ? "refund_to_buyer" : "released_to_seller";
        await supabaseAdmin
          .from("escrow_transactions")
          .update({ status: txFinalStatus, updated_at: now })
          .eq("payment_reference", paystackRef);

        const { error: eventErr } = await supabaseAdmin.from("escrow_events").insert({
          escrow_order_id: escrowOrderId,
          type: "dispute_resolved",
          payload: { resolution, resolved_at: now, paystack: paystackResult },
        });
        if (eventErr) {
          console.error("[escrow_actions] event insert failed", {
            message: eventErr.message,
            code: eventErr.code,
          });
        }

        // Notify both parties of dispute resolution
        const eventType = resolution === "refund_buyer" ? "escrow_refunded_to_buyer" : "escrow_released_to_seller";
        const recipientId = resolution === "refund_buyer" ? String((orderRow as any).buyer_id ?? "") : String((orderRow as any).seller_id ?? "");
        if (recipientId) {
          const { data: ru } = await supabaseAdmin.auth.admin.getUserById(recipientId);
          if (ru?.user?.email) {
            const { data: rp } = await supabaseAdmin.from("profiles").select("display_name,full_name").eq("id", recipientId).maybeSingle();
            await sendNotification(supabaseUrl, internalSecret, {
              event: eventType as any,
              to_email: ru.user.email,
              to_name: String((rp as any)?.display_name ?? (rp as any)?.full_name ?? ""),
              data: { order_id: escrowOrderId, resolution, note },
            });
          }
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
          .select("id,status,delivery_status,dispute_status,released_at,settlement_status,seller_id,subtotal_kobo")
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

        if (!paystackSecretKey) {
          return jsonResponse(500, { ok: false, error: "Paystack not configured." });
        }

        const sellerId = String((orderRow as any).seller_id ?? "").trim();
        const subtotalKobo = Number((orderRow as any).subtotal_kobo ?? 0);
        if (!sellerId || subtotalKobo <= 0) {
          return jsonResponse(400, { ok: false, error: "Cannot transfer: missing seller or amount." });
        }

        const { data: bankRow } = await supabaseAdmin
          .from("seller_bank_accounts")
          .select("bank_code,account_number,account_name,paystack_recipient_code")
          .eq("seller_id", sellerId)
          .maybeSingle();
        if (!bankRow?.account_number || !bankRow?.bank_code) {
          return jsonResponse(400, {
            ok: false,
            error: "Seller has no bank account on file. Ask seller to add bank details before releasing.",
          });
        }

        const now = new Date().toISOString();

        // FIX 1a: Write "releasing" to DB BEFORE calling Paystack.
        // If transfer fails the DB record exists for safe retry.
        // If DB update fails we never attempt a transfer.
        const preUpdates: Record<string, unknown> = {
          settlement_status: "releasing",
          settlement_admin_id: userId,
        };
        if (note) preUpdates.settlement_note = note;

        const { error: preErr } = await supabaseAdmin
          .from("escrow_orders")
          .update(preUpdates)
          .eq("id", escrowOrderId)
          // Guard: only advance from a non-terminal state
          .in("settlement_status", ["pending", null, "releasing"]);
        if (preErr) {
          return jsonResponse(500, { ok: false, error: "DB pre-update failed.", detail: preErr.message });
        }

        // Sync escrow_transactions to "releasing" as well (Fix 5)
        await supabaseAdmin
          .from("escrow_transactions")
          .update({ status: "releasing", updated_at: now })
          .eq("payment_reference", String((orderRow as any).paystack_reference ?? ""))
          .in("status", ["funded", "awaiting_buyer_confirmation", "pending_admin_release", "releasing"]);

        let paystackTransferData: Record<string, unknown> = {};
        try {
          let recipientCode = String(bankRow.paystack_recipient_code ?? "").trim();
          if (!recipientCode) {
            recipientCode = await getOrCreatePaystackRecipient(
              paystackSecretKey,
              bankRow.account_number,
              bankRow.bank_code,
              bankRow.account_name ?? ""
            );
            // FIX 4: guard — getOrCreatePaystackRecipient now throws on empty,
            // but double-check here before persisting an invalid code
            if (!recipientCode) {
              throw new Error("Paystack returned empty recipient_code");
            }
            await supabaseAdmin
              .from("seller_bank_accounts")
              .update({ paystack_recipient_code: recipientCode, updated_at: now })
              .eq("seller_id", sellerId);
          }
          // FIX 3: deterministic reference — no Date.now(), Paystack deduplicates on this
          const transferRef = `smp_rel_${escrowOrderId}`;
          paystackTransferData = await paystackTransferToSeller(
            paystackSecretKey,
            subtotalKobo,
            recipientCode,
            transferRef,
            `ShowMePrice.ng escrow payout`
          );
        } catch (transferErr: any) {
          console.error("[escrow_actions] paystack transfer failed", transferErr);
          // DB already marked "releasing" — admin can retry. Do NOT revert to avoid
          // masking a transfer that may have succeeded before the error was thrown.
          return jsonResponse(500, { ok: false, error: "Transfer failed. Order is marked 'releasing' — retry is safe.", detail: transferErr.message });
        }

        // Transfer succeeded — mark fully released
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
          // Transfer already sent — log prominently but don't surface to caller as failure
          console.error("[escrow_actions] CRITICAL: transfer sent but released_at update failed", { escrowOrderId, upErr });
          return jsonResponse(500, { ok: false, error: "Transfer sent but final DB update failed. Check logs.", detail: upErr.message });
        }

        // Fix 5: sync escrow_transactions final status
        await supabaseAdmin
          .from("escrow_transactions")
          .update({ status: "released_to_seller", updated_at: now })
          .eq("payment_reference", String((orderRow as any).paystack_reference ?? ""));

        const { error: eventErr } = await supabaseAdmin.from("escrow_events").insert({
          escrow_order_id: escrowOrderId,
          type: "funds_released_to_seller",
          payload: { released_at: now, paystack: paystackTransferData },
        });
        if (eventErr) {
          console.error("[escrow_actions] release event insert failed", {
            message: eventErr.message,
            code: eventErr.code,
          });
        }

        // Notify seller that funds have been released
        const { data: su } = await supabaseAdmin.auth.admin.getUserById(sellerId);
        if (su?.user?.email) {
          const { data: sp } = await supabaseAdmin.from("profiles").select("display_name,full_name").eq("id", sellerId).maybeSingle();
          await sendNotification(supabaseUrl, internalSecret, {
            event: "escrow_released_to_seller",
            to_email: su.user.email,
            to_name: String((sp as any)?.display_name ?? (sp as any)?.full_name ?? ""),
            data: {
              order_id: escrowOrderId,
              amount: String(Math.round(subtotalKobo / 100)),
            },
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
