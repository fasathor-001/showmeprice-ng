import type { User } from "@supabase/supabase-js";

type ProfileLike = {
  user_type?: string | null;
  role?: string | null;
};

export type EffectiveUserType = "admin" | "seller" | "buyer" | "unknown";
export type EffectiveAccountType = "admin" | "seller" | "buyer" | null;
export type AccountStatus = {
  effectiveType: EffectiveAccountType;
  ready: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  isBuyer: boolean;
  roleLabel: string | null;
};

function normalizeRole(v: unknown) {
  return String(v ?? "").toLowerCase();
}

export function getRoleHint(user?: User | null): EffectiveUserType {
  if (!user?.id) return "unknown";
  const metaRole = normalizeRole((user as any)?.user_metadata?.role);
  if (metaRole === "admin") return "admin";
  const metaType = normalizeRole((user as any)?.user_metadata?.user_type);
  if (metaType === "seller") return "seller";

  try {
    const cached = String(localStorage.getItem(`smp:role_hint:${user.id}`) || "").toLowerCase();
    if (cached === "admin" || cached === "seller" || cached === "buyer") return cached as EffectiveUserType;
  } catch {
    // intentionally empty
  }

  return "unknown";
}

export function setRoleHint(userId: string, role: EffectiveUserType) {
  if (!userId) return;
  if (role !== "admin" && role !== "seller" && role !== "buyer") return;
  try {
    localStorage.setItem(`smp:role_hint:${userId}`, role);
  } catch {
    // intentionally empty
  }
}

export function getEffectiveUserType(opts: {
  profile?: ProfileLike | null;
  user?: User | null;
  hasBusiness?: boolean;
  isAdminRole?: boolean;
  profileLoaded?: boolean;
}): EffectiveUserType {
  const { profile, user, hasBusiness, isAdminRole, profileLoaded } = opts;
  if (!profileLoaded) {
    return getRoleHint(user);
  }
  if (isAdminRole || normalizeRole(profile?.role) === "admin") return "admin";

  const profileType = normalizeRole(profile?.user_type);
  if (profileType === "seller" || hasBusiness) return "seller";

  return "buyer";
}

export function getEffectiveAccountType(opts: {
  profile?: ProfileLike | null;
  user?: User | null;
  hasBusiness?: boolean;
  isAdminRole?: boolean;
  profileLoaded?: boolean;
}): EffectiveAccountType {
  const resolved = getEffectiveUserType(opts);
  return resolved === "unknown" ? null : resolved;
}

export function getAccountStatus(opts: {
  profile?: ProfileLike | null;
  user?: User | null;
  hasBusiness?: boolean;
  isAdminRole?: boolean;
  profileLoaded?: boolean;
}): AccountStatus {
  const isLoggedIn = !!opts.user;
  const ready = !opts.user || !!opts.profileLoaded;
  const effectiveType = ready ? getEffectiveAccountType(opts) : null;
  const roleLabel =
    effectiveType === "admin"
      ? "Admin"
      : effectiveType === "seller"
      ? "Seller"
      : effectiveType === "buyer"
      ? "Buyer"
      : null;
  return {
    effectiveType,
    ready,
    isLoggedIn,
    isAdmin: effectiveType === "admin",
    isSeller: effectiveType === "seller",
    isBuyer: effectiveType === "buyer",
    roleLabel,
  };
}
