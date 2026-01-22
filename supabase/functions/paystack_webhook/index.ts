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

async function hmacSha512Hex(message: string, secret: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, msgData);
  const bytes = new Uint8Array(signature);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  const hasServiceRoleKey = Boolean(serviceRoleKey);
  const hasAnonKey = Boolean(Deno.env.get("SUPABASE_ANON_KEY"));

  console.log("[paystack_webhook] env", {
    hasServiceRoleKey,
    hasAnonKey,
  });

  if (!supabaseUrl) {
    return jsonResponse(500, { error: "SUPABASE_URL not set." });
  }
  if (!serviceRoleKey) {
    return jsonResponse(500, { error: "SUPABASE_SERVICE_ROLE_KEY not set." });
  }
  if (!paystackSecret) {
    return jsonResponse(500, { error: "PAYSTACK_SECRET_KEY not set." });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const hasSignature = Boolean(signature);
  const digest = await hmacSha512Hex(raw, paystackSecret);

  if (!signature || signature !== digest) {
    return jsonResponse(401, { error: "Invalid signature." });
  }

  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const eventName = String(payload?.event ?? "").trim();
  const dataStatus = String(payload?.data?.status ?? "").toLowerCase();
  const reference = String(payload?.data?.reference ?? payload?.data?.trxref ?? "").trim();
  console.log("[paystack_webhook] event", {
    event: eventName || "unknown",
    status: dataStatus || "unknown",
    hasSignature,
    reference: reference || "none",
  });

  const isSuccessEvent = eventName === "charge.success" || dataStatus === "success";
  if (isSuccessEvent) {
    if (reference) {
      const { data: order } = await supabaseAdmin
        .from("escrow_orders")
        .select("id,status,total_kobo,amount_kobo")
        .or(`id.eq.${reference},paystack_reference.eq.${reference}`)
        .maybeSingle();

      if (order?.id) {
        const paidAmount = Number(payload?.data?.amount ?? 0);
        const expectedTotalRaw = Number(order.total_kobo ?? 0);
        const expectedTotal =
          expectedTotalRaw > 0 ? expectedTotalRaw : Number(order.amount_kobo ?? 0);
        if (
          expectedTotalRaw > 0 &&
          (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount !== expectedTotal)
        ) {
          const { error: mismatchErr } = await supabaseAdmin.from("escrow_events").insert({
            escrow_order_id: order.id,
            type: "paystack.amount_mismatch",
            payload: {
              reference,
              paid_amount: paidAmount,
              expected_total: expectedTotal,
            },
          });
          if (mismatchErr && mismatchErr.code !== "23505") {
            console.error("[paystack_webhook] amount mismatch event failed", {
              code: mismatchErr.code,
              message: mismatchErr.message,
            });
          }
          console.error("[paystack_webhook] amount mismatch", {
            escrow_order_id: order.id,
            reference,
            paid_amount: paidAmount,
            expected_total: expectedTotal,
          });
          return jsonResponse(200, { ok: true });
        }

        const currentStatus = String(order.status ?? "").toLowerCase();
        if (!["paid", "released", "refunded"].includes(currentStatus)) {
          const paidAt = new Date().toISOString();
          const { data: updated, error: updateErr } = await supabaseAdmin
            .from("escrow_orders")
            .update({
              status: "paid",
              paid_at: paidAt,
              updated_at: paidAt,
            })
            .eq("id", order.id)
            .select("id,status,paid_at")
            .single();

          if (updateErr) {
            console.error("[paystack_webhook] update failed", {
              code: updateErr.code,
              message: updateErr.message,
            });

            const msg = String(updateErr.message ?? "").toLowerCase();
            const canFallback = msg.includes("constraint") || msg.includes("invalid") || msg.includes("enum");
            if (canFallback) {
              const { error: fallbackErr } = await supabaseAdmin
                .from("escrow_orders")
                .update({
                  paid_at: paidAt,
                  updated_at: paidAt,
                })
                .eq("id", order.id)
                .select("id,status,paid_at")
                .single();

              if (fallbackErr) {
                console.error("[paystack_webhook] fallback update failed", {
                  code: fallbackErr.code,
                  message: fallbackErr.message,
                });
                return jsonResponse(500, {
                  error: "Failed to update escrow order.",
                  detail: fallbackErr.message ?? "unknown",
                });
              }
            } else {
              return jsonResponse(500, {
                error: "Failed to update escrow order.",
                detail: updateErr.message ?? "unknown",
              });
            }
          } else {
            console.log("[paystack_webhook] update ok", {
              id: updated?.id ?? "unknown",
              status: updated?.status ?? "unknown",
              paid: Boolean(updated?.paid_at),
            });
          }
        }

        const { error: eventErr } = await supabaseAdmin.from("escrow_events").insert({
          escrow_order_id: order.id,
          type: "paystack.webhook.success",
          payload,
        });
        if (eventErr) {
          if (eventErr.code === "23505") {
            console.log("[paystack_webhook] duplicate event", {
              escrow_order_id: order.id,
              type: "paystack.webhook.success",
            });
            return jsonResponse(200, { ok: true });
          }
          console.error("[paystack_webhook] event insert failed", {
            code: eventErr.code,
            message: eventErr.message,
          });
        }
        console.log("[paystack_webhook] final status", {
          escrow_order_id: order.id,
          status: "paid",
        });
        console.log("[paystack_webhook] escrow match", { reference, matched: true });
      } else {
        console.warn("[paystack_webhook] Unmatched reference", reference);
        return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
      }
    }
  }

  return jsonResponse(200, { ok: true });
});
