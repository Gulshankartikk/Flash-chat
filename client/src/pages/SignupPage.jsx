import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { GoogleButton } from '../components/auth/GoogleButton';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import {
  User,
  AtSign,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const SignupPage = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Username validation feedback
  const [usernameStatus, setUsernameStatus] = useState({ checking: false, available: null, error: null });
  const [validationError, setValidationError] = useState('');

  const { signup, checkUsername, isLoggingIn, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  // Debounced username availability check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus({ checking: false, available: null, error: null });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: 'Only letters, numbers & underscores allowed'
      });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true, available: null, error: null });
      try {
        const available = await checkUsername(username);
        setUsernameStatus({
          checking: false,
          available,
          error: available ? null : 'Username is already taken'
        });
      } catch {
        setUsernameStatus({ checking: false, available: null, error: null });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (username && usernameStatus.available === false) {
      setValidationError('Please choose an available username.');
      return;
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match. Please verify.');
      return;
    }

    if (!termsAccepted) {
      setValidationError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }

    const fullPhone = phoneNumber.trim() ? `${countryCode}${phoneNumber.replace(/\D/g, '')}` : undefined;

    try {
      const user = await signup({
        name: name.trim(),
        username: username.trim().toLowerCase() || undefined,
        email: email.trim().toLowerCase(),
        phoneNumber: fullPhone,
        password
      });

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream text-ink">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-card rounded-2xl p-6 sm:p-8 shadow-soft border border-line"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-gradient text-white font-black text-2xl mb-3 shadow-soft">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            Create an Account
          </h1>
          <p className="text-xs text-muted mt-1 font-medium">
            Join the Flash Chat Super-App community
          </p>
        </div>

        {/* Quick OTP Banner */}
        <div className="mb-5 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
          <span className="text-ink font-medium">Prefer Phone or Email OTP?</span>
          <Link
            to="/login"
            className="font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>One-Tap OTP</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {(validationError || error) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center gap-2.5 text-xs text-accent font-semibold"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError || error}</span>
          </motion.div>
        )}

        <div className="mb-5">
          <GoogleButton text="Sign up with Google" />
        </div>

        <div className="relative flex items-center justify-center my-5">
          <div className="border-t border-line w-full" />
          <span className="bg-card px-3 text-[11px] font-semibold uppercase tracking-wider text-muted absolute">
            or with credentials
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name */}
          <Input
            label="Full Name"
            type="text"
            required
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={User}
          />

          {/* Username (Optional / Preferred) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-ink">
                Username (Optional)
              </label>
              {usernameStatus.checking && (
                <span className="text-[10px] text-muted animate-pulse">Checking availability...</span>
              )}
              {!usernameStatus.checking && usernameStatus.available === true && (
                <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Available
                </span>
              )}
              {!usernameStatus.checking && usernameStatus.available === false && (
                <span className="text-[10px] font-bold text-accent">
                  {usernameStatus.error || 'Unavailable'}
                </span>
              )}
            </div>
            <Input
              type="text"
              placeholder="unique_username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              icon={AtSign}
              error={usernameStatus.available === false ? usernameStatus.error : undefined}
            />
          </div>

          {/* Email Address */}
          <Input
            label="Email Address"
            type="email"
            required
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={Mail}
          />

          {/* Optional Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Phone Number (Optional)
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="py-2 px-2.5 rounded-xl border border-line bg-card text-xs text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
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
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  icon={Phone}
                />
              </div>
            </div>
          </div>

          {/* Password with Visibility Toggle */}
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            placeholder="At least 6 characters"
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

          {/* Confirm Password with Visibility Toggle */}
          <Input
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            required
            minLength={6}
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={Lock}
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="hover:text-ink transition cursor-pointer p-0.5"
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          {/* Terms & Privacy Consent */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="terms-consent"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <label htmlFor="terms-consent" className="text-xs text-muted leading-tight cursor-pointer">
              I agree to Flash Chat's{' '}
              <span className="text-ink font-semibold">Terms of Service</span> and{' '}
              <span className="text-ink font-semibold">Privacy Policy</span>.
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoggingIn}
            className="w-full py-3 gap-2 mt-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Account</span>
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-muted">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default SignupPage;

