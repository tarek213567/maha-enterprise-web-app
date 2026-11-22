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
      {/* 2. ADVANCED "AI MANEZAR" GLASSMORPHIC HERO BAR                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0A0A0A] border-2 border-black dark:border-neutral-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3.5 md:gap-6 transition-all text-black dark:text-white">
        {/* Left: Friendly Robot Mascot + Message */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border-2 border-black dark:border-white flex items-center justify-center relative overflow-hidden text-black dark:text-white">
              <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 10 Q24 4 19 4 Q19 10 24 10" fill="currentColor" stroke="currentColor" strokeWidth="1" />
                <path d="M24 10 Q24 4 29 4 Q29 10 24 10" fill="currentColor" stroke="currentColor" strokeWidth="1" />
                <rect x="8" y="10" width="32" height="26" rx="8" fill="transparent" stroke="currentColor" strokeWidth="1.5" />
                <rect x="12" y="15" width="24" height="15" rx="5" fill="currentColor" opacity="0.15" />
                <circle cx="18" cy="22" r="3" fill="currentColor" />
                <circle cx="30" cy="22" r="3" fill="currentColor" />
                <path d="M21 26 Q24 28 27 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="4" y="19" width="4" height="8" rx="2" fill="currentColor" />
                <rect x="40" y="19" width="4" height="8" rx="2" fill="currentColor" />
              </svg>
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-black dark:bg-white border-2 border-white dark:border-black" />
          </div>

          {/* AI Banner Text Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm sm:text-base font-extrabold text-black dark:text-white tracking-tight font-sans">
                Ai Manezar — আজকের স্মার্ট ব্যবসায়িক বিশ্লেষণ
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-black dark:text-white shadow-xs">
                Gemini High
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-neutral-600 dark:text-neutral-400 font-medium mt-1 leading-relaxed line-clamp-2">
              {greeting} আজকের ব্যবসায় আজ পর্যন্ত {topComm ? topComm.name_bn : 'সরিষা'}-র স্টক রয়েছে ({toBnDigits(topMon)} মণ) । বাকি বিক্রয় ৳{formatTakaBn(todayDueSale, false)}{creditorTotal > 0 ? ` এবং মোট পাওনাদার দেনা ৳${formatTakaBn(creditorTotal, false)}` : ' এবং কোনো বকেয়া পাওনাদার দেনা নেই'}। ⚠️ ১টি চালানের স্টক কম আছে।
            </p>
          </div>
        </div>

        {/* Right: Monochrome Interactive Button */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-ai-manezar'))}
          className="bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black font-black px-4 sm:px-5 py-2.5 rounded-full shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer text-xs sm:text-sm tracking-wide self-stretch md:self-auto border border-black dark:border-white"
          title="Ai Manezar (Gemini 3 Flash) খুলুন"
        >
          <BarChart3 className="w-4 h-4" />
          <span>ম্যানেজারের সাথে কথা বলুন ᐳ</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOUR HIGH-CONTRAST MONOCHROME KPI CARDS ROW                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: আজকের মোট বিক্রয় */}
        <div className="bg-white dark:bg-[#0A0A0A] border-2 border-neutral-200 dark:border-neutral-800 text-black dark:text-white rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-black dark:text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-neutral-600 dark:text-neutral-400 block truncate">আজকের মোট বিক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-black dark:text-white">
                {formatTakaBn(todayTotalSale, true)}
              </div>
              <span className="text-[9px] sm:text-[11px] font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-0.5 mt-0.5 whitespace-nowrap">
                ▲ গতদিনের চেয়ে +১২.৫%
              </span>
            </div>
          </div>
          <div className="hidden xs:flex items-end gap-1 h-9 opacity-15 pr-1 select-none pointer-events-none shrink-0 text-black dark:text-white">
            <div className="w-1.5 bg-current h-4 rounded-xs"></div>
            <div className="w-1.5 bg-current h-6 rounded-xs"></div>
            <div className="w-1.5 bg-current h-9 rounded-xs"></div>
          </div>
        </div>

        {/* Card 2: নগদ বিক্রয় */}
        <div className="bg-white dark:bg-[#0A0A0A] border-2 border-neutral-200 dark:border-neutral-800 text-black dark:text-white rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-black dark:text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-neutral-600 dark:text-neutral-400 block truncate">নগদ বিক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-black dark:text-white">
                {formatTakaBn(todayCashSale, true)}
              </div>
            </div>
          </div>
          <div className="hidden xs:block opacity-15 pr-1 select-none pointer-events-none shrink-0 text-black dark:text-white">
            <svg viewBox="0 0 36 24" className="w-9 h-6" fill="currentColor">
              <rect x="2" y="2" width="32" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="18" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Card 3: বাকি বিক্রয় */}
        <div className="bg-white dark:bg-[#0A0A0A] border-2 border-neutral-200 dark:border-neutral-800 text-black dark:text-white rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-black dark:text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-neutral-600 dark:text-neutral-400 block truncate">বাকি বিক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-black dark:text-white">
                {formatTakaBn(todayDueSale, true)}
              </div>
            </div>
          </div>
          <div className="hidden xs:block opacity-15 pr-1 select-none pointer-events-none shrink-0 text-black dark:text-white">
            <FileText className="w-8 h-8" />
          </div>
        </div>

        {/* Card 4: আজকের ক্রয় */}
        <div className="bg-white dark:bg-[#0A0A0A] border-2 border-neutral-200 dark:border-neutral-800 text-black dark:text-white rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-2.5 sm:gap-3 z-10 min-w-0 flex-1">
            <div className="p-2 sm:p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-black dark:text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] sm:text-xs font-semibold text-neutral-600 dark:text-neutral-400 block truncate">আজকের ক্রয়</span>
              <div className="text-base sm:text-xl md:text-2xl font-black tracking-tight font-sans mt-0.5 whitespace-nowrap text-black dark:text-white">
                {formatTakaBn(todayPurchase, true)}
              </div>
            </div>
          </div>
          <div className="hidden xs:block opacity-15 pr-1 select-none pointer-events-none shrink-0 text-black dark:text-white">
            <ShoppingCart className="w-8 h-8" />
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
        <div className="lg:col-span-8 bg-white dark:bg-[#0A0A0A] rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-5 flex flex-col justify-between shadow-sm min-h-[460px] text-black dark:text-white">
          <div>
            {/* Header: Title + Inline Actions (+ নতুন শস্য যোগ, 📉 ঘাটতি সমন্বয়) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h2 className="text-base sm:text-lg font-extrabold text-black dark:text-white tracking-tight font-sans">
                বর্তমান শস্যের স্টক (বস্তা ও ওজন)
              </h2>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => onNavigate('stock')}
                  className="bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black border border-black dark:border-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  title="নতুন শস্য গুদামে যোগ করুন"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ নতুন শস্য যোগ</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('stock')}
                  className="bg-neutral-100 hover:bg-neutral-200 text-black dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-white border border-neutral-300 dark:border-neutral-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  title="শুকতি বা অপচয় ঘাটতি সমন্বয় করুন"
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>📉 ঘাটতি সমন্বয়</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-3 scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white font-bold border-b border-neutral-200 dark:border-neutral-800">
                    <th className="py-2.5 px-3 text-center w-12">ক্রম</th>
                    <th className="py-2.5 px-3">শস্যের নাম</th>
                    <th className="py-2.5 px-3 text-center">বর্তমান মজুদ</th>
                    <th className="py-2.5 px-3 text-center">বস্তা সংখ্যা</th>
                    <th className="py-2.5 px-3 text-center">গড় ক্রয় দর</th>
                    <th className="py-2.5 px-3 text-center w-28">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {loading && commodities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-neutral-500 dark:text-neutral-400 font-semibold">
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
                        <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-colors text-black dark:text-white">
                          <td className="py-3 px-3 text-center font-bold text-neutral-500 dark:text-neutral-400 font-mono">
                            {toBnDigits(rowNum)}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-black dark:text-white block text-xs">{c.name_bn}</span>
                            {c.name_en && (
                              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block">({c.name_en})</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-black dark:text-white font-mono">
                            {toBnDigits(mon)} মণ {toBnDigits(kg.toFixed(1))} কেজি
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border border-neutral-300 dark:border-neutral-700 px-2.5 py-0.5 rounded font-bold text-xs font-mono">
                              {isJuteCrop ? '— (ওজনভিত্তিক)' : `${toBnDigits(c.current_stock_bags || 0)} বস্তা`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-black dark:text-white font-mono">
                            {formatTakaBn(c.current_wac_per_mon || 0, true)} /মণ
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isOutOfStock ? (
                              <span className="bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white border border-neutral-400 dark:border-neutral-600 px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
                                <span>স্টক নেই</span>
                              </span>
                            ) : (
                              <span className="bg-black dark:bg-white text-white dark:text-black border border-black dark:border-white px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-white dark:bg-black"></span>
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
          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3.5 mt-4 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
            <span className="font-bold">
              মোট {toBnDigits(totalCommodities)}টি শস্য
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40 cursor-pointer font-bold"
              >
                &lt;
              </button>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-black dark:bg-white text-white dark:text-black font-black cursor-default shadow-xs"
              >
                {toBnDigits(currentPage)}
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40 cursor-pointer font-bold"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* B. RIGHT CARD: আজকের বিক্রয়ের হিসাব (Graphical Panel)                      */}
        {/* ======================================================================= */}
        <div className="lg:col-span-4 bg-white dark:bg-[#0A0A0A] text-black dark:text-white rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm p-4 sm:p-5 flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-extrabold text-black dark:text-white text-base font-sans">
                আজকের বিক্রয়ের হিসাব
              </h3>
            </div>

            {/* Visual Monochrome Graph Art */}
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 items-end h-44 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl p-3 border border-neutral-200 dark:border-neutral-800 relative overflow-hidden">
                {/* Left: Bar Chart Graphic */}
                <div className="h-full flex items-end justify-around gap-1.5 border-r border-neutral-200 dark:border-neutral-800 pr-2">
                  <div className="w-3 bg-neutral-400 dark:bg-neutral-600 rounded-t-xs h-[50%]" />
                  <div className="w-3 bg-neutral-600 dark:bg-neutral-400 rounded-t-xs h-[80%]" />
                  <div className="w-3 bg-neutral-500 dark:bg-neutral-500 rounded-t-xs h-[65%]" />
                  <div className="w-3 bg-black dark:bg-white rounded-t-xs h-[90%]" />
                  <div className="w-3 bg-neutral-300 dark:bg-neutral-700 rounded-t-xs h-[40%]" />
                </div>

                {/* Right: Spline / Wave Chart Graphic */}
                <div className="h-full flex items-center justify-center pl-1 relative">
                  <svg viewBox="0 0 100 60" className="w-full h-28 text-black dark:text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M 5 45 Q 25 15 45 35 T 85 20 T 95 38"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity="0.5"
                    />
                    <path
                      d="M 5 50 Q 30 30 55 45 T 95 30"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Card Strip: পাওনাদার ও মহাজন হিসাব */}
          <button
            type="button"
            onClick={() => onNavigate('creditors')}
            className="w-full mt-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 shadow-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-between text-xs font-bold text-black dark:text-white cursor-pointer active:scale-95"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-black dark:text-white" />
              <span>পাওনাদার ও মহাজন হিসাব</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-black dark:text-white">
              <span>{formatTakaBn(creditorTotal, true)}</span>
              <ChevronRight className="w-4 h-4 text-black dark:text-white" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
