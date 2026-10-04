import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to dispatch reset request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream select-none">
      <div className="relative w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-line">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to sign in</span>
        </Link>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand text-white mb-3 shadow-md shadow-primary/20">
            <Mail className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink">
            Reset Password
          </h1>
          <p className="text-xs text-muted mt-1">
            Enter your email to receive a password reset link
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-2xl bg-accent/10 border border-accent/20 flex items-center gap-2.5 text-xs text-accent font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isSubmitted ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-ink">
              Check your inbox!
            </p>
            <p className="text-xs text-muted leading-relaxed">
              If an account with that email exists, we've sent password reset instructions to <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              placeholder="name@example.com"
              icon={<Mail className="w-4 h-4 text-muted" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full py-2.5"
            >
              Send Reset Link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
