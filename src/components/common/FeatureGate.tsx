import React from "react";
import { useFeatureFlags, type UserContext } from "../../hooks/useFeatureFlags";
import { useProfile } from "../../hooks/useProfile";
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

  const profileData = profile as Record<string, unknown> | null;
  const ctx = {
    isAuthenticated: Boolean(user),
    role: profileData?.role ?? null,
    plan: isPremium ? "premium" : (tier === "institution" ? "institution" : "free"),
  } satisfies UserContext;

  const allowed = isEnabled(flagKey) && canUserSee(flagKey, ctx);
  if (!allowed) return <>{fallback}</>;

  return <>{children}</>;
}

