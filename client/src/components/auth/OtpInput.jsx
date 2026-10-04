import React, { useRef, useEffect } from 'react';

export const OtpInput = ({
  length = 6,
  value = '',
  onChange,
  disabled = false,
  error = false,
  autoFocus = true
}) => {
  const inputRefs = useRef([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const digits = value.split('').slice(0, length);
  while (digits.length < length) {
    digits.push('');
  }

  const handleChange = (e, index) => {
    const val = e.target.value.replace(/\D/g, ''); // Numeric only
    if (!val) {
      // Cleared digit
      const nextDigits = [...digits];
      nextDigits[index] = '';
      onChange(nextDigits.join(''));
      return;
    }

    // Single digit entry
    const nextDigits = [...digits];
    nextDigits[index] = val.slice(-1);
    onChange(nextDigits.join(''));

    // Auto-advance to next box
    if (index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        // Move back on backspace when current box is empty
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    if (inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex].focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 max-w-xs mx-auto my-3" onPaste={handlePaste}>
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => (inputRefs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          disabled={disabled}
          className={`w-11 h-13 text-center text-xl font-bold rounded-xl border transition bg-card text-ink focus:outline-none focus:ring-2 select-none ${
            error
              ? 'border-accent focus:ring-accent text-accent bg-accent/5'
              : digits[idx]
              ? 'border-primary focus:ring-primary shadow-soft'
              : 'border-line focus:ring-primary'
          }`}
          aria-label={`Digit ${idx + 1} of verification code`}
        />
      ))}
    </div>
  );
};

export default OtpInput;
