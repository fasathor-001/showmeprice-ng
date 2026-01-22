// src/hooks/useAuth.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { setAuthSession } from "../lib/authSession";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  error: string | null;
};

type Listener = (session: Session | null, user: User | null) => void;

let booted = false;
let currentSession: Session | null = null;
let currentUser: User | null = null;
const listeners = new Set<Listener>();

async function bootAuthOnce() {
  if (booted) return;
  booted = true;

  try {
    const { data } = await supabase.auth.getSession();
    currentSession = data.session ?? null;
    currentUser = data.session?.user ?? null;
    setAuthSession(currentSession);
    listeners.forEach((fn) => fn(currentSession, currentUser));
  } catch {
    currentSession = null;
    currentUser = null;
    setAuthSession(null);
    listeners.forEach((fn) => fn(currentSession, currentUser));
  }

  supabase.auth.onAuthStateChange((_evt, session) => {
    currentSession = session ?? null;
    currentUser = session?.user ?? null;
    setAuthSession(currentSession);
    listeners.forEach((fn) => fn(currentSession, currentUser));
  });
}

function notify(session: Session | null, user: User | null) {
  currentSession = session;
  currentUser = user;
  setAuthSession(session);
  listeners.forEach((fn) => fn(session, user));
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: currentUser,
    session: currentSession,
    loading: true,
    authReady: false,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    bootAuthOnce().finally(() => {
      if (!alive) return;
      setState((s) => ({ ...s, authReady: true, loading: false }));
    });

    const fn: Listener = (session, user) => {
      if (!alive) return;
      setState((s) => ({
        ...s,
        session,
        user,
        loading: false,
        authReady: true,
        error: null,
      }));
    };

    listeners.add(fn);
    fn(currentSession, currentUser);

    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim();
    setState((s) => ({ ...s, loading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      throw error;
    }

    const session = data?.session ?? null;
    if (!session) {
      const msg = "Login completed but no session was created. Please try again.";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw new Error(msg);
    }

    notify(session, session.user);
    setState((s) => ({ ...s, loading: false, authReady: true, error: null }));

    return { user: session.user, session };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, options?: { data?: Record<string, any> }) => {
      const cleanEmail = email.trim();
      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: options?.data ? { data: options.data } : undefined,
      });

      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        throw error;
      }

      setState((s) => ({ ...s, loading: false, error: null }));
      return data;
    },
    []
  );

  const resetPassword = useCallback(async (email: string) => {
    const cleanEmail = email.trim();
    setState((s) => ({ ...s, loading: true, error: null }));

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });

    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      throw error;
    }

    setState((s) => ({ ...s, loading: false, error: null }));
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      throw error;
    }

    setState((s) => ({ ...s, loading: false, error: null }));
  }, []);

  const signOut = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const { error } = await supabase.auth.signOut();
    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      throw error;
    }
    notify(null, null);
    setState({ user: null, session: null, loading: false, authReady: true, error: null });
  }, []);

  const login = signIn;
  const logout = signOut;
  const register = signUp;

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    authReady: state.authReady,
    loadingAuth: state.loading,
    error: state.error,

    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,

    login,
    logout,
    register,
  };
}

export default useAuth;
