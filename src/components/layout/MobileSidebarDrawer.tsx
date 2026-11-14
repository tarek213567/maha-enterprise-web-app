import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Wallet,
  Calculator,
  BarChart3,
  Settings,
  NotebookPen,
  Trash2,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSecurity } from '../../context/SecurityContext';
import { dbService } from '../../services/api';
import { toBnDigits } from '../../utils/bengaliNumbers';

interface MobileSidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onTabChange: (tab: string) => void;
  onQuickBackup?: () => void | Promise<void>;
  onOpenCalculator?: () => void;
}

const menuItems = [
  { id: 'dashboard', name: 'ড্যাশবোর্ড', shortcut: 'F1', icon: LayoutDashboard },
  { id: 'purchases', name: 'শস্য ক্রয় ও স্টক-ইন', shortcut: 'F2', icon: ShoppingCart },
  { id: 'sales', name: 'পাইকারি বিক্রয় ও চালান', shortcut: 'F3', icon: Package },
  { id: 'stock', name: 'গুদাম স্টক ও ওজন', icon: Boxes },
  { id: 'ledgers', name: 'বাকি খাতা', icon: Users },
  { id: 'cashbook', name: 'দৈনিক ক্যাশ বই', shortcut: 'F4', icon: Wallet },
  { id: 'expenses', name: 'পরিচালন খরচ', icon: Calculator },
  { id: 'reports', name: 'রিপোর্ট', icon: BarChart3 },
  { id: 'settings', name: 'ব্যাকআপ ও সেটিংস', icon: Settings },
  { id: 'notebook', name: 'নোটবুক', icon: NotebookPen },
  { id: 'recycle_bin', name: 'রিসাইকেল বিন', icon: Trash2 },
  { id: 'calculator', name: 'ক্যালকুলেটর', shortcut: 'F8', icon: Calculator },
];

export const MobileSidebarDrawer: React.FC<MobileSidebarDrawerProps> = ({
  isOpen,
  onClose,
  currentTab,
  onTabChange,
  onQuickBackup,
  onOpenCalculator,
}) => {
  const [recycleCount, setRecycleCount] = useState<number>(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { lockApp } = useSecurity();

  useEffect(() => {
    if (!isOpen) return;
    const fetchCount = async () => {
      try {
        const count = await dbService.recycleBin.getCount();
        setRecycleCount(count || 0);
      } catch {}
    };
    fetchCount();
  }, [isOpen]);

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

  const handleLock = () => {
    onClose();
    lockApp();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex select-none">
      {/* Semi-transparent Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-[280px] max-w-[85vw] h-full bg-[#08152c] text-slate-200 border-r border-[#0f1d38] flex flex-col p-3 shadow-2xl z-10 overflow-y-auto animate-in slide-in-from-left duration-200">
        {/* Drawer Header: Emblem + Brand Title + Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-[#0f1d38] mb-2 px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 28C16 28 16 13 22 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M16 28C16 28 16 11 10 5" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="10" cy="5" r="3" fill="#f59e0b" />
                <circle cx="15.5" cy="8.5" r="2.5" fill="#f59e0b" />
                <circle cx="22" cy="7" r="3" fill="#10b981" />
              </svg>
            </div>
            <span className="text-slate-500 font-light text-xs">|</span>
            <span className="font-bold text-white text-sm tracking-wide">মাহা এন্টারপ্রাইজ</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'calculator') {
                    onClose();
                    onOpenCalculator?.();
                  } else {
                    onTabChange(item.id);
                    onClose();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left cursor-pointer ${
                  item.id === 'calculator'
                    ? 'text-amber-300 hover:text-white hover:bg-amber-500/15 border border-amber-500/25 bg-amber-950/20'
                    : isActive
                    ? 'border border-emerald-400/80 bg-emerald-950/60 text-white font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      item.id === 'calculator'
                        ? 'text-amber-400'
                        : isActive
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                {item.id === 'recycle_bin' && recycleCount > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 bg-rose-500/25 text-rose-300 border border-rose-500/40">
                    {toBnDigits(recycleCount)}
                  </span>
                ) : item.shortcut ? (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 ${
                      item.id === 'calculator'
                        ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                        : isActive
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.shortcut}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Divider directly below ক্যালকুলেটর */}
        <div className="my-2 border-t border-[#0f1d38]" />

        {/* Controls Panel (Theme Toggle, Lock, Instant Backup) */}
        <div className="flex flex-col gap-1.5 pt-1">
          {/* Row 1: Theme & Lock */}
          <div className="grid grid-cols-2 gap-1.5">
            {/* 1. Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all cursor-pointer shadow-2xs"
              title={isDark ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'লাইট' : 'ডার্ক'}</span>
            </button>

            {/* 2. Security Lock */}
            <button
              type="button"
              onClick={handleLock}
              className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 active:scale-95 transition-all cursor-pointer shadow-2xs"
              title="সফটওয়্যার স্ক্রিন লক করুন"
            >
              <span>🔒</span>
              <span>লক</span>
            </button>
          </div>

          {/* Row 2: 💾 তাৎক্ষণিক ব্যাকআপ */}
          <button
            type="button"
            onClick={handleBackup}
            disabled={isBackingUp}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border border-amber-500/50 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            title="ডাটাবেজ ও রয়্যাল এক্সেল (.xlsx) ব্যাকআপ ডাউনলোড করুন"
          >
            <span>💾</span>
            <span className="truncate">{isBackingUp ? 'ব্যাকআপ হচ্ছে...' : 'তাৎক্ষণিক ব্যাকআপ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
