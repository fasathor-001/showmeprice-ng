import { supabase } from "./supabase";

type InvokeOptions<T> = {
  body?: T;
};

function nav(to: string) {
  try {
    if (window.location.pathname !== to) window.history.pushState({}, "", to);
    window.dispatchEvent(new Event("smp:navigate"));
  } catch {
    window.location.href = to;
  }
}

export async function invokeAuthedFunction<TBody extends Record<string, unknown>>(
  name: string,
  options?: InvokeOptions<TBody>
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    try {
      sessionStorage.setItem("smp:auth_notice", "Session expired. Please sign in again.");
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    nav("/signin");
    throw new Error("Session expired. Please sign in again.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    try {
      sessionStorage.setItem("smp:auth_notice", "Session expired. Please sign in again.");
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    nav("/signin");
    throw new Error("Please sign in again.");
  }

  const result = await supabase.functions.invoke(name, {
    body: options?.body ?? {},
  });

  if (result.error) {
    let detail = result.error.message;
    try {
      const ctx = (result.error as any)?.context;
      if (ctx?.json) {
        const parsed = await ctx.json();
        detail = parsed?.detail || parsed?.error || detail;
      }
    } catch {}
    (result.error as any).message = detail;
  }

  return result;
}
