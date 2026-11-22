import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { getGregorianDateInBengali, getBanglaBongabdoDate } from '../../utils/banglaDate';
import { toBnDigits } from '../../utils/bengaliNumbers';

export const HeroWheatBanner: React.FC = () => {
  const [dates, setDates] = useState(() => ({
    gregorian: getGregorianDateInBengali().fullText,
    bongabdo: getBanglaBongabdoDate().fullText,
  }));

  const [liveTime, setLiveTime] = useState(() => {
    const d = new Date();
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    return `${toBnDigits(hStr)}:${toBnDigits(mStr)} ${ampm}`;
  });

  useEffect(() => {
    const updateDates = () => {
      setDates({
        gregorian: getGregorianDateInBengali().fullText,
        bongabdo: getBanglaBongabdoDate().fullText,
      });
    };
    const dateInterval = setInterval(updateDates, 60000);

    const clockInterval = setInterval(() => {
      const d = new Date();
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      setLiveTime(`${toBnDigits(hStr)}:${toBnDigits(mStr)} ${ampm}`);
    }, 1000);

    return () => {
      clearInterval(dateInterval);
      clearInterval(clockInterval);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-black dark:border-neutral-800 shadow-sm bg-white dark:bg-[#0A0A0A] text-black dark:text-white p-4 sm:p-5 md:p-6 min-h-[155px] sm:min-h-[175px] md:min-h-[195px] flex items-center justify-between select-none transition-all duration-300">
      {/* High-Resolution Wheat Backdrop Image Layer */}
      <div
        className="absolute inset-0 pointer-events-none bg-cover bg-center opacity-[0.04] dark:opacity-10 grayscale scale-100 transition-transform duration-700"
        style={{ backgroundImage: `url('/hero-wheat-banner.jpg')` }}
      />
      {/* Subtle Monochrome Gradient Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-white/90 via-transparent to-white/90 dark:from-black/90 dark:via-transparent dark:to-black/90" />

      {/* Left Title & Calligraphy Section */}
      <div className="relative z-10 flex flex-col justify-center max-w-[65%] sm:max-w-none">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <span className="text-black dark:text-white text-lg sm:text-2xl">🌾</span>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-black dark:text-white font-sans">
            মাহা এন্টারপ্রাইজ
          </h1>
          <span className="text-black dark:text-white text-lg sm:text-2xl">✨</span>
        </div>
        <p className="text-xs sm:text-sm md:text-base text-neutral-600 dark:text-neutral-400 font-bold tracking-wide mt-1">
          সততাই ব্যবসা বা সততাই ব্যবসার মূলধন
        </p>
      </div>

      {/* Center-Right Grain Sack Medallion (Monochrome) */}
      <div className="hidden lg:flex items-center justify-center shrink-0 my-auto relative z-10 mx-4">
        <div className="w-24 h-24 xl:w-28 xl:h-28 rounded-full border-2 border-black dark:border-white p-1 shadow-sm bg-neutral-100 dark:bg-neutral-900 relative overflow-hidden flex items-center justify-center">
          <div className="w-full h-full rounded-full border border-neutral-300 dark:border-neutral-700 overflow-hidden relative flex items-center justify-center bg-white dark:bg-black text-black dark:text-white">
            <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 85 Q30 40 25 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="25" cy="22" rx="5" ry="2.5" transform="rotate(-30 25 22)" fill="currentColor" opacity="0.6" />
              <ellipse cx="28" cy="30" rx="5" ry="2.5" transform="rotate(-20 28 30)" fill="currentColor" opacity="0.8" />
              <path d="M50 85 Q70 40 78 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="76" cy="20" rx="5" ry="2.5" transform="rotate(30 76 20)" fill="currentColor" opacity="0.6" />
              <ellipse cx="72" cy="28" rx="5" ry="2.5" transform="rotate(20 72 28)" fill="currentColor" opacity="0.8" />
              <path d="M30 50 C28 65 32 82 50 84 C68 82 72 65 70 50 C65 48 35 48 30 50 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
              <ellipse cx="50" cy="50" rx="20" ry="7" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1" />
              <ellipse cx="50" cy="46" rx="16" ry="9" fill="currentColor" opacity="0.4" />
              <circle cx="44" cy="44" r="2" fill="white" />
              <circle cx="52" cy="43" r="2" fill="white" />
              <circle cx="56" cy="46" r="1.8" fill="white" />
              <circle cx="47" cy="47" r="1.8" fill="white" />
              <path d="M20 78 Q35 65 50 62" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <ellipse cx="32" cy="70" rx="4" ry="2" transform="rotate(-15 32 70)" fill="currentColor" opacity="0.7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Far Right: Calendar Card */}
      <div className="relative z-10 shrink-0">
        <div className="bg-neutral-50 dark:bg-black border border-neutral-300 dark:border-neutral-800 rounded-xl shadow-xs px-3 sm:px-4 py-2 sm:py-2.5 text-black dark:text-white flex flex-col gap-1.5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-neutral-200 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-black dark:text-white">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black dark:text-white" />
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[11px] sm:text-xs font-bold text-black dark:text-white font-sans">
                {dates.gregorian}
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 font-sans mt-0.5">
                {dates.bongabdo}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-neutral-200 dark:border-neutral-800 text-[10px] sm:text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
            <Clock className="w-3 h-3 text-black dark:text-white shrink-0" />
            <span>সময়: {liveTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
