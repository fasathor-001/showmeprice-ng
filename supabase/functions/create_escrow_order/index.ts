import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CreatePayload = {
  product_id?: string;
  amount?: number;
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

function parseIntSafe(input: unknown) {
  const n = Number(input ?? 0);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

function parseNairaToKobo(input: unknown) {
  if (input === null || input === undefined) return null;
  if (typeof input === "string") {
    const cleaned = input.replace(/,/g, "").trim();
    const n = Number(cleaned);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  }
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function buildProductSnapshot(product: Record<string, unknown>) {
  const snapshot: Record<string, unknown> = {};
  if (product.title !== undefined) snapshot.title = product.title ?? null;
  if (product.price !== undefined) snapshot.price = product.price ?? null;
  if (product.city !== undefined) snapshot.city = product.city ?? null;
  if (product.area !== undefined) snapshot.area = product.area ?? null;
  return snapshot;
}

function resolveAmountKobo(product: Record<string, unknown>, fallbackAmount?: number | null) {
  const priceKobo = parseIntSafe(product.price_kobo);
  if (priceKobo) return priceKobo;

  const amount = parseIntSafe(product.amount_kobo ?? product.amount);
  if (amount) return amount;

  const priceNairaKobo = parseNairaToKobo(product.price ?? product.price_naira);
  if (priceNairaKobo) return priceNairaKobo;

  return fallbackAmount ?? null;
}

function calcEscrowFeeKobo(subtotalKobo: number) {
  const subtotal = Math.max(0, Math.round(Number(subtotalKobo ?? 0)));
  if (!subtotal) return { feeKobo: 0, totalKobo: 0 };

  const percent = 1.5;
  const flatKobo = 100 * 100;
  const percentFee = Math.ceil((subtotal * percent) / 100);
  const feeKobo = flatKobo + percentFee;
  return { feeKobo, totalKobo: subtotal + feeKobo };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL") ?? "";
  const supabaseAuthUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  const siteUrl = Deno.env.get("SITE_URL") ?? "";

  if (!supabaseUrl) {
    return jsonResponse(500, { error: "PROJECT_URL not set." });
  }
  if (!supabaseAuthUrl || !supabaseAnonKey) {
    return jsonResponse(500, { ok: false, error: "Server misconfigured." });
  }
  if (!serviceRoleKey) {
    return jsonResponse(500, { error: "SERVICE_ROLE_KEY not set." });
  }
  if (!paystackSecret) {
    return jsonResponse(500, { error: "PAYSTACK_SECRET_KEY not set." });
  }

  const ct = req.headers.get("content-type") ?? "";
  const raw = await req.text();
  let payload: CreatePayload | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as CreatePayload) : null;
  } catch (e: any) {
    return Response.json(
      {
        error: "Invalid JSON payload.",
        detail: String(e?.message ?? e),
        contentType: ct,
        bodyLength: raw.length,
        sample: raw.slice(0, 200),
      },
      { status: 400, headers: corsHeaders }
    );
  }

  const body = payload ?? {};
  const productId = normalizeId((body as any)?.product_id);
  const currency = String((body as any)?.currency ?? "NGN").trim() || "NGN";
  const _requestedAmount = Number((body as any).amount_kobo ?? (body as any).amount);
  void _requestedAmount;

  if (!productId) {
    return jsonResponse(400, { error: "product_id is required." });
  }

  const fallbackAmount = null;

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const hasAuthHeader = !!authHeader;
  console.log("[create_escrow_order] auth header present:", hasAuthHeader);
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!jwt) {
    return jsonResponse(401, { ok: false, error: "Unauthorized", detail: "Missing access token" });
  }

  const supabaseAuth = createClient(supabaseAuthUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(jwt);
  const buyer = authData?.user ?? null;
  if (authErr || !buyer) {
    return jsonResponse(401, {
      ok: false,
      error: "Unauthorized",
      detail: "Invalid or expired session. Please sign in again.",
    });
  }
  console.log("[create_escrow_order] auth user id:", buyer?.id ? String(buyer.id) : "none");

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });


  const { data: product, error: productErr } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (productErr) {
    console.error("[create_escrow_order] db error", {
      code: productErr.code,
      message: productErr.message,
      details: productErr.details,
      hint: productErr.hint,
    });
    return jsonResponse(500, { error: "Failed to load product." });
  }
  if (!product) {
    return jsonResponse(404, { error: "Product not found." });
  }

  let sellerId = normalizeId((product as any)?.owner_id);
  if (!sellerId) {
    const businessId = normalizeId((product as any)?.business_id);
    if (businessId) {
      const { data: bizRow, error: bizErr } = await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .maybeSingle();
      if (bizErr) {
        console.error("[create_escrow_order] db error", {
          code: bizErr.code,
          message: bizErr.message,
          details: bizErr.details,
          hint: bizErr.hint,
        });
        return jsonResponse(500, { error: "Failed to resolve seller business." });
      }
      sellerId = normalizeId((bizRow as any)?.owner_id) || normalizeId((bizRow as any)?.user_id);
    }
  }

  if (!sellerId) {
    return jsonResponse(500, { error: "Unable to resolve seller_id for product." });
  }

  const buyerId = String(buyer.id);
  if (buyerId === sellerId) {
    return jsonResponse(400, { error: "Buyer and seller cannot be the same." });
  }

  const minEscrowNaira = Number(Deno.env.get("ESCROW_MIN_PRICE_NGN") ?? 50000);
  const minEscrowKobo = Math.round(minEscrowNaira * 100);

  const subtotalKobo = resolveAmountKobo(product as Record<string, unknown>, fallbackAmount);
  if (!subtotalKobo) {
    return jsonResponse(400, { error: "Unable to determine amount." });
  }
  if (subtotalKobo <= 0 || subtotalKobo > 5_000_000_000) {
    return jsonResponse(400, { error: "Amount out of bounds." });
  }
  if (subtotalKobo < minEscrowKobo) {
    const formatted = `\u20A6${minEscrowNaira.toLocaleString("en-NG")}`;
    return jsonResponse(403, { error: `Escrow is only available for ${formatted}+ items.` });
  }

  const { feeKobo, totalKobo } = calcEscrowFeeKobo(subtotalKobo);
  const orderId = crypto.randomUUID();
  const snapshot = buildProductSnapshot(product as Record<string, unknown>);

  const { error: insertErr } = await supabaseAdmin.from("escrow_orders").insert({
    id: orderId,
    buyer_id: buyerId,
    seller_id: sellerId,
    product_id: productId,
    amount_kobo: totalKobo,
    subtotal_kobo: subtotalKobo,
    escrow_fee_kobo: feeKobo,
    total_kobo: totalKobo,
    currency,
    status: "initialized",
    paystack_reference: orderId,
    product_snapshot: snapshot,
  });

  if (insertErr) {
    console.error("[create_escrow_order] db error", {
      code: insertErr.code,
      message: insertErr.message,
      details: insertErr.details,
      hint: insertErr.hint,
    });
    return jsonResponse(500, {
      error: "Failed to create escrow order.",
      detail: insertErr?.message ?? String(insertErr ?? "unknown"),
    });
  }

  const origin = req.headers.get("origin") ?? "";
  const callbackBase = siteUrl || origin;
  const callbackUrl = callbackBase ? `${callbackBase.replace(/\/$/, "")}/escrow/return` : undefined;

  const initBody: Record<string, unknown> = {
    email: String(buyer.email ?? "").trim(),
    amount: totalKobo,
    reference: orderId,
    currency,
  };
  if (callbackUrl) initBody.callback_url = callbackUrl;

  let paystackJson: Record<string, unknown> | null = null;
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
    paystackJson = await res.json();
    if (!res.ok || !(paystackJson as any)?.status) {
      console.error("[create_escrow_order] paystack init failed", {
        status: res.status,
        body: paystackJson,
      });
      return jsonResponse(500, { error: "Paystack initialization failed." });
    }
    authorizationUrl = String((paystackJson as any)?.data?.authorization_url ?? "").trim();
    accessCode = String((paystackJson as any)?.data?.access_code ?? "").trim();
    if (!authorizationUrl || !accessCode) {
      return jsonResponse(500, { error: "Paystack authorization missing." });
    }
  } catch (err: any) {
    console.error("[create_escrow_order] failed", {
      message: err?.message ?? String(err),
      name: err?.name,
    });
    return jsonResponse(500, { error: "Paystack initialization failed." });
  }

  await supabaseAdmin.from("escrow_orders").update({
    paystack_reference: orderId,
    paystack_access_code: accessCode,
    paystack_authorization: (paystackJson as any)?.data?.authorization ?? null,
  }).eq("id", orderId);

  if (paystackJson) {
    await supabaseAdmin.from("escrow_events").insert({
      escrow_order_id: orderId,
      type: "paystack.initialize",
      payload: paystackJson,
    });
  }

  return jsonResponse(200, {
    order_id: orderId,
    reference: orderId,
    authorization_url: authorizationUrl,
    access_code: accessCode,
  });
});
