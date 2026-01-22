import type { Session, User } from "@supabase/supabase-js";

let currentSession: Session | null = null;
let currentUser: User | null = null;

export function setAuthSession(session: Session | null) {
  currentSession = session;
  currentUser = session?.user ?? null;
}

export function getAuthSession(): Session | null {
  return currentSession;
}

export function getAuthUser(): User | null {
  return currentUser;
}
