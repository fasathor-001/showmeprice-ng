import React, { useMemo, useState } from "react";
import { ArrowLeft, Building2, Phone, User2, Store, Save, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useStates } from "../hooks/useStates";

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, business, loading: profileLoading, refresh } = useProfile() as any;
  const { states, loading: statesLoading } = useStates();

  const profileReady = !!user && !profileLoading;
  const userType = profileReady ? String((profile as any)?.user_type ?? "buyer").toLowerCase() : "";
  const isSeller = profileReady && userType === "seller";

  const backTarget = isSeller ? "/my-shop" : "/dashboard";

  const displayName0 = String((profile as any)?.display_name ?? "");
  const fullName0 = String((profile as any)?.full_name ?? "");
  const phone0 = String((profile as any)?.phone ?? "");
  const city0 = String((profile as any)?.city ?? "");
  const address0 = String((profile as any)?.address ?? "");
  const stateId0 = (profile as any)?.state_id ?? "";

  const [displayName, setDisplayName] = useState(displayName0);
  const [fullName, setFullName] = useState(fullName0);
  const [phone, setPhone] = useState(phone0);
  const [city, setCity] = useState(city0);
  const [address, setAddress] = useState(address0);
  const [stateId, setStateId] = useState(stateId0 ? String(stateId0) : "");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const email = String(user?.email ?? "");

  const savePersonal = async () => {
    if (!user?.id) return;
    setErr(null);
    const fullNameClean = fullName.trim();
    const cityClean = city.trim();
    const stateIdNum = Number(stateId);
    if (!fullNameClean) {
      setErr("Full name is required.");
      return;
    }
    if (!cityClean) {
      setErr("City/Area is required.");
      return;
    }
    if (!Number.isFinite(stateIdNum) || stateIdNum <= 0) {
      setErr("State is required.");
      return;
    }
    setSaving(true);
    try {
      const patch: any = {
        display_name: displayName.trim() || fullNameClean,
        full_name: fullNameClean,
        phone: phone.trim() || null,
        city: cityClean,
        state_id: stateIdNum,
        address: address.trim() || null,
      };

      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);

      if (error) {
        // If the DB doesn't have profiles.address yet, retry without it and show a clear message
        const msg = String((error as any)?.message ?? "");
        if (!isSeller && /address/i.test(msg) && /column/i.test(msg)) {
          const { error: e2 } = await supabase
            .from("profiles")
            .update({
              display_name: patch.display_name,
              full_name: patch.full_name,
              phone: patch.phone,
              city: patch.city,
              state_id: patch.state_id,
            })
            .eq("id", user.id);

          if (e2) throw e2;

          setErr(
            "Your database is missing profiles.address. Run the provided SQL migration (add address column), then refresh this page to save address."
          );
          return;
        }
        throw error;
      }

      try {
        await refresh?.();
      } catch {
        // intentionally empty
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const bizName = String((business as any)?.business_name ?? "");
  const bizType = String((business as any)?.business_type ?? "");
  const bizCity = String((business as any)?.city ?? "");
  const bizAddress = String((business as any)?.address ?? "");
  const bizWhatsapp = String((business as any)?.whatsapp_number ?? "");
  const bizPhone = String((business as any)?.phone_number ?? "");

  const title = useMemo(() => {
    return isSeller ? "Seller Profile" : "Profile";
  }, [isSeller]);

  if (user && !profileReady) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="text-lg font-black text-slate-900">Loading your account...</div>
          <div className="text-sm text-slate-600 mt-2">Please wait a moment.</div>
        </div>
      </div>
    );
  }

  const needsName =
    !fullName0.trim() ||
    fullName0.trim().toLowerCase() === "new user" ||
    /^(user|buyer|seller)\s[0-9a-f]{4,}$/i.test(fullName0.trim());
  const needsPhone = !phone0.trim() || phone0.trim().toLowerCase() === "pending";
  const needsCity = !city0.trim() || city0.trim().toLowerCase() === "pending";
  const needsState = !stateId0;
  const missingFields = [
    needsName ? "Full name" : null,
    needsPhone ? "Phone number" : null,
    needsCity ? "City/Area" : null,
    needsState ? "State" : null,
  ].filter(Boolean);

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
          <div className="font-black text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{email}</div>
        </div>
      </div>

      {missingFields.length > 0 ? (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div className="text-sm font-bold">
            Please add: {missingFields.join(", ")}.
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div className="text-sm font-bold">{err}</div>
        </div>
      ) : null}

      {/* Personal */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="font-black text-slate-900">Personal details</div>
          <div className="text-xs text-slate-600">Your public identity</div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <User2 className="w-4 h-4" />
              Display name
            </label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Fanni Okolo"
            />
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">Full name</label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Fanni Okolo"
            />
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">City / Area</label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Lekki, Lagos"
            />
          </div>

          <div>
            <label className="text-sm font-black text-slate-700">State</label>
            <select
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              disabled={statesLoading}
            >
              <option value="">{statesLoading ? "Loading states..." : "Select State"}</option>
              {states.map((s: any) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone number
            </label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 08012345678"
            />
          </div>

          <div>
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {isSeller ? "Business address" : "Address"}
            </label>
            <input
              className="mt-1 w-full p-3 rounded-xl border bg-white"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 12 Admiralty Way, Lekki"
            />
          </div>


          <button
            type="button"
            onClick={savePersonal}
            disabled={saving}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white",
              saving ? "bg-slate-400" : "bg-slate-900 hover:opacity-90"
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save personal details"}
          </button>
        </div>
      </div>

      {/* Business */}
      <div className="bg-white border rounded-2xl overflow-hidden mt-4">
        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="font-black text-slate-900">Business details</div>
            <div className="text-xs text-slate-600">Shown to buyers</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav("/pricing")}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-bold inline-flex items-center gap-2 hover:bg-slate-50"
            >
              Plans & Pricing
            </button>
            <button
              type="button"
              onClick={() => nav("/seller/setup")}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:opacity-90 text-white font-black inline-flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              {isSeller ? "Edit shop details" : "Start selling"}
            </button>
          </div>
        </div>

        <div className="p-4 text-sm text-slate-700 space-y-1">
          <div className="font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {bizName || "Business name not set"}
          </div>
          <div>{bizAddress || "Address not set"}</div>
          <div>{bizType || "Business type not set"}</div>
          <div>{bizCity || "City/Area not set"}</div>
          <div className="pt-2 text-xs text-slate-500">
            WhatsApp: {bizWhatsapp || "--"} | Phone: {bizPhone || "--"}
          </div>
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}

