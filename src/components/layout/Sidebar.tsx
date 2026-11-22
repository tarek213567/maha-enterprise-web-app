import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  HandCoins,
  Wallet,
  Calculator,
  BarChart3,
  Settings,
  NotebookPen,
  Trash2,
  Download,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSecurity } from '../../context/SecurityContext';
import { useSector, SECTORS } from '../../context/SectorContext';
import { dbService } from '../../services/api';
import { toBnDigits } from '../../utils/bengaliNumbers';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onQuickBackup?: () => void | Promise<void>;
  onOpenCalculator?: () => void;
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
    id: 'creditors',
    name: 'পাওনাদার',
    icon: HandCoins,
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
  {
    id: 'calculator',
    name: 'ক্যালকুলেটর',
    shortcut: 'F8',
    icon: Calculator,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onQuickBackup,
  onOpenCalculator,
}) => {
  const [recycleCount, setRecycleCount] = useState<number>(0);
  const [creditorCount, setCreditorCount] = useState<number>(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { lockApp } = useSecurity();
  const { activeSector, setActiveSector } = useSector();

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [rcCount, suppliers] = await Promise.all([
          dbService.recycleBin.getCount(),
          dbService.parties.getAll('SUPPLIER').catch(() => []),
        ]);
        setRecycleCount(rcCount || 0);
        const activeSuppliers = (suppliers || []).filter((s) => (s.current_balance || 0) < 0 || (s.opening_balance || 0) < 0);
        setCreditorCount(activeSuppliers.length || (suppliers || []).length);
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 6000);
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
    <aside className="hidden md:flex w-60 bg-gradient-to-b from-[#0A251C] to-[#04120D] text-[#FFF9F0] border-r border-[#D4AF37]/20 flex-col py-3 px-2.5 gap-1 shrink-0 select-none overflow-y-auto h-full scrollbar-thin shadow-[0_0_20px_rgba(11,48,34,0.4)] relative">
      {/* Top Header Brand (Matching image_18.png) */}
      <div className="flex items-center gap-3 px-1.5 py-2.5 border-b border-[#D4AF37]/20 mb-1.5 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#103D2E] to-[#051C13] border border-[#D4AF37]/40 shadow-[0_0_12px_rgba(212,175,55,0.3)] flex items-center justify-center shrink-0">
          <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="goldEmblem" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFEFA6" />
                <stop offset="50%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#8C650A" />
              </linearGradient>
            </defs>
            <path d="M10 34 Q18 20 28 8" stroke="url(#goldEmblem)" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="27" cy="11" rx="4" ry="2" transform="rotate(-35 27 11)" fill="url(#goldEmblem)" />
            <ellipse cx="23" cy="15" rx="4" ry="2" transform="rotate(-25 23 15)" fill="url(#goldEmblem)" />
            <ellipse cx="20" cy="20" rx="4.5" ry="2.2" transform="rotate(-20 20 20)" fill="url(#goldEmblem)" />
            <ellipse cx="17" cy="25" rx="4.5" ry="2.2" transform="rotate(-15 17 25)" fill="url(#goldEmblem)" />
            <ellipse cx="14" cy="30" rx="4.5" ry="2.2" transform="rotate(-10 14 30)" fill="url(#goldEmblem)" />
            <path d="M8 32 C12 36 24 36 28 32" stroke="url(#goldEmblem)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-[#FFEFA6] via-[#D4AF37] to-[#AA7C11] truncate drop-shadow-sm font-sans">
            মাহা এন্টারপ্রাইজ
          </h1>
          <p className="text-[10px] text-[#A7C2B2] truncate font-medium flex items-center gap-1 mt-0.5">
            <span>🌾</span>
            <span>চাচকৈড় বাজার, নাটোর</span>
          </p>
        </div>
      </div>

      {/* Compact 2x2 Sector Switcher Grid */}
      <div className="mb-2 px-1 pt-0.5 shrink-0">
        <div className="grid grid-cols-2 gap-1.5">
          {SECTORS.map((s) => {
            const isActive = activeSector === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSector(s.id)}
                className={`text-xs font-semibold py-2 px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer ${
                  isActive
                    ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#FFEFA6] shadow-[0_0_10px_rgba(212,175,55,0.25)] font-bold'
                    : 'border-[#174233] bg-[#061D15] text-emerald-200/80 hover:border-[#D4AF37]/50 hover:text-[#FFEFA6]'
                }`}
                title={s.description}
              >
                <span className="text-sm leading-none">{s.icon}</span>
                <span className="truncate">{s.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 flex flex-col gap-0.5 min-h-0 overflow-y-auto pr-0.5 scrollbar-thin">
        {menuItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'calculator') {
                  onOpenCalculator?.();
                } else {
                  onTabChange(item.id);
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                item.id === 'calculator'
                  ? 'text-[#FFEFA6] hover:text-white hover:bg-[#D4AF37]/15 border border-[#D4AF37]/30 bg-[#0E3527]/40'
                  : isActive
                  ? 'border border-[#D4AF37]/60 bg-[#D4AF37]/15 text-[#FFEFA6] font-bold shadow-[0_0_14px_rgba(212,175,55,0.22)]'
                  : 'text-[#E2C384] hover:text-white hover:bg-[#D4AF37]/10 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    item.id === 'calculator'
                      ? 'text-[#D4AF37]'
                      : isActive
                      ? 'text-[#FFEFA6]'
                      : 'text-[#D4AF37]/80'
                  }`}
                />
                <span className="truncate">{item.name}</span>
              </div>

              {item.id === 'recycle_bin' && recycleCount > 0 ? (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 bg-rose-500/25 text-rose-300 border border-rose-500/40">
                  {toBnDigits(recycleCount)}
                </span>
              ) : item.id === 'creditors' && creditorCount > 0 ? (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 bg-[#D4AF37]/25 text-[#FFEFA6] border border-[#D4AF37]/40">
                  ({toBnDigits(creditorCount)})
                </span>
              ) : item.shortcut ? (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 ${
                    isActive
                      ? 'bg-[#D4AF37]/25 text-[#FFEFA6] border border-[#D4AF37]/40'
                      : 'bg-[#03150F] text-[#A7C2B2] border border-[#D4AF37]/20'
                  }`}
                >
                  {item.shortcut}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Dedicated Divider directly below menu */}
      <div className="my-1.5 border-t border-[#D4AF37]/20 shrink-0" />

      {/* Dedicated Quick Action Controls Panel */}
      <div className="flex flex-col gap-1.5 pt-0.5 shrink-0 relative z-10">
        {/* Row 1: 🌙 ডার্ক / ☀️ লাইট & 🔒 লক */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold border border-[#D4AF37]/35 bg-[#061E16] hover:bg-[#D4AF37]/20 text-[#FFEFA6] active:scale-95 transition-all cursor-pointer shadow-sm"
            title={isDark ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
          >
            <span>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'লাইট' : 'ডার্ক'}</span>
          </button>

          <button
            type="button"
            onClick={lockApp}
            className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold border border-rose-500/40 bg-[#2A0808] hover:bg-rose-900/40 text-rose-300 active:scale-95 transition-all cursor-pointer shadow-sm"
            title="সফটওয়্যার স্ক্রিন লক করুন"
          >
            <span>🔒</span>
            <span>লক</span>
          </button>
        </div>

        {/* Row 2: 📥 তাৎক্ষণিক ব্যাকআপ */}
        <button
          type="button"
          onClick={handleBackup}
          disabled={isBackingUp}
          className="w-full flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-bold border border-[#D4AF37]/45 bg-gradient-to-r from-[#0E3A2B] to-[#0A261C] hover:border-[#D4AF37] text-[#FFEFA6] active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-md"
          title="ডাটাবেজ ও রয়্যাল এক্সেল (.xlsx) ব্যাকআপ ডাউনলোড করুন"
        >
          <Download className={`w-3.5 h-3.5 text-[#D4AF37] shrink-0 ${isBackingUp ? 'animate-spin' : ''}`} />
          <span className="truncate">{isBackingUp ? 'তৈরি হচ্ছে...' : 'তাৎক্ষণিক ব্যাকআপ'}</span>
        </button>
      </div>

      {/* Subtle Wheat Watermark in corner */}
      <div className="absolute right-0 bottom-0 pointer-events-none opacity-10 select-none overflow-hidden">
        <svg viewBox="0 0 100 120" className="w-24 h-28 transform rotate-12" fill="none">
          <path d="M20 120 Q50 60 80 10" stroke="#D4AF37" strokeWidth="2" />
          <ellipse cx="75" cy="20" rx="8" ry="4" fill="#D4AF37" />
          <ellipse cx="68" cy="35" rx="8" ry="4" fill="#D4AF37" />
          <ellipse cx="60" cy="50" rx="8" ry="4" fill="#D4AF37" />
          <ellipse cx="50" cy="70" rx="8" ry="4" fill="#D4AF37" />
        </svg>
      </div>
    </aside>
  );
};
