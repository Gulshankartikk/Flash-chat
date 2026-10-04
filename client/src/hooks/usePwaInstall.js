import { useState, useEffect, useCallback } from 'react';

const DISMISSAL_KEY = 'flash_pwa_install_dismissed_at';
const DISMISSAL_EXPIRY_DAYS = 14;

export const usePwaInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // 1. Detect if app is already running in standalone mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIos(isIosDevice);

    // 3. Check dismissal expiry (14 days)
    const dismissedAt = localStorage.getItem(DISMISSAL_KEY);
    if (dismissedAt) {
      const diffDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (diffDays < DISMISSAL_EXPIRY_DAYS) {
        setIsDismissed(true);
      } else {
        localStorage.removeItem(DISMISSAL_KEY);
      }
    }

    // 4. Capture beforeinstallprompt event (Chrome, Android, Edge)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'dismissed' };

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    return { outcome };
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
  }, []);

  const canInstall = !isInstalled && (!!deferredPrompt || isIos);

  return {
    canInstall,
    isInstalled,
    isDismissed,
    isIos,
    hasDeferredPrompt: !!deferredPrompt,
    promptInstall,
    dismissBanner
  };
};

export default usePwaInstall;
