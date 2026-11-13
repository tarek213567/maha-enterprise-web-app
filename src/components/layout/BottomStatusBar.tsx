import React from 'react';

export const BottomStatusBar: React.FC = () => {
  return (
    <footer className="hidden md:flex bg-white border-t border-slate-200 h-9 px-5 items-center justify-between text-xs text-slate-700 font-medium select-none shrink-0 z-40">
      {/* Left: Green circle dot 🟢 + bold text "অফলাইন মোড সক্রিয়" */}
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs animate-pulse"></span>
        <span className="font-bold text-slate-800">অফলাইন মোড সক্রিয়</span>
      </div>

      {/* Right: Vertical divider | + wheat/leaf logo icon + bold text "মাহা এন্টারপ্রাইজ" */}
      <div className="flex items-center gap-2.5">
        <span className="text-slate-300 font-light">|</span>
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path d="M12 21C12 21 12 10 17 5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 21C12 21 12 8 7 4" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
            <circle cx="7" cy="4" r="2" fill="#f59e0b" />
            <circle cx="17" cy="5" r="2" fill="#10b981" />
          </svg>
        </div>
        <span className="font-bold text-slate-900">মাহা এন্টারপ্রাইজ</span>
      </div>
    </footer>
  );
};
