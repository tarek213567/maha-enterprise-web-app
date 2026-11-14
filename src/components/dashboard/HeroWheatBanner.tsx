import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { getGregorianDateInBengali, getBanglaBongabdoDate } from '../../utils/banglaDate';

export const HeroWheatBanner: React.FC = () => {
  const [dates, setDates] = useState(() => ({
    gregorian: getGregorianDateInBengali().fullText,
    bongabdo: getBanglaBongabdoDate().fullText,
  }));

  useEffect(() => {
    const updateDates = () => {
      setDates({
        gregorian: getGregorianDateInBengali().fullText,
        bongabdo: getBanglaBongabdoDate().fullText,
      });
    };

    // Update at minute intervals to keep accurate
    const interval = setInterval(updateDates, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-900/60 shadow-2xl bg-gradient-to-r from-[#071929] via-[#0b273d] to-[#083038] text-white p-4 sm:p-6 md:p-8 min-h-[145px] sm:min-h-[175px] md:min-h-[200px] flex flex-col justify-center select-none transition-all duration-300">
      {/* Background Decorative Constellations & Sparkles */}
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
        {/* Subtle radial center spotlight glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[250px] bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.15),transparent_70%)]" />

        {/* Left Constellation geometric web */}
        <svg
          viewBox="0 0 300 200"
          className="absolute -left-6 -top-4 w-56 sm:w-72 h-44 sm:h-52 text-cyan-500/25"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        >
          <line x1="20" y1="40" x2="70" y2="25" />
          <line x1="70" y1="25" x2="110" y2="60" />
          <line x1="110" y1="60" x2="60" y2="90" />
          <line x1="60" y1="90" x2="20" y2="40" />
          <line x1="110" y1="60" x2="160" y2="45" />
          <line x1="60" y1="90" x2="90" y2="140" />
          <line x1="90" y1="140" x2="150" y2="120" />
          <line x1="150" y1="120" x2="110" y2="60" />
          <line x1="20" y1="40" x2="35" y2="120" />
          <line x1="35" y1="120" x2="90" y2="140" />
          {/* Nodes */}
          <circle cx="20" cy="40" r="2.5" fill="#38bdf8" />
          <circle cx="70" cy="25" r="2" fill="#38bdf8" />
          <circle cx="110" cy="60" r="2.5" fill="#f59e0b" />
          <circle cx="60" cy="90" r="2" fill="#38bdf8" />
          <circle cx="160" cy="45" r="2" fill="#f59e0b" />
          <circle cx="90" cy="140" r="2" fill="#34d399" />
          <circle cx="150" cy="120" r="2.5" fill="#34d399" />
          <circle cx="35" cy="120" r="2" fill="#38bdf8" />
        </svg>

        {/* Right Constellation geometric web */}
        <svg
          viewBox="0 0 300 200"
          className="absolute -right-6 -bottom-4 w-56 sm:w-72 h-44 sm:h-52 text-emerald-500/25"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        >
          <line x1="260" y1="160" x2="220" y2="130" />
          <line x1="220" y1="130" x2="180" y2="170" />
          <line x1="180" y1="170" x2="230" y2="190" />
          <line x1="230" y1="190" x2="260" y2="160" />
          <line x1="220" y1="130" x2="210" y2="80" />
          <line x1="210" y1="80" x2="270" y2="95" />
          <line x1="270" y1="95" x2="260" y2="160" />
          <circle cx="260" cy="160" r="2.5" fill="#34d399" />
          <circle cx="220" cy="130" r="2" fill="#38bdf8" />
          <circle cx="180" cy="170" r="2.5" fill="#f59e0b" />
          <circle cx="230" cy="190" r="2" fill="#34d399" />
          <circle cx="210" cy="80" r="2.5" fill="#f59e0b" />
          <circle cx="270" cy="95" r="2" fill="#38bdf8" />
        </svg>
      </div>

      {/* Left Golden Wheat Sheaf Stalk Illustration */}
      <div className="absolute left-2 sm:left-4 bottom-0 pointer-events-none opacity-45 sm:opacity-65 select-none">
        <svg
          viewBox="0 0 120 160"
          className="w-20 sm:w-28 md:w-36 h-28 sm:h-36 md:h-44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Stem */}
          <path d="M10 160 Q40 100 85 20" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          {/* Wheat Grains along stem */}
          <ellipse cx="80" cy="30" rx="9" ry="4.5" transform="rotate(-35 80 30)" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
          <ellipse cx="72" cy="45" rx="9" ry="4.5" transform="rotate(-25 72 45)" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
          <ellipse cx="64" cy="62" rx="9.5" ry="4.8" transform="rotate(-20 64 62)" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
          <ellipse cx="56" cy="80" rx="9.5" ry="4.8" transform="rotate(-15 56 80)" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
          <ellipse cx="48" cy="100" rx="10" ry="5" transform="rotate(-10 48 100)" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
          <ellipse cx="40" cy="120" rx="10" ry="5" transform="rotate(-5 40 120)" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
          {/* Secondary Stem */}
          <path d="M5 160 Q25 110 50 45" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="48" cy="55" rx="8" ry="4" transform="rotate(-30 48 55)" fill="#fbbf24" stroke="#b45309" strokeWidth="0.8" />
          <ellipse cx="42" cy="70" rx="8" ry="4" transform="rotate(-25 42 70)" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
          <ellipse cx="36" cy="88" rx="8.5" ry="4.2" transform="rotate(-15 36 88)" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
          <ellipse cx="30" cy="108" rx="8.5" ry="4.2" transform="rotate(-10 30 108)" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
        </svg>
      </div>

      {/* Right Golden & Emerald Wheat Sheaf Stalk Illustration */}
      <div className="absolute right-2 sm:right-4 top-0 pointer-events-none opacity-45 sm:opacity-65 select-none">
        <svg
          viewBox="0 0 120 160"
          className="w-20 sm:w-28 md:w-36 h-28 sm:h-36 md:h-44 transform scale-x-[-1]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main Stem */}
          <path d="M10 160 Q40 100 85 20" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          {/* Wheat Grains along stem */}
          <ellipse cx="80" cy="30" rx="9" ry="4.5" transform="rotate(-35 80 30)" fill="#34d399" stroke="#059669" strokeWidth="0.8" />
          <ellipse cx="72" cy="45" rx="9" ry="4.5" transform="rotate(-25 72 45)" fill="#10b981" stroke="#047857" strokeWidth="0.8" />
          <ellipse cx="64" cy="62" rx="9.5" ry="4.8" transform="rotate(-20 64 62)" fill="#34d399" stroke="#059669" strokeWidth="0.8" />
          <ellipse cx="56" cy="80" rx="9.5" ry="4.8" transform="rotate(-15 56 80)" fill="#10b981" stroke="#047857" strokeWidth="0.8" />
          <ellipse cx="48" cy="100" rx="10" ry="5" transform="rotate(-10 48 100)" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
          <ellipse cx="40" cy="120" rx="10" ry="5" transform="rotate(-5 40 120)" fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
        </svg>
      </div>

      {/* Top-Right Glassmorphic Bengali & Bongabdo Date Badge */}
      <div className="relative z-10 flex justify-end md:absolute md:top-4 md:right-5 mb-3 md:mb-0 pr-10 sm:pr-12 md:pr-0">
        <div className="bg-slate-900/70 backdrop-blur-md border border-teal-400/35 rounded-xl px-3 sm:px-4 py-2 shadow-xl flex items-center gap-2.5 sm:gap-3 transition-transform hover:scale-[1.02]">
          {/* Cyan/Blue Calendar Icon with subtle glow */}
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300" />
          </div>

          {/* Two lines: Dynamic Weekday & Gregorian Date (Bold White), Dynamic Bongabdo Date (Warm Gold) */}
          <div className="flex flex-col text-left leading-tight">
            <span className="text-xs sm:text-[13px] font-bold text-white tracking-wide drop-shadow-sm">
              {dates.gregorian}
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-amber-300 tracking-wide mt-0.5 drop-shadow-sm">
              {dates.bongabdo}
            </span>
          </div>
        </div>
      </div>

      {/* Center Emblem & 3D Typography */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto py-1 sm:py-2">
        <div className="flex items-center justify-center gap-2 sm:gap-3.5 md:gap-4 flex-wrap sm:flex-nowrap">
          {/* Two-Tone Golden & Emerald Wheat Emblem Icon */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center shrink-0 drop-shadow-[0_4px_12px_rgba(245,158,11,0.45)]">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="wheatGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="wheatEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6ee7b7" />
                  <stop offset="50%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>

              {/* Central Root Stem */}
              <path
                d="M50 92 Q50 60 50 20"
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Golden Wheat Grains (Left Wing) */}
              <path
                d="M49 76 C45 74 30 68 22 55 C33 55 42 63 48 70"
                fill="url(#wheatGold)"
              />
              <path
                d="M49 60 C44 57 26 50 17 36 C29 36 39 46 47 53"
                fill="url(#wheatGold)"
              />
              <path
                d="M49 44 C44 41 28 32 20 18 C31 19 41 29 48 37"
                fill="url(#wheatGold)"
              />
              <path
                d="M50 28 C47 24 35 15 28 3 C38 6 46 16 50 22"
                fill="url(#wheatGold)"
              />

              {/* Emerald Wheat Grains (Right Wing) */}
              <path
                d="M51 76 C55 74 70 68 78 55 C67 55 58 63 52 70"
                fill="url(#wheatEmerald)"
              />
              <path
                d="M51 60 C56 57 74 50 83 36 C71 36 61 46 53 53"
                fill="url(#wheatEmerald)"
              />
              <path
                d="M51 44 C56 41 72 32 80 18 C69 19 59 29 52 37"
                fill="url(#wheatEmerald)"
              />
              <path
                d="M50 28 C53 24 65 15 72 3 C62 6 54 16 50 22"
                fill="url(#wheatEmerald)"
              />
            </svg>
          </div>

          {/* Vertical Gold Divider Bar */}
          <span className="text-2xl sm:text-3xl md:text-5xl font-extralight text-amber-400/90 select-none">
            |
          </span>

          {/* 3D Typography: মাহা (Metallic Gold) + এন্টারপ্রাইজ (3D Pearl-White) */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight flex items-center gap-1.5 sm:gap-2.5">
            {/* মাহা in 3D Metallic Gold Gradient */}
            <span className="bg-gradient-to-b from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_4px_14px_rgba(245,158,11,0.55)] font-black">
              মাহা
            </span>

            {/* এন্টারপ্রাইজ in 3D Pearl/Silver-White */}
            <span className="text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] font-black">
              এন্টারপ্রাইজ
            </span>
          </h1>
        </div>

        {/* Sleek Horizontal Glowing Gold-to-Emerald Laser Line */}
        <div className="w-full max-w-[240px] sm:max-w-[380px] md:max-w-[480px] h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-emerald-400 mt-2 sm:mt-3 rounded-full shadow-[0_0_14px_rgba(251,191,36,0.7)]" />
      </div>
    </div>
  );
};
