import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Wallet,
  Menu,
} from 'lucide-react';

interface MobileNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenMenu?: () => void;
}

const mobileItems = [
  { id: 'dashboard', name: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { id: 'purchases', name: 'ক্রয়', icon: ShoppingCart },
  { id: 'sales', name: 'বিক্রয়', icon: Package },
  { id: 'stock', name: 'স্টক', icon: Boxes },
  { id: 'ledgers', name: 'বাকি খাতা', icon: Users },
  { id: 'cashbook', name: 'ক্যাশ', icon: Wallet },
];

export const MobileNav: React.FC<MobileNavProps> = ({ currentTab, onTabChange, onOpenMenu }) => {
  return (
    <nav className="hidden items-center justify-around bg-white/95 dark:bg-black/95 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 py-1.5 px-2 shrink-0 z-50 text-[11px] font-bold select-none pb-[calc(env(safe-area-inset-bottom,4px)+6px)] shadow-xs">
      {mobileItems.map((item) => {
        const isActive = currentTab === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              isActive
                ? 'text-white bg-black dark:text-black dark:bg-white border border-black dark:border-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-white dark:text-black' : 'text-neutral-500 dark:text-neutral-400'}`} />
            <span className="text-[10px] leading-tight truncate">{item.name}</span>
          </button>
        );
      })}

      {/* Full Drawer Menu Trigger Button */}
      {onOpenMenu && (
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all text-black dark:text-white hover:opacity-80 active:scale-95 cursor-pointer"
          title="সকল মেনু ও কন্ট্রোল খুলুন"
        >
          <Menu className="w-5 h-5 mb-0.5 text-black dark:text-white" />
          <span className="text-[10px] leading-tight truncate font-bold">মেনু</span>
        </button>
      )}
    </nav>
  );
};
