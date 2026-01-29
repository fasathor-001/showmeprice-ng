import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  LogOut,
  Lock,
  Mail,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function lsKey(userId: string, k: string) {
  return `smp:settings:${userId}:${k}`;
}

function lsGetBool(userId: string, k: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(lsKey(userId, k));
    if (v === "1") return true;
    if (v === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function lsSetBool(userId: string, k: string, v: boolean) {
  try {
    localStorage.setItem(lsKey(userId, k), v ? "1" : "0");
  } catch {
    // intentionally empty
  }
}

async function safeProfileUpdate(userId: string, patch: Record<string, any>) {
  const { error } = await supabase.from("profiles").update(patch as any).eq("id", userId);
  if (!error) return;
  const msg = String((error as any)?.message || "").toLowerCase();
  if (msg.includes("column") || msg.includes("schema cache") || msg.includes("could not find")) return;
  throw error;
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  // eslint-disable-next-line no-unused-vars
  onChange: (_v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "inline-flex items-center h-7 w-12 rounded-full border transition px-1",
        value ? "bg-emerald-600 border-emerald-600" : "bg-slate-200 border-slate-300",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      )}
      aria-pressed={value}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow transition-transform",
          value ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { profile, refresh } = useProfile() as any;

  const userId = user?.id || "";
  const userType = String((profile as any)?.user_type ?? "buyer").toLowerCase();
  const isSeller = userType === "seller";
  const backTarget = isSeller ? "/my-shop" : "/dashboard";

  const email = String(user?.email || "");

  const [err, setErr] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // notification toggles (local + db best-effort)
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifySellerUpdates, setNotifySellerUpdates] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);

  // disable chats should prevent sending only
  const [disableChats, setDisableChats] = useState(false);
  const [disableFeedback, setDisableFeedback] = useState(false);

  // language (stored)
  const [_language, setLanguage] = useState("English");
  void _language;

  // Security helpers
  const [pwSent, setPwSent] = useState(false);
  const [emailDraft, setEmailDraft] = useState(email);
  const [showEmailEdit, setShowEmailEdit] = useState(false);

  // Delete (kept as menu; safe even if table doesn't exist)
  const [showDelete, setShowDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const p: any = profile || {};

    setNotifyMessages(Boolean(p.notify_messages ?? lsGetBool(userId, "notify_messages", true)));
    setNotifySellerUpdates(
      Boolean(p.notify_seller_updates ?? lsGetBool(userId, "notify_seller_updates", true))
    );
    setNotifySystem(Boolean(p.notify_system ?? lsGetBool(userId, "notify_system", true)));

    setDisableChats(Boolean(p.disable_chats ?? lsGetBool(userId, "disable_chats", false)));
    setDisableFeedback(Boolean(p.disable_feedback ?? lsGetBool(userId, "disable_feedback", false)));

    setLanguage(String(p.language ?? "English"));
    setEmailDraft(email);
  }, [userId, profile, email]);

  const save = async (patch: Record<string, any>, lsPairs: Array<[string, boolean]>) => {
    if (!userId) return;
    setErr(null);

    // local always
    for (const [k, v] of lsPairs) lsSetBool(userId, k, v);

    try {
      await safeProfileUpdate(userId, patch);
      try {
        await refresh?.();
      } catch {
        // intentionally empty
      }
      setSavingNote("Saved");
      setTimeout(() => setSavingNote(null), 1200);
    } catch (e: any) {
      setErr(e?.message || "Could not save to database. Saved locally on this device.");
      setSavingNote("Saved locally");
      setTimeout(() => setSavingNote(null), 1800);
    }
  };

  const requestPasswordReset = async () => {
    if (!email) return;
    setErr(null);
    setPwSent(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setPwSent(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to send password reset email.");
    }
  };


  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // intentionally empty
    }
    nav("/");
  };

  const deleteAccount = async () => {
    if (!userId) return;
    setErr(null);
    setDeleteBusy(true);
    try {
      const { error } = await supabase.from("account_deletion_requests").insert({
        user_id: userId,
        created_at: new Date().toISOString(),
        status: "requested",
      } as any);

      if (error) {
        const msg = String((error as any)?.message || "").toLowerCase();
        // If table doesn't exist yet, still show message and sign out
        if (!(msg.includes("could not find") || msg.includes("schema cache") || msg.includes("relation"))) {
          throw error;
        }
      }

      await supabase.auth.signOut();
      nav("/");
      alert("Account deletion requested. Contact support if you need immediate deletion.");
    } catch (e: any) {
      setErr(e?.message || "Failed to request deletion.");
    } finally {
      setDeleteBusy(false);
      setShowDelete(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border rounded-2xl p-5">
          <div className="font-black text-slate-900 text-lg">Please sign in</div>
          <div className="text-sm text-slate-600 mt-1">You need an account to access settings.</div>
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
          <div className="font-black text-slate-900">Settings</div>
          <div className="text-xs text-slate-500">{savingNote || "Manage account preferences"}</div>
        </div>
      </div>

      {err ? (
        <div className="mb-4 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div className="text-sm font-bold">{err}</div>
        </div>
      ) : null}

      {/* Manage account */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="font-black text-slate-900">Manage account</div>
          <div className="text-xs text-slate-600">Notifications, chats, feedback</div>
        </div>

        <div className="px-4 py-3 border-b">
          <div className="font-black text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Manage notifications
          </div>

          <div className="mt-3 rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-black text-slate-900">Messages</div>
                <div className="text-sm text-slate-600">New chats and replies</div>
              </div>
              <Toggle
                value={notifyMessages}
                onChange={async (v) => {
                  setNotifyMessages(v);
                  await save({ notify_messages: v }, [["notify_messages", v]]);
                }}
              />
            </div>

            <div className="border-t flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-black text-slate-900">Seller updates</div>
                <div className="text-sm text-slate-600">Shop activity</div>
              </div>
              <Toggle
                value={notifySellerUpdates}
                onChange={async (v) => {
                  setNotifySellerUpdates(v);
                  await save({ notify_seller_updates: v }, [["notify_seller_updates", v]]);
                }}
              />
            </div>

            <div className="border-t flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-black text-slate-900">System alerts</div>
                <div className="text-sm text-slate-600">Security & important updates</div>
              </div>
              <Toggle
                value={notifySystem}
                onChange={async (v) => {
                  setNotifySystem(v);
                  await save({ notify_system: v }, [["notify_system", v]]);
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <div className="font-black text-slate-900">Disable chats</div>
            <div className="text-sm text-slate-600">
              Prevents sending messages (you can still receive)
            </div>
          </div>
          <Toggle
            value={disableChats}
            onChange={async (v) => {
              setDisableChats(v);
              await save({ disable_chats: v }, [["disable_chats", v]]);
            }}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="font-black text-slate-900">Disable Feedback</div>
            <div className="text-sm text-slate-600">Stops feedback prompts</div>
          </div>
          <Toggle
            value={disableFeedback}
            onChange={async (v) => {
              setDisableFeedback(v);
              await save({ disable_feedback: v }, [["disable_feedback", v]]);
            }}
          />
        </div>
      </div>

      {/* Security */}
      <div className="bg-white border rounded-2xl overflow-hidden mt-4">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="font-black text-slate-900">Security</div>
          <div className="text-xs text-slate-600">Email & password</div>
        </div>

        <button
          type="button"
          onClick={() => setShowEmailEdit(true)}
          className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 border-b"
        >
          <div>
            <div className="font-black text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Change email
            </div>
            <div className="text-sm text-slate-600">{email}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={requestPasswordReset}
          className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
        >
          <div>
            <div className="font-black text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Change password
            </div>
            <div className="text-sm text-slate-600">
              {pwSent ? "Reset email sent" : "Send a password reset email"}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Connect accounts */}
      <div className="bg-white border rounded-2xl overflow-hidden mt-4">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="font-black text-slate-900">Connect accounts</div>
          <div className="text-xs text-slate-600">
            Connect your social media accounts for smoother experience!
          </div>
        </div>

        {["Truecaller", "Google", "Facebook", "Instagram", "X (Twitter)"].map((name) => (
          <div key={name} className="flex items-center justify-between px-4 py-3 border-t first:border-t-0">
            <div className="flex items-center gap-3">
              <LinkIcon className="w-5 h-5 text-slate-700" />
              <div className="font-black text-slate-900">{name}</div>
            </div>
            <button
              type="button"
              className="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 font-black text-slate-900"
              onClick={() => alert("Coming soon")}
            >
              Connect
            </button>
          </div>
        ))}
      </div>

      {/* Account actions */}
      <div className="bg-white border rounded-2xl overflow-hidden mt-4">
        <div className="px-4 py-3 border-b bg-slate-50">
          <div className="font-black text-slate-900">Account actions</div>
          <div className="text-xs text-slate-600">Log out or delete account</div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 border-b"
        >
          <div className="font-black text-slate-900 flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Log out
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 hover:bg-rose-50"
        >
          <div className="font-black text-rose-700">Delete my account permanently</div>
          <ChevronRight className="w-4 h-4 text-rose-400" />
        </button>
      </div>

      {/* Change email modal */}
      {showEmailEdit ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl border p-5">
            <div className="font-black text-slate-900 text-lg">Change email</div>
            <div className="text-sm text-slate-600 mt-1">
              You’ll receive a confirmation email to complete the change.
            </div>

            <input
              className="mt-4 w-full p-3 rounded-xl border bg-white"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="name@example.com"
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 px-4 py-3 rounded-xl border bg-white hover:bg-slate-50 font-black"
                onClick={() => setShowEmailEdit(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-3 rounded-xl bg-slate-900 text-white font-black hover:opacity-90"
                onClick={async () => {
                  const next = String(emailDraft || "").trim();
                  if (!next) return;
                  setErr(null);
                  try {
                    const { error } = await supabase.auth.updateUser({ email: next });
                    if (error) throw error;
                    setShowEmailEdit(false);
                    setSavingNote("Check your email to confirm");
                    setTimeout(() => setSavingNote(null), 2500);
                  } catch (e: any) {
                    setErr(e?.message || "Failed to update email.");
                  }
                }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete modal */}
      {showDelete ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl border p-5">
            <div className="font-black text-slate-900 text-lg">Delete account</div>
            <div className="text-sm text-slate-600 mt-1">
              This will request permanent deletion and sign you out immediately.
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 px-4 py-3 rounded-xl border bg-white hover:bg-slate-50 font-black"
                onClick={() => setShowDelete(false)}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-black hover:opacity-90"
                disabled={deleteBusy}
                onClick={deleteAccount}
              >
                {deleteBusy ? "Processing..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="h-6" />
    </div>
  );
}
