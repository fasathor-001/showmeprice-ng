import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret) {
    return jsonResponse(500, { error: "Server misconfigured." });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const kind = String(payload?.kind ?? payload?.intent ?? "").toLowerCase();
  const targetId = String(payload?.targetId ?? payload?.target_id ?? "").trim();
  const productId = String(payload?.product_id ?? "").trim();
  const successUrl = String(payload?.success_url ?? "").trim();
  const cancelUrl = String(payload?.cancel_url ?? "").trim();
  if (!kind || (!targetId && !productId)) return jsonResponse(400, { error: "Invalid request." });

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
  const user = authData?.user ?? null;
  if (authErr || !user) return jsonResponse(401, { error: "Invalid JWT" });

  if (kind !== "offer" && kind !== "escrow") return jsonResponse(400, { error: "Not implemented yet" });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let amountKobo = 0;
  let escrowOrderId: string | null = null;
  let intentTargetId = targetId;

  if (kind === "offer") {
    const { data: offer, error: offerErr } = await supabaseAdmin
      .from("offers")
      .select("id, buyer_id, offer_amount_kobo, accepted_amount_kobo")
      .eq("id", targetId)
      .maybeSingle();

    if (offerErr) return jsonResponse(500, { error: "Failed to load offer." });
    if (!offer) return jsonResponse(404, { error: "Offer not found." });
    if (String(offer.buyer_id) !== String(user.id)) return jsonResponse(403, { error: "Not allowed." });

    amountKobo = Number(offer.accepted_amount_kobo ?? offer.offer_amount_kobo ?? 0);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      return jsonResponse(400, { error: "Invalid amount." });
    }
  } else if (kind === "escrow") {
    const { data: product, error: productErr } = await supabaseAdmin
      .from("products")
      .select("id, owner_id, business_id, price, price_naira, amount")
      .eq("id", productId)
      .maybeSingle();

    if (productErr) return jsonResponse(500, { error: "Failed to load product." });
    if (!product) return jsonResponse(404, { error: "Product not found." });

    const rawPrice = product.price ?? (product as any)?.price_naira ?? (product as any)?.amount ?? 0;
    const priceNaira =
      typeof rawPrice === "number"
        ? rawPrice
        : Number(String(rawPrice).replace(/[^\d.]/g, "")) || 0;
    const priceKobo = Math.round(priceNaira * 100);
    const minKobo = 50000 * 100;
    if (!Number.isFinite(priceKobo) || priceKobo < minKobo) {
      return jsonResponse(403, { error: "Escrow is only available for ₦50,000+ items." });
    }

    const feeKobo = Math.floor(priceKobo * 0.015) + 10000;
    amountKobo = priceKobo + feeKobo;
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      return jsonResponse(400, { error: "Invalid amount." });
    }

    let sellerId = String((product as any)?.owner_id ?? "");
    if (!sellerId && (product as any)?.business_id) {
      const { data: biz, error: bizErr } = await supabaseAdmin
        .from("businesses")
        .select("id, owner_id, user_id")
        .eq("id", (product as any).business_id)
        .maybeSingle();
      if (bizErr) return jsonResponse(500, { error: "Failed to load business." });
      sellerId = String(biz?.owner_id ?? biz?.user_id ?? "");
    }
    if (!sellerId) return jsonResponse(500, { error: "Unable to resolve seller." });
    if (String(sellerId) === String(user.id)) {
      return jsonResponse(403, { error: "Buyer cannot escrow own product." });
    }

    const { data: escrowRow, error: escrowErr } = await supabaseAdmin
      .from("escrow_orders")
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
        product_id: product.id,
        amount_kobo: priceKobo,
        subtotal_kobo: priceKobo,
        escrow_fee_kobo: feeKobo,
        total_kobo: amountKobo,
        currency: "NGN",
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (escrowErr) return jsonResponse(500, { error: "Failed to create escrow order." });
    escrowOrderId = String(escrowRow?.id ?? "");
    if (!escrowOrderId) return jsonResponse(500, { error: "Failed to create escrow order." });
    intentTargetId = escrowOrderId;
  }

  const reference = `smp_${kind}_${crypto.randomUUID()}`;
  const { data: paymentRow, error: insertErr } = await supabaseAdmin
    .from("payment_intents")
    .insert({
      user_id: user.id,
      kind,
      intent: kind,
      target_id: intentTargetId,
      amount_kobo: amountKobo,
      currency: "NGN",
      status: "initialized",
      reference,
      metadata: {
        kind,
        target_id: intentTargetId,
        escrow_order_id: escrowOrderId,
        success_url: successUrl || null,
        cancel_url: cancelUrl || null,
      },
    })
    .select("id")
    .maybeSingle();

  if (insertErr) return jsonResponse(500, { error: "Failed to create payment intent." });

  let authorizationUrl = "";
  try {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: String(user.email ?? "").trim(),
        amount: amountKobo,
        reference,
        callback_url: successUrl || undefined,
        metadata: {
          kind,
          escrow_order_id: escrowOrderId,
          payment_intent_id: paymentRow?.id ?? null,
        },
      }),
    });
    const initJson = await res.json();
    if (!res.ok || !(initJson as any)?.status) {
      return jsonResponse(502, { error: "Paystack initialization failed." });
    }
    authorizationUrl = String((initJson as any)?.data?.authorization_url ?? "").trim();
  } catch {
    return jsonResponse(502, { error: "Paystack initialization failed." });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("payment_intents")
    .update({ authorization_url: authorizationUrl, updated_at: new Date().toISOString() })
    .eq("reference", reference);

  if (updateErr) return jsonResponse(500, { error: "Failed to update payment intent." });

  if (kind === "escrow" && escrowOrderId && paymentRow?.id) {
    await supabaseAdmin
      .from("escrow_orders")
      .update({
        paystack_reference: reference,
        payment_intent_id: paymentRow.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowOrderId);
  }

  return jsonResponse(200, { authorization_url: authorizationUrl, reference, escrow_order_id: escrowOrderId });
});
