import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUILD_ID = "offer_create@2026-01-28-02";

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeId(input: unknown) {
  return String(input ?? "").trim();
}

function toKobo(amount: number) {
  return Math.round(amount * 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(500, { error: "Server misconfigured." });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload." });
  }

  const productId = normalizeId(payload?.productId ?? payload?.product_id);
  const offerAmountKobo = Number.isFinite(Number(payload?.offer_amount_kobo))
    ? Number(payload?.offer_amount_kobo)
    : Number.isFinite(Number(payload?.amount))
    ? toKobo(Number(payload?.amount))
    : NaN;
  const message = String(payload?.message ?? "").trim() || null;
  const conversationId = normalizeId(payload?.conversationId ?? payload?.conversation_id) || null;
  const productTitleSnapshot = String(payload?.productTitle ?? payload?.product_title_snapshot ?? "").trim() || null;
  const listedPriceKobo = Number(payload?.listedPriceKobo ?? payload?.listed_price_kobo ?? 0) || null;

  if (!productId) return jsonResponse(400, { error: "productId is required." });
  if (!Number.isFinite(offerAmountKobo) || offerAmountKobo <= 0) {
    return jsonResponse(400, { error: "Invalid offer amount." });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : auth;
  if (!jwt) return jsonResponse(401, { error: "Unauthorized" });

  const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
  const user = authData?.user ?? null;
  if (authErr || !user) return jsonResponse(401, { error: "Unauthorized" });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: product, error: productErr } = await supabaseAdmin
    .from("products")
    .select("id, owner_id, business_id, title, price")
    .eq("id", productId)
    .maybeSingle();

  if (productErr) return jsonResponse(500, { error: "Failed to load product." });
  if (!product) return jsonResponse(404, { error: "Product not found." });

  let sellerId = normalizeId(product?.owner_id);
  if (!sellerId && product?.business_id) {
    const { data: biz, error: bizErr } = await supabaseAdmin
      .from("businesses")
      .select("id, owner_id, user_id")
      .eq("id", product.business_id)
      .maybeSingle();
    if (bizErr) return jsonResponse(500, { error: "Failed to load business." });
    sellerId = normalizeId(biz?.owner_id) || normalizeId(biz?.user_id);
  }

  if (!sellerId) return jsonResponse(500, { error: "Unable to resolve seller." });

  const buyerId = String(user.id);
  if (buyerId === sellerId) return jsonResponse(400, { error: "Buyer and seller cannot be the same." });

  const offerId = crypto.randomUUID();
  const snapshotTitle = productTitleSnapshot || String(product?.title ?? "").trim() || null;
  const priceKobo = listedPriceKobo ?? (Number(product?.price ?? 0) ? toKobo(Number(product?.price)) : null);

  const offerRow = {
    id: offerId,
    product_id: productId,
    buyer_id: buyerId,
    seller_id: sellerId,
    currency: "NGN",
    message,
    status: "sent",
    conversation_id: conversationId,
    offer_amount_kobo: offerAmountKobo,
    product_title_snapshot: snapshotTitle,
    listed_price_kobo: priceKobo,
  };
  console.log("[offer_create]", BUILD_ID, "offerRow keys:", Object.keys(offerRow));

  const { error: insertErr } = await supabaseAdmin.from("offers").insert(offerRow);

  if (insertErr) {
    return jsonResponse(500, {
      error: "Failed to create offer.",
      build: BUILD_ID,
      offerRowKeys: Object.keys(offerRow),
      detail: insertErr.message,
    });
  }

  await supabaseAdmin.from("offer_events").insert({
    offer_id: offerId,
    actor_id: buyerId,
    type: "created",
    payload: { amount_kobo: offerAmountKobo, message },
  });

  return jsonResponse(200, {
    id: offerId,
    status: "sent",
    build: BUILD_ID,
  });
});
