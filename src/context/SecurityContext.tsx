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
        const stored = localStorage.getItem('maha_app_pin');
        if (stored && /^\d{4}$/.test(stored)) {
          return stored;
        }
      } catch (e) {
        // Fallback below
      }
    }
    return DEFAULT_PIN;
  }, []);

  // Sync PIN from SQLite on mount
  useEffect(() => {
    let isMounted = true;
    dbService.system.getSettings().then((settings) => {
      if (!isMounted) return;
      if (settings?.app_pin && /^\d{4}$/.test(settings.app_pin)) {
        try {
          localStorage.setItem('maha_app_pin', settings.app_pin);
        } catch (e) {}
      }
    }).catch((err) => {
      console.warn('Failed to fetch security PIN from SQLite settings:', err);
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
    const active = getActivePin();
    if (currentPin !== active) {
      return { success: false, message: 'বর্তমান পিন কোডটি সঠিক নয়!' };
    }
    if (!/^\d{4}$/.test(newPin)) {
      return { success: false, message: 'নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে!' };
    }

    try {
      localStorage.setItem('maha_app_pin', newPin);
      await dbService.system.updateSetting('app_pin', newPin);
      return { success: true, message: `পিন কোড সফলভাবে পরিবর্তন করা হয়েছে (নতুন পিন: ${newPin})` };
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

