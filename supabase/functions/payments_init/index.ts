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

  const intent = String(payload?.intent ?? "").toLowerCase();
  const targetId = String(payload?.targetId ?? "").trim();
  if (!intent || !targetId) return jsonResponse(400, { error: "Invalid request." });

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
  const user = authData?.user ?? null;
  if (authErr || !user) return jsonResponse(401, { error: "Invalid JWT" });

  if (intent !== "offer") return jsonResponse(400, { error: "Not implemented yet" });

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: offer, error: offerErr } = await supabaseAdmin
    .from("offers")
    .select("id, buyer_id, offer_amount_kobo, accepted_amount_kobo")
    .eq("id", targetId)
    .maybeSingle();

  if (offerErr) return jsonResponse(500, { error: "Failed to load offer." });
  if (!offer) return jsonResponse(404, { error: "Offer not found." });
  if (String(offer.buyer_id) !== String(user.id)) return jsonResponse(403, { error: "Not allowed." });

  const amountKobo = Number(offer.accepted_amount_kobo ?? offer.offer_amount_kobo ?? 0);
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    return jsonResponse(400, { error: "Invalid amount." });
  }

  const reference = `smp_${intent}_${crypto.randomUUID()}`;
  const { error: insertErr } = await supabaseAdmin.from("payment_intents").insert({
    user_id: user.id,
    intent,
    target_id: targetId,
    amount_kobo: amountKobo,
    currency: "NGN",
    reference,
  });

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

  return jsonResponse(200, { authorization_url: authorizationUrl, reference });
});
