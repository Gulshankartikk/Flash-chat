import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, X, ShieldAlert, Fingerprint, Delete, AlertCircle } from 'lucide-react';
import { verifyVaultPinApi, setVaultPinApi } from '../api/pocketApi';
import { usePocketStore } from '../store/usePocketStore';

export const PinPadModal = ({
  isOpen,
  onClose,
  onSuccess,
  mode = 'unlock', // 'unlock' | 'setup' | 'change'
  title = 'Enter Vault PIN'
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [step, setStep] = useState('enter'); // for setup/change: 'current' | 'enter' | 'confirm'
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(null);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const containerRef = useRef(null);

  const {
    setPocketToken,
    isTemporarilyLocked,
    lockedUntil,
    setLockout
  } = usePocketStore();

  // Check biometric availability
  useEffect(() => {
    if (window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.()
        .then((available) => setBiometricsAvailable(!!available))
        .catch(() => setBiometricsAvailable(false));
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    let timer;
    if (lockedUntil && lockedUntil > Date.now()) {
      const updateLockout = () => {
        const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
        setLockoutRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
          setLockoutRemaining(null);
        }
      };
      updateLockout();
      timer = setInterval(updateLockout, 1000);
    } else {
      setLockoutRemaining(null);
    }
    return () => clearInterval(timer);
  }, [lockedUntil]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setConfirmPin('');
      setCurrentPin('');
      setError('');
      setAttemptsRemaining(null);
      setStep(mode === 'change' ? 'current' : 'enter');
    }
  }, [isOpen, mode]);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleDigit = useCallback(
    (digit) => {
      if (lockoutRemaining) return;
      setError('');

      if (mode === 'unlock') {
        if (pin.length < 6) {
          setPin((prev) => prev + digit);
        }
      } else if (step === 'current') {
        if (currentPin.length < 6) {
          setCurrentPin((prev) => prev + digit);
        }
      } else if (step === 'enter') {
        if (pin.length < 6) {
          setPin((prev) => prev + digit);
        }
      } else if (step === 'confirm') {
        if (confirmPin.length < 6) {
          setConfirmPin((prev) => prev + digit);
        }
      }
    },
    [pin, confirmPin, currentPin, step, mode, lockoutRemaining]
  );

  const handleDelete = useCallback(() => {
    if (mode === 'unlock') {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === 'current') {
      setCurrentPin((prev) => prev.slice(0, -1));
    } else if (step === 'enter') {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === 'confirm') {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
    setError('');
  }, [step, mode]);

  const submitUnlock = useCallback(
    async (pinToTest) => {
      setIsLoading(true);
      setError('');
      try {
        const res = await verifyVaultPinApi(pinToTest);
        if (res.token) {
          setPocketToken(res.token, res.expiresIn || 600);
          onSuccess?.(res.token);
          onClose?.();
        }
      } catch (err) {
        triggerShake();
        setPin('');
        const msg = err.message || 'Incorrect PIN';
        setError(msg);

        if (msg.includes('locked')) {
          setLockout(900); // 15 minutes lockout
        } else if (msg.includes('attempts remaining')) {
          const match = msg.match(/(\d+)\s+attempts/);
          if (match) setAttemptsRemaining(parseInt(match[1], 10));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [setPocketToken, setLockout, onSuccess, onClose]
  );

  // Auto-submit when pin is between 4 and 6 digits
  useEffect(() => {
    if (mode === 'unlock' && pin.length >= 4 && pin.length <= 6) {
      if (pin.length === 6) {
        submitUnlock(pin);
      }
    }
  }, [pin, mode, submitUnlock]);

  const handleNextStep = async () => {
    if (mode === 'unlock') {
      if (pin.length < 4) {
        setError('PIN must be at least 4 digits');
        triggerShake();
        return;
      }
      submitUnlock(pin);
    } else if (step === 'current') {
      if (currentPin.length < 4) {
        setError('Please enter your 4-6 digit current PIN');
        triggerShake();
        return;
      }
      setStep('enter');
    } else if (step === 'enter') {
      if (pin.length < 4) {
        setError('New PIN must be at least 4 digits');
        triggerShake();
        return;
      }
      setStep('confirm');
    } else if (step === 'confirm') {
      if (pin !== confirmPin) {
        setError('PINs do not match. Please re-enter.');
        triggerShake();
        setConfirmPin('');
        return;
      }

      setIsLoading(true);
      try {
        await setVaultPinApi({
          pin,
          currentPin: mode === 'change' ? currentPin : undefined
        });
        onSuccess?.();
        onClose?.();
      } catch (err) {
        triggerShake();
        setError(err.message || 'Failed to configure PIN');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleNextStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigit, handleDelete, handleNextStep, onClose]);

  // Biometrics trigger (WebAuthn placeholder/fallback)
  const handleBiometricUnlock = async () => {
    try {
      setIsLoading(true);
      setError('Biometric authentication requested. If unavailable, enter your PIN.');
      setTimeout(() => setIsLoading(false), 800);
    } catch (e) {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentPinLength =
    mode === 'unlock'
      ? pin.length
      : step === 'current'
      ? currentPin.length
      : step === 'enter'
      ? pin.length
      : confirmPin.length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: isShaking ? [-10, 10, -8, 8, -4, 4, 0] : 0
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: isShaking ? 0.4 : 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-pad-title"
          className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-[#FED7AA] flex flex-col items-center relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close PIN Pad"
            className="absolute top-4 right-4 p-2 rounded-full text-[#6B7280] hover:text-[#1F2937] hover:bg-[#FFF7ED] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#EC4899] flex items-center justify-center text-white shadow-lg shadow-orange-500/20 mb-3">
            {mode === 'unlock' ? <Lock className="w-7 h-7" /> : <Unlock className="w-7 h-7" />}
          </div>

          <h2 id="pin-pad-title" className="text-lg font-black text-[#1F2937] text-center">
            {mode === 'unlock'
              ? title
              : step === 'current'
              ? 'Enter Current PIN'
              : step === 'enter'
              ? 'Create New PIN'
              : 'Confirm New PIN'}
          </h2>

          <p className="text-xs text-[#6B7280] text-center mt-1 max-w-[260px]">
            {lockoutRemaining ? (
              <span className="text-rose-600 font-bold">
                Vault locked. Retry in {Math.floor(lockoutRemaining / 60)}m {lockoutRemaining % 60}s.
              </span>
            ) : mode === 'unlock' ? (
              'Enter your 4-6 digit master vault PIN to unlock your personal space.'
            ) : step === 'current' ? (
              'Verify your current PIN before changing.'
            ) : step === 'enter' ? (
              'Choose a memorable 4 to 6 digit security code.'
            ) : (
              'Re-enter your new PIN to confirm.'
            )}
          </p>

          {/* PIN Dots display */}
          <div className="flex items-center gap-3 my-5" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const isFilled = idx < currentPinLength;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    isFilled
                      ? 'bg-gradient-to-r from-[#F97316] to-[#EC4899] scale-110 shadow-sm'
                      : 'border-2 border-[#FED7AA] bg-[#FFF7ED]'
                  }`}
                />
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mb-3 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {attemptsRemaining !== null && attemptsRemaining < 5 && !lockoutRemaining && (
            <p className="text-xs text-amber-600 font-semibold mb-2">
              Warning: {attemptsRemaining} incorrect attempts left before 15m lockout.
            </p>
          )}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] my-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={!!lockoutRemaining || isLoading}
                onClick={() => handleDigit(String(digit))}
                aria-label={`Digit ${digit}`}
                className="h-14 rounded-2xl bg-[#FFF7ED] hover:bg-[#FED7AA]/60 active:scale-95 text-lg font-bold text-[#1F2937] transition-all flex items-center justify-center border border-[#FED7AA]/60 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {digit}
              </button>
            ))}

            {/* Biometrics / Empty button */}
            <button
              type="button"
              disabled={!biometricsAvailable || !!lockoutRemaining || isLoading}
              onClick={handleBiometricUnlock}
              aria-label="Use Biometric Unlock"
              className="h-14 rounded-2xl bg-[#FFF7ED] hover:bg-[#FED7AA]/60 active:scale-95 text-[#F97316] transition-all flex items-center justify-center border border-[#FED7AA]/60 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <Fingerprint className="w-6 h-6" />
            </button>

            {/* Zero */}
            <button
              type="button"
              disabled={!!lockoutRemaining || isLoading}
              onClick={() => handleDigit('0')}
              aria-label="Digit 0"
              className="h-14 rounded-2xl bg-[#FFF7ED] hover:bg-[#FED7AA]/60 active:scale-95 text-lg font-bold text-[#1F2937] transition-all flex items-center justify-center border border-[#FED7AA]/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              0
            </button>

            {/* Delete button */}
            <button
              type="button"
              disabled={currentPinLength === 0 || !!lockoutRemaining || isLoading}
              onClick={handleDelete}
              aria-label="Backspace"
              className="h-14 rounded-2xl bg-[#FFF7ED] hover:bg-[#FED7AA]/60 active:scale-95 text-[#6B7280] hover:text-[#1F2937] transition-all flex items-center justify-center border border-[#FED7AA]/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>

          {/* Action Button for setup/change or manual submit */}
          {(mode !== 'unlock' || currentPinLength >= 4) && (
            <button
              type="button"
              disabled={currentPinLength < 4 || !!lockoutRemaining || isLoading}
              onClick={handleNextStep}
              className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EC4899] text-white font-bold text-sm shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity disabled:opacity-40"
            >
              {isLoading
                ? 'Processing...'
                : mode === 'unlock'
                ? 'Unlock Vault'
                : step === 'confirm'
                ? 'Save PIN'
                : 'Next'}
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
