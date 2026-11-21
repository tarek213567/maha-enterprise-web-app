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
    <nav className="md:hidden flex items-center justify-around bg-gradient-to-r from-[#0A251C]/95 via-[#04120D]/95 to-[#0A251C]/95 backdrop-blur-lg border-t border-[#D4AF37]/30 py-1.5 px-2 shrink-0 z-50 text-[11px] font-bold select-none pb-[calc(env(safe-area-inset-bottom,4px)+6px)] shadow-2xl">
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
                ? 'text-[#FFEFA6] bg-[#D4AF37]/20 border border-[#D4AF37]/50 shadow-sm'
                : 'text-[#A7C2B2] hover:text-[#FFEFA6]'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-[#D4AF37]' : 'text-[#A7C2B2]'}`} />
            <span className="text-[10px] leading-tight truncate">{item.name}</span>
          </button>
        );
      })}

      {/* Full Drawer Menu Trigger Button */}
      {onOpenMenu && (
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all text-[#D4AF37] hover:text-[#FFEFA6] active:scale-95 cursor-pointer"
          title="সকল মেনু ও কন্ট্রোল খুলুন"
        >
          <Menu className="w-5 h-5 mb-0.5 text-[#D4AF37]" />
          <span className="text-[10px] leading-tight truncate font-bold">মেনু</span>
        </button>
      )}
    </nav>
  );
};
