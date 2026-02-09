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

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

let supabaseUrl = rawSupabaseUrl;
let supabaseAnonKey = rawSupabaseAnonKey;

if (import.meta.env.DEV) {
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
  supabaseAnonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
}

supabaseUrl = supabaseUrl.trim().replace(/\/+$/, "");
supabaseAnonKey = supabaseAnonKey.trim();

if (import.meta.env.DEV) {
  const keySuffix = supabaseAnonKey.length >= 6 ? supabaseAnonKey.slice(-6) : supabaseAnonKey;
  console.log("Supabase URL:", supabaseUrl);
  console.log("Supabase Anon Key Length:", supabaseAnonKey.length);
  console.log("Supabase Anon Key Suffix:", keySuffix);
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

function assertValidConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    const msg =
      "Missing Supabase env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (Vite).";
    if (import.meta.env.PROD) {
      throw new Error(msg);
    }
    throw new Error(msg);
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
      flowType: "pkce",
      storageKey: "smp-auth",
      // Optional: helps avoid collisions if you ever run multiple projects on same domain
      // storageKey: "smp-auth",
    },
  }));
