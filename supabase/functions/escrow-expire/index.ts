import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret || headerSecret !== cronSecret) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing server configuration." });
  }

  let body: { cutoff_minutes?: number } | null = null;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const cutoffMinutes = Number(body?.cutoff_minutes ?? 30);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabaseAdmin.rpc("expire_stale_escrow_orders", {
    cutoff_minutes: cutoffMinutes,
  });
  if (error) {
    return jsonResponse(500, { error: "Failed to expire escrow orders." });
  }

  return jsonResponse(200, { ok: true, expired_count: data ?? 0 });
});
