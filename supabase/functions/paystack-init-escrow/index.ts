import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InitPayload = {
  product_id?: string;
  seller_id?: string;
  amount_kobo?: number;
  currency?: string;
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

function normalizeTier(input: unknown) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "free") return "free";
  if (raw === "pro") return "pro";
  if (raw === "premium") return "premium";
  if (raw === "institution") return "institution";
  if (raw === "admin") return "admin";
  return raw ? "unknown" : "free";
}

function normalizeUserType(input: unknown) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "buyer") return "buyer";
  if (raw === "seller") return "seller";
  return raw ? "unknown" : "buyer";
}

function calculateEscrowFee(amountProduct: number, tier?: string) {
  const n = Number(amountProduct ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const t = normalizeTier(tier ?? "free");
  const config: Record<string, { rate: number; min: number }> = {
    free: { rate: 0.03, min: 500 },
    pro: { rate: 0.03, min: 500 },
    premium: { rate: 0.025, min: 400 },
    institution: { rate: 0.02, min: 300 },
    admin: { rate: 0.02, min: 300 },
    unknown: { rate: 0.03, min: 500 },
  };
  const chosen = config[t] ?? config.free;
  return Math.max(chosen.min, Math.round(n * chosen.rate));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY") ??
    "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, { error: "Supabase configuration missing." });
  }
  if (!serviceRoleKey) {
    return jsonResponse(500, { error: "SUPABASE_SERVICE_ROLE_KEY not set in Supabase secrets" });
  }
  if (!paystackSecretKey) {
    return jsonResponse(500, { error: "Paystack configuration missing." });
  }

  let payload: InitPayload;
  try {
    payload = (await req.json()) as InitPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid payload" });
  }

  const productId = normalizeId(payload?.product_id);
  const sellerId = normalizeId(payload?.seller_id);
  const amountKobo = Number(payload?.amount_kobo ?? 0);
  const currency = String(payload?.currency ?? "NGN").trim() || "NGN";

  if (!productId || !sellerId) {
    return jsonResponse(400, { error: "Missing product or seller." });
  }
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    return jsonResponse(400, { error: "Invalid amount." });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Missing Authorization" });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing Authorization" });
  }

  const appUrl =
    Deno.env.get("SITE_URL") ??
    Deno.env.get("APP_URL") ??
    Deno.env.get("PUBLIC_SITE_URL") ??
    "";
  if (!appUrl) {
    return jsonResponse(500, { error: "SITE_URL not set in Supabase secrets" });
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: "Invalid JWT" });
  }

  const buyerId = String(userData.user.id);
  const buyerEmail = String(userData.user.email ?? "").trim();
  if (!buyerEmail) {
    return jsonResponse(400, { error: "Missing buyer email." });
  }

  const { data: profileRow, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("membership_tier,user_type,role")
    .eq("id", buyerId)
    .maybeSingle();
  if (profileErr) {
    return jsonResponse(500, { error: "Failed to load buyer profile." });
  }
  const buyerTier = normalizeTier(profileRow?.membership_tier ?? "free");
  const buyerType = normalizeUserType(profileRow?.user_type ?? "buyer");
  const buyerRole = String(profileRow?.role ?? "").toLowerCase();

  if (buyerRole !== "admin" && buyerType === "seller") {
    return jsonResponse(403, { error: "Escrow is only available to buyers." });
  }
  if (buyerRole !== "admin" && buyerTier !== "premium" && buyerTier !== "institution") {
    return jsonResponse(403, { error: "Escrow requires Premium or Institution." });
  }

  const { data: productRows, error: productErr } = await supabaseAdmin
    .from("products")
    .select("id,business_id,price")
    .eq("id", productId)
    .limit(1);
  if (productErr) {
    return jsonResponse(500, { error: "Failed to load product." });
  }
  const product = productRows?.[0] ?? null;
  if (!product?.id) {
    return jsonResponse(404, { error: "Product not found." });
  }

  const businessId = String((product as any)?.business_id ?? "").trim();
  if (!businessId) {
    return jsonResponse(400, { error: "Product seller not found." });
  }

  const { data: businessRows, error: businessErr } = await supabaseAdmin
    .from("businesses")
    .select("id,user_id")
    .eq("id", businessId)
    .limit(1);
  if (businessErr) {
    return jsonResponse(500, { error: "Failed to load seller." });
  }
  const business = businessRows?.[0] ?? null;
  const resolvedSellerId = String((business as any)?.user_id ?? "").trim();
  if (!resolvedSellerId) {
    return jsonResponse(400, { error: "Seller account not found." });
  }
  if (resolvedSellerId !== sellerId) {
    return jsonResponse(400, { error: "Seller mismatch." });
  }

  const amountProduct = Number((product as any)?.price ?? 0);
  if (!Number.isFinite(amountProduct) || amountProduct <= 0) {
    return jsonResponse(400, { error: "Invalid product amount." });
  }

  const amountFee = calculateEscrowFee(amountProduct, buyerTier);
  const amountTotal = amountProduct + amountFee;
  const expectedKobo = Math.round(amountTotal * 100);
  if (Math.round(amountKobo) !== expectedKobo) {
    return jsonResponse(400, { error: "Amount mismatch." });
  }

  const reference = `escrow_${crypto.randomUUID().replace(/-/g, "")}`;
  const { data: orderRows, error: orderErr } = await supabaseAdmin
    .from("escrow_transactions")
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      product_id: productId,
      currency,
      amount_product: amountProduct,
      amount_fee: amountFee,
      amount_total: amountTotal,
      status: "pending_payment",
      payment_reference: reference,
    })
    .select("id")
    .limit(1);
  if (orderErr) {
    return jsonResponse(500, { error: "Failed to create escrow order." });
  }
  const orderId = String(orderRows?.[0]?.id ?? "").trim();
  if (!orderId) {
    return jsonResponse(500, { error: "Failed to create escrow order." });
  }

  const callbackUrl = `${appUrl.replace(/\/$/, "")}/escrow/return?order=${orderId}`;
  const initBody = {
    amount: expectedKobo,
    email: buyerEmail,
    reference,
    callback_url: callbackUrl,
    metadata: {
      order_id: orderId,
      product_id: productId,
      buyer_id: buyerId,
      seller_id: sellerId,
      amount_kobo: expectedKobo,
    },
  };

  let authorizationUrl = "";
  let accessCode = "";

  try {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initBody),
    });

    const json = await res.json();
    if (!res.ok || !json?.status) {
      return jsonResponse(500, { error: "Paystack initialization failed." });
    }

    authorizationUrl = String(json?.data?.authorization_url ?? "").trim();
    accessCode = String(json?.data?.access_code ?? "").trim();
    if (!authorizationUrl) {
      return jsonResponse(500, { error: "Paystack authorization missing." });
    }
  } catch (e: any) {
    return jsonResponse(500, { error: "Paystack initialization failed.", details: e?.message });
  }

  return jsonResponse(200, {
    ok: true,
    order_id: orderId,
    authorization_url: authorizationUrl,
  });
});
