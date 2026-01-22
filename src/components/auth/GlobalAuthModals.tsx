// src/components/auth/GlobalAuthModals.tsx
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";
import { useStates } from "../../hooks/useStates";
import { supabase } from "../../lib/supabase";

type OpenMode = "login" | "register" | "reset";

export default function GlobalAuthModals() {
  // useAuth may evolve; keep this component resilient
  const auth: any = useAuth();
  const signIn: (email: string, password: string) => Promise<any> = auth.signIn ?? auth.login;
  const signUp: (email: string, password: string, options?: { data?: Record<string, any> }) => Promise<any> =
    auth.signUp ?? auth.register;

  // Prefer hook resetPassword if present, otherwise fallback to Supabase directly
  const resetPassword: (email: string) => Promise<void> =
    auth.resetPassword ??
    (async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    });

  const { states, loading: statesLoading } = useStates();

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const [userType, setUserType] = useState<"buyer" | "seller">("buyer");
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");

  const [regForm, setRegForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    businessType: "",
    sellerState: "",
    sellerCity: "",
    businessAddress: "",
    terms: false,
  });

  const anyModalOpen = isRegisterOpen || isAuthOpen || isForgotOpen;

  const statesOptions = useMemo(() => states ?? [], [states]);

  // Helpers
  const closeAll = () => {
    setIsRegisterOpen(false);
    setIsAuthOpen(false);
    setIsForgotOpen(false);
  };

  const resetStatus = () => {
    setAuthError(null);
    setForgotSuccess(false);
    setRegSuccess(false);
    setAuthLoading(false);
  };

  const openWith = (mode: OpenMode) => {
    closeAll();
    resetStatus();

    if (mode === "login") setIsAuthOpen(true);
    if (mode === "register") setIsRegisterOpen(true);
    if (mode === "reset") setIsForgotOpen(true);
  };

  // ✅ Global openers (Navbar + any component can call these)
  useEffect(() => {
    // old API (keep for backward compatibility)
    (window as any).openRegisterModal = () => openWith("register");
    (window as any).openAuthModal = () => openWith("login");
    (window as any).openForgotPasswordModal = () => openWith("reset");

    // ✅ new unified API (Navbar uses this as strongest fallback)
    (window as any).smpOpenAuth = (mode: OpenMode) => openWith(mode);

    // ✅ listen to events (Navbar dispatches this)
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const mode = (detail?.mode as OpenMode | undefined) ?? "login";
      if (mode === "login" || mode === "register" || mode === "reset") openWith(mode);
    };
    window.addEventListener("smp:open-auth", onOpen as any);

    return () => {
      try {
        delete (window as any).openRegisterModal;
        delete (window as any).openAuthModal;
        delete (window as any).openForgotPasswordModal;
        delete (window as any).smpOpenAuth;
      } catch {}
      window.removeEventListener("smp:open-auth", onOpen as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on ESC (good UX)
  useEffect(() => {
    if (!anyModalOpen) return;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeAll();
        resetStatus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anyModalOpen]);

  const closeRegisterModal = () => {
    setIsRegisterOpen(false);
    setAuthError(null);
    setRegSuccess(false);
  };

  const closeAuthModal = () => {
    setIsAuthOpen(false);
    setAuthError(null);
  };

  const closeForgotModal = () => {
    setIsForgotOpen(false);
    setAuthError(null);
  };

  const switchToLogin = () => openWith("login");
  const switchToRegister = () => openWith("register");
  const switchToLoginFromForgot = () => openWith("login");

  const togglePassword = (id: string) => {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  function navigateToHomeAndMaybeDashboard(isSeller: boolean) {
    if (!isSeller) return;

    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new Event("smp:navigate"));
    }

    setTimeout(() => {
      window.dispatchEvent(new Event("smp:view-dashboard"));
      window.scrollTo(0, 0);
    }, 50);
  }

  function navigateToAccount() {
    if (window.location.pathname !== "/account") {
      window.history.pushState({}, "", "/account");
      window.dispatchEvent(new Event("smp:navigate"));
    }
  }

  const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const email = regForm.email.trim();
    const name = regForm.name.trim();
    const phone = regForm.phone.trim();
    const city = regForm.sellerCity.trim();
    const businessName = regForm.businessName.trim();
    const businessAddress = regForm.businessAddress.trim();
    const stateValue = regForm.sellerState.trim();

    if (!name) {
      setAuthError("Please enter your full name.");
      setAuthLoading(false);
      return;
    }
    if (!phone) {
      setAuthError("Please enter your phone number.");
      setAuthLoading(false);
      return;
    }
    if (!city) {
      setAuthError("Please enter your city or area.");
      setAuthLoading(false);
      return;
    }
    if (!stateValue) {
      setAuthError("Please select your state.");
      setAuthLoading(false);
      return;
    }
    if (userType === "seller") {
      if (!businessName) {
        setAuthError("Please enter your business name.");
        setAuthLoading(false);
        return;
      }
      if (!businessAddress) {
        setAuthError("Please enter your business address.");
        setAuthLoading(false);
        return;
      }
    }

    if (regForm.password !== regForm.confirmPassword) {
      setAuthError("Passwords do not match");
      setAuthLoading(false);
      return;
    }
    if (regForm.password.length < 6) {
      setAuthError("Password must be at least 6 characters");
      setAuthLoading(false);
      return;
    }
    if (!regForm.terms) {
      setAuthError("Please accept the Terms and Privacy Policy to continue.");
      setAuthLoading(false);
      return;
    }

    try {
      let stateId: number | null = null;
      if (stateValue) {
        const parsed = parseInt(stateValue, 10);
        if (Number.isFinite(parsed)) stateId = parsed;
      }

      // ✅ IMPORTANT: signUp expects { data: { ... } }
      const data = await signUp(email, regForm.password, {
        data: {
          full_name: name,
          fullName: name,
          display_name: name,
          displayName: name,
          phone,
          user_type: userType,
          userType: userType,
          business_name: businessName || "",
          business_type: regForm.businessType || "",
          city: city || "",
          address: userType === "seller" ? businessAddress : "",
          state_id: stateId,
        },
      });

      // Email confirmation ON (user created, session not created yet)
      if (data?.user && !data?.session) {
        setRegSuccess(true);
        return;
      }

      // Logged in immediately (Email confirmation OFF)
      if (data?.session) {
        try {
          const userId = String(data.session.user?.id ?? "").trim();
          if (!userId) throw new Error("Missing user id.");
          const profilePayload = {
            id: userId,
            full_name: name,
            display_name: name,
            phone,
            city: city || null,
            state_id: stateId,
            user_type: userType,
            business_name: businessName || null,
            address: userType === "seller" ? businessAddress : null,
          } as any;
          const { error: upErr } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
          if (upErr) throw upErr;
        } catch (err: any) {
          console.error("Profile upsert failed after sign up:", err);
          setAuthError(err?.message || "Signup completed, but profile setup failed.");
          return;
        }

        closeRegisterModal();
        const isSeller = (data.user?.user_metadata as any)?.user_type === "seller";
        navigateToAccount();
        navigateToHomeAndMaybeDashboard(!!isSeller);
        return;
      }

      setAuthError("Signup completed but no session was created. Please check your email.");
    } catch (err: any) {
      console.error("Registration error:", err);
      const msg = (err?.message || "").toLowerCase();

      if (msg.includes("already registered") || msg.includes("already exists")) {
        setAuthError("This email is already registered. Try logging in.");
      } else if (msg.includes("invalid email")) {
        setAuthError("Please enter a valid email address.");
      } else if (msg.includes("password")) {
        setAuthError(err?.message || "Password is not accepted. Try a stronger password.");
      } else {
        setAuthError(err?.message || "Failed to register. Please try again.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const email = loginForm.email.trim();
      const data = await signIn(email, loginForm.password);

      if (data?.session) {
        closeAuthModal();
        navigateToAccount();
        return;
      }

      // If some odd flow returns no session:
      setAuthError("Login completed but no session was created. Please try again.");
    } catch (err: any) {
      console.error("Login error:", err);

      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("invalid login credentials")) {
        setAuthError("Incorrect login credentials.");
      } else {
        setAuthError(err?.message || "Invalid email or password.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const email = forgotEmail.trim();
      await resetPassword(email);
      setForgotSuccess(true);
    } catch (err: any) {
      console.error("Reset password error:", err);
      setAuthError(err?.message || "Failed to send reset email.");
    } finally {
      setAuthLoading(false);
    }
  };

  const socialSoon = () => {
    alert("Social sign-in UI is ready. OAuth wiring comes in a later phase.");
  };

  // Small CSS helpers used by your markup (keeps your UI stable)
  const formControlClass =
    "w-full px-4 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-white";
  const passwordWrapperClass = "relative";
  const passwordToggleClass =
    "absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700";

  return (
    <>
      {/* REGISTER */}
      <div
        id="registerModal"
        className={`fixed inset-0 z-[120] modal-overlay items-center justify-center p-4 flex ${
          isRegisterOpen ? "" : "hidden"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Create account"
      >
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-view max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header (fixed) */}
          <div className="bg-brand text-white p-6 rounded-t-2xl text-center relative flex-shrink-0">
            <button
              onClick={closeRegisterModal}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
              type="button"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-brand font-bold text-xs">
                SMP
              </div>
              <span className="font-bold text-xl">ShowMePrice.ng</span>
            </div>
            <p className="text-brand-50 text-sm">Join Nigeria&apos;s trusted marketplace</p>
          </div>

          {/* Body (scrollable) */}
          <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
            {regSuccess ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Check your email</h3>
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">
                  We&apos;ve sent a confirmation link to <strong>{regForm.email}</strong>.
                  <br />
                  Please click the link to activate your account.
                </p>
                <button
                  onClick={switchToLogin}
                  className="bg-brand text-white px-6 py-3 rounded-lg font-bold text-sm w-full hover:opacity-90"
                  type="button"
                >
                  Proceed to Login
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Create your account</h2>
                <p className="text-slate-500 text-sm mb-6">Get started with verified buying &amp; selling</p>

                {authError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {authError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    type="button"
                    onClick={() => setUserType("buyer")}
                    className={`p-3 border rounded-lg text-center flex items-center justify-center gap-2 transition ${
                      userType === "buyer"
                        ? "border-blue-600 text-blue-600 bg-blue-50 ring-1 ring-blue-600"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="font-bold text-sm">I&apos;m a Buyer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserType("seller")}
                    className={`p-3 border rounded-lg text-center flex items-center justify-center gap-2 transition ${
                      userType === "seller"
                        ? "border-green-600 text-green-600 bg-green-50 ring-1 ring-green-600"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Store className="w-4 h-4" />
                    <span className="font-bold text-sm">I&apos;m a Seller</span>
                  </button>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Full Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      className={formControlClass}
                      required
                      value={regForm.name}
                      onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Email Address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className={formControlClass}
                      required
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+234 801 234 5678"
                      className={formControlClass}
                      required
                      value={regForm.phone}
                      onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">City / Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Ikeja, Surulere"
                      className={formControlClass}
                      required
                      value={regForm.sellerCity}
                      onChange={(e) => setRegForm({ ...regForm, sellerCity: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">State</label>
                    <select
                      className={formControlClass}
                      required
                      disabled={statesLoading}
                      value={regForm.sellerState}
                      onChange={(e) => setRegForm({ ...regForm, sellerState: e.target.value })}
                    >
                      <option value="">Select State</option>
                      {statesOptions.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Password</label>
                    <div className={passwordWrapperClass}>
                      <input
                        type={showPassword["regPassword"] ? "text" : "password"}
                        placeholder="Create a strong password"
                        className={formControlClass}
                        required
                        value={regForm.password}
                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        className={passwordToggleClass}
                        onClick={() => togglePassword("regPassword")}
                        aria-label={showPassword["regPassword"] ? "Hide password" : "Show password"}
                      >
                        {showPassword["regPassword"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Confirm Password</label>
                    <div className={passwordWrapperClass}>
                      <input
                        type={showPassword["regConfirmPassword"] ? "text" : "password"}
                        placeholder="Confirm your password"
                        className={formControlClass}
                        required
                        value={regForm.confirmPassword}
                        onChange={(e) => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                      />
                      <button
                        type="button"
                        className={passwordToggleClass}
                        onClick={() => togglePassword("regConfirmPassword")}
                        aria-label={showPassword["regConfirmPassword"] ? "Hide password" : "Show password"}
                      >
                        {showPassword["regConfirmPassword"] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {userType === "seller" && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 mt-4">
                      <h4 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        Seller Information
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-slate-600 mb-1 block">Business Name</label>
                          <input
                            type="text"
                            placeholder="Your Business Name"
                            className={formControlClass}
                            value={regForm.businessName}
                            onChange={(e) => setRegForm({ ...regForm, businessName: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-600 mb-1 block">Business Type</label>
                          <select
                            className={formControlClass}
                            value={regForm.businessType}
                            onChange={(e) => setRegForm({ ...regForm, businessType: e.target.value })}
                          >
                            <option value="">Select business type</option>
                            <option value="individual">Individual Seller</option>
                            <option value="registered">Registered Business</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-600 mb-1 block">Business Address</label>
                          <input
                            type="text"
                            placeholder="e.g., 12 Admiralty Way, Lekki"
                            className={formControlClass}
                            value={regForm.businessAddress}
                            onChange={(e) => setRegForm({ ...regForm, businessAddress: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 mt-4">
                    <input
                      type="checkbox"
                      id="regTerms"
                      className="w-4 h-4 mt-1 accent-brand"
                      required
                      checked={regForm.terms}
                      onChange={(e) => setRegForm({ ...regForm, terms: e.target.checked })}
                    />
                    <label htmlFor="regTerms" className="text-slate-500 text-xs leading-relaxed">
                      I agree to the{" "}
                      <a href="#" className="text-brand font-bold hover:underline">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="#" className="text-brand font-bold hover:underline">
                        Privacy Policy
                      </a>
                      . I confirm that I am at least 18 years old.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-brand text-white py-3 rounded-lg font-bold text-sm hover:opacity-90 transition shadow-sm mt-2 disabled:opacity-50"
                  >
                    {authLoading ? "Creating Account..." : "Create Account"}
                  </button>
                </form>

                <div className="text-center mt-6 pt-6 border-t border-slate-100">
                  <p className="text-slate-500 text-sm">
                    Already have an account?
                    <button
                      onClick={switchToLogin}
                      className="text-brand font-bold hover:underline ml-1"
                      type="button"
                    >
                      Sign in
                    </button>
                  </p>
                  <button
                    onClick={() => (window.location.href = "/")}
                    className="text-brand font-bold text-sm hover:underline mt-4 block mx-auto"
                    type="button"
                  >
                    Back to Homepage
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* LOGIN */}
      <div
        id="authModal"
        className={`fixed inset-0 z-[120] modal-overlay items-center justify-center p-4 ${
          isAuthOpen ? "flex" : "hidden"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
      >
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-view overflow-hidden">
          <div className="bg-brand text-white p-6 text-center relative">
            <button
              onClick={closeAuthModal}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
              type="button"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-brand font-bold text-xs">
                SMP
              </div>
              <span className="font-bold text-xl">ShowMePrice.ng</span>
            </div>
            <p className="text-brand-50 text-sm">Welcome back to Nigeria&apos;s trusted marketplace</p>
          </div>

          <div className="p-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Sign in to your account</h2>
            <p className="text-slate-500 text-sm mb-6">Enter your credentials to continue</p>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {authError}
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-700 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Reset instructions sent! Check your email.
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className={formControlClass}
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Password</label>
                <div className={passwordWrapperClass}>
                  <input
                    type={showPassword["loginPassword"] ? "text" : "password"}
                    placeholder="Enter your password"
                    className={formControlClass}
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className={passwordToggleClass}
                    onClick={() => togglePassword("loginPassword")}
                    aria-label={showPassword["loginPassword"] ? "Hide password" : "Show password"}
                  >
                    {showPassword["loginPassword"] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" className="w-4 h-4 accent-brand" />
                  Remember me
                </label>

                <button
                  type="button"
                  onClick={() => openWith("reset")}
                  className="text-brand font-bold text-sm hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-brand text-white py-3 rounded-lg font-bold text-sm hover:opacity-90 transition mt-2 disabled:opacity-50"
              >
                {authLoading ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-4 text-slate-400 text-xs">Or continue with</span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* Google */}
              <button
                onClick={socialSoon}
                type="button"
                className="flex items-center justify-center gap-2 border border-slate-200 py-2.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.1 0 5.9 1.1 8.1 3l5.9-5.9C34.4 3.2 29.6 1 24 1 14.9 1 7.3 6.2 3.3 13.8l6.9 5.4C12.2 13.2 17.6 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.7h12.5c-.5 3-2.2 5.5-4.8 7.2l7.3 5.7c4.3-4 7.1-9.9 7.1-16.5z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.2 28.6c-.6-1.7-1-3.5-1-5.4s.4-3.7 1-5.4l-6.9-5.4C1.8 15.5 1 19.2 1 23.2s.8 7.7 2.3 10.8l6.9-5.4z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 46c5.6 0 10.4-1.8 13.9-5l-7.3-5.7c-2 1.4-4.7 2.3-6.6 2.3-6.4 0-11.8-3.7-13.8-9.1l-6.9 5.4C7.3 41.8 14.9 46 24 46z"
                  />
                </svg>
                Google
              </button>

              {/* Facebook */}
              <button
                onClick={socialSoon}
                type="button"
                className="flex items-center justify-center gap-2 border border-slate-200 py-2.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#1877F2"
                    d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23 10.1 24v-8.4H7.1v-3.5h3V9.5c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.2h3.4l-.5 3.5h-2.9V24C19.6 23 24 18.1 24 12.1z"
                  />
                </svg>
                Facebook
              </button>
            </div>

            <div className="text-center">
              <p className="text-slate-500 text-sm">
                Don&apos;t have an account?
                <button onClick={switchToRegister} className="text-brand font-bold hover:underline ml-1" type="button">
                  Create account
                </button>
              </p>
              <button
                onClick={() => (window.location.href = "/")}
                className="text-brand font-bold text-sm hover:underline mt-4 block mx-auto"
                type="button"
              >
                Back to Homepage
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD */}
      <div
        id="forgotPasswordModal"
        className={`fixed inset-0 z-[120] modal-overlay items-center justify-center p-4 ${
          isForgotOpen ? "flex" : "hidden"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Reset password"
      >
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-view overflow-hidden">
          <div className="bg-brand text-white p-6 text-center relative">
            <button
              onClick={closeForgotModal}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
              type="button"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-brand font-bold text-xs">
                SMP
              </div>
              <span className="font-bold text-xl">ShowMePrice.ng</span>
            </div>
          </div>

          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-2">Reset your password</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              Enter your email address and we&apos;ll send you instructions to reset your password.
            </p>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4" />
                {authError}
              </div>
            )}

            {forgotSuccess ? (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-bold mb-4">
                Check your email for the reset link!
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Email Address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className={formControlClass}
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-brand text-white py-3 rounded-lg font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
                >
                  {authLoading ? "Sending..." : "Send Reset Instructions"}
                </button>
              </form>
            )}

            <div className="text-center mt-6">
              <p className="text-slate-500 text-sm">
                Remember your password?{" "}
                <button onClick={switchToLoginFromForgot} className="text-brand font-bold hover:underline" type="button">
                  Back to Sign in
                </button>
              </p>
              <button
                onClick={() => (window.location.href = "/")}
                className="text-brand font-bold text-sm hover:underline mt-4 block mx-auto"
                type="button"
              >
                Back to Homepage
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
