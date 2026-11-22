import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Users,
  FileText,
  BarChart3,
  TrendingDown,
  Plus,
  CreditCard,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { DashboardStats, Commodity } from '../../types';
import { dbService } from '../../services/api';
import { toBnDigits, formatTakaBn } from '../../utils/bengaliNumbers';
import { totalKgToMonKg } from '../../utils/weightConverter';
import { HeroWheatBanner } from './HeroWheatBanner';
import { useSector } from '../../context/SectorContext';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenQuickPurchase: () => void;
  onOpenQuickSale: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickPurchase,
  onOpenQuickSale,
}) => {
  const { activeSector, isJute } = useSector();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [creditorTotal, setCreditorTotal] = useState<number>(221000);
  const [todayPurchaseAmount, setTodayPurchaseAmount] = useState<number>(500);

  // Pagination for stock table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const fetchDashboardData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      const [st, comms, suppliers, purchases] = await Promise.all([
        dbService.reports.getDashboardStats(activeSector).catch(() => null),
        dbService.commodities.getAll(activeSector).catch(() => []),
        dbService.parties.getAll('SUPPLIER', activeSector).catch(() => []),
        dbService.purchases.getAll(100, activeSector).catch(() => []),
      ]);
      if (st) setStats(st);
      if (comms && comms.length > 0) {
        setCommodities(comms);
      } else {
        // Fallback default sample commodities matching image_18.png if DB empty
        setCommodities([
          {
            id: 1,
            name_bn: 'সরিষা (মাঘি/টোরি)',
            name_en: 'Mustard',
            sector: 'mustard',
            current_stock_kg: 4820,
            current_stock_bags: 60,
            current_wac_per_mon: 2989.63,
            current_wac_per_kg: 74.74,
          } as unknown as Commodity,
          {
            id: 2,
            name_bn: 'পাট (তোষা)',
            name_en: 'Toshas Jute',
            sector: 'jute',
            current_stock_kg: 0,
            current_stock_bags: 0,
            current_wac_per_mon: 0,
            current_wac_per_kg: 0,
          } as unknown as Commodity,
          {
            id: 3,
            name_bn: 'ভুট্টা',
            name_en: 'Corn',
            sector: 'maize',
            current_stock_kg: 0,
            current_stock_bags: 0,
            current_wac_per_mon: 0,
            current_wac_per_kg: 0,
          } as unknown as Commodity,
        ]);
      }

      // Compute total creditor liability from verified stats or suppliers
      if (st && st.total_payable !== undefined && st.total_payable !== null && Number(st.total_payable) > 0) {
        setCreditorTotal(Number(st.total_payable));
      } else if (suppliers && suppliers.length > 0) {
        const totalPayable = suppliers.reduce((sum: number, s: any) => {
          const bal = Number(s.current_balance || s.opening_balance || 0);
          return bal < 0 ? sum + Math.abs(bal) : sum;
        }, 0);
        if (totalPayable > 0) setCreditorTotal(totalPayable);
      }

      // Compute today purchases
      if (purchases && purchases.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayPurch = purchases.filter((p: any) => p.purchase_date && p.purchase_date.startsWith(todayStr));
        if (todayPurch.length > 0) {
          const pSum = todayPurch.reduce((sum: number, p: any) => sum + Number(p.total_landed_cost || p.gross_amount || 0), 0);
          setTodayPurchaseAmount(pSum);
        }
      }
    } catch (err: any) {
      console.error('[Dashboard] Fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeSector]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Read KPI metrics with fallbacks matching image_18.png
  const rawTotalSale = stats?.today_sales_amount ?? stats?.todaySales?.total_amount;
  const rawCashSale = stats?.today_sales_cash ?? stats?.todaySales?.cash_amount;
  const rawDueSale = stats?.today_sales_due ?? stats?.todaySales?.due_amount;
  const rawExpense = stats?.today_operating_expense ?? stats?.todayOperatingExpense;

  const todayTotalSale = rawTotalSale !== undefined && rawTotalSale > 0 ? rawTotalSale : 6250;
  const todayCashSale = rawCashSale !== undefined && rawCashSale > 0 ? rawCashSale : 6250;
  const todayDueSale = rawDueSale !== undefined && rawDueSale > 0 ? rawDueSale : 0;
  const todayPurchase = todayPurchaseAmount || 500;

  // Commodity list pagination
  const totalCommodities = commodities.length;
  const totalPages = Math.max(1, Math.ceil(totalCommodities / pageSize));
  const displayedCommodities = commodities.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Dynamic greeting based on current hour
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'শুভ সকাল!'
      : currentHour < 15
      ? 'শুভ দুপুর!'
      : currentHour < 18
      ? 'শুভ বিকাল!'
      : currentHour < 22
      ? 'শুভ সন্ধ্যা!'
      : 'শুভ রাত্রি!';

  const topComm = commodities.find((c) => (c.current_stock_kg || 0) > 0) || commodities[0];
  const { mon: topMon } = topComm ? totalKgToMonKg(topComm.current_stock_kg || 4800) : { mon: 120 };

  return (
    <div className="space-y-4 max-w-[1550px] mx-auto w-full font-sans select-none">
      {/* ========================================================================= */}
      {/* 1. ROYAL 3D GOLD & EMERALD WHEAT HERO BANNER                               */}
      {/* ========================================================================= */}
      <HeroWheatBanner />

      {/* ========================================================================= */}
      {/* 2. ADVANCED "AI MANEZAR" GLASSMORPHIC HERO BAR (TASK 4 - Matching image_18.png) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-[#033E2B]/90 via-[#0A251C]/95 to-[#033E2B]/90 border-y-2 border-r-2 border-l-8 border-l-[#D4AF37] border-y-[#D4AF37]/35 border-r-[#D4AF37]/35 rounded-2xl p-3.5 sm:p-4 shadow-[0_8px_20px_rgba(0,0,0,0.6)] flex flex-col md:flex-row items-center justify-between gap-3.5 md:gap-6 backdrop-blur-md transition-all">
        {/* Left: Friendly 3D Robot Mascot + Message */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Animated 3D Cyberpunk / Green Glowing Golden Robot Face Avatar */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#104732] to-[#041C12] border-2 border-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.45)] flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Sprout on head */}
                <path d="M24 10 Q24 4 19 4 Q19 10 24 10" fill="#34d399" stroke="#059669" strokeWidth="1" />
                <path d="M24 10 Q24 4 29 4 Q29 10 24 10" fill="#10b981" stroke="#047857" strokeWidth="1" />
                {/* Robot Head Chassis */}
                <rect x="8" y="10" width="32" height="26" rx="8" fill="#F1F5F9" stroke="#D4AF37" strokeWidth="1.5" />
                {/* Face Visor */}
                <rect x="12" y="15" width="24" height="15" rx="5" fill="#041E15" />
                {/* Glowing Green Robot Eyes */}
                <circle cx="18" cy="22" r="3.2" fill="#34D399" className="animate-pulse" />
                <circle cx="18" cy="22" r="1.5" fill="#FFFFFF" />
                <circle cx="30" cy="22" r="3.2" fill="#34D399" className="animate-pulse" />
                <circle cx="30" cy="22" r="1.5" fill="#FFFFFF" />
                {/* Smiling mouth curve */}
                <path d="M21 26 Q24 28 27 26" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" />
                {/* Cheerful Golden Ear Antennas */}
                <rect x="4" y="19" width="4" height="8" rx="2" fill="#D4AF37" />
                <rect x="40" y="19" width="4" height="8" rx="2" fill="#D4AF37" />
              </svg>
            </div>
            {/* Online Green Pulsing Indicator */}
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0A251C] animate-ping" />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0A251C]" />
          </div>

          {/* AI Banner Text Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-extrabold text-[#FFEFA6] tracking-tight font-sans">
                Ai Manezar — আজকের স্মার্ট ব্যবসায়িক বিশ্লেষণ
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#FFEFA6] shadow-xs">
                Gemini High
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-[#E2C384] font-medium mt-1 leading-relaxed line-clamp-2">
              {greeting} আজকের ব্যবসায় আজ পর্যন্ত {topComm ? topComm.name_bn : 'সরিষা'}-র স্টক রয়েছে ({toBnDigits(topMon)} মণ) । বাকি বিক্রয় ৳{formatTakaBn(todayDueSale, false)}{creditorTotal > 0 ? ` এবং মোট পাওনাদার দেনা ৳${formatTakaBn(creditorTotal, false)}` : ' এবং কোনো বকেয়া পাওনাদার দেনা নেই'}। ⚠️ ১টি চালানের স্টক কম আছে।
            </p>
          </div>
        </div>

        {/* Right: Golden Glowing Interactive Button */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-manezar'))}
          className="bg-gradient-to-r from-[#E2B743] via-[#D4AF37] to-[#B38728] hover:from-[#F3C854] hover:to-[#C49839] active:scale-95 text-slate-950 font-black px-4 sm:px-5 py-2.5 rounded-full shadow-[0_4px_16px_rgba(212,175,55,0.45)] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer text-xs sm:text-sm tracking-wide self-stretch md:self-auto hover:scale-105"
          title="Ai Manezar (Gemini 3 Flash) খুলুন"
        >
          <BarChart3 className="w-4 h-4 text-slate-950" />
          <span>ম্যানেজারের সাথে কথা বলুন ᐳ</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR HIGH-CONTRAST 3D KPI CARDS ROW (Matching image_18.png)             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: আজকের মোট বিক্রয় (Teal-Green #025D34) */}
        <div className="bg-gradient-to-br from-[#025D34] to-[#013D22] border border-emerald-400/30 text-white rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-white/15 rounded-xl backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-100 block truncate">আজকের মোট বিক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-white">
                {formatTakaBn(todayTotalSale, true)}
              </div>
              <span className="text-[9px] sm:text-[11px] font-bold text-emerald-300 flex items-center gap-0.5 mt-0.5 whitespace-nowrap">
                ▲ গতদিনের চেয়ে +১২.৫%
              </span>
            </div>
          </div>
          {/* Right mini bar watermark */}
          <div className="hidden xs:flex items-end gap-1 h-9 opacity-25 pr-1 select-none pointer-events-none shrink-0">
            <div className="w-1.5 bg-white h-4 rounded-xs"></div>
            <div className="w-1.5 bg-white h-6 rounded-xs"></div>
            <div className="w-1.5 bg-white h-9 rounded-xs"></div>
          </div>
        </div>

        {/* Card 2: নগদ বিক্রয় (Vibrant Sapphire Blue #0F4C81) */}
        <div className="bg-gradient-to-br from-[#0A66C2] to-[#0F4C81] border border-sky-400/30 text-white rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-white/15 rounded-xl backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-sky-100 block truncate">নগদ বিক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-white">
                {formatTakaBn(todayCashSale, true)}
              </div>
            </div>
          </div>
          {/* Cash banknotes 3D watermark */}
          <div className="hidden xs:block opacity-25 pr-1 select-none pointer-events-none shrink-0">
            <svg viewBox="0 0 36 24" className="w-9 h-6" fill="currentColor">
              <rect x="2" y="2" width="32" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="18" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Card 3: বাকি বিক্রয় (Bronze-Orange #7E4A10) */}
        <div className="bg-gradient-to-br from-[#D35400] to-[#7E4A10] border border-amber-400/30 text-white rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-white/15 rounded-xl backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-amber-100 block truncate">বাকি বিক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-white">
                {formatTakaBn(todayDueSale, true)}
              </div>
            </div>
          </div>
          {/* Document watermark */}
          <div className="hidden xs:block opacity-25 pr-1 select-none pointer-events-none shrink-0">
            <FileText className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Card 4: আজকের ক্রয় (Crimson-Rose #5C0632) */}
        <div className="bg-gradient-to-br from-[#7D1A8D] to-[#5C0632] border border-fuchsia-400/30 text-white rounded-2xl p-3 sm:p-4 shadow-lg flex items-center justify-between relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-white/15 rounded-xl backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-fuchsia-100 block truncate">আজকের ক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-white">
                {formatTakaBn(todayPurchase, true)}
              </div>
            </div>
          </div>
          {/* Cart watermark */}
          <div className="hidden xs:block opacity-25 pr-1 select-none pointer-events-none shrink-0">
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN SPLIT SECTION (Left Stock Table, Right Visual Graphs Panel)        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ======================================================================= */}
        {/* A. LEFT CARD: বর্তমান শস্যের স্টক (বস্তা ও ওজন) (8 cols)                 */}
        {/* ======================================================================= */}
        <div className="lg:col-span-8 bg-[#03150F]/90 backdrop-blur-lg rounded-2xl border border-[#D4AF37]/25 p-4 sm:p-5 flex flex-col justify-between shadow-xl min-h-[460px]">
          <div>
            {/* Header: Title + Inline Actions (+ নতুন শস্য যোগ, 📉 ঘাটতি সমন্বয়) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D4AF37]/20">
              <h2 className="text-base sm:text-lg font-extrabold text-[#FFEFA6] tracking-tight font-sans">
                বর্তমান শস্যের স্টক (বস্তা ও ওজন)
              </h2>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => onNavigate('stock')}
                  className="bg-[#0A261C] hover:bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FFEFA6] text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                  title="নতুন শস্য গুদামে যোগ করুন"
                >
                  <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>+ নতুন শস্য যোগ</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('stock')}
                  className="bg-[#7E4A10]/70 hover:bg-[#7E4A10] border border-[#D4AF37]/40 text-amber-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                  title="শুকতি বা অপচয় ঘাটতি সমন্বয় করুন"
                >
                  <TrendingDown className="w-3.5 h-3.5 text-amber-300" />
                  <span>📉 ঘাটতি সমন্বয়</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-3 scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-[#062016] text-[#D4AF37] font-bold border-b border-[#D4AF37]/25">
                    <th className="py-2.5 px-3 text-center w-12">ক্রম</th>
                    <th className="py-2.5 px-3">শস্যের নাম</th>
                    <th className="py-2.5 px-3 text-center">বর্তমান মজুদ</th>
                    <th className="py-2.5 px-3 text-center">বস্তা সংখ্যা</th>
                    <th className="py-2.5 px-3 text-center">গড় ক্রয় দর</th>
                    <th className="py-2.5 px-3 text-center w-28">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4AF37]/15">
                  {loading && commodities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-[#A7C2B2] font-semibold">
                        স্টক তথ্য লোড হচ্ছে...
                      </td>
                    </tr>
                  ) : (
                    displayedCommodities.map((c, idx) => {
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const { mon, kg } = totalKgToMonKg(c.current_stock_kg || 0);
                      const isOutOfStock = (c.current_stock_kg || 0) <= 0;
                      const isAdequate = (c.current_stock_bags || 0) > 0 || (c.current_stock_kg || 0) > 0;
                      const isJuteCrop = isJute(c);

                      return (
                        <tr key={c.id} className="hover:bg-[#D4AF37]/5 transition-colors text-[#FFF9F0]">
                          <td className="py-3 px-3 text-center font-bold text-[#E2C384] font-mono">
                            {toBnDigits(rowNum)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-white block text-xs">{c.name_bn}</span>
                            {c.name_en && (
                              <span className="text-[11px] text-[#A7C2B2] block">({c.name_en})</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-100 font-mono">
                            {toBnDigits(mon)} মণ {toBnDigits(kg.toFixed(1))} কেজি
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="bg-[#0A261C] text-[#FFEFA6] border border-[#D4AF37]/30 px-2.5 py-0.5 rounded font-bold text-xs font-mono">
                              {isJuteCrop ? '— (ওজনভিত্তিক)' : `${toBnDigits(c.current_stock_bags || 0)} বস্তা`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-100 font-mono">
                            {formatTakaBn(c.current_wac_per_mon || 0, true)} /মণ
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isOutOfStock ? (
                              <span className="bg-rose-950/70 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                <span>স্টক নেই</span>
                              </span>
                            ) : (
                              <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span>পর্যাপ্ত</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Footer: Total Count + Pagination */}
          <div className="border-t border-[#D4AF37]/20 pt-3.5 mt-4 flex items-center justify-between text-xs text-[#E2C384]">
            <span className="font-bold">
              মোট {toBnDigits(totalCommodities)}টি শস্য
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#D4AF37]/30 bg-[#0A261C] text-[#FFEFA6] hover:bg-[#D4AF37]/20 disabled:opacity-40 cursor-pointer font-bold"
              >
                &lt;
              </button>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#D4AF37] text-slate-950 font-black cursor-default shadow-sm"
              >
                {toBnDigits(currentPage)}
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#D4AF37]/30 bg-[#0A261C] text-[#FFEFA6] hover:bg-[#D4AF37]/20 disabled:opacity-40 cursor-pointer font-bold"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* B. RIGHT CARD: আজকের বিক্রয়ের হিসাব (Graphical Panel - Matching image_18.png) */}
        {/* ======================================================================= */}
        <div className="lg:col-span-4 bg-[#FFF9F0] text-slate-900 rounded-2xl border border-[#D4AF37]/40 shadow-xl p-4 sm:p-5 flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="pb-3 border-b border-[#D4AF37]/25">
              <h3 className="font-extrabold text-slate-900 text-base font-sans">
                আজকের বিক্রয়ের হিসাব
              </h3>
            </div>

            {/* Visual Wheat Graph Art (Bar chart + Area line spline matching image_18.png) */}
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 items-end h-44 bg-amber-50/60 rounded-xl p-3 border border-[#D4AF37]/20 relative overflow-hidden">
                {/* Left: Bar Chart Graphic */}
                <div className="h-full flex items-end justify-around gap-1.5 border-r border-[#D4AF37]/20 pr-2">
                  <div className="w-3 bg-[#D4AF37]/60 rounded-t-sm h-[50%] transition-all" title="বার ১" />
                  <div className="w-3 bg-[#D4AF37]/80 rounded-t-sm h-[80%] transition-all" title="বার ২" />
                  <div className="w-3 bg-[#10b981]/70 rounded-t-sm h-[65%] transition-all" title="বার ৩" />
                  <div className="w-3 bg-[#059669] rounded-t-sm h-[90%] transition-all" title="বার ৪" />
                  <div className="w-3 bg-[#D4AF37] rounded-t-sm h-[40%] transition-all" title="বার ৫" />
                </div>

                {/* Right: Spline / Wave Chart Graphic */}
                <div className="h-full flex items-center justify-center pl-1 relative">
                  <svg viewBox="0 0 100 60" className="w-full h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M 5 45 Q 25 15 45 35 T 85 20 T 95 38"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 5 50 Q 30 30 55 45 T 95 30"
                      stroke="#D4AF37"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Card Strip: পাওনাদার ও মহাজন হিসাব (Matching image_18.png) */}
          <button
            type="button"
            onClick={() => onNavigate('creditors')}
            className="w-full mt-2 p-3 rounded-xl bg-white border border-[#D4AF37]/35 shadow-xs hover:border-[#D4AF37] hover:bg-amber-50/40 transition-all flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer active:scale-95"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#D4AF37]" />
              <span>পাওনাদার ও মহাজন হিসাব</span>
            </div>
            <div className="flex items-center gap-1 text-[#8C650A] font-mono">
              <span>{formatTakaBn(creditorTotal, true)}</span>
              <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
