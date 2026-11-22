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
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSecurity } from '../../context/SecurityContext';
import { useSector, SECTORS } from '../../context/SectorContext';
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
  { id: 'creditors', name: 'পাওনাদার', icon: HandCoins },
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
  const [creditorCount, setCreditorCount] = useState<number>(0);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { lockApp } = useSecurity();
  const { activeSector, setActiveSector } = useSector();

  useEffect(() => {
    if (!isOpen) return;
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
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-[285px] max-w-[85vw] h-full bg-white dark:bg-black text-black dark:text-white border-r border-neutral-200 dark:border-neutral-800 flex flex-col p-3.5 shadow-2xl z-10 overflow-y-auto animate-in slide-in-from-left duration-300">
        {/* Drawer Header: Emblem + Brand Title + Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-2 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 32 32" className="w-5 h-5 text-black dark:text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 26 Q14 16 22 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <ellipse cx="21" cy="9" rx="3" ry="1.5" transform="rotate(-35 21 9)" fill="currentColor" />
                <ellipse cx="18" cy="13" rx="3.5" ry="1.7" transform="rotate(-25 18 13)" fill="currentColor" />
                <ellipse cx="15" cy="17" rx="3.5" ry="1.7" transform="rotate(-15 15 17)" fill="currentColor" />
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-black dark:text-white text-sm tracking-wide block font-sans">
                মাহা এন্টারপ্রাইজ
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">চাচকৈড় বাজার, নাটোর</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
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
                  onClick={() => {
                    setActiveSector(s.id);
                    onClose();
                  }}
                  className={`text-xs font-semibold py-2 px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer active:scale-95 ${
                    isActive
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black font-bold shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white'
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

        {/* Divider below Sector Grid */}
        <div className="mb-2 border-t border-neutral-200 dark:border-neutral-800" />

        {/* Menu Items */}
        <div className="flex-1 flex flex-col gap-1 overflow-y-auto pr-0.5 scrollbar-thin">
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  item.id === 'calculator'
                    ? 'text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 bg-neutral-100/50 dark:bg-neutral-900/50'
                    : isActive
                    ? 'border border-black bg-black text-white dark:border-white dark:bg-white dark:text-black font-bold shadow-xs'
                    : 'text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-white dark:text-black'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                {item.id === 'recycle_bin' && recycleCount > 0 ? (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 border ${
                    isActive ? 'bg-neutral-800 text-white border-neutral-600 dark:bg-neutral-200 dark:text-black' : 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border-neutral-300 dark:border-neutral-700'
                  }`}>
                    {toBnDigits(recycleCount)}
                  </span>
                ) : item.id === 'creditors' && creditorCount > 0 ? (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 border ${
                    isActive ? 'bg-neutral-800 text-white border-neutral-600 dark:bg-neutral-200 dark:text-black' : 'bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white border-neutral-300 dark:border-neutral-700'
                  }`}>
                    ({toBnDigits(creditorCount)})
                  </span>
                ) : item.shortcut ? (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 border ${
                      isActive
                        ? 'bg-neutral-800 text-white border-neutral-700 dark:bg-neutral-200 dark:text-black dark:border-neutral-300'
                        : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    {item.shortcut}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Divider directly below menu */}
        <div className="my-2 border-t border-neutral-200 dark:border-neutral-800" />

        {/* Controls Panel (Theme Toggle, Lock, Instant Backup) */}
        <div className="flex flex-col gap-1.5 pt-1 shrink-0">
          {/* Row 1: Theme & Lock */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-black dark:text-white active:scale-95 transition-all cursor-pointer shadow-xs"
              title={isDark ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'লাইট' : 'ডার্ক'}</span>
            </button>

            <button
              type="button"
              onClick={handleLock}
              className="flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-xs font-bold border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-black dark:text-white active:scale-95 transition-all cursor-pointer shadow-xs"
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
            className="w-full flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-bold border border-black bg-black text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            title="ডাটাবেজ ও রয়্যাল এক্সেল (.xlsx) ব্যাকআপ ডাউনলোড করুন"
          >
            <Download className={`w-3.5 h-3.5 shrink-0 ${isBackingUp ? 'animate-spin' : ''}`} />
            <span className="truncate">{isBackingUp ? 'ব্যাকআপ হচ্ছে...' : 'তাৎক্ষণিক ব্যাকআপ'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
