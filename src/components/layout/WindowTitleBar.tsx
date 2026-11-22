import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useSecurity } from '../../context/SecurityContext';
import { dbService } from '../../services/api';

declare global {
  interface Window {
    desktopAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
    };
  }
}

interface WindowTitleBarProps {
  onQuickBackup?: () => void | Promise<void>;
}

export const WindowTitleBar: React.FC<WindowTitleBarProps> = ({ onQuickBackup }) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { lockApp } = useSecurity();

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && window.desktopAPI?.minimize) {
      window.desktopAPI.minimize();
    }
  };

  const handleMaximize = () => {
    if (typeof window !== 'undefined' && window.desktopAPI?.maximize) {
      window.desktopAPI.maximize();
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const handleClose = () => {
    if (confirm('আপনি কি মাহা এন্টারপ্রাইজ সফটওয়্যার বন্ধ করতে চান?')) {
      if (typeof window !== 'undefined' && window.desktopAPI?.close) {
        window.desktopAPI.close();
      } else {
        window.close();
      }
    }
  };

  const handleBackup = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    try {
      if (onQuickBackup) {
        await onQuickBackup();
      } else {
        await dbService.system.backup();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <header
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={handleMaximize}
      className="window-titlebar hidden md:flex h-11 bg-white dark:bg-black text-black dark:text-white px-4 items-center justify-between text-xs select-none transition-colors duration-200 z-50 shrink-0 border-b border-neutral-200 dark:border-neutral-800"
    >
      {/* Left: Wheat/leaf emblem icon + vertical divider | + bold text "মাহা এন্টারপ্রাইজ" */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-2.5 cursor-default"
      >
        {/* Wheat/leaf emblem SVG */}
        <div className="w-6 h-6 flex items-center justify-center shrink-0 text-black dark:text-white">
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 28C16 28 16 13 22 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M16 28C16 28 16 11 10 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="10" cy="5" r="3" fill="currentColor" />
            <circle cx="15.5" cy="8.5" r="2.5" fill="currentColor" />
            <circle cx="22" cy="7" r="3" fill="currentColor" />
            <circle cx="18" cy="13.5" r="2.5" fill="currentColor" />
            <circle cx="13" cy="15.5" r="2.5" fill="currentColor" />
          </svg>
        </div>

        <span className="text-neutral-400 dark:text-neutral-600 font-light text-sm">|</span>

        <span className="font-bold text-black dark:text-white tracking-wide text-sm">
          মাহা এন্টারপ্রাইজ
        </span>
      </div>

      {/* Right Controls: Desktop Quick Action Buttons + Window Controls */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-2"
      >
        {/* Quick actions for extra-wide screens without cluttering medium screens */}
        <div className="hidden xl:flex items-center gap-2">
          {/* 1. 💾 তাৎক্ষণিক ব্যাকআপ */}
          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="border border-neutral-300 dark:border-neutral-700 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            title="ডাটাবেজ ও এক্সেল (.xlsx) ব্যাকআপ ডাউনলোড করুন"
          >
            <span>💾</span>
            <span>{isBackingUp ? '...' : 'ব্যাকআপ'}</span>
          </button>

          {/* 2. 🌙 ডার্ক / ☀️ লাইট */}
          <button
            onClick={toggleTheme}
            className="border border-neutral-300 dark:border-neutral-700 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all active:scale-95"
            title={isDark ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'লাইট' : 'ডার্ক'}</span>
          </button>

          {/* 3. 🔒 লক */}
          <button
            onClick={lockApp}
            className="border border-neutral-300 dark:border-neutral-700 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-black dark:text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all active:scale-95"
            title="সফটওয়্যার স্ক্রিন লক করুন"
          >
            <span>🔒</span>
            <span>লক</span>
          </button>
        </div>

        {/* Window Controls: —, ❐, ✕ */}
        <div className="flex items-center gap-1 ml-1 text-neutral-600 dark:text-neutral-400">
          <button
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white transition-colors cursor-pointer text-sm font-bold"
            title="Minimize"
            aria-label="Minimize"
          >
            —
          </button>
          <button
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white transition-colors cursor-pointer text-sm"
            title="Maximize"
            aria-label="Maximize"
          >
            ❐
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer text-sm font-bold"
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </header>
  );
};
