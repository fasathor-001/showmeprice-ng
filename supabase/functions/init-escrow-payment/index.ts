import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InitPayload = {
  product_id?: string;
  seller_id?: string;
  currency?: string | null;
  return_url?: string | null;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function calculateEscrowFee(amountProduct: number) {
  const n = Number(amountProduct ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(500, Math.round(n * 0.03));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, { error: "Supabase configuration missing." });
  }
  if (!paystackSecretKey) {
    return jsonResponse(500, { error: "Paystack configuration missing." });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let payload: InitPayload;
  try {
    payload = (await req.json()) as InitPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid payload" });
  }

  const productId = String(payload?.product_id ?? "").trim();
  const sellerId = String(payload?.seller_id ?? "").trim();
  const returnUrl = payload?.return_url ? String(payload.return_url).trim() : "";
  const currency = String(payload?.currency ?? "NGN").trim() || "NGN";

  if (!productId) return jsonResponse(400, { error: "Missing product" });
  if (!sellerId) return jsonResponse(400, { error: "Missing seller" });

  const { data: profileRows, error: profileErr } = await supabase
    .from("profiles")
    .select("membership_tier,user_type")
    .eq("id", userData.user.id)
    .limit(1);

  if (profileErr) {
    return jsonResponse(500, { error: "Failed to load profile" });
  }

  const profile = profileRows?.[0] ?? null;
  const tier = String(profile?.membership_tier ?? "").toLowerCase();
  const userType = String(profile?.user_type ?? "").toLowerCase();
  const eligible = userType === "buyer" && (tier === "premium" || tier === "institution");

  if (!eligible) {
    return jsonResponse(403, { error: "Escrow not available for this account" });
  }

  const { data: productRows, error: productErr } = await supabase
    .from("products")
    .select("id,price,business_id,businesses(user_id)")
    .eq("id", productId)
    .limit(1);

  if (productErr) {
    return jsonResponse(500, { error: "Failed to load product" });
  }

  const product = productRows?.[0] ?? null;
  if (!product) {
    return jsonResponse(404, { error: "Product not found" });
  }

  const businessRef = Array.isArray((product as any).businesses)
    ? (product as any).businesses[0]
    : (product as any).businesses;
  const resolvedSellerId = String(businessRef?.user_id ?? "").trim();

  if (!resolvedSellerId) {
    return jsonResponse(400, { error: "Seller not resolved" });
  }
  if (resolvedSellerId !== sellerId) {
    return jsonResponse(400, { error: "Seller mismatch" });
  }
  if (resolvedSellerId === userData.user.id) {
    return jsonResponse(403, { error: "Buyer cannot escrow own product" });
  }

  const amountProduct = Number((product as any)?.price ?? 0);
  if (!Number.isFinite(amountProduct) || amountProduct <= 0) {
    return jsonResponse(400, { error: "Invalid product amount" });
  }

  const amountFee = calculateEscrowFee(amountProduct);
  const amountTotal = amountProduct + amountFee;

  const reference = `SMP-ESCROW-${crypto.randomUUID()}`;
  const initBody = {
    email: userData.user.email,
    amount: Math.round(amountTotal * 100),
    reference,
    currency,
    callback_url: returnUrl || undefined,
    metadata: {
      product_id: productId,
      buyer_id: userData.user.id,
      seller_id: resolvedSellerId,
      amount_fee: amountFee,
      amount_product: amountProduct,
    },
  };

  const resp = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(initBody),
  });

  if (!resp.ok) {
    return jsonResponse(502, { error: "Paystack initialization failed" });
  }

  const initResult = await resp.json();
  if (!initResult?.status || !initResult?.data?.authorization_url || !initResult?.data?.reference) {
    return jsonResponse(502, { error: "Paystack returned invalid response" });
  }

  return jsonResponse(200, {
    authorization_url: initResult.data.authorization_url,
    reference: initResult.data.reference,
    access_code: initResult.data.access_code ?? null,
  });
});
