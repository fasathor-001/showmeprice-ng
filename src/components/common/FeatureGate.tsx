import React from "react";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
type UserContext = "all" | "authenticated" | "premium" | "institution" | "admin";import { useProfile } from "../../hooks/useProfile";
import { useAuth } from "../../hooks/useAuth";
import { useMembership } from "../../hooks/useMembership";

type Props = {
  flagKey: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * FeatureGate
 * - Hides children if:
 *   (a) flag disabled, OR
 *   (b) user not allowed by visible_to
 * - Safe-by-default: if flags are loading or erroring, gated features are hidden.
 * - Constitution: in_app_messaging_enabled is always allowed and always renders.
 *
 * TODO (server-side): For blocking direct API access, enforce feature access via RLS/RPC.
 */
export default function FeatureGate({ flagKey, fallback = null, children }: Props) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isPremium, tier } = useMembership();
  const { isEnabled, canUserSee, loading, error } = useFeatureFlags();

  if (flagKey === "in_app_messaging_enabled") {
    return <>{children}</>;
  }

  if (loading || error) {
    return <>{fallback}</>;
  }

  const ctx: UserContext = {
    isAuthenticated: Boolean(user),
    role: (profile as any)?.role ?? null,
    plan: isPremium ? "premium" : (tier === "institution" ? "institution" : "free"),
  };

  const allowed = isEnabled(flagKey) && canUserSee(flagKey, ctx);
  if (!allowed) return <>{fallback}</>;

  return <>{children}</>;
}

