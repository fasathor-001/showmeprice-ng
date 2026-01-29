import * as React from "react";

type Props = React.PropsWithChildren<object>;

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Unexpected error" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log for diagnostics; avoid crashing the UI.
    console.error("ErrorBoundary caught error", error, info);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      window.location.href = "/";
    }
  };

  handleGoHome = () => {
    try {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new Event("smp:navigate"));
    } catch {
      window.location.href = "/";
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const showDetail = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-lg font-black text-slate-900">Something went wrong</div>
          <div className="text-sm text-slate-600 mt-2">
            An unexpected error occurred. You can reload the page or return home.
          </div>
          {showDetail ? (
            <div className="mt-3 rounded-lg border bg-slate-50 p-3 text-xs text-slate-700">
              {this.state.message}
            </div>
          ) : null}
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="px-4 py-2 rounded-xl border bg-white text-slate-700 font-bold hover:bg-slate-50"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
