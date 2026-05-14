
import React, { useMemo, useState, useEffect, useRef } from "react";
import type { ProductWithRelations } from "../../types";
import { useAuth } from "../../hooks/useAuth";
import { useInstitution } from "../../hooks/useInstitution";
import { useContactReveal } from "../../hooks/useContactReveal";
import { supabase } from "../../lib/supabase";
import { useProfile } from "../../hooks/useProfile";
import { useFF } from "../../hooks/useFF";
import { canBuyerUseEscrow, getUserTier } from "../../lib/plans";
import { calcEscrowFeeKobo, formatNairaFromKobo } from "../../lib/escrowFee";
import { getAccountStatus } from "../../lib/userRole";
import { useProductLike } from "../../hooks/useProductLike";
import { useSellerFollow } from "../../hooks/useSellerFollow";
import { useProductComments } from "../../hooks/useProductComments";
import { useReportProduct } from "../../hooks/useReportProduct";
import { getAccessToken } from "../../lib/getAccessToken";
import { invokeAuthedFunction } from "../../lib/invokeAuthedFunction";
import FeatureGate from "../common/FeatureGate";
import SEO from "../common/SEO";

import {
  X,
  Image as ImageIcon,
  MapPin,
  Clock,
  MessageCircle,
  Phone,
  Crown,
  Star,
  AlertTriangle,
  BadgeCheck,
  Heart,
  Flag,
  UserPlus,
  Send,
} from "lucide-react";

interface ProductDetailProps {
  product: ProductWithRelations;
  onClose: () => void;
}

const REPORT_REASONS = [
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "fake", label: "Fake item" },
  { value: "illegal", label: "Illegal item" },
  { value: "other", label: "Other" },
];

function formatMoneyNGN(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "\u20A60";
  return `\u20A6${n.toLocaleString("en-NG")}`;
}

function safeText(input: any) {
  return String(input ?? "").trim();
}

