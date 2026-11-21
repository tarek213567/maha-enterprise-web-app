import React from 'react';
import { getGregorianDateInBengali } from '../../utils/banglaDate';

export const BottomStatusBar: React.FC = () => {
  const todayBn = getGregorianDateInBengali().fullText;

  return (
    <footer className="hidden md:flex bg-[#04120D] border-t border-[#D4AF37]/25 h-8 px-5 items-center justify-center text-xs text-[#E2C384] font-medium select-none shrink-0 z-40 shadow-inner">
      <div className="flex items-center gap-2 flex-wrap text-center">
        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          লাইভ সিঙ্ক চালু
        </span>
        <span className="text-[#D4AF37]/40">•</span>
        <span className="text-[#A7C2B2]">সর্বশেষ আপডেট: <strong className="text-white font-mono">{todayBn}</strong></span>
        <span className="text-[#D4AF37]/40">•</span>
        <span className="text-[#FFEFA6] font-bold">মাহা এন্টারপ্রাইজ</span>
        <span className="text-[#D4AF37]/40">|</span>
        <span className="text-[#A7C2B2] font-mono">সংস্করণ: ২.৬ (PRO)</span>
      </div>
    </footer>
  );
};
