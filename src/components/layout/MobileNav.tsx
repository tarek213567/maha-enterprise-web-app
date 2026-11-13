import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Wallet,
  Settings,
} from 'lucide-react';

interface MobileNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const mobileItems = [
  { id: 'dashboard', name: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { id: 'purchases', name: 'ক্রয়', icon: ShoppingCart },
  { id: 'sales', name: 'বিক্রয়', icon: Package },
  { id: 'stock', name: 'স্টক', icon: Boxes },
  { id: 'ledgers', name: 'বাকি খাতা', icon: Users },
  { id: 'cashbook', name: 'ক্যাশ', icon: Wallet },
  { id: 'settings', name: 'সেটিংস', icon: Settings },
];

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onTabChange }) => {
  return (
    <nav className="md:hidden flex items-center justify-around bg-[#0B0F19]/95 backdrop-blur-lg border-t border-slate-800 py-1.5 px-2 shrink-0 z-50 text-[11px] font-bold select-none pb-[calc(env(safe-area-inset-bottom,4px)+6px)] shadow-2xl">
      {mobileItems.map((item) => {
        const isActive = currentTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              isActive
                ? 'text-emerald-400 bg-emerald-500/15'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="text-[10px] leading-tight truncate">{item.name}</span>
          </button>
        );
      })}
    </nav>
  );
};
