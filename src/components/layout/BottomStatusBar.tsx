import React from 'react';
import { getGregorianDateInBengali } from '../../utils/banglaDate';

export const BottomStatusBar: React.FC = () => {
  const todayBn = getGregorianDateInBengali().fullText;

  return (
    <footer className="hidden md:flex bg-white dark:bg-black border-t border-neutral-200 dark:border-neutral-800 h-8 px-5 items-center justify-center text-xs text-neutral-600 dark:text-neutral-400 font-medium select-none shrink-0 z-40 shadow-xs">
      <div className="flex items-center gap-2 flex-wrap text-center">
        <span className="inline-flex items-center gap-1.5 text-black dark:text-white font-bold">
          <span className="w-2 h-2 rounded-full bg-black dark:bg-white animate-pulse"></span>
          লাইভ সিঙ্ক চালু
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">•</span>
        <span className="text-neutral-600 dark:text-neutral-400">সর্বশেষ আপডেট: <strong className="text-black dark:text-white font-mono">{todayBn}</strong></span>
        <span className="text-neutral-300 dark:text-neutral-700">•</span>
        <span className="text-black dark:text-white font-bold">মাহা এন্টারপ্রাইজ</span>
        <span className="text-neutral-300 dark:text-neutral-700">|</span>
        <span className="text-neutral-500 dark:text-neutral-400 font-mono">সংস্করণ: ২.৬ (PRO)</span>
      </div>
    </footer>
  );
};
