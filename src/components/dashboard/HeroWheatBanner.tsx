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
    <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 shadow-xl bg-[#04120D] text-white p-4 sm:p-5 md:p-6 min-h-[155px] sm:min-h-[175px] md:min-h-[195px] flex items-center justify-between select-none transition-all duration-300">
      {/* High-Resolution Royal Wheat Backdrop Image Layer */}
      <div
        className="absolute inset-0 pointer-events-none bg-cover bg-center opacity-55 mix-blend-screen scale-100 transition-transform duration-700"
        style={{ backgroundImage: `url('/hero-wheat-banner.jpg')` }}
      />
      {/* Dark Royal Emerald Gradient Overlay to ensure crisp contrast */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#04120D]/95 via-[#0A251C]/75 to-[#04120D]/90" />

      {/* Decorative Golden Wheat Sparks in background */}
      <div className="absolute inset-0 pointer-events-none opacity-30 overflow-hidden">
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[450px] h-[200px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.2),transparent_70%)]" />
      </div>

      {/* Left Title & Calligraphy Section */}
      <div className="relative z-10 flex flex-col justify-center max-w-[65%] sm:max-w-none">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <span className="text-[#D4AF37] text-lg sm:text-2xl drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]">🌾</span>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFFFFF] via-[#FFE48F] to-[#D4AF37] drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)] font-sans">
            মাহা এন্টারপ্রাইজ
          </h1>
          <span className="text-[#D4AF37] text-lg sm:text-2xl drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]">✨</span>
        </div>
        <p className="text-xs sm:text-sm md:text-base text-[#E2C384] font-bold tracking-wide mt-1 drop-shadow-md">
          সততাই ব্যবসা বা সততাই ব্যবসার মূলধন
        </p>
      </div>

      {/* Center-Right Golden Grain Sack Medallion (Matching image_18.png) */}
      <div className="hidden lg:flex items-center justify-center shrink-0 my-auto relative z-10 mx-4">
        <div className="w-24 h-24 xl:w-28 xl:h-28 rounded-full border-2 border-[#D4AF37] p-1 shadow-[0_0_20px_rgba(212,175,55,0.45)] bg-[#0A251C]/85 backdrop-blur-md relative overflow-hidden flex items-center justify-center">
          <div className="w-full h-full rounded-full border border-[#D4AF37]/60 overflow-hidden relative flex items-center justify-center bg-gradient-to-br from-[#123E2E] to-[#04140D]">
            <svg viewBox="0 0 100 100" className="w-full h-full p-1.5" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="grainGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFF2AF" />
                  <stop offset="50%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#784B08" />
                </radialGradient>
                <linearGradient id="sackBurlap" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C49A45" />
                  <stop offset="50%" stopColor="#9C7426" />
                  <stop offset="100%" stopColor="#6E4D12" />
                </linearGradient>
              </defs>
              {/* Green & Golden Stalks behind sack */}
              <path d="M50 85 Q30 40 25 20" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="25" cy="22" rx="5" ry="2.5" transform="rotate(-30 25 22)" fill="#34d399" />
              <ellipse cx="28" cy="30" rx="5" ry="2.5" transform="rotate(-20 28 30)" fill="#10b981" />
              <path d="M50 85 Q70 40 78 18" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
              <ellipse cx="76" cy="20" rx="5" ry="2.5" transform="rotate(30 76 20)" fill="#fbbf24" />
              <ellipse cx="72" cy="28" rx="5" ry="2.5" transform="rotate(20 72 28)" fill="#f59e0b" />
              {/* Burlap Sack Body */}
              <path d="M30 50 C28 65 32 82 50 84 C68 82 72 65 70 50 C65 48 35 48 30 50 Z" fill="url(#sackBurlap)" stroke="#6E4D12" strokeWidth="1.5" />
              <ellipse cx="50" cy="50" rx="20" ry="7" fill="url(#sackBurlap)" stroke="#52390C" strokeWidth="1" />
              {/* Overflowing Golden Grains */}
              <ellipse cx="50" cy="46" rx="16" ry="9" fill="url(#grainGlow)" />
              <circle cx="44" cy="44" r="2" fill="#FFFFFF" />
              <circle cx="52" cy="43" r="2" fill="#FFFFFF" />
              <circle cx="56" cy="46" r="1.8" fill="#FFFFFF" />
              <circle cx="47" cy="47" r="1.8" fill="#FFFFFF" />
              {/* Front Wheat Stalk Framing */}
              <path d="M20 78 Q35 65 50 62" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" />
              <ellipse cx="32" cy="70" rx="4" ry="2" transform="rotate(-15 32 70)" fill="#34d399" />
            </svg>
          </div>
        </div>
      </div>

      {/* Far Right: Translucent Gold Calendar Card (Matching image_18.png) */}
      <div className="relative z-10 shrink-0">
        <div className="bg-[#0A251C]/85 backdrop-blur-md border border-[#D4AF37]/45 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.5)] px-3 sm:px-4 py-2 sm:py-2.5 text-[#FFEBA6] flex flex-col gap-1.5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#D4AF37]">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF37]" />
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[11px] sm:text-xs font-bold text-white drop-shadow-sm font-sans">
                {dates.gregorian}
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#E2C384] drop-shadow-sm font-sans mt-0.5">
                {dates.bongabdo}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-[#D4AF37]/20 text-[10px] sm:text-[11px] font-bold text-[#FFEBA6]">
            <Clock className="w-3 h-3 text-[#D4AF37] shrink-0" />
            <span>সময়: {liveTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
