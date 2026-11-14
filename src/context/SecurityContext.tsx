import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { APP_CONFIG } from '../config/appConfig';
import { dbService } from '../services/api';

export const DEFAULT_PIN = APP_CONFIG.defaultPin || '5555';
export const AUTO_LOCK_TIMEOUT_MS = (APP_CONFIG.autoLockMinutes || 30) * 60 * 1000; // 30 minutes = 1,800,000 ms

interface SecurityContextType {
  isLocked: boolean;
  setIsLocked: React.Dispatch<React.SetStateAction<boolean>>;
  lockApp: () => void;
  unlockApp: () => void;
  getActivePin: () => string;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; message: string }>;
}

const SecurityContext = createContext<SecurityContextType>({
  isLocked: true,
  setIsLocked: () => {},
  lockApp: () => {},
  unlockApp: () => {},
  getActivePin: () => DEFAULT_PIN,
  changePin: async () => ({ success: false, message: '' }),
});

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // STRICT COLD-START: Software ALWAYS boots in locked state (isLocked = true)
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronous PIN retrieval with fallback to database settings
  const getActivePin = useCallback((): string => {
    if (typeof window !== 'undefined') {
      try {
        const raw =
          localStorage.getItem('maha_pin') ||
          localStorage.getItem('maha_app_pin') ||
          localStorage.getItem('pin') ||
          sessionStorage.getItem('maha_pin') ||
          sessionStorage.getItem('maha_app_pin');
        if (raw) {
          const cleaned = String(raw).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
          if (/^\d{4}$/.test(cleaned)) {
            return cleaned;
          }
        }
      } catch (e) {
        // Fallback below
      }
    }
    return DEFAULT_PIN;
  }, []);

  // Sync PIN from backend on mount
  useEffect(() => {
    let isMounted = true;
    dbService.system.getSettings().then((settings) => {
      if (!isMounted) return;
      const remotePin = settings?.app_pin || settings?.app_security_pin;
      if (remotePin) {
        const cleaned = String(remotePin).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
        if (/^\d{4}$/.test(cleaned)) {
          try {
            localStorage.setItem('maha_pin', cleaned);
            localStorage.setItem('maha_app_pin', cleaned);
            localStorage.setItem('pin', cleaned);
            sessionStorage.setItem('maha_pin', cleaned);
            sessionStorage.setItem('maha_app_pin', cleaned);
          } catch (e) {}
        }
      }
    }).catch((err) => {
      console.warn('Failed to fetch security PIN from backend settings:', err);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const lockApp = useCallback(() => {
    setIsLocked(true);
  }, []);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
    lastActivityRef.current = Date.now();
  }, []);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<{ success: boolean; message: string }> => {
    const cleanedCurrent = String(currentPin).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
    const cleanedNew = String(newPin).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
    const active = getActivePin();

    if (cleanedCurrent !== active) {
      return { success: false, message: 'বর্তমান পিন কোডটি সঠিক নয়!' };
    }
    if (!/^\d{4}$/.test(cleanedNew)) {
      return { success: false, message: 'নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে!' };
    }

    try {
      // 1. Immediately store new PIN across local & session storage
      localStorage.setItem('maha_pin', cleanedNew);
      localStorage.setItem('maha_app_pin', cleanedNew);
      localStorage.setItem('pin', cleanedNew);
      sessionStorage.setItem('maha_pin', cleanedNew);
      sessionStorage.setItem('maha_app_pin', cleanedNew);

      // 2. Call backend auth changePin endpoint
      const res = await dbService.auth.changePin(cleanedCurrent, cleanedNew);
      if (!res.success) {
        throw new Error(res.message);
      }

      return { success: true, message: `পিন কোড সফলভাবে পরিবর্তন করা হয়েছে (নতুন পিন: ${cleanedNew})` };
    } catch (err: any) {
      return { success: false, message: `পিন সংরক্ষণে সমস্যা: ${err?.message || 'অজানা ত্রুটি'}` };
    }
  }, [getActivePin]);

  // 30-Minute Inactivity Auto-Lock & Global Lock Event Listener
  useEffect(() => {
    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = () => {
      if (!isLocked) {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= AUTO_LOCK_TIMEOUT_MS) {
          setIsLocked(true);
        }
      }
    };

    const handleCustomLockEvent = () => {
      setIsLocked(true);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    window.addEventListener('maha_lock_app', handleCustomLockEvent);

    timerRef.current = setInterval(checkInactivity, 10000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      window.removeEventListener('maha_lock_app', handleCustomLockEvent);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLocked]);

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        setIsLocked,
        lockApp,
        unlockApp,
        getActivePin,
        changePin,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => useContext(SecurityContext);

