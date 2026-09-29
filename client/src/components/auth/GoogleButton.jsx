import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export const GoogleButton = ({ text = 'Continue with Google' }) => {
  const googleBtnRef = useRef(null);
  const { googleAuth, isLoggingIn } = useAuthStore();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId || !window.google) return;

    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (response.credential) {
            googleAuth(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left'
        });
      }
    } catch (err) {
      console.warn('Google Identity initialization notice:', err.message);
    }
  }, [googleClientId, googleAuth]);

  const handleManualClick = () => {
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      alert(
        'Google OAuth Client ID is not configured yet. Add VITE_GOOGLE_CLIENT_ID in client/.env to test Google sign-in.'
      );
    }
  };

  return (
    <div className="w-full">
      {/* Container for Google Identity Services official rendered button */}
      <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]">
        {/* Fallback button before Google script loads */}
        <button
          type="button"
          onClick={handleManualClick}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 font-medium transition shadow-sm hover:shadow"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
          <span>{text}</span>
        </button>
      </div>
    </div>
  );
};
