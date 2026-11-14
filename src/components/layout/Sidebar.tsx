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
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSecurity } from '../../context/SecurityContext';
import { dbService } from '../../services/api';
import { toBnDigits } from '../../utils/bengaliNumbers';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onQuickBackup?: () => void | Promise<void>;
}

const menuItems = [
  {
    id: 'dashboard',
    name: 'ড্যাশবোর্ড',
    shortcut: 'F1',
    icon: LayoutDashboard,
  },
  {
    id: 'purchases',
    name: 'শস্য ক্রয় ও স্টক-ইন',
    shortcut: 'F2',
    icon: ShoppingCart,
  },
  {
    id: 'sales',
    name: 'পাইকারি বিক্রয় ও চালান',
    shortcut: 'F3',
    icon: Package,
  },
  {
    id: 'stock',
    name: 'গুদাম স্টক ও ওজন',
    icon: Boxes,
  },
  {
    id: 'ledgers',
    name: 'বাকি খাতা',
    icon: Users,
  },
  {
    id: 'cashbook',
    name: 'দৈনিক ক্যাশ বই',
    shortcut: 'F4',
    icon: Wallet,
  },
  {
    id: 'expenses',
    name: 'পরিচালন খরচ',
    icon: Calculator,
  },
  {
    id: 'reports',
    name: 'রিপোর্ট',
    icon: BarChart3,
  },
  {
    id: 'settings',
    name: 'ব্যাকআপ ও সেটিংস',
    icon: Settings,
  },
  {
    id: 'notebook',
    name: 'নোটবুক',
    icon: NotebookPen,
  },
  {
    id: 'recycle_bin',
    name: 'রিসাইকেল বিন',
    icon: Trash2,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, onQuickBackup }) => {
  const [recycleCount, setRecycleCount] = useState<number>(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { lockApp } = useSecurity();

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const count = await dbService.recycleBin.getCount();
        setRecycleCount(count || 0);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 6000);
    return () => clearInterval(interval);
  }, []);

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
    <aside className="hidden md:flex w-56 bg-[#08152c] text-slate-200 border-r border-[#0f1d38] flex-col py-3 px-2.5 gap-1 shrink-0 select-none overflow-y-auto">
      {/* Starts directly with the menu items */}
      <div className="flex-1 flex flex-col gap-1">
        {menuItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-[13px] font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? 'border border-emerald-400/80 bg-emerald-950/60 text-white font-bold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-emerald-400' : 'text-slate-400'
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
                    isActive
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

      {/* Dedicated Divider directly below রিসাইকেল বিন */}
      <div className="my-2 border-t border-[#0f1d38]" />

      {/* Dedicated Quick Action Controls Panel (Screenshot 2) */}
      <div className="flex flex-col gap-1.5 pt-1">
        {/* Row 1: 🌙 ডার্ক / ☀️ লাইট & 🔒 লক (2 Columns) */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* 1. 🌙 ডার্ক / ☀️ লাইট */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 text-slate-200 active:scale-95 transition-all cursor-pointer shadow-2xs"
            title={isDark ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'লাইট' : 'ডার্ক'}</span>
          </button>

          {/* 2. 🔒 লক */}
          <button
            type="button"
            onClick={lockApp}
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
    </aside>
  );
};
