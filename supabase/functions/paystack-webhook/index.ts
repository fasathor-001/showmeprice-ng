import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha512Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceKey) {
    return new Response("Missing SERVICE_ROLE_KEY secret", { status: 500 });
  }
  if (!secret || !supabaseUrl) return new Response("Missing env", { status: 500 });

  // MUST verify signature against RAW body
  const rawBody = await req.text();
  const receivedSig = req.headers.get("x-paystack-signature") ?? "";
  const computedSig = await hmacSha512Hex(secret, rawBody);

  if (computedSig !== receivedSig) return new Response("Invalid signature", { status: 401 });

  let evt: any;
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const provider = "paystack";
  const type = String(evt?.event ?? "");
  const event_id = String(evt?.id ?? "");
  const reference = String(evt?.data?.reference ?? "");

  if (!type || !reference) return new Response("OK", { status: 200 });

  const db = createClient(supabaseUrl, serviceKey);

  // Resolve escrow order id (optional but useful)
  const { data: order } = await db
    .from("escrow_orders")
    .select("id, status")
    .eq("paystack_reference", reference)
    .maybeSingle();

  // Insert event; idempotency is enforced by unique index.
  const ins = await db.from("escrow_events").insert({
    provider,
    type,
    event_id,
    reference,
    escrow_order_id: order?.id ?? null,
    payload: evt,
  });

  // If duplicate event => idempotent ACK
  if (ins.error) {
    if (ins.error.code !== "23505") {
      console.error("paystack-webhook:escrow_events insert failed", ins.error);
    }
    return new Response("OK", { status: 200 });
  }

  // Apply state transition only once
  if (type === "charge.success" && reference) {
    const nowIso = new Date().toISOString();
    await db
      .from("escrow_orders")
      .update({ status: "funded", paid_at: nowIso, updated_at: nowIso })
      .eq("paystack_reference", reference)
      .in("status", ["initialized", "pending"]);
  }

  return new Response("OK", { status: 200 });
});
