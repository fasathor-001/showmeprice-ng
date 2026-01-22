import React from "react";
import { useMembership } from "../hooks/useMembership";
import { useAuth } from "../hooks/useAuth";
import { usePayment } from "../hooks/usePayment";
import { useProfile } from "../hooks/useProfile";
import { getAccountStatus } from "../lib/userRole";
import { buyerPlans, formatNaira, getRecommendedPlan, sellerPlans } from "../lib/plans";
import SEO from "../components/common/SEO";
import { ArrowRight } from "lucide-react";

interface PricingPageProps {
  onNavigateHome: () => void;
  pricingReason?: string | null;
  userType?: string | null;
}

export default function PricingPage({ onNavigateHome, pricingReason, userType }: PricingPageProps) {
  const { user } = useAuth();
  const { isPremium, isPro, isInstitution, loading, tier } = useMembership();
  const { error } = usePayment();
  const { profile, business, loading: profileLoading } = useProfile() as any;
  const profileLoaded = !!user && !profileLoading;
  const hasBusiness = profileLoaded && !!(business as any)?.id;
  const isAdminRole = profileLoaded && String((profile as any)?.role ?? "").toLowerCase() === "admin";
  const accountStatus = getAccountStatus({
    profile,
    user,
    hasBusiness,
    isAdminRole,
    profileLoaded,
  });
  const urlParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlView = urlParams?.get("view") || urlParams?.get("role");
  const urlReason = urlParams?.get("reason");
  const viewParam = urlView === "buyer" || urlView === "seller" ? urlView : null;
  if (user && !viewParam && !accountStatus.ready) {
    return (
      <div className="container mx-auto px-4 py-12 animate-view">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="text-2xl font-black text-slate-900">Pricing</div>
          <div className="text-sm text-slate-600 mt-2">Loading plans...</div>
        </div>
        <div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="h-5 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-10 w-32 bg-slate-100 rounded mt-4 animate-pulse" />
              <div className="h-4 w-40 bg-slate-100 rounded mt-4 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const resolvedUserType = String(viewParam || userType || accountStatus.effectiveType || (user ? "" : "buyer")).toLowerCase();
  const pricingUserType = resolvedUserType === "admin" ? "buyer" : resolvedUserType || "buyer";
  const isSeller = pricingUserType === "seller";
  const plans = isSeller ? sellerPlans : buyerPlans;
  const resolvedReason = pricingReason ?? urlReason;
  const recommendedPlanRaw = getRecommendedPlan(resolvedReason, pricingUserType as any);
  const recommendedPlan =
    resolvedReason === "limits" && isSeller
      ? tier === "pro"
        ? "premium"
        : "pro"
      : recommendedPlanRaw;

  const freePlan = plans.find((plan) => plan.key === "free");
  const proPlan = plans.find((plan) => plan.key === "pro");
  const premiumPlan = plans.find((plan) => plan.key === "premium");
  const institutionPlan = plans.find((plan) => plan.key === "institution");

  const PaymentButton = () => {
    const { initiatePremiumUpgrade, processing } = usePayment();
    const [payError, setPayError] = React.useState<string | null>(null);

    const loadPaystack = () =>
      new Promise<void>((resolve, reject) => {
        const existing = (window as any).PaystackPop?.setup;
        if (existing) return resolve();

        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Paystack script."));
        document.body.appendChild(script);
      });

    const triggerPayment = async () => {
      setPayError(null);
      if (!user) {
        (window as any).openAuthModal?.();
        return;
      }

      if (!premiumPlan) {
        const msg = "Premium plan details are unavailable. Please refresh and try again.";
        console.error("[pricing] missing premium plan", { premiumPlan });
        setPayError(msg);
        return;
      }

      const publicKey = (import.meta as any)?.env?.VITE_PAYSTACK_PUBLIC_KEY;
      if (!publicKey) {
        const msg = "Payment is not configured. Please contact support.";
        console.error("[pricing] missing VITE_PAYSTACK_PUBLIC_KEY");
        setPayError(msg);
        return;
      }

      const userEmail = String(user?.email ?? "").trim();
      if (!userEmail) {
        const msg = "Your account is missing an email. Please update your profile.";
        console.error("[pricing] missing user email");
        setPayError(msg);
        return;
      }

      const { config, handleSuccess, handleClose } = await initiatePremiumUpgrade(() => {
        alert("Welcome to Premium! Your account has been upgraded.");
        window.location.reload();
      });

      try {
        if (!(window as any).PaystackPop?.setup) {
          await loadPaystack();
        }

        if (!(window as any).PaystackPop?.setup) {
          const msg = "Payment gateway failed to load. Please try again.";
          console.error("[pricing] PaystackPop missing after load");
          setPayError(msg);
          return;
        }

        // @ts-ignore
        const handler = (window as any).PaystackPop.setup({
          ...config,
          callback: handleSuccess,
          onClose: handleClose,
        });

        if (handler) {
          handler.openIframe();
        } else {
          const msg = "Unable to start payment. Please try again.";
          console.error("[pricing] Paystack handler unavailable");
          setPayError(msg);
        }
      } catch (err: any) {
        const msg = err?.message ?? "Payment gateway error. Please try again.";
        console.error("[pricing] paystack init failed", err);
        setPayError(msg);
      }
    };

    return (
      <div>
        <button
          onClick={triggerPayment}
          disabled={processing}
          className="w-full py-3 rounded-xl font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition shadow-lg flex items-center justify-center gap-2"
        >
          {processing ? "Processing..." : "Upgrade"} <ArrowRight />
        </button>
        {payError ? <div className="mt-2 text-xs text-rose-600">{payError}</div> : null}
      </div>
    );
  };

  const openAuthModal = () => {
    (window as any).openAuthModal?.();
  };

  const showCurrent = (plan: "free" | "pro" | "premium") => {
    if (isInstitution) return false;
    if (plan === "premium") return isPremium;
    if (plan === "pro") return isPro;
    return !isPro && !isPremium;
  };

  const renderStandardFeature = (text: string) => {
    const disabled = /^no\s/i.test(text);
    return (
      <li key={text} className={`flex items-start gap-3 text-sm ${disabled ? "text-slate-400" : "text-slate-700"}`}>
        <div className={`${disabled ? "bg-slate-100 text-slate-400" : "bg-green-100 text-green-600"} rounded-full p-1`}>
          <ArrowRight />
        </div>
        {text}
      </li>
    );
  };

  const renderPremiumFeature = (text: string, highlight = false) => (
    <li key={text} className={`flex items-start gap-3 text-sm ${highlight ? "text-white" : "text-slate-300"}`}>
      <div
        className={`rounded-full p-1 ${highlight ? "bg-amber-400 text-amber-900" : "bg-slate-700 text-slate-300"}`}
      >
        <ArrowRight />
      </div>
      {highlight ? <span className="font-bold">{text}</span> : text}
    </li>
  );

  return (
    <div className="container mx-auto px-4 py-12 animate-view">
      <SEO
        title="Pricing & Membership"
        description={
          isSeller
            ? "Seller plans for ShowMePrice.ng."
            : "Buyer plans for ShowMePrice.ng with escrow and contact access."
        }
      />

      <div className="text-center max-w-2xl mx-auto mb-12">
        <button
          onClick={onNavigateHome}
          className="text-sm text-brand font-bold hover:underline mb-4 flex items-center justify-center gap-1"
        >
          <ArrowRight /> Back to Marketplace
        </button>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
          {isSeller ? "Pick a seller plan" : "Pick a buyer plan"}
        </h1>
        <p className="text-slate-600 text-lg">
          {isSeller
            ? "Plans that grow your listings and visibility."
            : "Plans that unlock seller contact and escrow."}
        </p>
        {error && <p className="text-red-500 font-bold mt-4">{error}</p>}
      </div>

      <div className={`grid grid-cols-1 gap-6 max-w-6xl mx-auto ${isSeller ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
        {/* Free Plan */}
        <div
          className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col relative overflow-hidden ${
            recommendedPlan === "free" ? "ring-2 ring-amber-300" : ""
          }`}
        >
          {recommendedPlan === "free" ? (
            <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
              Recommended
            </div>
          ) : null}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900">{freePlan?.label ?? "Free"}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-black text-slate-900">Free</span>
              <span className="text-slate-500">/ forever</span>
            </div>
            <p className="text-slate-500 text-sm mt-2">{freePlan?.description ?? "Great for starters."}</p>
          </div>

          <ul className="space-y-4 mb-8 flex-1">
            {(freePlan?.features ?? []).map(renderStandardFeature)}
          </ul>

          <div className="mt-auto">
            {showCurrent("free") ? (
              <button className="w-full py-3 rounded-xl font-bold text-slate-700 bg-slate-100 border border-slate-200 cursor-default">
                Your Current Plan
              </button>
            ) : (
              <button className="w-full py-3 rounded-xl font-bold text-slate-500 bg-slate-100 cursor-not-allowed">
                Current: {tier === "institution" ? "Institution" : tier}
              </button>
            )}
          </div>
        </div>

        {/* Pro Plan */}
        <div
          className={`bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col relative overflow-hidden ${
            recommendedPlan === "pro" ? "ring-2 ring-amber-300" : ""
          }`}
        >
          {recommendedPlan === "pro" ? (
            <div className="absolute top-4 right-4 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
              Recommended
            </div>
          ) : null}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900">{proPlan?.label ?? "Pro"}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-black text-slate-900">
                {proPlan?.priceMonthly ? formatNaira(proPlan.priceMonthly) : "Contact us"}
              </span>
              <span className="text-slate-500">/ month</span>
            </div>
            <p className="text-slate-500 text-sm mt-2">{proPlan?.description ?? "Unlock direct contact."}</p>
          </div>

          <ul className="space-y-4 mb-8 flex-1">
            {(proPlan?.features ?? []).map(renderStandardFeature)}
          </ul>

          <div className="mt-auto">
            {loading ? (
              <div className="w-full py-3 rounded-xl bg-slate-100 animate-pulse"></div>
            ) : showCurrent("pro") ? (
              <button className="w-full py-3 rounded-xl font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 cursor-default">
                Active Plan
              </button>
            ) : !user ? (
              <button
                onClick={openAuthModal}
                className="w-full py-3 rounded-xl font-bold text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Sign In to Upgrade
              </button>
            ) : (
              <button
                onClick={() => {
                  window.location.href =
                    "mailto:support@showmeprice.ng?subject=Upgrade%20to%20Pro&body=Hi%20ShowMePrice%2C%20I%20want%20to%20upgrade%20to%20Pro.";
                }}
                className="w-full py-3 rounded-xl font-bold text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>

        {/* Premium Plan */}
        <div
          className={`bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700 p-8 shadow-xl flex flex-col relative overflow-hidden ${
            recommendedPlan === "premium" ? "ring-2 ring-amber-400" : ""
          }`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ArrowRight />
          </div>

          <div className="mb-6 relative z-10">
            {recommendedPlan === "premium" ? (
              <div className="bg-amber-400 text-amber-900 text-xs font-black px-3 py-1 rounded-full inline-block mb-3 uppercase tracking-wider">
                Recommended
              </div>
            ) : null}
            <h3 className="text-xl font-bold text-white">{premiumPlan?.label ?? "Premium"}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-black text-white">
                {premiumPlan?.priceMonthly ? formatNaira(premiumPlan.priceMonthly) : "Contact us"}
              </span>
              <span className="text-slate-400">/ month</span>
            </div>
            <p className="text-slate-300 text-sm mt-2">
              {premiumPlan?.description ?? "Escrow unlocked with discounted fees."}
            </p>
          </div>

          <ul className="space-y-4 mb-8 flex-1 relative z-10">
            {(premiumPlan?.features ?? []).map((feature, index) => renderPremiumFeature(feature, index === 0))}
          </ul>

          <div className="mt-auto relative z-10">
            {loading ? (
              <div className="w-full py-3 rounded-xl bg-white/10 animate-pulse"></div>
            ) : !user ? (
              <button
                onClick={openAuthModal}
                className="w-full py-3 rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100 transition shadow-lg"
              >
                Sign In to Upgrade
              </button>
            ) : isPremium ? (
              <button className="w-full py-3 rounded-xl font-bold text-green-800 bg-green-100 flex items-center justify-center gap-2 cursor-default">
                <ArrowRight /> Active Membership
              </button>
            ) : (
              <PaymentButton />
            )}
            <p className="text-center text-xs text-slate-500 mt-3">Secure payment via Paystack</p>
          </div>
        </div>

        {!isSeller ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col relative overflow-hidden">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900">{institutionPlan?.label ?? "Institution"}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-slate-900">Enterprise</span>
                <span className="text-slate-500">/ custom</span>
              </div>
              <p className="text-slate-500 text-sm mt-2">
                {institutionPlan?.description ?? "Buyer-only access for large teams."}
              </p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
              {(institutionPlan?.features ?? []).map(renderStandardFeature)}
            </ul>

            <div className="mt-auto">
              <button
                onClick={() => {
                  window.location.href =
                    "mailto:support@showmeprice.ng?subject=Institution%20Plan&body=Hi%20ShowMePrice%2C%20we%20need%20an%20Institution%20plan.";
                }}
                className="w-full py-3 rounded-xl font-bold text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Contact Sales
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!isSeller ? (
        <div className="mt-10 text-center text-xs text-slate-500">
          Institution accounts (buyer-only) have all features unlocked. Contact support for enterprise onboarding.
        </div>
      ) : (
        <div className="mt-8 text-center text-xs text-slate-500">
          Buying for an organisation?{" "}
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, "", "/pricing?role=buyer");
              window.dispatchEvent(new Event("smp:navigate"));
            }}
            className="underline font-bold text-slate-700 hover:text-slate-900"
          >
            View the Institution plan (buyers only).
          </button>
        </div>
      )}
    </div>
  );
}
