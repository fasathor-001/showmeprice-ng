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
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !paystackSecretKey) {
    return jsonResponse(500, { ok: false, error: "Server misconfigured." });
  }

  // Require valid session — only authenticated sellers may resolve
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Unauthorized" });
  }
  const token = authHeader.slice(7).trim();

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !authData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid or expired session." });
  }

  let body: { account_number?: string; bank_code?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON" });
  }

  const accountNumber = String(body?.account_number ?? "").trim().replace(/\D/g, "");
  const bankCode = String(body?.bank_code ?? "").trim();

  if (accountNumber.length !== 10) {
    return jsonResponse(400, { ok: false, error: "Account number must be 10 digits." });
  }
  if (!bankCode) {
    return jsonResponse(400, { ok: false, error: "Missing bank_code." });
  }

  try {
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
    );
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json?.status) {
      return jsonResponse(422, {
        ok: false,
        error: "Could not verify account. Check the account number and bank.",
      });
    }

    const accountName = String(json?.data?.account_name ?? "").trim();
    if (!accountName) {
      return jsonResponse(422, { ok: false, error: "Paystack returned empty account name." });
    }

    return jsonResponse(200, { ok: true, account_name: accountName });
  } catch (err: any) {
    console.error("[resolve-bank-account] paystack error", err);
    return jsonResponse(500, { ok: false, error: "Failed to verify account. Try again." });
  }
});
