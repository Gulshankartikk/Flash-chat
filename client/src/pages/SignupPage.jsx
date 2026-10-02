import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { GoogleButton } from '../components/auth/GoogleButton';
import { User, Mail, Lock, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

export const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const { signup, isSigningUp, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match. Please verify.');
      return;
    }

    try {
      const user = await signup({ name: name.trim(), email: email.trim(), password });
      if (!user.isOnboarded) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FFF7ED]">
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#F97316]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#EC4899]/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-[#FED7AA]"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] text-white font-black text-2xl mb-3 shadow-lg shadow-orange-500/25">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#1F2937]">
            Create an Account
          </h1>
          <p className="text-xs text-[#6B7280] mt-1 font-medium">
            Join the Flash Chat Super-App community
          </p>
        </div>

        {/* Quick OTP Banner */}
        <div className="mb-5 p-3 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between text-xs">
          <span className="text-orange-950 font-medium">Prefer Phone or Email OTP?</span>
          <Link
            to="/login"
            className="font-bold text-[#F97316] hover:underline flex items-center gap-1"
          >
            <span>One-Tap OTP</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {(validationError || error) && (
          <div className="mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-[#F43F5E]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError || error}</span>
          </div>
        )}

        <div className="mb-5">
          <GoogleButton text="Sign up with Google" />
        </div>

        <div className="relative flex items-center justify-center my-5">
          <div className="border-t border-[#FED7AA] w-full" />
          <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] absolute">
            or with email
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
              <input
                type="text"
                required
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
              <input
                type="password"
                required
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F2937] mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-[#6B7280]" />
              <input
                type="password"
                required
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/30 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSigningUp}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:from-[#EA580C] hover:to-[#DB2777] text-white font-semibold text-sm shadow-md hover:shadow-orange-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSigningUp ? 'Creating Account...' : 'Create Account'}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[#6B7280]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-[#F97316] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;
