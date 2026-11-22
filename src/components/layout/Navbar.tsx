import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  TrendingUp,
  Boxes,
  Users,
  Wallet,
  Receipt,
  BarChart3,
  HardDriveDownload,
  ShieldCheck,
  Phone,
  MapPin,
  Sun,
  Moon,
  Binary,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { APP_CONFIG } from '../../config/appConfig';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenQuickPurchase: () => void;
  onOpenQuickSale: () => void;
  onQuickBackup: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenQuickPurchase,
  onOpenQuickSale,
  onQuickBackup,
}) => {
  const { theme, isDark, digitMode, toggleTheme, toggleDigitMode } = useTheme();

  const navItems = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
    { id: 'purchases', label: 'ক্রয় / স্টক-ইন', icon: ShoppingCart },
    { id: 'sales', label: 'বিক্রয় ও চালান', icon: TrendingUp },
    { id: 'stock', label: 'গুদাম স্টক ও শুকতি', icon: Boxes },
    { id: 'ledgers', label: 'পার্টি খাতা (লেজার)', icon: Users },
    { id: 'cashbook', label: 'দৈনিক ক্যাশ বই', icon: Wallet },
    { id: 'expenses', label: 'পরিচালন খরচ', icon: Receipt },
    { id: 'reports', label: 'লাভ-ক্ষতি বিবরণী', icon: BarChart3 },
    { id: 'settings', label: 'ব্যাকআপ ও সেটিংস', icon: HardDriveDownload },
  ];

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm transition-colors duration-150">
      {/* Official Business Header */}
      <div className="bg-emerald-900 dark:bg-emerald-950 text-white px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Brand & Proprietor */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center font-black text-amber-300 text-lg border border-emerald-500 shadow-sm">
              মা
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-wide text-amber-300">
                  মাহা এন্টারপ্রাইজ
                </h1>
                <span className="text-[11px] bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-700">
                  Maha Enterprise
                </span>
                <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black">
                  {APP_CONFIG.version}
                </span>
              </div>
              <p className="text-[11px] text-emerald-200">
                প্রোপ্রাইটর: মোঃ আব্দুর রশিদ সরকার এন্ড সন্স
              </p>
            </div>
          </div>

          {/* Contact Numbers, Location & Controls */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-100">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>চাঁচকৈড় বাজার, গুরুদাসপুর, নাটোর</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>আলজাবির: <strong className="text-white">01711054499</strong></span>
              <span>|</span>
              <span>আব্দুর রশিদ: <strong className="text-white">01711703241</strong></span>
            </div>

            {/* Offline badge */}
            <div className="flex items-center gap-1 bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>১০০% অফলাইন</span>
            </div>

            {/* Digit Display Mode Toggle */}
            <button
              onClick={toggleDigitMode}
              title="সংখ্যা প্রদর্শন মোড পরিবর্তন (বাংলা / ইংরেজি)"
              className="flex items-center gap-1 bg-emerald-800/80 hover:bg-emerald-800 text-amber-300 px-2.5 py-0.5 rounded border border-emerald-700 transition-colors font-semibold"
            >
              <Binary className="w-3 h-3" />
              <span>সংখ্যা: {digitMode === 'BN' ? 'বাংলা (১২,৩৪৫)' : 'English (12,345)'}</span>
            </button>

            {/* Day / Night Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={!isDark ? 'নাইট / ডার্ক মোডে পরিবর্তন করুন' : 'ডে / লাইট মোডে পরিবর্তন করুন'}
              className="flex items-center gap-1 bg-emerald-800/80 hover:bg-emerald-800 text-white px-2.5 py-0.5 rounded border border-emerald-700 transition-colors font-semibold"
            >
              {!isDark ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-300" />
                  <span>ডার্ক মোড</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span>লাইট মোড</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Bar & Quick Action Buttons */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-2 overflow-x-auto">
          {/* Main Navigation Tabs */}
          <nav className="flex space-x-1 shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenQuickPurchase}
              title="নতুন শস্য ক্রয় এন্ট্রি (F2)"
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>+ ক্রয় (F2)</span>
            </button>

            <button
              onClick={onOpenQuickSale}
              title="নতুন বিক্রয় ও চালান এন্ট্রি (F3)"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+ বিক্রয় (F3)</span>
            </button>

            <button
              onClick={onQuickBackup}
              title="এক ক্লিকে ডাটাবেস ব্যাকআপ সংরক্ষণ"
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs flex items-center gap-1 border border-slate-300 dark:border-slate-700 transition-colors"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden lg:inline">ব্যাকআপ</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
