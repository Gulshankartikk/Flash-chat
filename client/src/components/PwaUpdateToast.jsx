import React, { useState, useEffect } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export const PwaUpdateToast = () => {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      // Reload once when the new service worker has activated and taken control
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Inspect registration for waiting worker
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowToast(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowToast(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleReload = () => {
    // Safety check: Defer reload if currently in an active audio/video call
    if (callState && (callState.status === 'connected' || callState.status === 'calling')) {
      alert('You are currently on a call. Update will be applied after your call ends.');
      return;
    }

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  if (!showToast) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto animate-bounce-in">
      <div className="bg-card text-ink px-5 py-3.5 rounded-2xl shadow-2xl border border-line flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-gradient flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-ink leading-tight">New update available</p>
            <p className="text-[11px] text-muted">Reload to get the latest features</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-gradient hover:opacity-90 text-white text-xs font-bold shadow-md transition active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
            <span>Reload</span>
          </button>
          <button
            onClick={() => setShowToast(false)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
            aria-label="Dismiss update banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaUpdateToast;
