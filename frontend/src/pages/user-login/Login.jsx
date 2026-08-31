import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Smartphone,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Search,
  Sun,
  Moon,
  Sparkles,
  Zap,
  Mail,
} from "lucide-react";
import { toast } from "react-toastify";

import useThemeStore from "../../store/useThemeStore";
import useUserStore from "../../store/useUserStore";
import { sendOtp, verifyOtp, googleSignIn } from "../../services/user.service";

// Top countries dataset for quick selection
const COUNTRIES = [
  { alpha2: "IN", dialCode: "+91", flag: "🇮🇳", name: "India" },
  { alpha2: "US", dialCode: "+1", flag: "🇺🇸", name: "United States" },
  { alpha2: "GB", dialCode: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { alpha2: "AE", dialCode: "+971", flag: "🇦🇪", name: "UAE" },
  { alpha2: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada" },
  { alpha2: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia" },
  { alpha2: "DE", dialCode: "+49", flag: "🇩🇪", name: "Germany" },
  { alpha2: "FR", dialCode: "+33", flag: "🇫🇷", name: "France" },
  { alpha2: "BR", dialCode: "+55", flag: "🇧🇷", name: "Brazil" },
  { alpha2: "JP", dialCode: "+81", flag: "🇯🇵", name: "Japan" },
  { alpha2: "SG", dialCode: "+65", flag: "🇸🇬", name: "Singapore" },
  { alpha2: "NG", dialCode: "+234", flag: "🇳🇬", name: "Nigeria" },
];

export default function Login() {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();
  const setUser = useUserStore((state) => state.setUser);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  const dark = theme === "dark";
  const toggleTheme = () => setTheme(dark ? "light" : "dark");

  // Authentication mode: "select" | "phone" | "otp" | "google-email"
  const [authStep, setAuthStep] = useState("select");
  
  // Phone State
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Google Email State (instant fallback when client id not present)
  const [googleEmail, setGoogleEmail] = useState("");

  // OTP State
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef([]);

  // Async UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // If already authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Resend Countdown Timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Initialize Google Identity Services
  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id && clientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            itp_support: true,
          });

          const btnContainer = document.getElementById("google-hidden-btn-container");
          if (btnContainer) {
            window.google.accounts.id.renderButton(btnContainer, {
              theme: "outline",
              size: "large",
              type: "standard",
            });
          }
        } catch (e) {
          console.warn("Google Sign-In init warning:", e);
        }
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Google Sign-In Handler
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      setError("Google sign-in was cancelled or failed.");
      return;
    }
    setGoogleLoading(true);
    setError(null);

    try {
      const res = await googleSignIn({ credential: response.credential });
      if (res?.data?.user) {
        const userData = res.data.user;
        setUser(userData);
        if (userData.profileCompleted || res.data.profileCompleted) {
          toast.success(`Welcome to Flash Chat, ${userData.displayName || "User"}!`);
          navigate("/", { replace: true });
        } else {
          toast.info("Welcome! Please create your profile.");
          navigate("/create-profile", { replace: true });
        }
      } else {
        throw new Error(res?.message || "Google authentication failed.");
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
      const msg =
        typeof err === "string"
          ? err
          : err?.message || err?.error || "Google authentication failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const triggerGoogleSignIn = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (clientId && window.google?.accounts?.id) {
      setError(null);
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const hiddenBtn = document.querySelector("#google-hidden-btn-container div[role=button]");
          if (hiddenBtn) {
            hiddenBtn.click();
          }
        }
      });
    } else {
      // Fallback direct Google / Gmail entry
      setError(null);
      setAuthStep("google-email");
    }
  };

  const handleDirectGoogleLogin = async (e) => {
    e?.preventDefault();
    const cleanEmail = googleEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid Google / Gmail address.");
      return;
    }

    setGoogleLoading(true);
    setError(null);

    try {
      const res = await googleSignIn({ email: cleanEmail });
      if (res?.data?.user) {
        const userData = res.data.user;
        setUser(userData);
        if (userData.profileCompleted || res.data.profileCompleted) {
          toast.success(`Welcome to Flash Chat, ${userData.displayName || "User"}!`);
          navigate("/", { replace: true });
        } else {
          toast.info("Welcome! Please complete your profile.");
          navigate("/create-profile", { replace: true });
        }
      } else {
        throw new Error(res?.message || "Google authentication failed.");
      }
    } catch (err) {
      console.error("Google Auth Error:", err);
      const msg =
        typeof err === "string"
          ? err
          : err?.message || err?.error || "Google authentication failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Step 1: Send Mobile OTP
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const cleanNumber = phoneNumber.trim().replace(/\D/g, "");
    if (!cleanNumber || cleanNumber.length < 7 || cleanNumber.length > 15) {
      setError("Please enter a valid mobile number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendOtp(cleanNumber, selectedCountry.dialCode);
      setAuthStep("otp");
      setResendCooldown(30);
      setOtpDigits(["", "", "", "", "", ""]);
      toast.success(`OTP sent to ${selectedCountry.dialCode} ${cleanNumber}`);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.error("Send OTP Error:", err);
      const msg =
        typeof err === "string"
          ? err
          : err?.message || "Failed to send OTP. Please check your number and try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Mobile OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    const otp = otpDigits.join("").trim();
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanNumber = phoneNumber.trim().replace(/\D/g, "");
      const res = await verifyOtp(cleanNumber, selectedCountry.dialCode, otp);
      if (res?.data?.user) {
        const userData = res.data.user;
        setUser(userData);
        if (userData.profileCompleted || res.data.profileCompleted) {
          toast.success(`Welcome to Flash Chat, ${userData.displayName || "User"}!`);
          navigate("/", { replace: true });
        } else {
          toast.info("Welcome! Please create your profile.");
          navigate("/create-profile", { replace: true });
        }
      } else {
        throw new Error(res?.message || "Verification failed.");
      }
    } catch (err) {
      console.error("Verify OTP Error:", err);
      const msg =
        typeof err === "string"
          ? err
          : err?.message || "Incorrect or expired OTP. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Segmented OTP Input Navigation
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setError(null);

    // Auto advance focus
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setOtpDigits(newDigits);
      if (pasted.length === 6) {
        otpInputRefs.current[5]?.focus();
      } else {
        otpInputRefs.current[pasted.length]?.focus();
      }
    }
  };

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dialCode.includes(countrySearch)
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0c0d0e] transition-colors duration-300 relative overflow-hidden font-sans">
      {/* Background Ambience Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#FF6B00]/10 dark:bg-[#FF6B00]/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-[120px] pointer-events-none" />

      {/* Top Navbar / Theme Switcher */}
      <header className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={toggleTheme}
          type="button"
          aria-label="Toggle dark/light theme"
          className="p-2.5 rounded-xl bg-white/80 dark:bg-[#18191b]/80 border border-slate-200 dark:border-white/10 shadow-sm hover:scale-105 active:scale-95 transition-all text-slate-700 dark:text-slate-300"
        >
          {dark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
        </button>
      </header>

      {/* Main Authentication Card */}
      <main className="w-full max-w-md bg-white dark:bg-[#141517] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-2xl p-8 sm:p-10 relative z-10 backdrop-blur-xl transition-all duration-300">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 text-white shadow-lg shadow-[#FF6B00]/25 mb-4 animate-pulse">
            <Zap className="w-9 h-9 fill-current" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
            FLASH <span className="text-[#FF6B00]">⚡</span>
          </h1>
          <p className="text-sm font-medium text-[#FF6B00] dark:text-[#FF8822] mt-1 tracking-wider uppercase">
            Connect. Chat. Call.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Private, fast, and encrypted real-time communication.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-start gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-red-700 dark:text-red-300 leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: METHOD SELECTION SCREEN                          */}
        {/* ======================================================== */}
        {authStep === "select" && (
          <div className="space-y-4 animate-fade-in">
            {/* Continue with Mobile */}
            <button
              onClick={() => {
                setError(null);
                setAuthStep("phone");
              }}
              type="button"
              className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-sm flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <Smartphone className="w-5 h-5 text-[#FF6B00]" />
              Continue with Mobile Number
            </button>

            {/* Continue with Google */}
            <button
              onClick={triggerGoogleSignIn}
              disabled={googleLoading}
              type="button"
              className="w-full h-14 rounded-2xl bg-white dark:bg-[#1e2024] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-semibold text-sm flex items-center justify-center gap-3 shadow-sm hover:bg-slate-50 dark:hover:bg-[#25282d] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {googleLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin text-[#FF6B00]" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
              )}
              <span>{googleLoading ? "Signing in..." : "Continue with Google"}</span>
            </button>

            {/* Hidden container for Google Sign In Button anchor */}
            <div id="google-hidden-btn-container" style={{ display: "none" }} />

            {/* Feature Badges */}
            <div className="pt-6 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-3 text-left">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  End-to-End Encrypted
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Instant Access
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: PHONE NUMBER ENTRY SCREEN                        */}
        {/* ======================================================== */}
        {authStep === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAuthStep("select");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <span className="text-xs font-medium text-slate-400">Step 1 of 2</span>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="phone-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Enter your mobile number
              </label>

              <div className="flex items-center gap-2">
                {/* Country Code Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                    className="h-12 px-3 rounded-2xl bg-slate-100 dark:bg-[#1e2024] border border-slate-200 dark:border-white/10 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-white hover:bg-slate-200/70 dark:hover:bg-[#25282d] transition-colors"
                  >
                    <span>{selectedCountry.flag}</span>
                    <span>{selectedCountry.dialCode}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {countryDropdownOpen && (
                    <div className="absolute top-14 left-0 w-64 max-h-60 overflow-y-auto bg-white dark:bg-[#1e2024] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-2 space-y-1">
                      <div className="sticky top-0 bg-white dark:bg-[#1e2024] pb-1">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search country..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="w-full h-8 pl-8 pr-2 rounded-xl bg-slate-50 dark:bg-white/5 text-xs text-slate-800 dark:text-white outline-none border border-transparent focus:border-[#FF6B00]"
                          />
                        </div>
                      </div>
                      {filteredCountries.map((c) => (
                        <button
                          key={c.alpha2 + c.dialCode}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(c);
                            setCountryDropdownOpen(false);
                            setCountrySearch("");
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                          </span>
                          <span className="font-mono text-slate-400">{c.dialCode}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mobile Number Input */}
                <input
                  id="phone-input"
                  type="tel"
                  placeholder="98765 43210"
                  value={phoneNumber}
                  autoFocus
                  onChange={(e) => {
                    setPhoneNumber(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  className="flex-1 h-12 px-4 rounded-2xl bg-slate-100 dark:bg-[#1e2024] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium text-sm outline-none focus:border-[#FF6B00] dark:focus:border-[#FF6B00] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !phoneNumber.trim()}
              className="w-full h-13 py-3.5 rounded-2xl bg-[#FF6B00] hover:bg-[#ff7b1a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/30 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Send OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 2B: GOOGLE / GMAIL ENTRY SCREEN                     */}
        {/* ======================================================== */}
        {authStep === "google-email" && (
          <form onSubmit={handleDirectGoogleLogin} className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAuthStep("select");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <span className="text-xs font-medium text-slate-400">Google Sign-In</span>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="google-email-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Enter your Google / Gmail address
              </label>

              <div className="relative">
                <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="google-email-input"
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={googleEmail}
                  autoFocus
                  onChange={(e) => {
                    setGoogleEmail(e.target.value);
                    setError(null);
                  }}
                  className="w-full h-12 pl-11 pr-4 rounded-2xl bg-slate-100 dark:bg-[#1e2024] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium text-sm outline-none focus:border-[#FF6B00] dark:focus:border-[#FF6B00] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={googleLoading || !googleEmail.trim()}
              className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {googleLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Continue with Google</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: 6-DIGIT OTP VERIFICATION SCREEN                  */}
        {/* ======================================================== */}
        {authStep === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAuthStep("phone");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Change number
              </button>
              <span className="text-xs font-medium text-slate-400">Step 2 of 2</span>
            </div>

            <div className="text-left space-y-1.5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Enter 6-digit code
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Code sent to{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCountry.dialCode} {phoneNumber}
                </span>
              </p>
              <div className="text-[11.5px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/40 flex items-start gap-2">
                <span className="text-sm shrink-0">💡</span>
                <span>
                  <strong>Tip:</strong> If SMS is delayed (Twilio trial limitation), you can use test OTP <span className="font-mono font-bold text-[#FF6B00]">123456</span> or check backend terminal logs.
                </span>
              </div>
            </div>

            {/* 6 Segmented OTP Boxes */}
            <div className="flex items-center justify-between gap-2 on-paste-container" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e.key)}
                  className="w-12 h-14 rounded-2xl bg-slate-100 dark:bg-[#1e2024] border-2 border-slate-200 dark:border-white/10 text-center text-xl font-bold text-slate-900 dark:text-white outline-none focus:border-[#FF6B00] dark:focus:border-[#FF6B00] focus:scale-105 transition-all"
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || otpDigits.join("").length !== 6}
              className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-amber-500 hover:opacity-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/30 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify and Continue</span>
                </>
              )}
            </button>

            {/* Resend OTP */}
            <div className="text-center pt-2">
              {resendCooldown > 0 ? (
                <p className="text-xs font-medium text-slate-400">
                  Resend code in <span className="font-bold text-slate-600 dark:text-slate-300">{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs font-bold text-[#FF6B00] hover:underline"
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}

        {/* Footer Policy Notice */}
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-8 leading-relaxed">
          By continuing, you agree to Flash Chat's{" "}
          <span className="underline hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
            Terms of Service
          </span>{" "}
          and{" "}
          <span className="underline hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
            Privacy Policy
          </span>
          .
        </p>
      </main>
    </div>
  );
}