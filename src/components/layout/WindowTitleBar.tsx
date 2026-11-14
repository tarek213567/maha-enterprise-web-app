import React, { useState, useEffect } from 'react';
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
      className="window-titlebar h-12 bg-[#061126] text-white px-4 flex items-center justify-between text-xs select-none transition-colors duration-200 z-50 shrink-0 border-b border-[#0f1d38]"
    >
      {/* Left: Golden-green wheat/leaf emblem icon + vertical divider | + bold white text "মাহা এন্টারপ্রাইজ" */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-2.5 cursor-default"
      >
        {/* Golden-green wheat/leaf emblem SVG */}
        <div className="w-7 h-7 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 28C16 28 16 13 22 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M16 28C16 28 16 11 10 5" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="10" cy="5" r="3" fill="#f59e0b" />
            <circle cx="15.5" cy="8.5" r="2.5" fill="#f59e0b" />
            <circle cx="22" cy="7" r="3" fill="#10b981" />
            <circle cx="18" cy="13.5" r="2.5" fill="#10b981" />
            <circle cx="13" cy="15.5" r="2.5" fill="#d97706" />
          </svg>
        </div>

        <span className="text-slate-500 font-light text-sm">|</span>

        <span className="font-bold text-white tracking-wide text-sm sm:text-base">
          মাহা এন্টারপ্রাইজ
        </span>
      </div>

      {/* Right Controls: 🗂️ ব্যাকআপ, 🌙 ডার্ক, 🔒 লক, Window controls: —, ❐, ✕ */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-2 sm:gap-2.5"
      >
        {/* 1. 💾 তাৎক্ষণিক ব্যাকআপ */}
        <button
          onClick={handleBackup}
          disabled={isBackingUp}
          className="border border-amber-500/60 bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 rounded-lg px-3 py-1 text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          title="ডাটাবেজ ও রয়্যাল এক্সেল (.xlsx) ব্যাকআপ ডাউনলোড করুন"
        >
          <span>💾</span>
          <span className="hidden sm:inline">{isBackingUp ? 'ব্যাকআপ হচ্ছে...' : 'তাৎক্ষণিক ব্যাকআপ'}</span>
          <span className="sm:hidden">{isBackingUp ? '...' : 'ব্যাকআপ'}</span>
        </button>

        {/* 2. 🌙 ডার্ক / ☀️ লাইট */}
        <button
          onClick={toggleTheme}
          className="border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg px-3 py-1 text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all active:scale-95"
          title={isDark ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
        >
          {isDark ? (
            <>
              <span>☀️</span>
              <span>লাইট</span>
            </>
          ) : (
            <>
              <span>🌙</span>
              <span>ডার্ক</span>
            </>
          )}
        </button>

        {/* 3. 🔒 লক */}
        <button
          onClick={lockApp}
          className="border border-rose-500/50 bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 rounded-lg px-3 py-1 text-xs flex items-center gap-1.5 font-bold cursor-pointer transition-all active:scale-95"
          title="সফটওয়্যার স্ক্রিন লক করুন"
        >
          <span>🔒</span>
          <span>লক</span>
        </button>

        {/* 4. Window Controls: —, ❐, ✕ */}
        <div className="flex items-center gap-1 ml-1 text-slate-400">
          <button
            onClick={handleMinimize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-sm font-bold"
            title="Minimize"
            aria-label="Minimize"
          >
            —
          </button>
          <button
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-sm"
            title="Maximize"
            aria-label="Maximize"
          >
            ❐
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-rose-600 hover:text-white transition-colors cursor-pointer text-sm font-bold"
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
