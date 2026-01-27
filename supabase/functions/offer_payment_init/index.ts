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

  const offerId = normalizeId(payload?.offerId ?? payload?.offer_id);
  const idempotencyKey = normalizeId(payload?.idempotencyKey ?? payload?.idempotency_key);

  if (!offerId) return jsonResponse(400, { error: "offerId is required." });
  if (!idempotencyKey) return jsonResponse(400, { error: "idempotencyKey is required." });

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return jsonResponse(401, { error: "Unauthorized" });

  const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(token);
  const user = authData?.user ?? null;
  if (authErr || !user) return jsonResponse(401, { error: "Unauthorized" });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: offer, error: offerErr } = await supabaseAdmin
    .from("offers")
    .select("id, buyer_id, seller_id, amount, currency, status, expires_at")
    .eq("id", offerId)
    .maybeSingle();

  if (offerErr) return jsonResponse(500, { error: "Failed to load offer." });
  if (!offer) return jsonResponse(404, { error: "Offer not found." });

  if (String(offer.buyer_id) !== String(user.id)) {
    return jsonResponse(403, { error: "Not allowed." });
  }

  const status = String(offer.status ?? "").toLowerCase();
  if (status !== "accepted") return jsonResponse(400, { error: "Offer is not accepted." });

  const expiresAt = offer.expires_at ? Date.parse(String(offer.expires_at)) : NaN;
  if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
    return jsonResponse(400, { error: "Offer has expired." });
  }

  const amount = Number(offer.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return jsonResponse(400, { error: "Invalid amount." });

  const amountKobo = toKobo(amount);
  const currency = String(offer.currency ?? "NGN") || "NGN";

  const { data: existing } = await supabaseAdmin
    .from("offer_payments")
    .select("authorization_url, reference, status")
    .eq("offer_id", offerId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing?.authorization_url && existing?.reference) {
    return jsonResponse(200, {
      authorizationUrl: existing.authorization_url,
      reference: existing.reference,
      status: existing.status,
    });
  }

  const reference = `offer_${offerId}_${crypto.randomUUID()}`;
  const initBody: Record<string, unknown> = {
    email: String(user.email ?? "").trim(),
    amount: amountKobo,
    currency,
    reference,
    metadata: { kind: "offer", offerId },
  };

  let initJson: Record<string, unknown> | null = null;
  let authorizationUrl = "";
  let accessCode = "";

  try {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initBody),
    });
    initJson = await res.json();
    if (!res.ok || !(initJson as any)?.status) {
      return jsonResponse(502, { error: "Paystack initialization failed." });
    }
    authorizationUrl = String((initJson as any)?.data?.authorization_url ?? "").trim();
    accessCode = String((initJson as any)?.data?.access_code ?? "").trim();
  } catch {
    return jsonResponse(502, { error: "Paystack initialization failed." });
  }

  const { error: insertErr } = await supabaseAdmin.from("offer_payments").insert({
    offer_id: offerId,
    buyer_id: offer.buyer_id,
    idempotency_key: idempotencyKey,
    reference,
    amount_kobo: amountKobo,
    currency,
    status: "initialized",
    paystack_access_code: accessCode || null,
    authorization_url: authorizationUrl || null,
    raw_init_response: initJson ?? {},
  });

  if (insertErr) {
    return jsonResponse(500, { error: "Failed to initialize payment." });
  }

  return jsonResponse(200, {
    authorizationUrl,
    reference,
  });
});
