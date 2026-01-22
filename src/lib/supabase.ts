// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * ShowMePrice.ng — Supabase client (single instance)
 *
 * IMPORTANT:
 * - In a Vite app, env vars must be prefixed with VITE_
 * - Do NOT export a nullable client; fail fast instead.
 * - Keep createClient in ONE place to avoid multiple GoTrueClient instances.
 */

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

function assertValidConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    // This makes the error obvious instead of looking like CORS/network issues.
    throw new Error(
      "Missing Supabase config. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY exist in your .env and restart `npm run dev`."
    );
  }
  if (!/^https?:\/\//i.test(supabaseUrl)) {
    throw new Error(`Invalid VITE_SUPABASE_URL: "${supabaseUrl}" (must start with http/https).`);
  }
}

assertValidConfig();

const g = globalThis as any;

export const supabase: SupabaseClient =
  g.__SMP_SUPABASE__ ??
  (g.__SMP_SUPABASE__ = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Optional: helps avoid collisions if you ever run multiple projects on same domain
      // storageKey: "smp-auth",
    },
  }));
