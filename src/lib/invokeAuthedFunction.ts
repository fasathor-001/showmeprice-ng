import { supabase } from "./supabase";

type InvokeOptions<T> = {
  body?: T;
  headers?: Record<string, string>;
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

  const jwt = (session?.access_token ?? "").trim();
  console.log("[invokeAuthedFunction] token", {
    hasSession: !!session,
    jwtLen: jwt.length,
    jwtParts: jwt ? jwt.split(".").length : 0,
    jwtPrefix: jwt.slice(0, 10),
  });

  if (!session?.access_token) {
    throw new Error("No session (please login again)");
  }
  if (!jwt || jwt.split(".").length !== 3) {
    try {
      sessionStorage.setItem("smp:auth_notice", "Session expired. Please sign in again.");
    } catch {
      // intentionally empty
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // intentionally empty
    }
    nav("/signin");
    throw new Error("Session expired. Please sign in again.");
  }

  const result = await supabase.functions.invoke(name, {
    body: options?.body ?? {},
    headers: { ...(options?.headers ?? {}), Authorization: `Bearer ${jwt}` },
  });

  const signOutForInvalidJwt = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // intentionally empty
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("smp:toast", {
          detail: { type: "error", message: "Session expired or env mismatch. Please sign in again." },
        })
      );
    }
  };

  if (result.error) {
    console.error("[invokeAuthedFunction] error", result.error);
    let detail = result.error.message;
    try {
      const ctx = (result.error as any)?.context;
      if (ctx?.response) {
        const text = await ctx.response.text();
        if (ctx?.response?.status) {
          console.error("[invokeAuthedFunction] response", {
            status: ctx.response.status,
            statusText: ctx.response.statusText,
            text,
          });
        }
        if (text) detail = `${detail}: ${text}`;
        if (ctx?.response?.status === 401 && /invalid jwt/i.test(text)) {
          await signOutForInvalidJwt();
          throw new Error("Session expired or env mismatch. Please sign in again.");
        }
      } else if (ctx?.json) {
        const parsed = await ctx.json();
        const extra =
          parsed && typeof parsed === "object"
            ? parsed?.detail || parsed?.error || parsed?.message || JSON.stringify(parsed)
            : String(parsed ?? "");
        if (extra) detail = `${detail}: ${extra}`;
        if (/invalid jwt/i.test(extra)) {
          await signOutForInvalidJwt();
          throw new Error("Session expired or env mismatch. Please sign in again.");
        }
      }
    } catch {
      // intentionally empty
    }
    (result.error as any).message = detail;
  }

  return result;
}
