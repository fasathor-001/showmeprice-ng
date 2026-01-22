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

async function getReferenceFromRequest(req: Request) {
  const url = new URL(req.url);
  const queryRef = String(
    url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? "",
  ).trim();
  if (queryRef) return queryRef;

  try {
    const payload = await req.json();
    return String(payload?.reference ?? "").trim();
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  if (!supabaseUrl) {
    return jsonResponse(500, { error: "PROJECT_URL not set." });
  }
  if (!serviceRoleKey) {
    return jsonResponse(500, { error: "SERVICE_ROLE_KEY not set." });
  }
  if (!paystackSecret) {
    return jsonResponse(500, { error: "PAYSTACK_SECRET_KEY not set." });
  }

  const reference = await getReferenceFromRequest(req);
  if (!reference) {
    return jsonResponse(400, { error: "reference is required." });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: escrowRow } = await supabaseAdmin
    .from("escrow_orders")
    .select("id,status,paid_at")
    .or(`id.eq.${reference},paystack_reference.eq.${reference}`)
    .maybeSingle();

  const status = String(escrowRow?.status ?? "unknown").toLowerCase();
  const alreadyFinal = Boolean(
    escrowRow?.paid_at || ["paid", "funded", "released", "refunded"].includes(status),
  );
  console.log("[verify_escrow_status] order lookup", {
    reference,
    found: Boolean(escrowRow),
    status: status || "unknown",
    paid: Boolean(escrowRow?.paid_at),
  });

  if (alreadyFinal) {
    return jsonResponse(200, {
      reference,
      funded: true,
      status,
      paid_at: escrowRow?.paid_at ?? null,
    });
  }

  let verifyJson: any = null;
  let verifyStatus = "unknown";
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${paystackSecret}` } },
    );
    verifyJson = await res.json();
    verifyStatus = String(verifyJson?.data?.status ?? "unknown").toLowerCase();
  } catch {
    return jsonResponse(502, { error: "Paystack verify request failed." });
  }

  console.log("[verify_escrow_status] paystack verify", {
    reference,
    status: verifyStatus,
  });

  let updatedPaidAt: string | null = null;
  if (verifyStatus === "success" && escrowRow?.id) {
    updatedPaidAt = new Date().toISOString();
    await supabaseAdmin
      .from("escrow_orders")
      .update({
        status: "paid",
        paid_at: updatedPaidAt,
        paystack_reference: reference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", escrowRow.id)
      .not("status", "in", '("paid","released","refunded")');

    await supabaseAdmin.from("escrow_events").insert({
      escrow_order_id: escrowRow.id,
      type: "paystack.verified.success",
      payload: {
        reference,
        status: verifyStatus,
        amount: verifyJson?.data?.amount ?? null,
      },
    });
  }

  const funded = verifyStatus === "success" && Boolean(escrowRow?.id);

  return jsonResponse(200, {
    reference,
    funded,
    status: funded ? "paid" : status || "unknown",
    paid_at: funded ? updatedPaidAt : escrowRow?.paid_at ?? null,
  });
});
