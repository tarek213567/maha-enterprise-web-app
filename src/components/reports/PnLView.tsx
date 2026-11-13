import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Printer,
  Download,
  Calendar,
  RotateCw,
  ShoppingCart,
  Users,
  FileText,
  Wallet,
  Boxes,
  TrendingUp,
  Percent,
  TrendingDown,
  CheckCircle,
  Truck,
  Filter,
} from 'lucide-react';
import { dbService } from '../../services/api';
import { formatBanglaCurrency, formatDate, toBnDigits } from '../../utils/bengaliNumbers';
import { totalKgToMonKg } from '../../utils/weightConverter';
import { useTheme } from '../../context/ThemeContext';
import { Sale, Purchase, Expense, Commodity, DashboardStats } from '../../types';

type ReportTab = 'SUMMARY' | 'PROFIT' | 'SALES' | 'PURCHASES' | 'EXPENSES';

export const PnLView: React.FC = () => {
  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';

  const todayStr = new Date().toISOString().split('T')[0];
  const monthStart = todayStr.substring(0, 7) + '-01';

  // Tabs
  const [activeTab, setActiveTab] = useState<ReportTab>('SUMMARY');

  // Date range for P&L tab
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(todayStr);

  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pnlReport, setPnlReport] = useState<any>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load all report data
  const loadAllReports = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      setLoading(true);

      const [statsData, pnlData, salesData, purData, expData, commData] = await Promise.all([
        dbService.reports.getDashboardStats(),
        dbService.reports.getPnL(startDate, endDate),
        dbService.sales.getAll(500),
        dbService.purchases.getAll(500),
        dbService.expenses.getAll(500),
        dbService.commodities.getAll(),
      ]);

      setStats(statsData);
      setPnlReport(pnlData);
      setSales(salesData);
      setPurchases(purData);
      setExpenses(expData);
      setCommodities(commData);
    } catch (e) {
      console.error('[Reports] Error loading data:', e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadAllReports();
  }, [loadAllReports]);

  // Date presets for P&L
  const setRange = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (preset === 'TODAY') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'WEEK') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(today);
    } else if (preset === 'MONTH') {
      setStartDate(today.substring(0, 7) + '-01');
      setEndDate(today);
    } else if (preset === 'YEAR') {
      setStartDate(today.substring(0, 4) + '-01-01');
      setEndDate(today);
    }
  };

  const printReport = () => {
    dbService.system.print();
  };

  // Export to Excel CSV with UTF-8 BOM
  const exportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filenamePrefix = 'maha_enterprise_report';

    if (activeTab === 'SUMMARY') {
      filenamePrefix = 'maha_daily_summary';
      headers = ['ক্রম', 'শস্যের নাম', 'বর্তমান মজুদ (কেজি)', 'বর্তমান বস্তা', 'গড় ক্রয় মূল্য (WAC)', 'সম্ভাব্য বিক্রয় দর', 'মজুদ বিক্রয় মূল্য (৳)'];
      rows = commodities.map((c, i) => [
        i + 1,
        `"${c.name_bn}"`,
        c.current_stock_kg,
        c.current_stock_bags,
        c.current_wac_per_mon,
        Math.round(c.current_wac_per_mon * 1.08),
        Math.round((c.current_stock_kg / 40.0) * c.current_wac_per_mon * 1.08),
      ]);
    } else if (activeTab === 'PROFIT') {
      filenamePrefix = 'maha_profit_loss';
      headers = ['খাত / বিবরণ', 'পরিমাণ (টাকা)'];
      rows = [
        ['মোট বিক্রয় রেভিনিউ', pnlReport?.sales?.total_net_revenue || 0],
        ['বিক্রিত পণ্যের ক্রয় খরচ (COGS)', pnlReport?.sales?.total_cogs || 0],
        ['মোট লাভ (Gross Profit)', pnlReport?.sales?.gross_profit || 0],
        ['শুকতি / ঘাটতিজনিত ক্ষতি', pnlReport?.shrinkage?.shrinkage_cost || 0],
        ['পরিচালন ও ব্যবসায়িক খরচ', pnlReport?.totalOperatingExpenses || 0],
        ['প্রকৃত নিট মুনাফা (Net Profit)', pnlReport?.netProfit || 0],
      ];
    } else if (activeTab === 'SALES') {
      filenamePrefix = 'maha_sales_report';
      headers = ['চালান নং', 'তারিখ', 'ক্রেতার নাম', 'গাড়ি নং', 'শস্যের জাত', 'ওজন (মণ)', 'বস্তা', 'দর (৳/মণ)', 'মোট বিল (৳)', 'নগদ আদায় (৳)', 'বাকি (৳)'];
      rows = sales.map((s) => [
        s.invoice_no,
        s.sale_date,
        `"${s.party_name || (s as any).buyer_name || 'সাধারণ ক্রেতা'}"`,
        `"${s.vehicle_no || '—'}"`,
        `"${s.commodity_name || 'শস্য'}"`,
        s.net_weight_mon,
        s.bags_count,
        s.rate_per_mon,
        s.net_invoice_amount ?? (s as any).total_amount ?? 0,
        s.paid_amount,
        s.due_amount,
      ]);
    } else if (activeTab === 'PURCHASES') {
      filenamePrefix = 'maha_purchase_report';
      headers = ['মেমো নং', 'তারিখ', 'সরবরাহকারী / পার্টির নাম', 'শস্যের জাত', 'ওজন (মণ)', 'বস্তা', 'দর (৳/মণ)', 'লেবার/গাড়ি খরচ', 'মোট খরচ (৳)', 'পরিশোধ (৳)', 'বাকি (৳)'];
      rows = purchases.map((p) => [
        p.invoice_no,
        p.purchase_date,
        `"${p.party_name || 'বেপারী/চাষী'}"`,
        `"${p.commodity_name || 'শস্য'}"`,
        p.net_weight_mon,
        p.bags_count,
        p.rate_per_mon,
        (p.labor_cost || 0) + (p.transport_cost || 0),
        p.total_landed_cost || p.gross_amount,
        p.paid_amount,
        p.due_amount,
      ]);
    } else if (activeTab === 'EXPENSES') {
      filenamePrefix = 'maha_expense_report';
      headers = ['ভাউচার নং', 'তারিখ', 'খরচের বিবরণ', 'ক্যাটাগরি', 'পরিশোধ মাধ্যম', 'প্রাপক', 'টাকা'];
      rows = expenses.map((e) => [
        (e as any).voucher_no || `EXP-${e.id}`,
        e.expense_date,
        `"${e.notes || (e as any).title || e.category}"`,
        `"${e.category}"`,
        e.payment_mode,
        `"${e.paid_to || '—'}"`,
        e.amount,
      ]);
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}_${todayStr}.csv`;
    link.click();
  };

  // Helper date formatter in Bengali
  const today = new Date();
  const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const months = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];
  const currentDateText = `${days[today.getDay()]}, ${isBn ? toBnDigits(today.getDate()) : today.getDate()} ${
    months[today.getMonth()]
  } ${isBn ? toBnDigits(today.getFullYear()) : today.getFullYear()}`;

  // Filter sales for today
  const todaySalesList = sales.filter((s) => s.sale_date === todayStr);
  const todayCashSalesCount = todaySalesList.filter((s) => s.due_amount <= 0);
  const todayDueSalesCount = todaySalesList.filter((s) => s.due_amount > 0);

  const todayCashBags = todayCashSalesCount.reduce((sum, s) => sum + (s.bags_count || 0), 0);
  const todayDueBags = todayDueSalesCount.reduce((sum, s) => sum + (s.bags_count || 0), 0);

  const todayTotalSaleAmt = stats?.today_sales_amount || todaySalesList.reduce((sum, s) => sum + (s.net_invoice_amount ?? (s as any).total_amount ?? 0), 0);
  const todayCashSaleAmt = todaySalesList.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
  const todayDueSaleAmt = todaySalesList.reduce((sum, s) => sum + (s.due_amount || 0), 0);
  const todayExpenseAmt = stats?.today_cash_out || 0;

  return (
    <div className="p-1 md:p-2 space-y-4 max-w-[1550px] mx-auto w-full">
      {/* 1. Module Header Bar with Action Buttons (Export CSV & Print) */}
      <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border-color)] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
              রিপোর্ট ও লাভ-লোকসান বিশ্লেষণ
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              দোকানের সর্বমোট আয়, ক্রয়, খরচ এবং নিট মুনাফা খতিয়ান
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAllReports(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border-color)] transition-colors cursor-pointer"
            title="তথ্য রিফ্রেশ করুন"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : 'text-[var(--text-muted)]'}`} />
            <span>রিফ্রেশ</span>
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border-color)] transition-colors shadow-2xs cursor-pointer"
            title="এক্সেল সামঞ্জস্যপূর্ণ CSV ফাইল ডাউনলোড করুন"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>এক্সেল CSV</span>
          </button>

          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            title="রিপোর্ট প্রিন্ট করুন"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {/* 2. Five Comprehensive Report Tabs Navigation */}
      <div className="bg-[var(--surface)] p-2 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center gap-2 print:hidden overflow-x-auto text-xs font-bold transition-colors">
        {[
          { key: 'SUMMARY', label: '১. দৈনিক সংক্ষিপ্ত হিসাব' },
          { key: 'PROFIT', label: '২. লাভ-লোকসান খতিয়ান' },
          { key: 'SALES', label: '৩. বিক্রয় রিপোর্ট' },
          { key: 'PURCHASES', label: '৪. মাল আসার রিপোর্ট' },
          { key: 'EXPENSES', label: '৫. খরচ রিপোর্ট' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as ReportTab)}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.key
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Main Report View Container */}
      <div className="bg-[var(--surface)] rounded-2xl p-5 md:p-6 border border-[var(--border-color)] shadow-sm space-y-6 transition-colors">
        {/* Printable Business Header Banner */}
        <div className="text-center border-b border-[var(--border-color)] pb-4 space-y-1">
          <div className="flex items-center justify-center gap-2.5 mb-1">
            <img src="/logo.png" alt="মাহা এন্টারপ্রাইজ লোগো" className="w-10 h-10 object-contain rounded-lg border border-slate-200 dark:border-amber-500/40 bg-white dark:bg-slate-950 p-0.5" />
            <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-wide">
              মাহা এন্টারপ্রাইজ
            </h2>
          </div>
          <p className="text-xs font-bold text-[var(--text-secondary)]">
            মোঃ আব্দুর রশিদ সরকার এন্ড সন্স &bull; পাইকারি শস্য বাণিজ্য ও আড়তদারি
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            চাচকৈড় বাজার, গুরুদাসপুর, নাটোর | ফোন: 01711054499, 01711703241
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-[var(--surface-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-amber-400">
            {currentDateText}
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: দৈনিক সংক্ষিপ্ত হিসাব (DAILY SUMMARY) */}
        {/* ============================================================== */}
        {activeTab === 'SUMMARY' && (
          <div className="space-y-5">
            {/* Top 4 Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                <span className="text-[var(--text-secondary)] font-semibold block">আজকের মোট বিক্রয়</span>
                <span className="text-xl font-black text-emerald-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(todayTotalSaleAmt.toLocaleString()) : todayTotalSaleAmt.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {isBn ? toBnDigits(todayCashBags + todayDueBags) : todayCashBags + todayDueBags} বস্তা বিক্রি
                </span>
              </div>

              <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-center">
                <span className="text-[var(--text-secondary)] font-semibold block">আজকের নগদ আদায়</span>
                <span className="text-xl font-black text-sky-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(todayCashSaleAmt.toLocaleString()) : todayCashSaleAmt.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">ক্যাশ আদায়</span>
              </div>

              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
                <span className="text-[var(--text-secondary)] font-semibold block">আজকের বাকি বিক্রয়</span>
                <span className="text-xl font-black text-amber-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(todayDueSaleAmt.toLocaleString()) : todayDueSaleAmt.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">গ্রাহক বাকি খাতা</span>
              </div>

              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center">
                <span className="text-[var(--text-secondary)] font-semibold block">আজকের মোট খরচ</span>
                <span className="text-xl font-black text-rose-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(todayExpenseAmt.toLocaleString()) : todayExpenseAmt.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">দোকান ও কুলি খরচ</span>
              </div>
            </div>

            {/* 2 Dedicated Sub-cards: নগদ বিক্রি ও বাকি বিক্রি (বস্তা) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-blue-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-between shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-xs"></span>
                    <span className="text-[var(--text-primary)] font-bold text-xs">আজকে মোট নগদ বিক্রি (বস্তা)</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    সম্পূর্ণ নগদ পরিশোধিত ও বকেয়াহীন চালানের মোট বস্তা
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400 font-sans block">
                    {isBn ? toBnDigits(todayCashBags) : todayCashBags} <span className="text-xs font-bold text-emerald-300">বস্তা</span>
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 border border-amber-500/30 rounded-xl flex items-center justify-between shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs"></span>
                    <span className="text-[var(--text-primary)] font-bold text-xs">আজকে মোট বাকি বিক্রি (বস্তা)</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] block">
                    চালানে অবশিষ্ট বকেয়া রয়ে গেছে এমন চালানের মোট বস্তা
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-amber-400 font-sans block">
                    {isBn ? toBnDigits(todayDueBags) : todayDueBags} <span className="text-xs font-bold text-amber-300">বস্তা</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Current Stock Inventory Summary Table */}
            <div className="overflow-x-auto pt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-extrabold text-[var(--text-primary)] text-sm">
                  গুদামে বর্তমান শস্যের মজুদ ও সম্ভাব্য বিক্রয় মূল্য (রিয়েল-টাইম স্টক)
                </h3>
                <span className="text-[11px] text-[var(--text-muted)]">
                  মোট শস্যের জাত: {isBn ? toBnDigits(commodities.length) : commodities.length} টি
                </span>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-y border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                    <th className="py-2.5 px-3 text-center w-12">ক্রম</th>
                    <th className="py-2.5 px-3">শস্যের নাম</th>
                    <th className="py-2.5 px-3 text-center">বর্তমান মজুদ (মণ - কেজি)</th>
                    <th className="py-2.5 px-3 text-center">বস্তা সংখ্যা</th>
                    <th className="py-2.5 px-3 text-right">গড় ক্রয় মূল্য (WAC ৳/মণ)</th>
                    <th className="py-2.5 px-3 text-right">বর্তমান বিক্রয় দর</th>
                    <th className="py-2.5 px-3 text-right">মজুদ সম্ভাব্য মূল্য (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-sans">
                  {commodities.map((c, idx) => {
                    const { mon, kg } = totalKgToMonKg(c.current_stock_kg);
                    const sellingRate = Math.round(c.current_wac_per_mon * 1.08) || c.current_wac_per_mon;
                    const stockValue = Math.round((c.current_stock_kg / 40.0) * sellingRate);

                    return (
                      <tr key={c.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-[var(--text-muted)]">
                          {isBn ? toBnDigits(idx + 1) : idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[var(--text-primary)] font-sans">
                          {c.name_bn}
                          <span className="text-[10px] font-normal text-[var(--text-muted)] block">{c.name_en}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-[var(--text-primary)]">
                          {isBn ? toBnDigits(mon) : mon} মণ {isBn ? toBnDigits(kg.toFixed(1)) : kg.toFixed(1)} কেজি
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-400">
                          {isBn ? toBnDigits(c.current_stock_bags) : c.current_stock_bags} বস্তা
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] font-mono">
                          ৳ {isBn ? toBnDigits(c.current_wac_per_mon.toFixed(0)) : c.current_wac_per_mon.toFixed(0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400 font-mono">
                          ৳ {isBn ? toBnDigits(sellingRate) : sellingRate}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[var(--text-primary)] font-mono">
                          ৳ {isBn ? toBnDigits(stockValue.toLocaleString()) : stockValue.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: লাভ-লোকসান খতিয়ান (P&L STATEMENT) */}
        {/* ============================================================== */}
        {activeTab === 'PROFIT' && (
          <div className="space-y-5">
            {/* Date Range Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-color)] print:hidden">
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-[var(--text-primary)]">ফিল্টার রেঞ্জ:</span>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => setRange('TODAY')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                  >
                    আজকে
                  </button>
                  <button
                    onClick={() => setRange('WEEK')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                  >
                    চলতি সপ্তাহ
                  </button>
                  <button
                    onClick={() => setRange('MONTH')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                  >
                    চলতি মাস
                  </button>
                  <button
                    onClick={() => setRange('YEAR')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                  >
                    চলতি বছর
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-2.5 py-1 rounded-lg text-xs outline-none"
                />
                <span className="text-[var(--text-muted)]">হতে</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-2.5 py-1 rounded-lg text-xs outline-none"
                />
              </div>
            </div>

            <div className="max-w-2xl mx-auto bg-[var(--surface-secondary)] p-6 rounded-2xl border border-[var(--border-color)] space-y-3.5 text-xs shadow-sm">
              <h3 className="font-extrabold text-[var(--text-primary)] text-base border-b border-[var(--border-color)] pb-2 flex items-center justify-between">
                <span>লাভ-লোকসান খতিয়ান বিবরণী (P&L Ledger)</span>
                <span className="text-xs font-mono text-amber-400 font-bold">
                  {startDate} থেকে {endDate}
                </span>
              </h3>

              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="font-bold text-[var(--text-primary)]">১. মোট বিক্রয় রেভিনিউ:</span>
                <span className="font-black text-[var(--text-primary)] font-mono text-sm">
                  ৳ {isBn ? toBnDigits((pnlReport?.sales?.total_net_revenue || 0).toLocaleString()) : (pnlReport?.sales?.total_net_revenue || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--border-color)] text-rose-400">
                <span className="font-semibold">২. বিক্রীত পণ্যের কেনা দাম (COGS - WAC ভিত্তিক):</span>
                <span className="font-bold font-mono">
                  -৳ {isBn ? toBnDigits((pnlReport?.sales?.total_cogs || 0).toLocaleString()) : (pnlReport?.sales?.total_cogs || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-2.5 border-b border-[var(--border-color)] bg-emerald-500/10 px-3 rounded-xl border border-emerald-500/20">
                <span className="font-black text-emerald-400 text-xs">৩. মোট লাভ (Gross Profit):</span>
                <span className="font-black text-emerald-400 font-mono text-base">
                  ৳ {isBn ? toBnDigits((pnlReport?.sales?.gross_profit || 0).toLocaleString()) : (pnlReport?.sales?.gross_profit || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--border-color)] text-amber-400">
                <span className="font-semibold">৪. শুকতি ও গুদাম ঘাটতি জনিত ক্ষতি:</span>
                <span className="font-bold font-mono">
                  -৳ {isBn ? toBnDigits((pnlReport?.shrinkage?.shrinkage_cost || 0).toLocaleString()) : (pnlReport?.shrinkage?.shrinkage_cost || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--border-color)] text-rose-400">
                <span className="font-semibold">৫. পরিচালন ও ব্যবসায়িক মোট খরচ:</span>
                <span className="font-bold font-mono">
                  -৳ {isBn ? toBnDigits((pnlReport?.totalOperatingExpenses || 0).toLocaleString()) : (pnlReport?.totalOperatingExpenses || 0).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-3 bg-amber-500/15 px-4 rounded-xl border border-amber-500/30 text-sm">
                <span className="font-black text-amber-300">প্রকৃত নিট মুনাফা (Net Operating Profit):</span>
                <span className="font-black text-amber-400 font-mono text-lg">
                  ৳ {isBn ? toBnDigits((pnlReport?.netProfit || 0).toLocaleString()) : (pnlReport?.netProfit || 0).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 text-[11px] text-[var(--text-muted)] space-y-1">
                <p>* সমীকরণ: নিট লাভ = মোট বিক্রয় রেভিনিউ - COGS - শুকতি ক্ষতি - পরিচালন খরচ।</p>
                <p>* বাজারে বর্তমানে ক্রেতা বাকি পাওনা: <strong className="text-amber-400">৳ {isBn ? toBnDigits((stats?.total_receivable || 0).toLocaleString()) : (stats?.total_receivable || 0).toLocaleString()}</strong></p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: বিক্রয় রিপোর্ট (SALES REPORT) */}
        {/* ============================================================== */}
        {activeTab === 'SALES' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">
                চালানভিত্তিক বিক্রয় ও পাওনা রিপোর্ট (সর্বশেষ ৫০০ চালান)
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                মোট বিক্রয় চালান: {isBn ? toBnDigits(sales.length) : sales.length} টি
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                    <th className="py-2.5 px-3">চালান নং</th>
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3">ক্রেতার নাম</th>
                    <th className="py-2.5 px-3">গাড়ি নং</th>
                    <th className="py-2.5 px-3">শস্যের জাত</th>
                    <th className="py-2.5 px-3 text-center">ওজন (মণ)</th>
                    <th className="py-2.5 px-3 text-center">বস্তা</th>
                    <th className="py-2.5 px-3 text-right">দর (৳/মণ)</th>
                    <th className="py-2.5 px-3 text-right">মোট বিল (৳)</th>
                    <th className="py-2.5 px-3 text-right">নগদ আদায়</th>
                    <th className="py-2.5 px-3 text-right">বাকি</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-sans">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-6 text-center text-[var(--text-muted)] font-semibold">
                        কোনো বিক্রয় রেকর্ড নেই
                      </td>
                    </tr>
                  ) : (
                    sales.map((s) => (
                      <tr key={s.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-amber-400">#{s.invoice_no}</td>
                        <td className="py-2 px-3 text-[var(--text-muted)] font-mono">{s.sale_date}</td>
                        <td className="py-2 px-3 font-sans font-bold text-[var(--text-primary)]">
                          {s.party_name || (s as any).buyer_name || 'সাধারণ ক্রেতা'}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-muted)] font-mono">{s.vehicle_no || '—'}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{s.commodity_name || 'শস্য'}</td>
                        <td className="py-2 px-3 text-center font-bold text-[var(--text-primary)] font-mono">
                          {isBn ? toBnDigits(s.net_weight_mon) : s.net_weight_mon}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-amber-400 font-mono">
                          {isBn ? toBnDigits(s.bags_count) : s.bags_count}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--text-secondary)] font-mono">
                          ৳ {isBn ? toBnDigits(s.rate_per_mon) : s.rate_per_mon}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-[var(--text-primary)] font-mono">
                          ৳ {isBn ? toBnDigits((s.net_invoice_amount ?? (s as any).total_amount ?? 0).toLocaleString()) : (s.net_invoice_amount ?? (s as any).total_amount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold font-mono">
                          ৳ {isBn ? toBnDigits(s.paid_amount.toLocaleString()) : s.paid_amount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-orange-400 font-bold font-mono">
                          ৳ {isBn ? toBnDigits(s.due_amount.toLocaleString()) : s.due_amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: মাল আসার রিপোর্ট (PURCHASE / STOCK-IN REPORT) */}
        {/* ============================================================== */}
        {activeTab === 'PURCHASES' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">
                বেপারী ও চাষী হতে মাল ক্রয় ও স্টক-ইন চালান ইতিহাস
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                মোট ক্রয় চালান: {isBn ? toBnDigits(purchases.length) : purchases.length} টি
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                    <th className="py-2.5 px-3">মেমো নং</th>
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3">পার্টির নাম</th>
                    <th className="py-2.5 px-3">শস্যের জাত</th>
                    <th className="py-2.5 px-3 text-center">ওজন (মণ)</th>
                    <th className="py-2.5 px-3 text-center">মোট বস্তা</th>
                    <th className="py-2.5 px-3 text-right">দর (৳/মণ)</th>
                    <th className="py-2.5 px-3 text-right">লেবার/ভাড়া</th>
                    <th className="py-2.5 px-3 text-right">মোট ক্রয় খরচ</th>
                    <th className="py-2.5 px-3 text-right">পরিশোধ</th>
                    <th className="py-2.5 px-3 text-right">বাকি</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-sans">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-6 text-center text-[var(--text-muted)] font-semibold">
                        কোনো ক্রয় চালান রেকর্ড নেই
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-amber-400">#{p.invoice_no}</td>
                        <td className="py-2 px-3 text-[var(--text-muted)] font-mono">{p.purchase_date}</td>
                        <td className="py-2 px-3 font-sans font-bold text-[var(--text-primary)]">
                          {p.party_name || 'বেপারী/চাষী'}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{p.commodity_name || 'শস্য'}</td>
                        <td className="py-2 px-3 text-center font-bold text-[var(--text-primary)] font-mono">
                          {isBn ? toBnDigits(p.net_weight_mon) : p.net_weight_mon}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-400 font-mono">
                          {isBn ? toBnDigits(p.bags_count) : p.bags_count}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--text-secondary)] font-mono">
                          ৳ {isBn ? toBnDigits(p.rate_per_mon) : p.rate_per_mon}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--text-muted)] font-mono">
                          ৳ {isBn ? toBnDigits(((p.labor_cost || 0) + (p.transport_cost || 0)).toLocaleString()) : ((p.labor_cost || 0) + (p.transport_cost || 0)).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-[var(--text-primary)] font-mono">
                          ৳ {isBn ? toBnDigits((p.total_landed_cost || p.gross_amount).toLocaleString()) : (p.total_landed_cost || p.gross_amount).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-bold font-mono">
                          ৳ {isBn ? toBnDigits(p.paid_amount.toLocaleString()) : p.paid_amount.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right text-orange-400 font-bold font-mono">
                          ৳ {isBn ? toBnDigits(p.due_amount.toLocaleString()) : p.due_amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: খরচ রিপোর্ট (EXPENSE REPORT) */}
        {/* ============================================================== */}
        {activeTab === 'EXPENSES' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">
                দোকান পরিচালনা ও দৈনন্দিন খরচের তালিকা
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                মোট খরচ ভাউচার: {isBn ? toBnDigits(expenses.length) : expenses.length} টি
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-b border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                    <th className="py-2.5 px-3">ভাউচার</th>
                    <th className="py-2.5 px-3">তারিখ</th>
                    <th className="py-2.5 px-3">বিবরণ</th>
                    <th className="py-2.5 px-3">ক্যাটাগরি</th>
                    <th className="py-2.5 px-3">পরিশোধ মাধ্যম</th>
                    <th className="py-2.5 px-3">প্রাপক</th>
                    <th className="py-2.5 px-3 text-right">টাকা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-sans">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[var(--text-muted)] font-semibold">
                        কোনো খরচের রেকর্ড নেই
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                        <td className="py-2 px-3 font-mono text-[var(--text-muted)]">{(e as any).voucher_no || `EXP-${e.id}`}</td>
                        <td className="py-2 px-3 text-[var(--text-muted)] font-mono">{e.expense_date}</td>
                        <td className="py-2 px-3 font-sans font-bold text-[var(--text-primary)]">{e.notes || (e as any).title || e.category}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)]">
                            {e.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">{e.payment_mode}</td>
                        <td className="py-2 px-3 text-[var(--text-secondary)]">{e.paid_to || '—'}</td>
                        <td className="py-2 px-3 text-right font-black text-rose-400 font-mono">
                          ৳ {isBn ? toBnDigits(e.amount.toLocaleString()) : e.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Formal 3-Signature Signoff Block (Print Only) */}
        <div className="hidden print:flex justify-between items-end pt-20 text-xs text-slate-700">
          <div className="text-center border-t-2 border-slate-800 pt-2 w-48 font-bold">
            হিসাব রক্ষকের স্বাক্ষর
          </div>
          <div className="text-center border-t-2 border-slate-800 pt-2 w-48 font-bold">
            গুদাম ইন-চার্জ
          </div>
          <div className="text-center border-t-2 border-slate-800 pt-2 w-48 font-bold">
            প্রোপ্রাইটর / মালিকের স্বাক্ষর
          </div>
        </div>
      </div>
    </div>
  );
};
