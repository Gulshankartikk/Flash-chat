import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { GoogleButton } from '../components/auth/GoogleButton';
import {
  Phone,
  Mail,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Lock,
  ChevronLeft
} from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const {
    sendOtp,
    verifyOtp,
    login,
    isSendingOtp,
    isVerifyingOtp,
    isLoggingIn,
    error,
    clearError,
    otpSent,
    setOtpSent,
    otpCooldown,
    setOtpCooldown
  } = useAuthStore();

  const [authMode, setAuthMode] = useState('otp'); // 'otp' | 'password'
  const [method, setMethod] = useState('phone'); // 'phone' | 'email'

  // Phone inputs
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Email inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 6-digit OTP inputs
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef([]);

  // Cooldown countdown
  useEffect(() => {
    let timer = null;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown(otpCooldown - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [otpCooldown, setOtpCooldown]);

  useEffect(() => {
    clearError();
  }, [clearError, method, authMode]);

  const getFullIdentifier = () => {
    if (method === 'phone') {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      return `${countryCode}${cleanPhone}`;
    }
    return email.toLowerCase().trim();
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    clearError();

    const identifier = getFullIdentifier();
    if (!identifier) return;

    try {
      await sendOtp(identifier, method);
    } catch {
      // Error handled by store
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    clearError();

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) return;

    const identifier = getFullIdentifier();

    try {
      const { isOnboarded } = await verifyOtp(identifier, fullOtp);
      if (!isOnboarded) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      // Error handled by store
    }
  };

  const handleOtpChange = (index, value) => {
    const cleanValue = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleanValue.length > 1) {
      // Handle paste of whole 6 digits
      const pasted = cleanValue.slice(0, 6).split('');
      pasted.forEach((char, i) => {
        newDigits[i] = char;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pasted.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    newDigits[index] = cleanValue;
    setOtpDigits(newDigits);

    if (cleanValue && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    clearError();
    try {
      const user = await login({ email: email.trim(), password });
      if (!user.isOnboarded) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      // Error handled by store
    }
  };

  const resetOtpFlow = () => {
    setOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FFF7ED]">
      {/* Decorative ambient gradients */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#F97316]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#EC4899]/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-[#FED7AA]"
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white font-black text-2xl mb-3 shadow-lg shadow-orange-500/25">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#1F2937]">
            Flash Chat
          </h1>
          <p className="text-xs text-[#6B7280] mt-1 font-medium">
            Next-Gen Messaging, Social Feed & Personal Pocket Vault
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-[#F43F5E]"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {authMode === 'otp' ? (
          <div>
            {!otpSent ? (
              /* Step 1: Identifier Input (Phone or Email) */
              <form onSubmit={handleSendOtp} className="space-y-4">
                {/* Method selector tabs */}
                <div className="flex p-1 bg-[#FFF7ED] rounded-xl border border-[#FED7AA]">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('phone');
                      clearError();
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                      method === 'phone'
                        ? 'bg-white text-[#1F2937] shadow-sm'
                        : 'text-[#6B7280] hover:text-[#1F2937]'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5 text-[#F97316]" />
                    <span>Phone OTP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('email');
                      clearError();
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                      method === 'email'
                        ? 'bg-white text-[#1F2937] shadow-sm'
                        : 'text-[#6B7280] hover:text-[#1F2937]'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-[#EC4899]" />
                    <span>Email OTP</span>
                  </button>
                </div>

                {method === 'phone' ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="py-2.5 px-3 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-xs text-[#1F2937] font-semibold focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      >
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+61">🇦🇺 +61</option>
                        <option value="+81">🇯🇵 +81</option>
                        <option value="+49">🇩🇪 +49</option>
                        <option value="+33">🇫🇷 +33</option>
                      </select>
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 5550192834"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full pl-3.5 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
                      <input
                        type="email"
                        required
                        placeholder="you@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white font-semibold text-sm shadow-md hover:shadow-orange-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{isSendingOtp ? 'Sending code...' : 'Continue with OTP'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Dev Mode Banner */}
                <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-center text-[11px] text-orange-800">
                  <span className="font-semibold">Dev Note:</span> Real keys not required. Check backend terminal for OTP (or use default <b>123456</b>).
                </div>
              </form>
            ) : (
              /* Step 2: 6-Digit OTP Verification */
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="text-center">
                  <p className="text-xs text-[#6B7280]">
                    We sent a 6-digit verification code to
                  </p>
                  <p className="text-sm font-bold text-[#1F2937] mt-0.5">
                    {getFullIdentifier()}
                  </p>
                  <button
                    type="button"
                    onClick={resetOtpFlow}
                    className="text-xs text-[#F97316] hover:underline mt-1 font-medium inline-flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3 h-3" /> Change {method}
                  </button>
                </div>

                {/* 6 Digit Input Boxes */}
                <div className="flex justify-between gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-12 h-14 text-center text-xl font-bold rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpDigits.join('').length !== 6}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white font-semibold text-sm shadow-md hover:shadow-orange-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isVerifyingOtp ? 'Verifying...' : 'Verify & Enter Flash Chat'}</span>
                </button>

                {/* Resend Cooldown */}
                <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280]">
                  {otpCooldown > 0 ? (
                    <span>Resend code in {otpCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-[#F97316] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Resend OTP Code</span>
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Alternative auth toggles */}
            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-[#FED7AA] w-full" />
              <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] absolute">
                or sign in with
              </span>
            </div>

            <div className="space-y-3">
              <GoogleButton text="Continue with Google" />

              <button
                type="button"
                onClick={() => setAuthMode('password')}
                className="w-full py-2.5 px-4 rounded-xl border border-[#FED7AA] text-xs font-semibold text-[#1F2937] hover:bg-[#FFF7ED] transition flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Use Email & Password</span>
              </button>
            </div>
          </div>
        ) : (
          /* Password Login Mode */
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#1F2937]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#F97316] hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white font-semibold text-sm shadow-md hover:shadow-orange-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLoggingIn ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setAuthMode('otp')}
              className="w-full py-2.5 text-xs text-[#F97316] font-semibold hover:underline"
            >
              ← Back to One-Time Password (OTP) Login
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default LoginPage;
