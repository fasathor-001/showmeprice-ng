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

  const jwt = (session?.access_token ?? "").trim();
  const jwtParts = jwt.split(".").length;
  console.log("[invokeAuthedFunction] token", {
    hasSession: !!session,
    jwtLen: jwt.length,
    jwtParts,
    jwtPrefix: jwt.slice(0, 10),
  });

  if (!jwt || jwtParts !== 3) {
    try {
      sessionStorage.setItem("smp:auth_notice", "Session expired. Please sign in again.");
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    nav("/signin");
    throw new Error("Session expired. Please sign in again.");
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(options?.body ?? {}),
  });

  let data: any = null;
  let error: any = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const detail =
      typeof data === "string"
        ? data
        : data && typeof data === "object"
        ? data?.error || data?.message || JSON.stringify(data)
        : "";
    error = { message: `${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}` };
  }
  return { data, error };
}
