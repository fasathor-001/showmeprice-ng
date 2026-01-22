import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RevokePayload = {
  email?: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(input: string) {
  return String(input ?? "").trim().toLowerCase();
}

async function findUserByEmail(supabaseAdmin: any, email: string) {
  const adminApi: any = supabaseAdmin?.auth?.admin;
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await adminApi.listUsers({ page, perPage });
    if (error) {
      throw new Error(error?.message ?? "User lookup failed");
    }
    const users = data?.users ?? [];
    const match = users.find((u: any) => String(u?.email ?? "").toLowerCase() === email);
    if (match?.id) return match;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

  if (!serviceRoleKey) {
    return jsonResponse(500, { error: "SERVICE_ROLE_KEY not set in Supabase secrets" });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, { error: "Supabase configuration missing." });
  }

  let payload: RevokePayload;
  try {
    payload = (await req.json()) as RevokePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid payload" });
  }

  const email = normalizeEmail(payload?.email ?? "");
  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Invalid email" });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Missing Authorization" });
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing Authorization" });
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

  const callerId = userData.user.id;
  const { data: adminRows, error: adminErr } = await supabaseAdmin
    .from("profiles")
    .select("id,role")
    .eq("id", callerId)
    .limit(1);

  if (adminErr) {
    return jsonResponse(500, { error: "Admin check failed", details: adminErr?.message });
  }
  const profileRole = String(adminRows?.[0]?.role ?? "").toLowerCase();
  if (profileRole !== "admin") {
    return jsonResponse(403, { error: "Forbidden" });
  }

  let targetUserId = "";
  let existingAppMeta: Record<string, unknown> = {};
  let existingUserMeta: Record<string, unknown> = {};
  try {
    const targetUser = await findUserByEmail(supabaseAdmin, email);
    if (targetUser?.id) {
      targetUserId = String(targetUser.id);
      existingAppMeta = (targetUser?.app_metadata ?? {}) as Record<string, unknown>;
      existingUserMeta = (targetUser?.user_metadata ?? {}) as Record<string, unknown>;
    }
  } catch (e: any) {
    return jsonResponse(500, { error: "User lookup failed", details: e?.message });
  }

  if (!targetUserId) {
    return jsonResponse(404, { error: "User not found" });
  }

  if (targetUserId === callerId) {
    return jsonResponse(400, { error: "cannot revoke self" });
  }

  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { ...existingAppMeta, role: "user" },
    user_metadata: { ...existingUserMeta, role: "user" },
  });
  if (metaErr) {
    return jsonResponse(500, { error: "Failed to update user role", details: metaErr?.message });
  }

  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({ role: "user" })
    .eq("id", targetUserId);
  if (profileErr) {
    return jsonResponse(500, { error: "Profile update failed", details: profileErr?.message });
  }

  return jsonResponse(200, { ok: true });
});
