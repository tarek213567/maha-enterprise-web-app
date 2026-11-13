import React from 'react';
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
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onQuickBackup?: () => void;
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
];

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  return (
    <aside className="hidden md:flex w-56 bg-[#08152c] text-slate-200 border-r border-[#0f1d38] flex-col py-3 px-2.5 gap-1 shrink-0 select-none overflow-y-auto">
      {/* Starts directly with the menu items (no extra header block above ড্যাশবোর্ড and no proprietor footer block at the bottom) */}
      {menuItems.map((item) => {
        const isActive = currentTab === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-[13px] font-medium transition-all text-left cursor-pointer ${
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

            {item.shortcut && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1 ${
                  isActive
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
};
