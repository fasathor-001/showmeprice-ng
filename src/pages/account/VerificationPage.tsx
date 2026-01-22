import React, { useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../hooks/useProfile";

function nav(to: string) {
  try {
    if (window.location.pathname !== to) window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("smp:navigate"));
  } catch {
    window.location.href = to;
  }
}

export default function VerificationPage() {
  const { user } = useAuth();
  const { profile, business, loading: profileLoading, refresh } = useProfile() as any;

  const userType = String((profile as any)?.user_type ?? "").toLowerCase();
  const isSeller = user && userType === "seller";
  const status = String((profile as any)?.seller_verification_status ?? "unverified").toLowerCase();

  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idImageUrl, setIdImageUrl] = useState("");
  const [selfieImageUrl, setSelfieImageUrl] = useState("");
  const [cacNumber, setCacNumber] = useState("");
  const [businessName, setBusinessName] = useState(String((business as any)?.business_name ?? ""));
  const [businessAddress, setBusinessAddress] = useState(String((business as any)?.address ?? ""));
  const [socialLinks, setSocialLinks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statusLabel = useMemo(() => {
    if (status === "verified") return "Verified";
    if (status === "pending") return "Pending";
    if (status === "rejected") return "Rejected";
    return "Unverified";
  }, [status]);

  const submit = async () => {
    if (!user?.id) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const payload = {
        seller_id: user.id,
        status: "pending",
        submitted_at: new Date().toISOString(),
        id_type: idType.trim() || null,
        id_number: idNumber.trim() || null,
        id_image_url: idImageUrl.trim() || null,
        selfie_image_url: selfieImageUrl.trim() || null,
        cac_number: cacNumber.trim() || null,
        business_name: businessName.trim() || null,
        business_address: businessAddress.trim() || null,
        social_links: socialLinks.trim() ? { raw: socialLinks.trim() } : null,
        updated_at: new Date().toISOString(),
      };

      const { error: upErr } = await supabase
        .from("seller_verifications")
        .upsert(payload, { onConflict: "seller_id" });
      if (upErr) throw upErr;

      try {
        await supabase
          .from("businesses")
          .update({ verification_status: "pending", updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } catch {}

      try {
        await refresh?.();
      } catch {}

      setNotice("Verification submitted. We will review it shortly.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit verification.");
    } finally {
      setSaving(false);
    }
  };

  if (user && profileLoading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="text-lg font-black text-slate-900">Loading your account...</div>
          <div className="text-sm text-slate-600 mt-2">Please wait a moment.</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="text-lg font-black text-slate-900">Sign in required</div>
          <div className="text-sm text-slate-600 mt-2">Please sign in to continue.</div>
          <button
            type="button"
            onClick={() => nav("/signin")}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-white font-bold"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <div className="text-lg font-black text-slate-900">Seller verification</div>
          <div className="text-sm text-slate-600 mt-2">
            Verification is available for seller accounts only.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Seller Verification</h2>
          <p className="text-sm text-slate-600">Status: {statusLabel}</p>
        </div>
        <ShieldCheck className="w-8 h-8 text-slate-400" />
      </div>

      {notice ? <div className="text-sm text-emerald-700">{notice}</div> : null}
      {error ? (
        <div className="text-sm text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      ) : null}

      <div className="bg-white border rounded-2xl p-5 space-y-3">
        <div>
          <label className="text-sm font-black text-slate-700">ID type</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
            placeholder="e.g. NIN, Driver's License"
          />
        </div>
        <div>
          <label className="text-sm font-black text-slate-700">ID number</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="ID number"
          />
        </div>
        <div>
          <label className="text-sm font-black text-slate-700">ID image URL</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={idImageUrl}
            onChange={(e) => setIdImageUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div>
          <label className="text-sm font-black text-slate-700">Selfie image URL</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={selfieImageUrl}
            onChange={(e) => setSelfieImageUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div>
          <label className="text-sm font-black text-slate-700">CAC number (optional)</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={cacNumber}
            onChange={(e) => setCacNumber(e.target.value)}
            placeholder="CAC number"
          />
        </div>
        <div>
          <label className="text-sm font-black text-slate-700">Business name</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name"
          />
        </div>
        <div>
          <label className="text-sm font-black text-slate-700">Business address</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            placeholder="Business address"
          />
        </div>
        <div>
          <label className="text-sm font-black text-slate-700">Social links (optional)</label>
          <input
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={socialLinks}
            onChange={(e) => setSocialLinks(e.target.value)}
            placeholder="Instagram, website, etc"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white bg-slate-900 hover:opacity-90 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? "Submitting..." : "Submit for verification"}
        </button>
      </div>
    </div>
  );
}
