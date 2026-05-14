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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "";

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return jsonResponse(500, { ok: false, error: "Server misconfigured." });
  }

  // Verify caller is an authenticated admin
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Unauthorized" });
  }
  const token = authHeader.slice(7).trim();

  const supabaseAuth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authErr } = await supabaseAuth.auth.getUser(token);
  if (authErr || !authData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid session." });
  }

  const adminId = authData.user.id;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Confirm caller is admin
  const { data: adminProfile } = await supabaseAdmin
    .from("profiles")
    .select("role, user_type, is_admin")
    .eq("id", adminId)
    .maybeSingle();

  const isAdmin =
    !!(adminProfile as any)?.is_admin ||
    String((adminProfile as any)?.role ?? "").toLowerCase() === "admin" ||
    String((adminProfile as any)?.user_type ?? "").toLowerCase() === "admin";

  if (!isAdmin) {
    return jsonResponse(403, { ok: false, error: "Admin access required." });
  }

  let body: { verification_id?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON" });
  }

  const verificationId = String(body?.verification_id ?? "").trim();
  if (!verificationId) {
    return jsonResponse(400, { ok: false, error: "Missing verification_id." });
  }

  // Fetch the verification row to get seller_id
  const { data: vRow, error: vErr } = await supabaseAdmin
    .from("seller_verifications")
    .select("id, seller_id")
    .eq("id", verificationId)
    .maybeSingle();

  if (vErr || !vRow?.seller_id) {
    return jsonResponse(404, { ok: false, error: "Verification not found." });
  }

  const sellerId = String(vRow.seller_id);
  const now = new Date().toISOString();

  // Update seller_verifications → verified
  const { error: verifyErr } = await supabaseAdmin
    .from("seller_verifications")
    .update({ status: "verified", reviewed_at: now, reviewed_by: adminId })
    .eq("id", verificationId);

  if (verifyErr) {
    return jsonResponse(500, { ok: false, error: "Failed to update verification." });
  }

  // Update businesses → approved
  await supabaseAdmin
    .from("businesses")
    .update({ verification_status: "approved", verification_tier: "verified", updated_at: now })
    .eq("user_id", sellerId);

  // Note: profiles.seller_verification_status does not exist in production.
  // Verification status is read from businesses.verification_status (updated above).

  // Get seller's email and name for the notification
  const { data: sellerUser } = await supabaseAdmin.auth.admin.getUserById(sellerId);
  const sellerEmail = String(sellerUser?.user?.email ?? "").trim();
  const { data: sellerProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, display_name")
    .eq("id", sellerId)
    .maybeSingle();
  const sellerName =
    String((sellerProfile as any)?.full_name ?? (sellerProfile as any)?.display_name ?? "").trim() || "Seller";

  // Send approval email via notify function (fire-and-forget, don't fail approval if email fails)
  if (sellerEmail && internalSecret) {
    try {
      const notifyUrl = `${supabaseUrl}/functions/v1/notify`;
      await fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({
          event: "seller_approved",
          to_email: sellerEmail,
          to_name: sellerName,
        }),
      });
    } catch (e) {
      // Log but don't fail — the approval itself succeeded
      console.error("[approve-seller] notify failed:", (e as any)?.message);
    }
  }

  return jsonResponse(200, { ok: true, seller_id: sellerId });
});
