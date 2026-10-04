import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Missing or invalid reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: password
      });
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream select-none">
      <div className="relative w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-line">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand text-white mb-3 shadow-md shadow-primary/20">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            Set New Password
          </h1>
          <p className="text-xs text-muted mt-1">
            Choose a strong password to secure your account
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-2xl bg-accent/10 border border-accent/20 flex items-center gap-2.5 text-xs text-accent font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-ink">
              Password Reset Successfully!
            </p>
            <p className="text-xs text-muted">
              Redirecting you to the sign-in page...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              required
              minLength={6}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Input
              label="Confirm New Password"
              type="password"
              required
              minLength={6}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full py-2.5"
            >
              Update Password
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-xs font-bold text-primary hover:underline"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
