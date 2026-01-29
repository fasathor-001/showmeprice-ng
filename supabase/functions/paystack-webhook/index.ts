import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha512Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

serve(async (req) => {
  const hasSig = !!req.headers.get("x-paystack-signature");
  try {
    const url = new URL(req.url);
    console.log("paystack-webhook:request", {
      method: req.method,
      path: url.pathname,
      hasSig,
    });
  } catch {
    console.log("paystack-webhook:request", { method: req.method, path: "", hasSig });
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceKey) {
    return new Response("Missing SERVICE_ROLE_KEY secret", { status: 500 });
  }
  if (!secret || !supabaseUrl) return new Response("Missing env", { status: 500 });

  // MUST verify signature against RAW body
  const rawBody = await req.text();
  const receivedSig = req.headers.get("x-paystack-signature") ?? "";
  const computedSig = await hmacSha512Hex(secret, rawBody);

  if (computedSig !== receivedSig) {
    console.warn("Invalid signature", { hasSig, bodyLen: rawBody.length });
    return new Response("Invalid signature", { status: 401 });
  }

  let evt: any;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const provider = "paystack";
  const type = String(evt?.event ?? "");
  const event_id = String(evt?.id ?? "");
  const reference = String(evt?.data?.reference ?? "");
  const metadata = evt?.data?.metadata ?? {};
  const isOfferEvent =
    String(metadata?.kind ?? "").toLowerCase() === "offer" || reference.startsWith("offer_");

  console.log("paystack-webhook:event", { type, reference: reference || "" });

  if (!type || !reference) return new Response("OK", { status: 200 });

  const db = createClient(supabaseUrl, serviceKey);

  const { data: paymentIntent } = await db
    .from("payment_intents")
    .select("id, intent, target_id, amount_kobo, status")
    .eq("reference", reference)
    .maybeSingle();

  if (paymentIntent?.id) {
    try {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) return new Response("OK", { status: 200 });
      const status = String(verifyJson?.data?.status ?? "");
      const paidAmount = Number(verifyJson?.data?.amount ?? 0);
      if (status !== "success") return new Response("OK", { status: 200 });
      if (paymentIntent.amount_kobo && paidAmount && Number(paymentIntent.amount_kobo) !== paidAmount) {
        console.error("paystack-webhook:payment_intents amount mismatch", {
          expected: paymentIntent.amount_kobo,
          actual: paidAmount,
        });
        return new Response("OK", { status: 200 });
      }
    } catch (err) {
      console.error("paystack-webhook:payment_intents verify error", err);
      return new Response("OK", { status: 200 });
    }

    const nowIso = new Date().toISOString();
    await db
      .from("payment_intents")
      .update({ status: "paid", paid_at: nowIso, updated_at: nowIso })
      .eq("id", paymentIntent.id);

    if (String(paymentIntent.intent ?? "").toLowerCase() === "offer") {
      const { data: offer } = await db
        .from("offers")
        .select("id")
        .eq("id", paymentIntent.target_id)
        .maybeSingle();

      if (offer?.id) {
        await db
          .from("offers")
          .update({ status: "paid", updated_at: nowIso })
          .eq("id", offer.id);
      } else {
        console.log("paystack-webhook:payment_intents offer missing", paymentIntent.target_id);
      }
    }

    return new Response("OK", { status: 200 });
  }

  // Resolve escrow order id (optional but useful)
  const { data: order } = await db
    .from("escrow_orders")
    .select("id, status, total_kobo, paid_at")
    .eq("paystack_reference", reference)
    .maybeSingle();

  // Insert event; idempotency is enforced by unique index.
  const ins = await db.from("escrow_events").insert({
    provider,
    type,
    event_id,
    reference,
    escrow_order_id: order?.id ?? null,
    payload: evt,
  });

  // If duplicate event => idempotent ACK
  if (ins.error) {
    if (ins.error.code !== "23505") {
      console.error("paystack-webhook:escrow_events insert failed", ins.error);
    }
    return new Response("OK", { status: 200 });
  }

  // Apply state transition only once
  if (type === "charge.success" && reference) {
    if (isOfferEvent) {
      const { data: payment } = await db
        .from("offer_payments")
        .select("id, offer_id, amount_kobo, status")
        .eq("reference", reference)
        .maybeSingle();

      if (!payment?.id) return new Response("OK", { status: 200 });
      if (String(payment.status ?? "") === "paid") return new Response("OK", { status: 200 });

      try {
        const verifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${secret}` } }
        );
        const verifyJson = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok) return new Response("OK", { status: 200 });
        const status = String(verifyJson?.data?.status ?? "");
        const paidAmount = Number(verifyJson?.data?.amount ?? 0);
        if (status !== "success") return new Response("OK", { status: 200 });
        if (payment.amount_kobo && paidAmount && Number(payment.amount_kobo) !== paidAmount) {
          console.error("paystack-webhook:offer amount mismatch", {
            expected: payment.amount_kobo,
            actual: paidAmount,
          });
          return new Response("OK", { status: 200 });
        }
      } catch (err) {
        console.error("paystack-webhook:offer verify error", err);
        return new Response("OK", { status: 200 });
      }

      const nowIso = new Date().toISOString();
      await db
        .from("offer_payments")
        .update({ status: "paid", updated_at: nowIso })
        .eq("id", payment.id);

      const { data: offer } = await db
        .from("offers")
        .select("id, product_id, buyer_id, seller_id, offer_amount_kobo, accepted_amount_kobo, currency")
        .eq("id", payment.offer_id)
        .maybeSingle();

      if (offer?.id) {
        const orderAmountKobo = Number(offer.accepted_amount_kobo ?? offer.offer_amount_kobo ?? 0);
        await db
          .from("offers")
          .update({ status: "paid", updated_at: nowIso })
          .eq("id", offer.id);

        const { data: existingOrder } = await db
          .from("orders")
          .select("id")
          .eq("offer_id", offer.id)
          .maybeSingle();

        if (!existingOrder?.id) {
          await db.from("orders").insert({
            source: "offer",
            offer_id: offer.id,
            product_id: offer.product_id,
            buyer_id: offer.buyer_id,
            seller_id: offer.seller_id,
            amount: orderAmountKobo,
            currency: offer.currency ?? "NGN",
            status: "paid",
          });
        }
      }

      return new Response("OK", { status: 200 });
    }

    if (order?.paid_at || ["paid", "released", "refunded"].includes(String(order?.status ?? ""))) {
      return new Response("OK", { status: 200 });
    }

    try {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: { Authorization: `Bearer ${secret}` },
        }
      );
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        console.error("paystack-webhook:verify failed", { status: verifyRes.status });
        return new Response("OK", { status: 200 });
      }

      const status = String(verifyJson?.data?.status ?? "");
      const paidAmount = Number(verifyJson?.data?.amount ?? 0);
      if (status !== "success") {
        return new Response("OK", { status: 200 });
      }
      if (order?.total_kobo && paidAmount && Number(order.total_kobo) !== paidAmount) {
        console.error("paystack-webhook:amount mismatch", {
          expected: order.total_kobo,
          actual: paidAmount,
        });
        return new Response("OK", { status: 200 });
      }
    } catch (err) {
      console.error("paystack-webhook:verify error", err);
      return new Response("OK", { status: 200 });
    }

    const nowIso = new Date().toISOString();
    await db
      .from("escrow_orders")
      .update({ status: "paid", paid_at: nowIso, updated_at: nowIso })
      .eq("paystack_reference", reference)
      .in("status", ["initialized", "pending_payment", "pending", "funded"]);
  }

  return new Response("OK", { status: 200 });
});
