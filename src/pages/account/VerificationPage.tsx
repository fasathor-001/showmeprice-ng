import React, { useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, Save, Landmark, CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useProfile } from "../../hooks/useProfile";
import { invokeAuthedFunction } from "../../lib/invokeAuthedFunction";
// Note: bank account resolution now goes through resolve-bank-account Edge Function,
// not directly to Paystack — keeps the secret key off the client.

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

  // Bank account fields
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankNotice, setBankNotice] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

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
      } catch {
        // intentionally empty
      }

      try {
        await refresh?.();
      } catch {
        // intentionally empty
      }

      setNotice("Verification submitted. We will review it shortly.");
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit verification.");
    } finally {
      setSaving(false);
    }
  };

  const resolveAccountName = async () => {
    if (!accountNumber || accountNumber.length !== 10 || !bankCode) return;
    setResolving(true);
    setBankError(null);
    try {
      const { data, error } = await invokeAuthedFunction("resolve-bank-account", {
        body: { account_number: accountNumber, bank_code: bankCode },
      });
      if (error) throw error;
      const name = String((data as any)?.account_name ?? "").trim();
      if (!name) throw new Error("Could not resolve account. Check the account number and bank.");
      setAccountName(name);
    } catch (e: any) {
      setBankError(e?.message ?? "Failed to verify account. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  const saveBankAccount = async () => {
    if (!user?.id) return;
    if (!bankCode || !accountNumber || !accountName) {
      setBankError("Please fill in all bank details and resolve the account name.");
      return;
    }
    setBankSaving(true);
    setBankError(null);
    setBankNotice(null);
    try {
      const { error: upErr } = await supabase
        .from("seller_bank_accounts")
        .upsert(
          {
            seller_id: user.id,
            bank_code: bankCode.trim(),
            account_number: accountNumber.trim(),
            account_name: accountName.trim(),
            paystack_recipient_code: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "seller_id" }
        );
      if (upErr) throw upErr;
      setBankNotice("Bank account saved successfully.");
    } catch (e: any) {
      setBankError(e?.message ?? "Failed to save bank account.");
    } finally {
      setBankSaving(false);
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

      {/* Bank account section — required for escrow payouts */}
      <div className="bg-white border rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-slate-500" />
          <h3 className="text-lg font-black text-slate-900">Bank Account for Payouts</h3>
        </div>
        <p className="text-sm text-slate-500">
          Required before escrow funds can be released to you. Your account name will be verified via Paystack.
        </p>

        {bankNotice && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle className="w-4 h-4" /> {bankNotice}
          </div>
        )}
        {bankError && (
          <div className="flex items-center gap-2 text-sm text-rose-700">
            <AlertTriangle className="w-4 h-4" /> {bankError}
          </div>
        )}

        <div>
          <label className="text-sm font-black text-slate-700">Bank</label>
          <select
            className="mt-1 w-full p-3 rounded-xl border bg-white"
            value={bankCode}
            onChange={(e) => { setBankCode(e.target.value); setAccountName(""); }}
          >
            <option value="">Select bank...</option>
            <option value="044">Access Bank</option>
            <option value="023">Citibank</option>
            <option value="050">EcoBank</option>
            <option value="011">First Bank</option>
            <option value="214">First City Monument Bank (FCMB)</option>
            <option value="070">Fidelity Bank</option>
            <option value="058">Guaranty Trust Bank (GTB)</option>
            <option value="030">Heritage Bank</option>
            <option value="301">Jaiz Bank</option>
            <option value="082">Keystone Bank</option>
            <option value="526">Moniepoint MFB</option>
            <option value="057">Zenith Bank</option>
            <option value="076">Polaris Bank</option>
            <option value="101">ProvidusBank</option>
            <option value="221">Stanbic IBTC Bank</option>
            <option value="068">Standard Chartered Bank</option>
            <option value="232">Sterling Bank</option>
            <option value="100">Suntrust Bank</option>
            <option value="032">Union Bank</option>
            <option value="033">United Bank for Africa (UBA)</option>
            <option value="215">Unity Bank</option>
            <option value="035">Wema Bank</option>
            <option value="035A">ALAT by Wema</option>
            <option value="565">Carbon</option>
            <option value="090115">TCF MFB</option>
            <option value="50211">Kuda Bank</option>
            <option value="50515">PalmPay</option>
            <option value="999992">OPay</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-black text-slate-700">Account Number</label>
          <div className="flex gap-2 mt-1">
            <input
              className="flex-1 p-3 rounded-xl border bg-white"
              value={accountNumber}
              maxLength={10}
              onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); setAccountName(""); }}
              placeholder="10-digit NUBAN"
            />
            <button
              type="button"
              onClick={resolveAccountName}
              disabled={resolving || accountNumber.length !== 10 || !bankCode}
              className="px-4 py-2 rounded-xl border font-bold text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
            >
              {resolving ? "Checking..." : "Verify"}
            </button>
          </div>
        </div>

        {accountName && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
            <CheckCircle className="w-4 h-4" /> Account: {accountName}
          </div>
        )}

        <button
          type="button"
          onClick={saveBankAccount}
          disabled={bankSaving || !accountName}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white bg-emerald-700 hover:opacity-90 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {bankSaving ? "Saving..." : "Save Bank Account"}
        </button>
      </div>
    </div>
  );
}
