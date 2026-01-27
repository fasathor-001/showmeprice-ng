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

function parseAmount(input: unknown) {
  const n = Number(input ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
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

  const offerId = normalizeId(payload?.offerId ?? payload?.offer_id);
  const action = String(payload?.action ?? "").toLowerCase();
  const amount = parseAmount(payload?.amount);
  const message = String(payload?.message ?? "").trim() || null;

  if (!offerId) return jsonResponse(400, { error: "offerId is required." });
  if (!action) return jsonResponse(400, { error: "action is required." });

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
    .select("id, buyer_id, seller_id, amount, status, expires_at")
    .eq("id", offerId)
    .maybeSingle();

  if (offerErr) return jsonResponse(500, { error: "Failed to load offer." });
  if (!offer) return jsonResponse(404, { error: "Offer not found." });

  const isSeller = String(offer.seller_id) === String(user.id);
  const isBuyer = String(offer.buyer_id) === String(user.id);

  const status = String(offer.status ?? "").toLowerCase();
  if (status === "paid") return jsonResponse(400, { error: "Offer already paid." });

  const expiresAt = offer.expires_at ? Date.parse(String(offer.expires_at)) : NaN;
  if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
    return jsonResponse(400, { error: "Offer has expired." });
  }

  const nowIso = new Date().toISOString();
  let updates: Record<string, unknown> = { updated_at: nowIso };
  let eventType = "";

  if (action === "accept") {
    if (!isSeller) return jsonResponse(403, { error: "Not allowed." });
    updates = { ...updates, status: "accepted", accepted_by: user.id, accepted_at: nowIso };
    updates.accepted_amount_kobo = toKobo(Number(offer.amount ?? 0));
    eventType = "accept";
  } else if (action === "decline") {
    if (!isSeller) return jsonResponse(403, { error: "Not allowed." });
    updates = { ...updates, status: "declined", declined_by: user.id, declined_at: nowIso };
    eventType = "decline";
  } else if (action === "counter") {
    if (!isSeller) return jsonResponse(403, { error: "Not allowed." });
    if (!amount) return jsonResponse(400, { error: "amount is required for counter." });
    updates = {
      ...updates,
      status: "countered",
      amount,
      offer_amount_kobo: toKobo(amount),
    };
    eventType = "counter";
  } else if (action === "cancel") {
    if (!isBuyer) return jsonResponse(403, { error: "Not allowed." });
    updates = { ...updates, status: "canceled" };
    eventType = "cancel";
  } else {
    return jsonResponse(400, { error: "Invalid action." });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("offers")
    .update(updates)
    .eq("id", offerId);

  if (updateErr) return jsonResponse(500, { error: "Failed to update offer." });

  const { data: updated } = await supabaseAdmin
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  await supabaseAdmin.from("offer_events")
    .insert({
      offer_id: offerId,
      actor_id: user.id,
      type: eventType,
      payload: { amount: amount ?? null, message },
    });

  return jsonResponse(200, updated ? (updated as Record<string, unknown>) : { ok: true });
});
