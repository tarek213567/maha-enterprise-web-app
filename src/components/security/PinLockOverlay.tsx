import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, Shield, AlertCircle } from 'lucide-react';
import { useSecurity } from '../../context/SecurityContext';
import { APP_CONFIG } from '../../config/appConfig';
import { dbService } from '../../services/api';
import { toEnglishDigits } from '../../utils/bengaliNumbers';

export const PinLockOverlay: React.FC = () => {
  const { isLocked, unlockApp, getActivePin } = useSecurity();
  const [pin, setPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unlockedSuccess, setUnlockedSuccess] = useState(false);

  // Unlock verification
  const verifyPin = useCallback(async (candidate: string) => {
    const candidateEn = toEnglishDigits(candidate).trim();
    const activePin = getActivePin();

    let isValid = candidateEn === activePin;

    // If local comparison fails, check remote backend in case PIN was changed on another device/session
    if (!isValid) {
      try {
        const remoteValid = await dbService.auth.verifyPin(candidateEn);
        if (remoteValid) {
          isValid = true;
        }
      } catch (e) {
        // network or offline, keep isValid false
      }
    }

    if (isValid) {
      setUnlockedSuccess(true);
      setErrorMessage('');
      try {
        sessionStorage.setItem('maha_pin', candidateEn);
        sessionStorage.setItem('maha_app_pin', candidateEn);
        localStorage.setItem('maha_pin', candidateEn);
        localStorage.setItem('maha_app_pin', candidateEn);
        localStorage.setItem('pin', candidateEn);
      } catch (e) {}
      setTimeout(() => {
        unlockApp();
        setPin('');
        setUnlockedSuccess(false);
      }, 250);
    } else {
      setIsShaking(true);
      setErrorMessage('ভুল পিন কোড, আবার চেষ্টা করুন');
      setTimeout(() => {
        setPin('');
        setIsShaking(false);
      }, 400);
    }
  }, [getActivePin, unlockApp]);

  // Handle number input
  const handleDigit = useCallback((digit: string) => {
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + digit;
      if (next.length === 4) {
        setTimeout(() => verifyPin(next), 50);
      }
      return next;
    });
  }, [verifyPin]);

  // Handle backspace
  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  }, []);

  // Handle clear
  const handleClear = useCallback(() => {
    setPin('');
    setErrorMessage('');
  }, []);

  // Physical Keyboard & NumPad Listener
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check 0-9 from top row or numpad
      if ((e.key >= '0' && e.key <= '9') || (e.code && e.code.startsWith('Numpad') && !isNaN(Number(e.key)))) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, handleDigit, handleBackspace, handleClear]);

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 dark:bg-black/95 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in transition-all">
      <div className="w-full max-w-sm bg-white dark:bg-[#0A0A0A] border-2 border-black dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col items-center text-center">
        {/* App Logo & Header */}
        <div className="w-20 h-20 rounded-2xl bg-black dark:bg-white p-0.5 shadow-xl mb-3 flex items-center justify-center">
          <div className="w-full h-full bg-white dark:bg-black rounded-2xl overflow-hidden flex items-center justify-center p-1.5">
            <img
              src="/icon.png"
              alt="মাহা এন্টারপ্রাইজ লোগো"
              className="w-full h-full object-contain"
              onError={(e) => {
                if (!e.currentTarget.src.endsWith('/logo.png')) {
                  e.currentTarget.src = '/logo.png';
                } else {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.innerText = '🌾';
                  }
                }
              }}
            />
          </div>
        </div>

        <h2 className="text-xl font-black text-black dark:text-white tracking-wide">
          {APP_CONFIG.name}
        </h2>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium mt-1 flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-black dark:text-white" />
          নিরাপত্তা স্ক্রিন লক • পিন কোড দিন
        </p>

        {/* 4 Bullet Indicators (● ● ● ●) */}
        <div
          className={`flex items-center justify-center gap-4 my-7 transition-transform ${
            isShaking ? 'animate-pin-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                  unlockedSuccess || isFilled
                    ? 'border-black bg-black dark:border-white dark:bg-white scale-110'
                    : 'border-neutral-400 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        <div className="h-6 mb-2 flex items-center justify-center">
          {errorMessage && (
            <p className="text-xs text-black dark:text-white font-bold flex items-center justify-center gap-1 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMessage}
            </p>
          )}
        </div>

        {/* ATM / bKash Style Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3.5 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:active:bg-neutral-700 active:scale-95 border border-neutral-300 dark:border-neutral-700 text-black dark:text-white font-mono font-bold text-2xl transition-all shadow-sm focus:outline-none cursor-pointer flex items-center justify-center"
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: Clear, 0, Backspace */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-neutral-200 hover:bg-neutral-300 active:scale-95 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-black dark:text-white font-bold text-xs transition-all focus:outline-none cursor-pointer flex items-center justify-center"
            title="মুছুন"
          >
            ক্লিয়ার
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:active:bg-neutral-700 active:scale-95 border border-neutral-300 dark:border-neutral-700 text-black dark:text-white font-mono font-bold text-2xl transition-all shadow-sm focus:outline-none cursor-pointer flex items-center justify-center"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:active:bg-neutral-700 active:scale-95 border border-neutral-300 dark:border-neutral-700 text-black dark:text-white transition-all shadow-sm focus:outline-none cursor-pointer flex items-center justify-center"
            title="একটি সংখ্যা মুছুন"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Security Footer */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 w-full flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-black dark:text-white" />
            ৩০ মিনিট নিষ্ক্রিয়তায় অটো-লক
          </span>
          <span className="font-mono text-black dark:text-white font-bold">{APP_CONFIG.version} Enterprise</span>
        </div>
      </div>
    </div>
  );
};

