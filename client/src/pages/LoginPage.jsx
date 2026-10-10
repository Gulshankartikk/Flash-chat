import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { GoogleButton } from '../components/auth/GoogleButton';
import { OtpInput } from '../components/auth/OtpInput';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import {
  Phone,
  Mail,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  User,
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

  // Phone inputs (Default +91 for primary audience, selectable worldwide)
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Identifier & Password inputs
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 6-digit OTP string
  const [otpValue, setOtpValue] = useState('');

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
    return identifier.toLowerCase().trim();
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    clearError();

    const idVal = getFullIdentifier();
    if (!idVal) return;

    try {
      await sendOtp(idVal, method);
    } catch {
      // Error handled by store
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    clearError();

    if (otpValue.length !== 6) return;
    const idVal = getFullIdentifier();

    try {
      const { isOnboarded } = await verifyOtp(idVal, otpValue);
      if (!isOnboarded) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      // Error handled by store
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    clearError();
    try {
      const user = await login({ identifier: identifier.trim(), password });
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
    setOtpValue('');
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream text-ink">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-card rounded-2xl p-6 sm:p-8 shadow-soft border border-line"
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gradient text-white font-black text-2xl mb-3 shadow-soft">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            Flash Chat
          </h1>
          <p className="text-xs text-muted mt-1 font-medium">
            Next-Gen Messaging, Social Feed, Personal Pocket & Flash AI
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center gap-2.5 text-xs text-accent font-medium"
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
                <div className="flex p-1 bg-cream rounded-xl border border-line">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('phone');
                      clearError();
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      method === 'phone'
                        ? 'bg-card text-ink shadow-soft'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    <span>Phone OTP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('email');
                      clearError();
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      method === 'email'
                        ? 'bg-card text-ink shadow-soft'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-secondary" />
                    <span>Email OTP</span>
                  </button>
                </div>

                {method === 'phone' ? (
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">
                      Phone Number
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="py-2.5 px-3 rounded-xl border border-line bg-card text-xs text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-label="Country Calling Code"
                      >
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+1">🇺🇸 +1</option>
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
                          placeholder="e.g. 9876543210"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full pl-3.5 pr-4 py-2.5 rounded-xl border border-line bg-card text-sm text-ink placeholder-muted/70 focus:outline-none focus:ring-2 focus:ring-primary"
                          aria-label="Phone Number"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Input
                      label="Email Address"
                      type="email"
                      required
                      placeholder="you@domain.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      icon={Mail}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSendingOtp}
                  className="w-full py-3"
                >
                  <span>Continue with OTP</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>

                {/* Friendly dev / fallback note */}
                <div className="p-2.5 rounded-xl bg-cream border border-line text-center text-[11px] text-muted">
                  <span>Fast verification: check terminal or use universal test OTP <b>123456</b> in development.</span>
                </div>
              </form>
            ) : (
              /* Step 2: 6-Digit OTP Verification */
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center">
                  <p className="text-xs text-muted">
                    We sent a 6-digit verification code to
                  </p>
                  <p className="text-sm font-bold text-ink mt-0.5">
                    {getFullIdentifier()}
                  </p>
                  <button
                    type="button"
                    onClick={resetOtpFlow}
                    className="text-xs text-primary hover:underline mt-1 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3 h-3" /> Change {method}
                  </button>
                </div>

                {/* 6 Digit Separate Input Boxes */}
                <OtpInput
                  length={6}
                  value={otpValue}
                  onChange={setOtpValue}
                  disabled={isVerifyingOtp}
                  error={!!error}
                />

                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isVerifyingOtp}
                  disabled={otpValue.length !== 6}
                  className="w-full py-3 gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Verify & Enter Flash Chat</span>
                </Button>

                {/* Resend Cooldown */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted">
                  {otpCooldown > 0 ? (
                    <span>Resend code in {otpCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
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
              <div className="border-t border-line w-full" />
              <span className="bg-card px-3 text-[11px] font-semibold uppercase tracking-wider text-muted absolute">
                or sign in with
              </span>
            </div>

            <div className="space-y-3">
              <GoogleButton text="Continue with Google" />

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setAuthMode('password');
                  clearError();
                }}
                icon={Lock}
                className="w-full"
              >
                Use Password Login
              </Button>
            </div>
          </div>
        ) : (
          /* Password Login Mode */
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <Input
              label="Email, Username, or Phone"
              type="text"
              required
              placeholder="name@example.com or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              icon={User}
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-ink">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={Lock}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-ink transition cursor-pointer p-0.5"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoggingIn}
              className="w-full py-3 gap-2"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('otp');
                clearError();
              }}
              className="w-full py-2 text-xs text-primary font-semibold hover:underline cursor-pointer"
            >
              ← Back to One-Time Password (OTP) Login
            </button>
          </form>
        )}

        {/* Global Footer Link to Signup */}
        <div className="mt-6 text-center text-xs text-muted border-t border-line/60 pt-4">
          Don't have an account?{' '}
          <Link
            to="/signup"
            className="font-bold text-primary hover:underline cursor-pointer"
          >
            Create Account
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;

