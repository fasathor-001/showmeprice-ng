export type MembershipTier = "free" | "pro" | "premium" | "institution" | "admin" | "unknown";
export type UserType = "buyer" | "seller" | "unknown";
export type PlanKey = "free" | "pro" | "premium" | "institution";
export type PlanDefinition = {
  key: PlanKey;
  label: string;
  priceMonthly: number | null;
  description: string;
  features: string[];
};

type ProfileLike = {
  membership_tier?: string | null;
  user_type?: string | null;
  role?: string | null;
};

const buyerPlanLimits: Record<PlanKey, number | null> = {
  free: 2,
  pro: 15,
  premium: null,
  institution: null,
};

const sellerPlanLimits: Record<Exclude<PlanKey, "institution">, number | null> = {
  free: 2,
  pro: 15,
  premium: null,
};

export const buyerPlans: PlanDefinition[] = [
  {
    key: "free",
    label: "Free",
    priceMonthly: null,
    description: "See real prices and chat sellers for free.",
    features: [
      "See real prices upfront",
      "Chat sellers inside the app",
      "WhatsApp/phone locked",
      "No escrow protection",
    ],
  },
  {
    key: "pro",
    label: "Pro",
    priceMonthly: 1500,
    description: "Call or WhatsApp sellers when you’re ready to buy.",
    features: [
      "WhatsApp + phone access",
      "In-app chat included",
      "Faster reach to sellers",
      "No escrow (Premium unlocks it)",
    ],
  },
  {
    key: "premium",
    label: "Premium",
    priceMonthly: 2500,
    description: "Extra protection with Escrow for serious purchases.",
    features: [
      "Pay with Escrow (buyer protection)",
      "WhatsApp + phone access",
      "Priority support for issues",
      "Best for higher-value items",
    ],
  },
  {
    key: "institution",
    label: "Institution",
    priceMonthly: null,
    description: "For organisations buying in bulk (custom onboarding).",
    features: ["Bulk buying support + invoicing", "Escrow enabled", "Dedicated onboarding", "Enterprise support"],
  },
];

export const sellerPlans: PlanDefinition[] = [
  {
    key: "free",
    label: "Free",
    priceMonthly: null,
    description: "Start selling — no cost, just list and chat.",
    features: ["List up to 2 products", "Chat with buyers in-app", "Basic shop profile", "Standard visibility"],
  },
  {
    key: "pro",
    label: "Pro",
    priceMonthly: 1500,
    description: "Grow faster with better visibility and tools.",
    features: ["List up to 15 products", "Better visibility in search", "Priority placement boosts", "Seller tools unlocks"],
  },
  {
    key: "premium",
    label: "Premium",
    priceMonthly: 2500,
    description: "Unlimited listings + premium support for serious sellers.",
    features: ["Unlimited listings", "Boosted visibility + badge", "Priority support", "Best for full-time sellers"],
  },
];

export function normalizeTier(input: unknown): MembershipTier {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "free") return "free";
  if (raw === "pro") return "pro";
  if (raw === "premium") return "premium";
  if (raw === "institution") return "institution";
  if (raw === "admin") return "admin";
  return raw ? "unknown" : "free";
}

export function normalizeUserType(input: unknown): UserType {
  const raw = String(input ?? "").trim().toLowerCase();
  if (raw === "buyer") return "buyer";
  if (raw === "seller") return "seller";
  return raw ? "unknown" : "buyer";
}

export function getUserTier(profile?: ProfileLike | null): MembershipTier {
  return normalizeTier(profile?.membership_tier);
}

export function getUserType(profile?: ProfileLike | null): UserType {
  return normalizeUserType(profile?.user_type);
}

export function isAdmin(profile?: ProfileLike | null): boolean {
  return String(profile?.role ?? "").toLowerCase() === "admin";
}

export function canBuyerRevealContact(profile?: ProfileLike | null): boolean {
  if (isAdmin(profile)) return true;
  const tier = getUserTier(profile);
  const userType = getUserType(profile);
  if (userType === "seller") return false;
  return tier === "pro" || tier === "premium" || tier === "institution";
}

export function canBuyerUseEscrow(profile: ProfileLike | null | undefined, escrowEnabled: boolean): boolean {
  if (!escrowEnabled) return false;
  if (isAdmin(profile)) return true;
  const tier = getUserTier(profile);
  const userType = getUserType(profile);
  if (userType === "seller") return false;
  return tier === "premium" || tier === "institution";
}

export function buyerMaxProducts(profile?: ProfileLike | null): number | null {
  const tier = getUserTier(profile);
  if (tier === "premium" || tier === "institution" || tier === "admin") return null;
  if (tier === "pro") return buyerPlanLimits.pro;
  return buyerPlanLimits.free;
}

export function sellerMaxProducts(profile?: ProfileLike | null): number | null {
  const tier = getUserTier(profile);
  if (tier === "premium" || tier === "admin") return null;
  if (tier === "pro") return sellerPlanLimits.pro;
  return sellerPlanLimits.free;
}

export function sellerPostingLimit(profile?: ProfileLike | null): number | null {
  return sellerMaxProducts(profile);
}

export function calculateEscrowFee(amountProduct: number, buyerTier?: MembershipTier): number {
  const n = Number(amountProduct ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;

  const tier = buyerTier ?? "free";
  const rates: Record<MembershipTier, { rate: number; min: number }> = {
    free: { rate: 0.03, min: 500 },
    pro: { rate: 0.03, min: 500 },
    premium: { rate: 0.025, min: 400 },
    institution: { rate: 0.02, min: 300 },
    admin: { rate: 0.02, min: 300 },
    unknown: { rate: 0.03, min: 500 },
  };

  const config = rates[tier] ?? rates.free;
  return Math.max(config.min, Math.round(n * config.rate));
}

export function getRecommendedPlan(reason?: string | null, userType?: UserType | null): PlanKey | null {
  const normalizedReason = String(reason ?? "").toLowerCase();
  const type = userType ?? "buyer";
  if (normalizedReason === "contact") return "pro";
  if (normalizedReason === "escrow") return "premium";
  if (type === "seller") return "pro";
  return null;
}

export function formatNaira(value: number): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(
      Number(value ?? 0)
    );
  } catch {
    return `\u20A6${Number(value ?? 0).toLocaleString("en-NG")}`;
  }
}
