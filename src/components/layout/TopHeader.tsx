import React, { useState, useEffect } from 'react';
import { ShoppingCart, TrendingUp, Sparkles, Trash2 } from 'lucide-react';
import { dbService } from '../../services/api';
import { LiveClock } from './LiveClock';

interface TopHeaderProps {
  currentTab: string;
  onOpenQuickPurchase: () => void;
  onOpenQuickSale: () => void;
}

const tabTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'ব্যবসা সারসংক্ষেপ ড্যাশবোর্ড',
    subtitle: 'আজকের সামগ্রিক মজুদ, ক্রয়-বিক্রয়, নগদ ক্যাশ এবং দ্রুত অ্যাকশন প্যানেল',
  },
  purchases: {
    title: 'শস্য ক্রয় ও স্টক-ইন চালান',
    subtitle: 'কৃষক ও পার্টি থেকে ধান, গম, ভুট্টা, সরিষা, পাট, খেসারী ক্রয় এন্ট্রি ও বস্তা হিসাব',
  },
  sales: {
    title: 'পাইকারি বিক্রয় ও চালান (POS)',
    subtitle: 'ক্রেতা পার্টির নিকট পণ্য বিক্রয়, চালান মেমো তৈরি এবং ক্যাশ/বাকির হিসাব',
  },
  stock: {
    title: 'গুদাম স্টক ও শুকতি ঘাটতি ট্র্যাকিং',
    subtitle: 'বর্তমান মজুত পরিমাণ, বস্তা সংখ্যা, শুকতি লস হিসাব ও কেজি রূপান্তর',
  },
  ledgers: {
    title: 'বাকি খাতা ও গ্রাহক খতিয়ান',
    subtitle: 'খরিদ্দারদের বাকি খাতা, সাবেক বকেয়া ও নগদ/ব্যাংক জমা-খরচ বিবরণী',
  },
  creditors: {
    title: 'পাওনাদার খাতা ও মহাজন লেজার',
    subtitle: 'যাদের নিকট হতে বাকিতে শস্য ক্রয় করা হয়েছে বা যারা টাকা পাবেন তাদের সম্পূর্ণ হিসাব',
  },
  cashbook: {
    title: 'দৈনিক ক্যাশ বই (রোজক্যাশ)',
    subtitle: 'দৈনন্দিন নগদ জমা ও নগদ খরচের সম্পূর্ণ হিসাব ও ব্যালেন্স বিবরণী',
  },
  expenses: {
    title: 'পরিচালন ও ব্যবসায়িক খরচ',
    subtitle: 'লেবার বিল, পরিবহন ভাড়া, গুদাম ভাড়া, বিদ্যুৎ ও বিবিধ পরিচালন ব্যয়ের হিসাব',
  },
  reports: {
    title: 'লাভ-ক্ষতি ও আর্থিক বিবরণী',
    subtitle: 'নিট লাভ, বিক্রিত পণ্যের ব্যয় (COGS), শুকতি জনিত ক্ষতি এবং সামগ্রিক প্রতিবেদন',
  },
  settings: {
    title: 'ডাটা সুরক্ষা, ব্যাকআপ ও সেটিংস',
    subtitle: '১০০% অফলাইন SQLite ডাটাবেজ ব্যাকআপ, ডাটা রিস্টোর, থিম ও ফন্ট সেটিংস',
  },
  notebook: {
    title: 'নোটবুক ও দৈনন্দিন টোকাবহি',
    subtitle: 'জরুরি হিসাব, দরদাম ও বেপারী স্মরণিকা লিখে রাখার ডিজিটাল নোটপ্যাড',
  },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentTab,
  onOpenQuickPurchase,
  onOpenQuickSale,
}) => {
  const currentInfo = tabTitles[currentTab] || {
    title: 'মাহা এন্টারপ্রাইজ',
    subtitle: 'শস্য আড়ত ও পাইকারি ব্যবসা ব্যবস্থাপনা',
  };

  const [hasDrafts, setHasDrafts] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkDrafts = async () => {
      try {
        const exists = await dbService.system.hasTestDrafts();
        if (mounted) setHasDrafts(exists);
      } catch {
        // ignore
      }
    };
    checkDrafts();

    const handleDraftsChanged = () => {
      checkDrafts();
    };
    window.addEventListener('maha-drafts-changed', handleDraftsChanged);

    return () => {
      mounted = false;
      window.removeEventListener('maha-drafts-changed', handleDraftsChanged);
    };
  }, []);

  const handlePurgeDrafts = async () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে সকল টেস্ট ড্রাফট লেনদেন মুছে ফেলে স্টক ও খতিয়ান ব্যালেন্স পূর্বের অবস্থায় ফিরিয়ে নিতে চান?')) {
      return;
    }
    try {
      setIsPurging(true);
      const res = await dbService.system.purgeTestDrafts();
      alert(res.message || 'সকল টেস্ট ড্রাফট ডাটা সফলভাবে মুছে ফেলা হয়েছে।');
      setHasDrafts(false);
      window.location.reload();
    } catch (err: any) {
      alert('মুছতে সমস্যা হয়েছে: ' + (err.message || 'অজানা ত্রুটি'));
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <header className="print:hidden bg-[#0A251C]/90 backdrop-blur-md text-[#FFF9F0] border-b border-[#D4AF37]/25 pl-14 pr-4 md:px-5 py-3 sticky top-0 z-10 shadow-md transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Active Tab Title & Subtitle */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-lg font-black text-[#FFEFA6] tracking-tight whitespace-nowrap truncate max-w-[140px] sm:max-w-none shrink-0 font-sans">
              {currentInfo.title}
            </h2>
            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#FFEFA6]">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              <span>সক্রিয় মডিউল</span>
            </span>
          </div>
          <p className="text-xs text-[#A7C2B2] truncate mt-0.5">
            {currentInfo.subtitle}
          </p>
        </div>

        {/* Right: Date, Location & Quick Entry Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 overflow-x-auto no-scrollbar max-w-full pb-0.5">
          {/* Location & Date Badge (Isolated Memoized Component) */}
          <LiveClock />

          {/* Test Drafts Purge Button */}
          {hasDrafts && (
            <button
              onClick={handlePurgeDrafts}
              disabled={isPurging}
              title="সকল পরীক্ষামূলক টেস্ট ড্রাফট ডাটা ডাটাবেজ থেকে মুছে ফেলুন"
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-xl text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-md transition-all duration-150 cursor-pointer animate-pulse"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              <span>{isPurging ? 'মুছে ফেলা হচ্ছে...' : '🗑️ সকল টেস্ট ড্রাফট ডাটা মুছুন'}</span>
            </button>
          )}

          {/* Ai Manezar (Gemini 3 Flash) Pill Button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-manezar'))}
            title="Ai Manezar (Gemini 3 Flash) আড়ত সহকারী খুলুন"
            className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-95 text-white font-black rounded-xl text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>✨ Ai Manezar</span>
          </button>

          {/* Quick Purchase Entry (F2) */}
          <button
            onClick={onOpenQuickPurchase}
            title="নতুন শস্য ক্রয় চালান এন্ট্রি করুন (F2)"
            className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 text-slate-950" />
            <span>+ ক্রয় (F2)</span>
          </button>

          {/* Quick Sale / Challan Entry (F3) */}
          <button
            onClick={onOpenQuickSale}
            title="নতুন বিক্রয় ও মেমো চালান তৈরি করুন (F3)"
            className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-emerald-100" />
            <span>+ বিক্রয় (F3)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
