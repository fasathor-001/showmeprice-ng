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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

  if (!serviceKey) return jsonResponse(500, { error: "Missing SERVICE_ROLE_KEY secret" });
  if (!supabaseUrl || !anonKey || !paystackSecretKey) {
    return jsonResponse(500, { error: "Missing server configuration." });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { error: "Missing auth token." });
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !authData?.user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let body: { reference?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const reference = String(body?.reference ?? "").trim();
  if (!reference) return jsonResponse(400, { error: "Missing reference." });

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    }
  );

  const verifyJson = await verifyRes.json();
  if (!verifyRes.ok) {
    return jsonResponse(502, { error: "Paystack verification failed.", status: verifyRes.status });
  }

  const status = String(verifyJson?.data?.status ?? "");
  const eventId = verifyJson?.data?.id ? String(verifyJson.data.id) : "";

  const { data: order } = await supabaseAdmin
    .from("escrow_orders")
    .select("id,status")
    .eq("paystack_reference", reference)
    .maybeSingle();

  let updated = false;
  if (status === "success") {
    const nowIso = new Date().toISOString();
    const { data: updatedRow } = await supabaseAdmin
      .from("escrow_orders")
      .update({ status: "funded", paid_at: nowIso, updated_at: nowIso })
      .eq("paystack_reference", reference)
      .in("status", ["initialized", "pending"])
      .select("id")
      .maybeSingle();
    updated = !!updatedRow?.id;

    const { error: eventErr } = await supabaseAdmin.from("escrow_events").insert({
      provider: "paystack",
      type: "charge.success",
      event_id: eventId || null,
      reference,
      escrow_order_id: order?.id ?? updatedRow?.id ?? null,
      payload: verifyJson,
    });
    if (eventErr && eventErr.code !== "23505") {
      console.error("escrow-verify:escrow_events insert failed", eventErr);
    }
  }

  return jsonResponse(200, { ok: true, status, updated });
});
