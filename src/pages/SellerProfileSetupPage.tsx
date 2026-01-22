import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Store, Save, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useStates } from "../hooks/useStates";

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
  window.dispatchEvent(new Event("popstate"));
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function safeStr(v: any) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function digitsOnly(s: string) {
  return String(s || "").replace(/\D+/g, "");
}

function normalizeNgPhone(v: string) {
  // Keep Nigerian local style like 080..., 070..., 090..., etc (no +234)
  const d = digitsOnly(v);
  if (!d) return "";
  // If user typed +234XXXXXXXXXX, convert to 0XXXXXXXXXX where possible
  if (d.startsWith("234") && d.length >= 13) return "0" + d.slice(3);
  return d;
}

export default function SellerProfileSetupPage() {
  const { user } = useAuth();
  const { profile, business, refresh } = useProfile() as any;
  const { states, loading: statesLoading } = useStates() as any;

  const userType = String((profile as any)?.user_type ?? "buyer").toLowerCase();
  const isSeller = userType === "seller";

  // Buyers can open this page to become a seller, BUT we only flip user_type on successful save.
  const [showIntro, setShowIntro] = useState(!isSeller);

  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    state_id: "",
    city: "",
    address: "",
    whatsapp: "",
    phone: "",
    description: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const backTarget = isSeller ? "/my-shop" : "/dashboard";

  const stateOptions = useMemo(() => {
    return Array.isArray(states) ? states : [];
  }, [states]);

  // Load existing business (if any)
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setErr(null);
      setLoading(true);

      try {
        // Prefer the business object from useProfile if available
        const b0 = business ?? null;

        let b = b0;
        if (!b) {
          const { data, error } = await supabase
            .from("businesses")
            .select("business_name,business_type,state_id,city,address,whatsapp_number,phone_number,description")
            .eq("user_id", user.id)
            .limit(1);

          if (error) throw error;
          b = (data as any)?.[0] ?? null;
        }

        if (!alive) return;

        if (b) {
          setForm({
            business_name: safeStr(b.business_name),
            business_type: safeStr(b.business_type),
            state_id: b.state_id != null ? String(b.state_id) : "",
            city: safeStr(b.city),
            address: safeStr(b.address),
            whatsapp: safeStr(b.whatsapp_number),
            phone: safeStr(b.phone_number),
            description: safeStr(b.description),
          });
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load business details.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const validate = () => {
    const f = form;
    if (!safeStr(f.business_name)) return "Business name is required.";
    if (!safeStr(f.business_type)) return "Business type is required.";
    if (!safeStr(f.state_id)) return "State is required.";
    if (!safeStr(f.city)) return "City/Area is required.";
    if (!safeStr(f.address)) return "Address is required.";
    if (!safeStr(f.whatsapp)) return "WhatsApp number is required.";
    return null;
  };

  const save = async () => {
    if (!user?.id) {
      setErr("Please sign in to complete seller setup.");
      return;
    }

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setErr(null);
    setSaved(false);
    setSaving(true);

    try {
      const payload: any = {
        user_id: user.id,
        owner_id: user.id,
        business_name: safeStr(form.business_name) || null,
        business_type: safeStr(form.business_type) || null,
        state_id: form.state_id ? Number(form.state_id) : null,
        city: safeStr(form.city) || null,
        address: safeStr(form.address) || null,
        whatsapp_number: normalizeNgPhone(form.whatsapp) || null,
        phone_number: normalizeNgPhone(form.phone) || null,
        description: safeStr(form.description) || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("businesses").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      // Now that setup is saved, flip the profile to seller (idempotent)
      const { error: pErr } = await supabase.from("profiles").update({ user_type: "seller" }).eq("id", user.id);
      if (pErr) throw pErr;

      try {
        await supabase.auth.updateUser({ data: { user_type: "seller" } });
      } catch {}

      setSaved(true);

      try {
        await refresh?.();
      } catch {
        window.location.reload();
        return;
      }

      // Seller is active after successful save
      nav("/my-shop");
    } catch (e: any) {
      setErr(e?.message || "Failed to save setup.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border rounded-2xl p-5">
          <div className="font-black text-slate-900 text-lg">Sign in required</div>
          <div className="text-sm text-slate-600 mt-1">Please sign in to complete seller setup.</div>
          <div className="mt-4">
            <button
              type="button"
              className="px-4 py-3 rounded-xl bg-slate-900 text-white font-black hover:opacity-90"
              onClick={() => nav("/")}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Optional intro for buyers so they understand they won't become a seller until they save.
  if (showIntro && !isSeller) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => nav("/dashboard")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 font-black"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-right">
            <div className="font-black text-slate-900">Become a Seller</div>
            <div className="text-xs text-slate-500">Your buyer account stays as-is until you save</div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-slate-900 text-lg">Set up your shop</div>
              <div className="text-sm text-slate-600 mt-1">
                Fill your business details. You become a seller only after you <span className="font-black">save</span>.
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="px-4 py-3 rounded-xl bg-slate-900 text-white font-black hover:opacity-90"
                  onClick={() => setShowIntro(false)}
                >
                  Continue
                </button>
                <button
                  type="button"
                  className="px-4 py-3 rounded-xl border bg-white font-black hover:bg-slate-50"
                  onClick={() => nav("/dashboard")}
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => nav(backTarget)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 font-black"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-right">
          <div className="font-black text-slate-900">Seller setup</div>
          <div className="text-xs text-slate-500">Complete your business details</div>
        </div>
      </div>

      {err ? (
        <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div className="text-sm font-bold">{err}</div>
        </div>
      ) : null}

      {saved ? (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900">
          <CheckCircle2 className="w-5 h-5" />
          <div className="text-sm font-black">Saved. Redirecting...</div>
        </div>
      ) : null}

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="font-black text-slate-900">Business details</div>
          <div className="text-xs text-slate-600">Shown to buyers</div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-sm font-black text-slate-700">Business name *</label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={form.business_name}
              onChange={(e) => setForm((s) => ({ ...s, business_name: e.target.value }))}
              placeholder="e.g. Okolo Fashion World"
            />
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">Business type *</label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={form.business_type}
              onChange={(e) => setForm((s) => ({ ...s, business_type: e.target.value }))}
              placeholder="e.g. Fashion, Phones, Furniture"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-black text-slate-700">State *</label>
              <select
                className="mt-1 w-full p-3 rounded-xl border bg-white"
                value={form.state_id}
                onChange={(e) => setForm((s) => ({ ...s, state_id: e.target.value }))}
                disabled={statesLoading}
              >
                <option value="">{statesLoading ? "Loading..." : "Select state"}</option>
                {stateOptions.map((st: any) => (
                  <option key={String(st.id)} value={String(st.id)}>
                    {String(st.name ?? st.state_name ?? "")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">City/Area *</label>
              <input
                className="mt-1 w-full p-3 rounded-xl border bg-white"
                value={form.city}
                onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                placeholder="e.g. Ikeja"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">Address *</label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              placeholder="e.g. 823 Okumgba Road, Warri"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-black text-slate-700">WhatsApp number *</label>
              <input
                className="mt-1 w-full p-3 rounded-xl border bg-white"
                value={form.whatsapp}
                onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value }))}
                placeholder="e.g. 08012345678"
              />
            </div>

            <div>
              <label className="text-sm font-black text-slate-700">Phone number</label>
              <input
                className="mt-1 w-full p-3 rounded-xl border bg-white"
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="e.g. 07012345678"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">Description</label>
            <textarea
              className="mt-1 w-full p-3 rounded-xl border bg-white min-h-[96px]"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Optional short bio about your shop…"
            />
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white",
              saving || loading ? "bg-slate-400" : "bg-slate-900 hover:opacity-90"
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save & Activate Seller Account"}
          </button>
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}