function toTitleCase(input: string) {
  return input
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function extractBusinessName(rawProduct: any) {
  const p = rawProduct as any;
  const direct =
    safeText(p?.businesses?.business_name) ||
    safeText(p?.business?.business_name) ||
    safeText(p?.business_name);
  if (direct) return direct;
  const arrName = safeText(p?.businesses?.[0]?.business_name);
  return arrName || "";
}

export default function ProductDetail({ product, onClose }: ProductDetailProps) {
  const { user } = useAuth();
  const FF = useFF();

  // Viewer access
  const { profile: viewerProfile, loading: profileLoading } = useProfile() as any;
  const viewerTier = getUserTier(viewerProfile);
  const buyerTier = String(
    (viewerProfile as any)?.membership_tier ?? (viewerProfile as any)?.membership_1 ?? (viewerTier as any) ?? "free"
  ).toLowerCase();
  const _isBuyerPremium = buyerTier === "premium";
  void _isBuyerPremium;

  // Access rule:
  // Premium - WhatsApp + Phone + INAPP MESSENGER
  // Pro     - WhatsApp + Phone + INAPP MESSENGER
  // Free    - INAPP MESSENGER only
  const messagingEnabled = !!FF.messaging;
  const canInAppMessage = messagingEnabled; // server-side enforcement still required; UI gate here
  const canRevealContact = buyerTier === "pro" || buyerTier === "premium" || buyerTier === "institution";
  const escrowEnabled = !!FF?.isEnabled?.("escrow_enabled", false);
  const escrowEligible = canBuyerUseEscrow(viewerProfile, escrowEnabled);
  const showEscrow = escrowEnabled;
  const profileLoaded = !!user && !profileLoading;
  const isAdminRole = String((viewerProfile as any)?.role ?? "").toLowerCase() === "admin";
  const accountStatus = getAccountStatus({
    profile: viewerProfile,
    user,
    hasBusiness: false,
    isAdminRole,
    profileLoaded,
  });
  const isBuyerAccount = accountStatus.effectiveType === "buyer";
  const isInstitutionBuyer = viewerTier === "institution";

  const { institution, addToProcurement } = useInstitution();
  const { reveal, data: contactData, loading: revealLoading, revealed } = useContactReveal();

  // --- core product fields (safe)
  const productId = (product as any)?.id;
  const title = safeText((product as any)?.title);
  const description = safeText((product as any)?.description);
  const condition = safeText((product as any)?.condition ?? "new");
  const conditionLabel = toTitleCase(condition || "new");
  const createdAt = safeText((product as any)?.created_at);
  const price = (product as any)?.price;
  const originalPrice = (product as any)?.original_price;
  const isSold = String((product as any)?.status ?? "").toLowerCase() === "sold";

  const categoryName = safeText((product as any)?.categories?.name);

  const stateName = (product as any)?.states?.name ? safeText((product as any).states.name) : "";
  const cityName = (product as any)?.city ? safeText((product as any).city) : "";

  // seller fields
  const businessName =
    safeText((product as any)?.seller_business_name) || extractBusinessName(product) || "Seller";
  const businessId =
    (product as any)?.business_id ||
    (product as any)?.businesses?.id ||
    (product as any)?.business?.id ||
    null;

  // IMPORTANT: requires PRODUCT_SELECT to include businesses(user_id)
  const sellerUserId =
    (product as any)?.businesses?.user_id ||
    (product as any)?.business?.user_id ||
    (product as any)?.owner_id ||
    null;
  const isOwner = !!sellerUserId && !!user?.id && String(sellerUserId) === String(user.id);

  const viewLoggedRef = useRef(false);
  const pendingActionRef = useRef<string | null>(null);

  // View tracking: insert a row into product_views (trigger increments products.view_count)
  useEffect(() => {
    const pid = safeText(productId);
    if (!pid) return;
    // Don't count views when the owner is previewing their own listing
    if (sellerUserId && user?.id && String(sellerUserId) === String(user.id)) return;
    if (viewLoggedRef.current) return;
    viewLoggedRef.current = true;

    (async () => {
      try {
        const { error } = await supabase.from("product_views").insert({
          product_id: pid,
          viewer_id: user?.id ?? null,
        });
        if (error?.code && error.code !== "PGRST205" && error.code !== "PGRST116") {
          // ignore logging errors to avoid breaking product detail view
        }
      } catch {
        // ignore (e.g., table not created yet, RLS/policy not applied)
      }
    })();
  }, [productId, sellerUserId, user?.id]);


  const tier = String((product as any)?.seller_verification_tier ?? "").toLowerCase();
  const hasSellerBadge =
    typeof (product as any)?.seller_is_verified === "boolean" || !!(product as any)?.seller_verification_tier;
  const isSellerVerified =
    (product as any)?.seller_is_verified === true || tier === "verified";
  const verificationTone = isSellerVerified ? "text-emerald-600" : "text-red-600";
  const sellerBadgeLabel = hasSellerBadge ? (isSellerVerified ? "Verified" : "Unverified") : "";
  const sellerMembershipTier = String((product as any)?.seller_membership_tier ?? "").toLowerCase().trim();
  const isSellerPremium = sellerMembershipTier === "premium";
  const sellerTierLabel =
    sellerMembershipTier === "premium"
      ? "PREMIUM SELLER"
      : sellerMembershipTier === "pro"
      ? "PRO SELLER"
      : "";

  // discount
  const hasDiscount = !!originalPrice && Number(originalPrice) > Number(price);
  const discountPercentage = hasDiscount
    ? Math.round(((Number(originalPrice) - Number(price)) / Number(originalPrice)) * 100)
    : 0;

  // Images (supports stored paths or URLs)
  const displayImages = useMemo(() => {
    const raw = Array.isArray((product as any).images) ? ((product as any).images as any[]) : [];
    const fallback = safeText((product as any)?.image_url);
    const source = raw.length > 0 ? raw : fallback ? [fallback] : [];
    return source
      .map((img) => {
        const s = safeText(img);
        if (!s) return "";
        if (/^https?:\/\//i.test(s)) return s;

        const path = s.startsWith("products/") ? s.slice("products/".length) : s;
        try {
          if (!supabase) return s;
          const { data } = supabase.storage.from("products").getPublicUrl(path);
          return data?.publicUrl || s;
        } catch {
          return s;
        }
      })
      .filter(Boolean);
  }, [product]);

  const [activeImage, setActiveImage] = useState<string | null>(null);
  useEffect(() => {
    setActiveImage(displayImages.length > 0 ? displayImages[0] : null);
  }, [displayImages]);

  // Institution tools
  const [isAddingToProc, setIsAddingToProc] = useState(false);

  // Reporting
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  const { submitReport, loading: reportLoading } = useReportProduct(productId);

  const [escrowStarting, setEscrowStarting] = useState(false);
  const [escrowError, setEscrowError] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerSending, setOfferSending] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [buyWithEscrowSending, setBuyWithEscrowSending] = useState(false);
  const [buyWithEscrowDone, setBuyWithEscrowDone] = useState(false);

  // Social hooks
  const { liked, count: likeCount, mutating: likeMutating, toggleLike } = useProductLike(productId);
  const { following, mutating: followMutating, toggleFollow } = useSellerFollow(businessId);
  const { comments, loading: commentsLoading, addComment } = useProductComments(productId);

  // Comments
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return "";
    }
  };

  const safeDesc = description.slice(0, 160);
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: title,
    image: displayImages || [],
    description: safeDesc || "Verified product listing on ShowMePrice.ng",
    sku: String(productId ?? ""),
    brand: { "@type": "Brand", name: businessName || "Generic" },
    offers: {
      "@type": "Offer",
      url: window.location.href,
      priceCurrency: "NGN",
      price: Number(price ?? 0),
      availability: "https://schema.org/InStock",
      itemCondition: condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      seller: { "@type": "Organization", name: businessName || "ShowMePrice Seller" },
    },
  };

  // --- actions
  const openAuthModal = (reason?: string) => {
    if (typeof (window as any).openAuthModal === "function") {
      (window as any).openAuthModal();
      return;
    }
    window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login", reason } }));
  };

  const emitToast = (type: "success" | "error" | "info", message: string) => {
    window.dispatchEvent(new CustomEvent("smp:toast", { detail: { type, message } }));
  };

  const openPricing = (reason?: "contact" | "escrow") => {
    try {
      const url = reason ? `/pricing?reason=${encodeURIComponent(reason)}` : "/pricing";
      window.history.pushState({}, "", url);
      window.dispatchEvent(new Event("smp:navigate"));
    } catch {
      window.location.href = reason ? `/pricing?reason=${encodeURIComponent(reason)}` : "/pricing";
    }
  };

  const offersEnabled = !!FF?.isEnabled?.("make_offer_enabled", false);

  const setPostAuthIntent = (intent: string) => {
    try {
      sessionStorage.setItem("smp:post_auth_intent", intent);
    } catch {
      // intentionally empty
    }
    pendingActionRef.current = intent;
  };

  const consumePostAuthIntent = () => {
    let intent = pendingActionRef.current;
    if (!intent) {
      try {
        intent = String(sessionStorage.getItem("smp:post_auth_intent") ?? "");
      } catch {
        intent = "";
      }
    }

    if (!intent) return "";

    pendingActionRef.current = null;
    try {
      sessionStorage.removeItem("smp:post_auth_intent");
    } catch {
      // intentionally empty
    }

    return intent;
  };

  const requireAuthOr = async (fn: () => void | Promise<void>, reason?: string) => {
    if (!user) {
      if (reason) setPostAuthIntent(reason);
      openAuthModal(reason);
      return;
    }
    await fn();
  };

  const handleMessageSeller = (messageContent?: string) => {
    requireAuthOr(() => {
      if (!canInAppMessage) {
        alert("In-app messaging is currently unavailable.");
        return;
      }

      if (!sellerUserId) {
        alert("Seller account not available for messaging yet (missing businesses.user_id).");
        return;
      }

      try {
        sessionStorage.setItem(
          "smp_initial_chat",
          JSON.stringify({
            sellerUserId: String(sellerUserId),
            productId: productId ? String(productId) : null,
          })
        );
      } catch {
        // intentionally empty
      }

      window.dispatchEvent(
        new CustomEvent("smp:view-inbox", {
          detail: {
            partnerId: String(sellerUserId),
            partnerName: businessName || "Seller",
            productId: productId ? String(productId) : null,
            message: messageContent,
          },
        })
      );
    }, "message");
  };

  const handleMakeOfferClick = () => {
    if (!offersEnabled) return;
    requireAuthOr(() => setOfferOpen(true), "make_offer");
  };

  const handleBuyWithEscrow = () => {
    if (buyWithEscrowSending || buyWithEscrowDone) return;
    requireAuthOr(async () => {
      if (!productId) { emitToast("error", "Product not found."); return; }
      setBuyWithEscrowSending(true);
      try {
        const { data, error } = await invokeAuthedFunction("offer_create", {
          body: {
            productId: String(productId),
            offer_amount_kobo: Math.round(priceNaira * 100),
            message: null,
          },
        });
        if (error || !data) throw new Error((error as any)?.message ?? "Failed to send buy request.");
        setBuyWithEscrowDone(true);
        emitToast("success", "Buy request sent! The seller will confirm and then you can pay via escrow.");
      } catch (err: any) {
        emitToast("error", err?.message ?? "Failed to send buy request.");
      } finally {
        setBuyWithEscrowSending(false);
      }
    }, "buy_with_escrow");
  };

  const handleOfferSend = async () => {
    if (!user?.id) {
      emitToast("info", "Please sign in to make an offer");
      return;
    }
    if (!productId) {
      emitToast("error", "Product is missing.");
      return;
    }
    const amount = Number(String(offerAmount ?? "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      emitToast("info", "Enter a valid offer amount.");
      return;
    }
    setOfferSending(true);
    try {
      console.log("[MakeOffer] clicked submit", { productId, amount });
      const { data, error } = await invokeAuthedFunction("offer_create", {
        body: {
          productId: String(productId),
          offer_amount_kobo: Math.round(amount * 100),
          message: offerNote.trim() || null,
        },
      });
      if (error || !data) {
        throw new Error(error?.message ?? "Offer failed to send.");
      }
      emitToast("success", "Offer sent");
      setOfferOpen(false);
      setOfferAmount("");
      setOfferNote("");
    } catch (err: any) {
      console.error("[MakeOffer] failed", err);
      emitToast("error", err?.message ?? "Failed to send offer.");
    } finally {
      setOfferSending(false);
    }
  };

  const handleReveal = async () => {
    // Use the pre-computed businessId which includes businesses.id as a fallback.
    // Directly reading product.business_id missed the businesses(id) join path.
    const targetId = safeText(businessId);
    if (!targetId) return;
    await reveal(String(targetId));
  };

  const handleCall = () => {
    if (!contactData?.phone) return;
    window.location.href = `tel:${contactData.phone}`;
  };

  const handleWhatsApp = () => {
    const wa = contactData?.whatsapp || contactData?.phone;
    if (!wa) return;

    const cleanNum = String(wa).replace(/\D/g, "");
    const formattedNum = cleanNum.startsWith("234") ? cleanNum : `234${cleanNum.replace(/^0+/, "")}`;
    const message = encodeURIComponent(
      `Hi, I am interested in your listing "${title}" on ShowMePrice.ng. Is it still available?`
    );
    window.open(`https://wa.me/${formattedNum}?text=${message}`, "_blank");
  };

  /**
   * One-tap action:
   * - not logged in => auth
   * - logged in but free => pricing (upgrade)
   * - pro/premium but not revealed => reveal
   * - revealed => run action
   */
  const smartContactAction = async (intent: "call" | "whatsapp_number") => {
    if (!user) {
      setPostAuthIntent(intent === "call" ? "contact_call" : "contact_whatsapp");
      openAuthModal("contact");
      return;
    }

    if (!canRevealContact) {
      openPricing("contact");
      return;
    }

    if (!revealed) {
      await handleReveal();
      return;
    }

    if (intent === "call") handleCall();
    if (intent === "whatsapp_number") handleWhatsApp();
  };

  const handleAddToProcurement = async () => {
    if (!institution) {
      if (confirm("You need to activate Institution Tools to use this feature. Go to setup?")) {
        window.dispatchEvent(new Event("smp:view-institution"));
      }
      return;
    }

    setIsAddingToProc(true);
    await addToProcurement({
      productId,
      name: title,
      price: Number(price ?? 0),
      qty: 1,
    });
    setIsAddingToProc(false);
    alert("Added to Procurement Log!");
  };

  const handleBulkQuote = () => {
    const msg = `Hello, I am interested in a bulk purchase of "${title}". Could you please provide a quote for [Quantity] units?`;
    handleMessageSeller(msg);
  };

  const MIN_ESCROW_NAIRA = Number(import.meta.env.VITE_ESCROW_MIN_PRICE_NGN) || 50000;
  const MIN_ESCROW_KOBO = Math.round(MIN_ESCROW_NAIRA * 100);

  const rawPrice = (product as any)?.price ?? (product as any)?.price_naira ?? (product as any)?.amount ?? 0;
  const priceNaira =
    typeof rawPrice === "number"
      ? rawPrice
      : Number(String(rawPrice).replace(/[^\d.]/g, "")) || 0;
  const escrowSubtotalKobo = useMemo(() => Math.round(priceNaira * 100), [priceNaira]);
  const { feeKobo: escrowFeeKobo, totalKobo: escrowTotalKobo } = useMemo(
    () => calcEscrowFeeKobo(escrowSubtotalKobo),
    [escrowSubtotalKobo]
  );
  const escrowMinEligible = escrowSubtotalKobo >= MIN_ESCROW_KOBO;
  const escrowCtaVisible =
    showEscrow &&
    escrowMinEligible &&
    sellerUserId &&
    !isOwner;
  const escrowUpsell =
    accountStatus.isLoggedIn && accountStatus.ready && !escrowEligible && !isInstitutionBuyer;

  const handleEscrowSuccess = (result: { orderId: string }) => {
    try {
      const pending = {
        orderId: safeText(result?.orderId),
        productId: safeText(productId),
        createdAt: Date.now(),
      };
      sessionStorage.setItem("smp:escrow_pending", JSON.stringify(pending));
    } catch {
      // intentionally empty
    }
  };

  const doPayWithEscrow = async () => {
    setEscrowError(null);
    if (!sellerUserId) {
      alert("Seller account not available.");
      return;
    }

    if (profileLoading) {
      alert("Loading your profile... please try again.");
      setPostAuthIntent("escrow");
      return;
    }

    if (!escrowEligible) {
      openPricing("escrow");
      return;
    }

    if (!escrowMinEligible) {
      const message = `Escrow is only available for \u20A6${Number(MIN_ESCROW_NAIRA).toLocaleString("en-NG")}+ items.`;
      setEscrowError(message);
      alert(message);
      return;
    }

    const amountKobo = escrowSubtotalKobo;
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      const message = "Unable to determine product amount for escrow.";
      setEscrowError(message);
      alert(message);
      return;
    }

    try {
      setEscrowStarting(true);
      const origin = window.location.origin || "";
      const successUrl = `${origin}/escrow/status`;
      const cancelUrl = `${origin}/escrow/status`;

      const { data, error } = await invokeAuthedFunction("payments_init", {
        body: {
          kind: "escrow",
          product_id: safeText(productId),
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      });
      if (error) throw error;
      const authorizationUrl = String((data as any)?.authorization_url ?? "").trim();
      const orderId = String((data as any)?.escrow_order_id ?? "").trim();
      if (!authorizationUrl) {
        throw new Error("Missing Paystack authorization URL.");
      }
      if (orderId) handleEscrowSuccess({ orderId });
      window.location.href = authorizationUrl;
    } catch (err: any) {
      const message = err?.message ?? "Failed to start escrow payment.";
      setEscrowError(message);
      alert(message);
    } finally {
      setEscrowStarting(false);
    }
  };

  const setEscrowPending = () => {
    try {
      sessionStorage.setItem(
        "smp:escrow_pending_action",
        JSON.stringify({
          productId: safeText(productId),
          sellerId: sellerUserId ? String(sellerUserId) : "",
          createdAt: Date.now(),
        })
      );
    } catch {
      // intentionally empty
    }
  };

  const ensureAuthForEscrow = async () => {
    if (!user) {
      setEscrowPending();
      window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login", reason: "escrow" } }));
      return false;
    }
    try {
      await getAccessToken();
    } catch {
      setEscrowPending();
      window.dispatchEvent(new CustomEvent("smp:open-auth", { detail: { mode: "login", reason: "escrow" } }));
      return false;
    }
    return true;
  };

  const handlePayWithEscrow = async () => {
    const authed = await ensureAuthForEscrow();
    if (!authed) return;
    if (!escrowEligible && !isInstitutionBuyer) {
      openPricing("escrow");
      return;
    }
    await doPayWithEscrow();
  };

  const handleToggleLike = async () => {
    await requireAuthOr(async () => {
      const nextSaved = !liked;
      try {
        await toggleLike();
        emitToast("success", nextSaved ? "Saved" : "Removed from saved");
        window.dispatchEvent(new CustomEvent("smp:saved:refresh"));
      } catch (err: any) {
        emitToast("error", err?.message ?? "Unable to update saved items.");
      }
    }, "like");
  };

  const handleToggleFollow = async () => {
    if (!user) {
      emitToast("info", "Please sign in to follow sellers.");
      return;
    }
    if (!businessId) {
      emitToast("error", "Seller business not available.");
      return;
    }
    await requireAuthOr(async () => {
      const nextFollow = !following;
      try {
        await toggleFollow();
        const label = businessName ? ` ${businessName}` : "";
        emitToast("success", nextFollow ? `Following${label}` : `Unfollowed${label}`);
      } catch (err: any) {
        emitToast("error", err?.message ?? "Unable to update follow.");
      }
    }, "follow");
  };

  const handleSubmitReport = async () => {
    await requireAuthOr(async () => {
      try {
        await submitReport(reportReason, reportDetails);
        setReportSuccess(true);
        setTimeout(() => {
          setIsReporting(false);
          setReportSuccess(false);
          setReportReason(REPORT_REASONS[0].value);
          setReportDetails("");
        }, 1800);
      } catch (err: any) {
        alert(err?.message ?? "Failed to send report. Please try again.");
      }
    });
  };

  const handleAddComment = async () => {
    await requireAuthOr(async () => {
      setCommentSubmitting(true);
      setCommentError(null);
      try {
        await addComment(commentBody);
        setCommentBody("");
        emitToast("success", "Comment posted");
      } catch (err: any) {
        setCommentError(err?.message ?? "Failed to add comment.");
        emitToast("error", err?.message ?? "Failed to add comment.");
      } finally {
        setCommentSubmitting(false);
      }
    }, "comment");
  };

  useEffect(() => {
    if (!user?.id || profileLoading) return;

    const intent = consumePostAuthIntent();
    if (!intent) return;

    if (intent === "escrow") {
      doPayWithEscrow();
      return;
    }
    if (intent === "like") {
      handleToggleLike();
      return;
    }
    if (intent === "follow") {
      handleToggleFollow();
      return;
    }
    if (intent === "comment") {
      if (commentBody.trim()) {
        handleAddComment();
      }
      return;
    }
    if (intent === "message") {
      handleMessageSeller();
      return;
    }
    if (intent === "contact_call") {
      smartContactAction("call");
      return;
    }
    if (intent === "contact_whatsapp") {
      smartContactAction("whatsapp_number");
    }
  }, [user?.id, profileLoading, commentBody, sellerUserId]);

  const viewerEmailPrefix = useMemo(() => {
    const email = safeText(user?.email);
    if (!email.includes("@")) return "";
    return email.split("@")[0];
  }, [user?.email]);

  const resolveCommentName = (userId: string) => {
    const comment = comments.find((c) => c.user_id === userId);
    const name = safeText((comment as any)?.profiles?.display_name);
    if (name) return name;
    if (user?.id && userId === user.id && viewerEmailPrefix) return viewerEmailPrefix;
    return "Buyer";
  };

  return (
    <div className="relative flex flex-col h-[90vh] max-h-[90vh] bg-white overflow-hidden">
      <SEO
        title={`${title} - ${formatMoneyNGN(price)}`}
        description={`${safeDesc}${safeDesc ? "..." : ""} | Sold by ${businessName} in ${stateName || "Nigeria"}`}
        image={displayImages?.[0]}
        schema={productSchema}
      />

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-30 bg-white/85 backdrop-blur p-2 rounded-full text-slate-700 hover:text-slate-900 transition shadow-sm border border-slate-100"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="px-4 md:px-6 lg:px-8 py-6 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr_0.85fr] gap-6 min-h-0 items-stretch">
            {/* LEFT: Media */}
            <div className="bg-slate-100 rounded-2xl overflow-hidden flex flex-col h-full">
              <div className="min-h-[320px] md:min-h-[600px] flex-1 flex items-center justify-center relative">
                {activeImage ? (
                  <img
                    src={activeImage}
                    className="max-h-full max-w-full object-contain"
                    alt={title || "Product image"}
                  />
                ) : (
                  <div className="text-slate-400 flex flex-col items-center py-16">
                    <ImageIcon className="w-14 h-14 mb-2" />
                    <span className="text-sm font-medium">No Image Available</span>
                  </div>
                )}

                {hasDiscount && (
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-lg font-black text-sm shadow-sm">
                    -{discountPercentage}% OFF
                  </div>
                )}
              </div>

              {displayImages.length > 1 && (
                <div className="px-4 pb-4">
                  <div className="flex gap-2 overflow-x-auto">
                    {displayImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        onClick={() => setActiveImage(img)}
                        className={`w-[72px] h-[72px] rounded-lg border-2 overflow-hidden flex-shrink-0 transition ${
                          activeImage === img ? "border-brand" : "border-white"
                        } shadow-sm bg-white`}
                        type="button"
                        aria-label={`View image ${idx + 1}`}
                      >
                        <img src={img} className="w-full h-full object-cover" alt={`thumb-${idx + 1}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* MIDDLE: Details */}
            <div className="min-w-0 lg:overflow-y-auto lg:max-h-[calc(90vh-6rem)] lg:pr-2 space-y-5">

              {/* Badges — compact, low-noise */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {conditionLabel || "New"}
                </span>
                {categoryName ? (
                  <span className="text-[11px] font-semibold text-brand bg-brand/8 px-2 py-0.5 rounded-md">
                    {categoryName}
                  </span>
                ) : null}
                {sellerTierLabel ? (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5 fill-amber-700 text-amber-700" /> {sellerTierLabel}
                  </span>
                ) : null}
                {isSellerVerified ? (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <BadgeCheck className="w-2.5 h-2.5" /> Verified
                  </span>
                ) : null}
              </div>

              {/* Title + sold badge */}
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">
                  {title || "Untitled Product"}
                </h2>
                {isSold ? (
                  <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-black tracking-wide">
                    SOLD
                  </div>
                ) : null}
              </div>

              {/* Price — prominent on mobile (right panel is below); smaller on desktop where right panel is adjacent */}
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-black text-slate-900 lg:text-xl lg:font-bold lg:text-slate-700">
                  {formatMoneyNGN(price)}
                </span>
                {hasDiscount ? (
                  <span className="text-sm text-slate-400 line-through">{formatMoneyNGN(originalPrice)}</span>
                ) : null}
              </div>

              {/* Location + Date — single compact row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>{[cityName, stateName].filter(Boolean).join(", ") || "Nigeria"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>Posted {formatDate(createdAt) || "Recently"}</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {description || "No description provided by the seller."}
                </p>
              </div>

              {/* Product Information */}
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Product Information</h3>
                <dl className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 text-sm">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white">
                    <dt className="text-slate-500">Condition</dt>
                    <dd className="font-semibold text-slate-800">{conditionLabel || "N/A"}</dd>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white">
                    <dt className="text-slate-500">Category</dt>
                    <dd className="font-semibold text-slate-800">{categoryName || "General"}</dd>
                  </div>
                </dl>
              </div>

              {/* Safety Tips — muted, compact */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Safety Tips
                </div>
                <ul className="text-xs text-slate-500 space-y-0.5">
                  <li>{"·"} Meet in a public place for inspections.</li>
                  <li>{"·"} Never pay before inspecting the item.</li>
                  <li>{"·"} Use escrow for added buyer protection.</li>
                </ul>
              </div>

              {/* Institution tools */}
              <FeatureGate flagKey="institution_tools_enabled">
                {institution ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <AlertTriangle className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                      Institution Tools
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleAddToProcurement}
                        disabled={isAddingToProc}
                        className="bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isAddingToProc ? "Adding..." : "Add to Procurement"}
                      </button>
                      <button
                        onClick={handleBulkQuote}
                        className="bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center justify-center gap-2"
                      >
                        Request Bulk Quote
                      </button>
                    </div>
                  </div>
                ) : null}
              </FeatureGate>

              {/* Comments — low visual priority */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-500">Comments</h3>
                  <span className="text-[11px] text-slate-400">{comments.length} comments</span>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      rows={2}
                      placeholder="Write a comment..."
                      className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={commentSubmitting}
                      className="h-9 px-3 rounded-lg bg-brand text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center gap-1.5 self-start mt-0.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Post
                    </button>
                  </div>
                  {commentError ? <div className="text-xs text-rose-500">{commentError}</div> : null}

                  <div className="space-y-2">
                    {commentsLoading ? (
                      <div className="text-xs text-slate-400">Loading comments...</div>
                    ) : comments.length === 0 ? (
                      <div className="text-xs text-slate-400">No comments yet.</div>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="rounded-lg px-3 py-2.5 bg-slate-50 border border-slate-100">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                            <span className="font-semibold text-slate-600">{resolveCommentName(comment.user_id)}</span>
                            <span>{formatDate(comment.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-600 whitespace-pre-wrap break-words leading-relaxed">{comment.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
            {/* RIGHT: Action Panel */}
            <div className="lg:sticky lg:top-6 h-fit space-y-3">

              {/* ── 1. MAIN ACTION CARD ── */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Price row */}
                <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                      {formatMoneyNGN(price)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1.5">{likeCount} people saved this</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleLike}
                    disabled={likeMutating}
                    className={`rounded-full border p-2 transition flex-shrink-0 ${
                      liked
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : "border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-400"
                    }`}
                    title={liked ? "Unsave" : "Save"}
                  >
                    <Heart className={`w-4 h-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
                  </button>
                </div>

                {/* Action buttons — non-owner only */}
                {!isOwner ? (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-2.5">
                    {buyWithEscrowDone ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-semibold text-center">
                        {"✓"} Request sent!{" "}
                        <button
                          type="button"
                          onClick={() => { window.history.pushState({}, "", "/my-offers"); window.dispatchEvent(new Event("smp:navigate")); }}
                          className="underline font-black"
                        >
                          Check My Offers
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleBuyWithEscrow}
                          disabled={buyWithEscrowSending}
                          className="w-full rounded-xl bg-emerald-600 text-white font-black py-3.5 text-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-70 transition shadow-sm flex items-center justify-center gap-2"
                        >
                          {"🔒"}{" "}
                          {buyWithEscrowSending
                            ? "Sending request..."
                            : `Buy with Escrow Protection (${formatMoneyNGN(priceNaira)})`}
                        </button>
                        <p className="text-xs text-slate-500 text-center">
                          Seller confirms your order, then you pay securely with escrow.
                        </p>
                      </>
                    )}

                    {offersEnabled ? (
                      <button
                        type="button"
                        onClick={handleMakeOfferClick}
                        className="w-full py-3 rounded-xl font-bold text-sm transition border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2"
                      >
                        Make an Offer
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleMessageSeller()}
                      disabled={!canInAppMessage && !!user}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition border flex items-center justify-center gap-2 ${
                        !canInAppMessage && !!user
                          ? "border-slate-100 text-slate-400 cursor-not-allowed"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                      title={!canInAppMessage ? "Messaging is currently disabled." : ""}
                    >
                      <MessageCircle className="w-4 h-4" />
                      Message Seller{user ? "" : " (Login Required)"}
                    </button>
                  </div>
                ) : null}
              </div>

              {/* ── 2. SELLER TRUST CARD ── */}
              <div
                className={`rounded-2xl border p-4 shadow-sm ${
                  isSellerPremium
                    ? "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg border-2 flex-shrink-0 ${
                      isSellerPremium
                        ? "bg-amber-500 border-amber-400 text-white"
                        : "bg-brand/10 border-brand/20 text-brand"
                    }`}
                    aria-hidden
                  >
                    {String(businessName || "S").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`font-black text-base flex items-center gap-1.5 ${isSellerPremium ? "text-white" : "text-slate-900"}`}>
                      <span className="truncate">{businessName}</span>
                      {isSellerVerified ? (
                        <Crown
                          className={`w-4 h-4 flex-shrink-0 ${isSellerPremium ? "text-amber-400 fill-amber-400" : "text-brand fill-brand"}`}
                          title="Verified Seller"
                        />
                      ) : null}
                    </div>
                    <div className={`text-xs mt-0.5 flex items-center gap-1.5 flex-wrap ${isSellerPremium ? "text-slate-300" : "text-slate-500"}`}>
                      {sellerBadgeLabel ? (
                        <>
                          <span className={`${verificationTone} font-bold`}>{sellerBadgeLabel}</span>
                          <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                        </>
                      ) : null}
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="font-bold">4.8</span>
                        <span>(15 reviews)</span>
                      </div>
                    </div>
                    <div className={`text-xs mt-1 font-semibold ${isSellerPremium ? "text-emerald-400" : "text-emerald-600"}`}>
                      {"✓"} Trusted seller on ShowMePrice
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleFollow(); }}
                  disabled={followMutating || !businessId}
                  className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm font-bold flex items-center justify-center gap-2 transition ${
                    following
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isSellerPremium
                      ? "border-slate-600 text-slate-200 hover:bg-slate-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  {following ? "Following" : "Follow Seller"}
                </button>
              </div>

              {/* ── 3. CONTACT OPTIONS ── */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => smartContactAction("call")}
                    className="py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    disabled={revealLoading}
                    type="button"
                    title={!user ? "Login required" : !canRevealContact ? "Pro/Premium required" : !revealed ? "Reveal required" : ""}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {revealed && contactData?.phone ? contactData.phone : "Call"}
                  </button>
                  <button
                    onClick={() => smartContactAction("whatsapp_number")}
                    className="py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    disabled={revealLoading}
                    type="button"
                    title={!user ? "Login required" : !canRevealContact ? "Pro/Premium required" : !revealed ? "Reveal required" : ""}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                </div>

                {!user ? (
                  <p className="text-xs text-slate-400 text-center">Login to reveal seller contact.</p>
                ) : !canRevealContact ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-black text-amber-900">Unlock seller contact</div>
                    <div className="text-xs text-amber-800 mt-1">Upgrade to Pro to call or chat on WhatsApp.</div>
                    <button
                      type="button"
                      onClick={() => openPricing("contact")}
                      className="mt-1.5 text-xs font-bold underline text-amber-800 hover:text-amber-900"
                    >
                      See plans
                    </button>
                  </div>
                ) : !revealed ? (
                  <button
                    type="button"
                    onClick={handleReveal}
                    disabled={revealLoading}
                    className="w-full text-xs font-bold underline text-slate-600 hover:text-slate-900"
                  >
                    {revealLoading ? "Revealing..." : "Reveal contact info"}
                  </button>
                ) : null}
              </div>

              {/* ── 4. ESCROW SAFETY NOTE (compact) ── */}
              {!isOwner ? (
                <div className="px-1 space-y-1.5">
                  {[
                    "Payment secured by ShowMePrice",
                    "Seller gets paid after your delivery confirmation",
                    "Full refund if item is not as described",
                  ].map((line) => (
                    <div key={line} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <BadgeCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      {line}
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400 pt-0.5">
                    {"⚠"} Avoid paying outside escrow — you will not be protected.
                  </p>
                </div>
              ) : null}

              {/* Report */}
              <div className="text-center pb-1">
                <button
                  onClick={() => setIsReporting(true)}
                  className="text-slate-400 text-xs font-medium hover:text-red-500 transition inline-flex items-center gap-1.5"
                >
                  <Flag className="w-3 h-3" /> Report Ad
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {offerOpen ? (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="text-lg font-black text-slate-900">Make an Offer</div>
            <div className="text-xs text-slate-500 mt-1">
              {title ? `Offer for ${title}` : "Send your offer to the seller."}
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-slate-600">Offer amount (₦)</label>
              <input
                type="text"
                inputMode="numeric"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder="e.g. 50,000"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-slate-600">Note (optional)</label>
              <textarea
                value={offerNote}
                onChange={(e) => setOfferNote(e.target.value)}
                rows={3}
                placeholder="Add a short note..."
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setOfferOpen(false)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOfferSend}
                disabled={offerSending}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {offerSending ? "Sending..." : "Send Offer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* REPORT OVERLAY */}
      {isReporting && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            {reportSuccess ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BadgeCheck className="w-6 h-6" />
                </div>
                <h3 className="font-black text-slate-900">Report Sent</h3>
                <p className="text-xs text-slate-500 mt-1">Thank you for helping keep our community safe.</p>
              </div>
            ) : (
              <>
                <h3 className="font-black text-lg text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" /> Report Ad
                </h3>

                <label className="text-xs font-bold text-slate-600">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>

                <label className="text-xs font-bold text-slate-600 mt-4 block">Details (optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none"
                  placeholder="Add extra context if needed"
                />

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setIsReporting(false)}
                    className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50"
                    type="button"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleSubmitReport}
                    disabled={reportLoading}
                    className="flex-1 py-2 rounded-lg bg-red-500 text-white font-black text-sm hover:bg-red-600 disabled:opacity-50"
                    type="button"
                  >
                    {reportLoading ? "Sending..." : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
