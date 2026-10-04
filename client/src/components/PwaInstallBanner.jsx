import React, { useState } from 'react';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { Button } from './Button';

export const PwaInstallBanner = () => {
  const { canInstall, isDismissed, isIos, promptInstall, dismissBanner } = usePwaInstall();
  const [showIosModal, setShowIosModal] = useState(false);

  if (!canInstall || isDismissed) return null;

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
    } else {
      await promptInstall();
    }
  };

  return (
    <>
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-3 select-none">
        <div className="bg-card rounded-2xl p-3.5 shadow-xl border border-line flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-black text-ink">Install Flash Chat</h4>
              <p className="text-[11px] text-muted">
                Faster messaging, push alerts & offline notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleInstallClick}
            >
              Install
            </Button>
            <button
              onClick={dismissBanner}
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-cream transition"
              aria-label="Dismiss installation prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Add to Home Screen Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 select-none">
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-line text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center mx-auto shadow-md shadow-primary/20">
              <Download className="w-6 h-6 text-white" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-ink">Install on iOS</h3>
              <p className="text-xs text-muted">
                Install Flash Chat on your iPhone or iPad home screen for fullscreen experience
              </p>
            </div>

            <div className="space-y-2.5 text-left bg-cream p-3.5 rounded-2xl border border-line text-xs">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                  1
                </div>
                <p className="text-ink">
                  Tap the <strong className="inline-flex items-center gap-0.5"><Share className="w-3 h-3 text-primary inline" /> Share</strong> icon in Safari toolbar.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                  2
                </div>
                <p className="text-ink">
                  Scroll down and tap <strong className="inline-flex items-center gap-0.5"><PlusSquare className="w-3 h-3 text-primary inline" /> Add to Home Screen</strong>.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => setShowIosModal(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallBanner;
