import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const str = String(value ?? "").trim().replace(/[^\d.]/g, "");
  if (!str) return null;
  const n = Number(str);
  return Number.isFinite(n) ? n : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  const siteUrl = Deno.env.get("SITE_URL") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !paystackSecretKey || !siteUrl) {
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
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let body: { product_id?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const productId = String(body?.product_id ?? "").trim();
  if (!productId) return jsonResponse(400, { error: "Missing product_id." });

  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !authData?.user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  const buyer = authData.user;

  const { data: product, error: prodErr } = await supabaseAdmin
    .from("products")
    .select("id, price, owner_id, business_id")
    .eq("id", productId)
    .maybeSingle();
  if (prodErr || !product) return jsonResponse(404, { error: "Product not found." });

  const priceNaira = numberFrom((product as any).price);
  if (!priceNaira || priceNaira <= 0) {
    return jsonResponse(400, { error: "Invalid product price." });
  }

  let sellerId = (product as any).owner_id ? String((product as any).owner_id) : "";
  const businessId = (product as any).business_id ? String((product as any).business_id) : "";

  if (!sellerId && businessId) {
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("user_id")
      .eq("id", businessId)
      .maybeSingle();
    sellerId = biz?.user_id ? String((biz as any).user_id) : "";
  }

  if (!sellerId) {
    return jsonResponse(400, { error: "Seller not found for product." });
  }

  const subtotalKobo = Math.round(priceNaira * 100);
  if (subtotalKobo < 5_000_000) {
    return jsonResponse(403, { error: "Escrow requires minimum ₦50,000." });
  }

  const feeKobo = Math.round(subtotalKobo * 0.015) + 10_000;
  const totalKobo = subtotalKobo + feeKobo;

  const reference = `smp_${crypto.randomUUID().replace(/-/g, "")}`;

  const { data: orderRow, error: orderErr } = await supabaseAdmin
    .from("escrow_orders")
    .insert({
      buyer_id: buyer.id,
      seller_id: sellerId,
      product_id: productId,
      subtotal_kobo: subtotalKobo,
      total_kobo: totalKobo,
      status: "initialized",
      funded: false,
      paystack_reference: reference,
    })
    .select("id")
    .single();
  if (orderErr || !orderRow?.id) {
    return jsonResponse(500, { error: "Failed to create escrow order." });
  }

  const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: buyer.email ?? "",
      amount: totalKobo,
      reference,
      callback_url: `${siteUrl.replace(/\/+$/, "")}/escrow/callback?reference=${reference}`,
      metadata: {
        escrow_order_id: orderRow.id,
        product_id: productId,
        buyer_id: buyer.id,
      },
    }),
  });

  const initJson = await initRes.json();
  if (!initRes.ok || !initJson?.data?.authorization_url) {
    return jsonResponse(502, { error: "Failed to initialize payment." });
  }

  const authorizationUrl = String(initJson.data.authorization_url ?? "").trim();
  const accessCode = String(initJson.data.access_code ?? "").trim();

  if (authorizationUrl || accessCode) {
    try {
      await supabaseAdmin
        .from("escrow_orders")
        .update({
          authorization_url: authorizationUrl || null,
          access_code: accessCode || null,
        })
        .eq("id", orderRow.id);
    } catch {
      // ignore if columns do not exist
    }
  }

  return jsonResponse(200, {
    escrow_order_id: orderRow.id,
    reference,
    authorization_url: authorizationUrl,
  });
});
