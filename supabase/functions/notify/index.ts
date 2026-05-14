import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type NotifyEvent =
  | "escrow_payment_confirmed"
  | "escrow_shipped"
  | "escrow_delivered_confirmed"
  | "escrow_released_to_seller"
  | "escrow_refunded_to_buyer"
  | "escrow_dispute_opened"
  | "escrow_dispute_resolved"
  | "seller_approved";

type NotifyPayload = {
  event: NotifyEvent;
  to_email: string;
  to_name?: string;
  data?: Record<string, string>;
};

const TEMPLATES: Record<NotifyEvent, { subject: string; body: (d: Record<string, string>) => string }> = {
  escrow_payment_confirmed: {
    subject: "Payment confirmed — your escrow is active",
    body: (d) => `Hi ${d.name ?? "there"},\n\nYour payment of ₦${d.amount ?? ""} for "${d.product ?? "your order"}" has been confirmed.\n\nYour funds are held securely in escrow. The seller will be notified to ship your item.\n\nOrder ID: ${d.order_id ?? ""}\n\nThanks,\nShowMePrice.ng`,
  },
  escrow_shipped: {
    subject: "Your order has been shipped",
    body: (d) => `Hi ${d.name ?? "there"},\n\nThe seller has marked your order for "${d.product ?? "your order"}" as shipped.\n\nTracking reference: ${d.tracking ?? "not provided"}\n\nOnce you receive and confirm delivery, funds will be released to the seller.\n\nOrder ID: ${d.order_id ?? ""}\n\nThanks,\nShowMePrice.ng`,
  },
  escrow_delivered_confirmed: {
    subject: "Delivery confirmed — funds pending release",
    body: (d) => `Hi ${d.name ?? "there"},\n\nYou have confirmed delivery of "${d.product ?? "your order"}". Our team will review and release the funds to the seller shortly.\n\nOrder ID: ${d.order_id ?? ""}\n\nThanks,\nShowMePrice.ng`,
  },
  escrow_released_to_seller: {
    subject: "Funds released to your account",
    body: (d) => `Hi ${d.name ?? "there"},\n\n₦${d.amount ?? ""} has been transferred to your bank account for the sale of "${d.product ?? "your item"}".\n\nPlease allow 1–3 business days for the transfer to reflect.\n\nOrder ID: ${d.order_id ?? ""}\n\nThanks,\nShowMePrice.ng`,
  },
  escrow_refunded_to_buyer: {
    subject: "Refund processed to your account",
    body: (d) => `Hi ${d.name ?? "there"},\n\n₦${d.amount ?? ""} has been refunded to your original payment method for "${d.product ?? "your order"}".\n\nPlease allow 3–5 business days for the refund to reflect.\n\nOrder ID: ${d.order_id ?? ""}\n\nThanks,\nShowMePrice.ng`,
  },
  escrow_dispute_opened: {
    subject: "Dispute opened on your order",
    body: (d) => `Hi ${d.name ?? "there"},\n\nA dispute has been opened on order "${d.order_id ?? ""}" for "${d.product ?? "your order"}".\n\nReason: ${d.reason ?? "not specified"}\n\nOur team will review and resolve this within 3–5 business days.\n\nThanks,\nShowMePrice.ng`,
  },
  escrow_dispute_resolved: {
    subject: "Your dispute has been resolved",
    body: (d) => `Hi ${d.name ?? "there"},\n\nThe dispute on order "${d.order_id ?? ""}" has been resolved.\n\nDecision: ${d.resolution ?? "see dashboard"}\n${d.note ? `\nAdmin note: ${d.note}` : ""}\n\nThanks,\nShowMePrice.ng`,
  },
  seller_approved: {
    subject: "Your seller account has been approved!",
    body: (d) => `Hi ${d.name ?? "there"},\n\nCongratulations — your seller account on ShowMePrice.ng has been approved!\n\nYou can now list products and accept escrow orders from buyers.\n\nLog in to get started: https://showmeprice.ng\n\nThanks,\nShowMePrice.ng`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  // Internal-only: caller must pass the internal secret header
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";
  const headerSecret = req.headers.get("x-internal-secret") ?? "";
  if (!internalSecret || headerSecret !== internalSecret) {
    return jsonResponse(401, { ok: false, error: "Unauthorized" });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resendApiKey) {
    console.warn("[notify] RESEND_API_KEY not set — skipping email");
    return jsonResponse(200, { ok: true, skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  let body: NotifyPayload;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON" });
  }

  const { event, to_email, to_name, data = {} } = body;
  if (!event || !to_email) {
    return jsonResponse(400, { ok: false, error: "Missing event or to_email" });
  }

  const template = TEMPLATES[event];
  if (!template) {
    return jsonResponse(400, { ok: false, error: `Unknown event: ${event}` });
  }

  const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@showmeprice.ng";
  const templateData = { name: to_name ?? "", ...data };
  const textBody = template.body(templateData);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ShowMePrice.ng <${fromEmail}>`,
        to: [to_email],
        subject: template.subject,
        text: textBody,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[notify] Resend error", { status: res.status, body: json });
      return jsonResponse(500, { ok: false, error: "Failed to send email", detail: json });
    }

    console.log("[notify] sent", { event, to_email });
    return jsonResponse(200, { ok: true, id: json?.id ?? null });
  } catch (err: any) {
    console.error("[notify] fetch error", err);
    return jsonResponse(500, { ok: false, error: err.message });
  }
});
