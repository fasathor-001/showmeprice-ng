import React from "react";
import { Mail, MessageSquare, ShieldCheck, HelpCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

function nav(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new Event("smp:navigate"));
}

export default function HelpPage() {
  const { user } = useAuth();

  const handleInbox = () => {
    if (!user) {
      try {
        sessionStorage.setItem("smp:post_auth_intent", "inbox");
      } catch {
        // intentionally empty
      }
      window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login", reason: "inbox" } }));
      return;
    }
    window.history.pushState({}, "", "/inbox");
    window.dispatchEvent(new Event("smp:navigate"));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">Help</h1>
        <p className="text-sm md:text-base text-slate-600 mt-2">
          Simple tips to buy and sell safely.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-2xl p-5 bg-white">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-slate-700" />
            <div className="font-black text-slate-900">For Buyers</div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Free: Message sellers in the app.</li>
            <li>Pro: Unlock Call and WhatsApp to reach sellers faster.</li>
            <li>Premium: Pay with Escrow for extra protection (small fee applies).</li>
            <li>Institution: Buying for your organisation? Contact us for a custom plan.</li>
          </ul>
          <button
            type="button"
            onClick={() => nav("/pricing")}
            className="mt-5 px-4 py-2 rounded-xl font-black bg-slate-900 text-white hover:opacity-90"
          >
            View plans
          </button>
        </div>

        <div className="border rounded-2xl p-5 bg-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700" />
            <div className="font-black text-slate-900">For Sellers</div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>Post clear photos and a real price.</li>
            <li>Reply fast to chats to close sales.</li>
            <li>Buyers can pay with Escrow - sellers don&apos;t need Premium for that.</li>
            <li>Upgrade your seller plan for more listings and visibility.</li>
          </ul>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleInbox}
              className="py-2 rounded-xl font-black border bg-white hover:bg-slate-50 flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Open Inbox
            </button>
            <a
              className="py-2 rounded-xl font-black bg-emerald-600 text-white hover:opacity-90 flex items-center justify-center gap-2"
              href="mailto:support@showmeprice.ng"
            >
              <Mail className="w-4 h-4" />
              Contact support
            </a>
          </div>
        </div>
      </div>

      <div className="border rounded-2xl p-5 bg-white">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700" />
            <div className="font-black text-slate-900">Safety tips</div>
          </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>Meet in a public place.</li>
          <li>Inspect before you pay.</li>
          <li>Never share OTP or card detail.</li>
        </ul>
      </div>
    </div>
  );
}
