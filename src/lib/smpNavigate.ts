type NavigateOptions = {
  replace?: boolean;
};

function normalizePath(to: string) {
  if (!to) return "/";
  return to.startsWith("/") ? to : `/${to}`;
}

export function smpNavigate(to: string, opts: NavigateOptions = {}) {
  const path = normalizePath(to);
  try {
    if (opts.replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    window.dispatchEvent(new CustomEvent("smp:navigate", { detail: { to: path } }));
  } catch {
    window.location.href = path;
  }
}
