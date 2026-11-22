import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  DollarSign,
  Layers,
  PieChart,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService } from '../../services/api';
import { formatBanglaCurrency, formatDate, toBnDigits } from '../../utils/bengaliNumbers';
import { totalKgToMonKg } from '../../utils/weightConverter';
import { useTheme } from '../../context/ThemeContext';
import { useSector } from '../../context/SectorContext';
import { Sale, Purchase, Expense, Commodity, DashboardStats } from '../../types';

type ReportTab = 'DAILY_INCOME' | 'MONTHLY_PNL' | 'YEARLY_PNL' | 'STOCK_SUMMARY' | 'TRANSACTIONS_LOG';

export const PnLView: React.FC = () => {
  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';
  const { activeSector, getSectorLabel, isJute } = useSector();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7); // 'YYYY-MM'
  const currentYearNum = now.getFullYear();

  // Active Tab
  const [activeTab, setActiveTab] = useState<ReportTab>('DAILY_INCOME');

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [showOnlyActiveDays, setShowOnlyActiveDays] = useState<boolean>(true);

  // Raw Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pnlReport, setPnlReport] = useState<any>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Month date range helper
  const { monthStart, monthEnd } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      monthStart: `${selectedMonth}-01`,
      monthEnd: `${selectedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [selectedMonth]);

  // Year date range helper
  const { yearStart, yearEnd } = useMemo(() => {
    return {
      yearStart: `${selectedYear}-01-01`,
      yearEnd: `${selectedYear}-12-31`,
    };
  }, [selectedYear]);

  // Load all report data
  const loadAllReports = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsRefreshing(true);
      setLoading(true);

      const [statsData, pnlData, salesData, purData, expData, commData] = await Promise.all([
        dbService.reports.getDashboardStats(activeSector),
        dbService.reports.getPnL(monthStart, monthEnd, activeSector),
        dbService.sales.getAll(1000, activeSector),
        dbService.purchases.getAll(1000, activeSector),
        dbService.expenses.getAll(1000, activeSector),
        dbService.commodities.getAll(activeSector),
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
  }, [activeSector, monthStart, monthEnd]);

  useEffect(() => {
    loadAllReports();
  }, [loadAllReports]);

  // Sector filtering
  const filteredSales = useMemo(() => {
    if (activeSector === 'all') return sales;
    return sales.filter((s) => s.sector === activeSector);
  }, [sales, activeSector]);

  const filteredPurchases = useMemo(() => {
    if (activeSector === 'all') return purchases;
    return purchases.filter((p) => p.sector === activeSector);
  }, [purchases, activeSector]);

  const filteredExpenses = useMemo(() => {
    if (activeSector === 'all') return expenses;
    return expenses.filter((e) => e.sector === activeSector || e.sector === 'general' || !e.sector);
  }, [expenses, activeSector]);

  const filteredCommodities = useMemo(() => {
    if (activeSector === 'all') return commodities;
    return commodities.filter((c) => c.sector === activeSector);
  }, [commodities, activeSector]);

  // Commodity mapping by ID
  const commodityMap = useMemo(() => {
    const map = new Map<number, Commodity>();
    for (const c of commodities) {
      map.set(c.id, c);
    }
    return map;
  }, [commodities]);

  // Helper date formatter in Bengali
  const daysBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const monthsBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const currentDateText = useMemo(() => {
    const t = new Date();
    return `${daysBn[t.getDay()]}, ${isBn ? toBnDigits(t.getDate()) : t.getDate()} ${
      monthsBn[t.getMonth()]
    } ${isBn ? toBnDigits(t.getFullYear()) : t.getFullYear()}`;
  }, [isBn]);

  // -------------------------------------------------------------
  // TAB 1: DAILY INCOME & NET PROFIT ENGINE (Date-by-Date Ledger)
  // -------------------------------------------------------------
  const dailyLedgerData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // Map by date string YYYY-MM-DD
    const dateMap = new Map<string, {
      date: string;
      dayOfWeek: string;
      purchasesAmt: number;
      salesAmt: number;
      cogsAmt: number;
      expensesAmt: number;
      netIncome: number;
      txCount: number;
    }>();

    // Initialize all dates in month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(y, m - 1, d);
      dateMap.set(dStr, {
        date: dStr,
        dayOfWeek: daysBn[dayDate.getDay()],
        purchasesAmt: 0,
        salesAmt: 0,
        cogsAmt: 0,
        expensesAmt: 0,
        netIncome: 0,
        txCount: 0,
      });
    }

    // Accumulate purchases
    for (const p of filteredPurchases) {
      const pDate = (p.purchase_date || '').substring(0, 10);
      if (dateMap.has(pDate)) {
        const entry = dateMap.get(pDate)!;
        const amt = Number(p.total_landed_cost || p.gross_amount || 0);
        entry.purchasesAmt += amt;
        entry.txCount += 1;
      }
    }

    // Accumulate sales & COGS
    for (const s of filteredSales) {
      const sDate = (s.sale_date || '').substring(0, 10);
      if (dateMap.has(sDate)) {
        const entry = dateMap.get(sDate)!;
        const saleAmt = Number(s.net_invoice_amount ?? (s as any).total_amount ?? 0);
        let cogsAmt = Number(s.cogs_amount || 0);
        if (!cogsAmt && s.net_weight_kg) {
          const comm = commodityMap.get(s.commodity_id);
          const wac = comm ? comm.current_wac_per_kg : 0;
          cogsAmt = Math.round(s.net_weight_kg * wac);
        }
        entry.salesAmt += saleAmt;
        entry.cogsAmt += cogsAmt;
        entry.txCount += 1;
      }
    }

    // Accumulate expenses
    for (const e of filteredExpenses) {
      const eDate = (e.expense_date || '').substring(0, 10);
      if (dateMap.has(eDate)) {
        const entry = dateMap.get(eDate)!;
        const amt = Number(e.amount || 0);
        entry.expensesAmt += amt;
        entry.txCount += 1;
      }
    }

    // Calculate daily net income: Net Revenue - COGS - Expenses
    const list = Array.from(dateMap.values()).map((row) => {
      const netIncome = Math.round(row.salesAmt - row.cogsAmt - row.expensesAmt);
      return {
        ...row,
        netIncome,
      };
    });

    // Sort descending by date (newest first)
    list.sort((a, b) => b.date.localeCompare(a.date));

    // Filter if user only wants active days
    const displayList = showOnlyActiveDays ? list.filter((r) => r.txCount > 0) : list;

    // Totals
    const totals = displayList.reduce(
      (acc, r) => {
        acc.purchasesAmt += r.purchasesAmt;
        acc.salesAmt += r.salesAmt;
        acc.cogsAmt += r.cogsAmt;
        acc.expensesAmt += r.expensesAmt;
        acc.netIncome += r.netIncome;
        return acc;
      },
      { purchasesAmt: 0, salesAmt: 0, cogsAmt: 0, expensesAmt: 0, netIncome: 0 }
    );

    return {
      rows: displayList,
      totals,
    };
  }, [selectedMonth, filteredPurchases, filteredSales, filteredExpenses, commodityMap, showOnlyActiveDays]);

  // -------------------------------------------------------------
  // TAB 2: MONTHLY NET PROFIT ENGINE
  // -------------------------------------------------------------
  const monthlyPnLData = useMemo(() => {
    // Purchases this month
    const monthPurchasesList = filteredPurchases.filter(
      (p) => (p.purchase_date || '').startsWith(selectedMonth)
    );
    const totalPurchases = monthPurchasesList.reduce(
      (sum, p) => sum + Number(p.total_landed_cost || p.gross_amount || 0),
      0
    );

    // Sales this month
    const monthSalesList = filteredSales.filter(
      (s) => (s.sale_date || '').startsWith(selectedMonth)
    );
    const totalSales = monthSalesList.reduce(
      (sum, s) => sum + Number(s.net_invoice_amount ?? (s as any).total_amount ?? 0),
      0
    );
    const totalCogs = monthSalesList.reduce((sum, s) => {
      let cogs = Number(s.cogs_amount || 0);
      if (!cogs && s.net_weight_kg) {
        const comm = commodityMap.get(s.commodity_id);
        const wac = comm ? comm.current_wac_per_kg : 0;
        cogs = Math.round(s.net_weight_kg * wac);
      }
      return sum + cogs;
    }, 0);

    const grossProfit = totalSales - totalCogs;

    // Expenses this month
    const monthExpensesList = filteredExpenses.filter(
      (e) => (e.expense_date || '').startsWith(selectedMonth)
    );
    const totalExpenses = monthExpensesList.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    );

    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0';

    // Itemized Expense Breakdown by Category
    const expCategoryMap = new Map<string, { category: string; count: number; amount: number }>();
    for (const e of monthExpensesList) {
      const cat = e.category || 'অন্যান্য পরিচালন খরচ';
      const existing = expCategoryMap.get(cat) || { category: cat, count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += Number(e.amount || 0);
      expCategoryMap.set(cat, existing);
    }
    const expBreakdown = Array.from(expCategoryMap.values()).sort((a, b) => b.amount - a.amount);

    // Commodity-wise Sales & Profit Breakdown
    const commBreakdownMap = new Map<number, {
      commodity_id: number;
      name_bn: string;
      sector: string;
      total_kg: number;
      total_mon: number;
      total_bags: number;
      total_revenue: number;
      total_cogs: number;
      profit: number;
    }>();

    for (const s of monthSalesList) {
      const commId = s.commodity_id;
      const comm = commodityMap.get(commId);
      const name = comm ? comm.name_bn : (s.commodity_name || 'সাধারণ শস্য');
      const itemSector: string = s.sector || comm?.sector || 'mustard';

      const existing = commBreakdownMap.get(commId) || {
        commodity_id: commId,
        name_bn: name,
        sector: itemSector,
        total_kg: 0,
        total_mon: 0,
        total_bags: 0,
        total_revenue: 0,
        total_cogs: 0,
        profit: 0,
      };

      const kg = Number(s.net_weight_kg || 0);
      const mon = Number(s.net_weight_mon || (kg / 40.0));
      const bags = Number(s.bags_count || 0);
      const rev = Number(s.net_invoice_amount ?? (s as any).total_amount ?? 0);

      let cogs = Number(s.cogs_amount || 0);
      if (!cogs && kg) {
        const wac = comm ? comm.current_wac_per_kg : 0;
        cogs = Math.round(kg * wac);
      }

      existing.total_kg += kg;
      existing.total_mon += mon;
      existing.total_bags += bags;
      existing.total_revenue += rev;
      existing.total_cogs += cogs;
      existing.profit += (rev - cogs);

      commBreakdownMap.set(commId, existing);
    }
    const commBreakdown = Array.from(commBreakdownMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);

    return {
      totalPurchases,
      totalSales,
      totalCogs,
      grossProfit,
      totalExpenses,
      netProfit,
      profitMargin,
      expBreakdown,
      commBreakdown,
      purchasesCount: monthPurchasesList.length,
      salesCount: monthSalesList.length,
      expensesCount: monthExpensesList.length,
    };
  }, [selectedMonth, filteredPurchases, filteredSales, filteredExpenses, commodityMap]);

  // -------------------------------------------------------------
  // TAB 3: YEARLY NET PROFIT ENGINE (12-Month Performance Table)
  // -------------------------------------------------------------
  const yearlyPnLData = useMemo(() => {
    const yearPrefix = String(selectedYear);

    // 12 months array
    const monthlyStats = monthsBn.map((mName, idx) => {
      const monthNumberStr = String(idx + 1).padStart(2, '0');
      const monthPrefix = `${yearPrefix}-${monthNumberStr}`;

      // Purchases in this month
      const pAmt = filteredPurchases
        .filter((p) => (p.purchase_date || '').startsWith(monthPrefix))
        .reduce((sum, p) => sum + Number(p.total_landed_cost || p.gross_amount || 0), 0);

      // Sales in this month
      const monthSales = filteredSales.filter((s) => (s.sale_date || '').startsWith(monthPrefix));
      const sAmt = monthSales.reduce(
        (sum, s) => sum + Number(s.net_invoice_amount ?? (s as any).total_amount ?? 0),
        0
      );
      const cogsAmt = monthSales.reduce((sum, s) => {
        let cogs = Number(s.cogs_amount || 0);
        if (!cogs && s.net_weight_kg) {
          const comm = commodityMap.get(s.commodity_id);
          const wac = comm ? comm.current_wac_per_kg : 0;
          cogs = Math.round(s.net_weight_kg * wac);
        }
        return sum + cogs;
      }, 0);

      const grossProfit = sAmt - cogsAmt;

      // Expenses in this month
      const expAmt = filteredExpenses
        .filter((e) => (e.expense_date || '').startsWith(monthPrefix))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const netIncome = grossProfit - expAmt;
      const hasActivity = pAmt > 0 || sAmt > 0 || expAmt > 0;

      return {
        monthIndex: idx + 1,
        monthName: mName,
        monthKey: monthPrefix,
        purchasesAmt: pAmt,
        salesAmt: sAmt,
        cogsAmt,
        grossProfit,
        expensesAmt: expAmt,
        netIncome,
        hasActivity,
      };
    });

    // Grand Annual Totals
    const grandTotals = monthlyStats.reduce(
      (acc, m) => {
        acc.purchasesAmt += m.purchasesAmt;
        acc.salesAmt += m.salesAmt;
        acc.cogsAmt += m.cogsAmt;
        acc.grossProfit += m.grossProfit;
        acc.expensesAmt += m.expensesAmt;
        acc.netIncome += m.netIncome;
        return acc;
      },
      { purchasesAmt: 0, salesAmt: 0, cogsAmt: 0, grossProfit: 0, expensesAmt: 0, netIncome: 0 }
    );

    const annualMargin = grandTotals.salesAmt > 0
      ? ((grandTotals.netIncome / grandTotals.salesAmt) * 100).toFixed(1)
      : '0';

    return {
      monthlyStats,
      grandTotals,
      annualMargin,
    };
  }, [selectedYear, filteredPurchases, filteredSales, filteredExpenses, commodityMap]);

  // -------------------------------------------------------------
  // PRINT & EXCEL (.xlsx) EXPORT ENGINE
  // -------------------------------------------------------------
  const printReport = () => {
    window.print();
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const sectorName = getSectorLabel(activeSector);

    if (activeTab === 'DAILY_INCOME') {
      const rows: any[][] = [
        ['মাহা এন্টারপ্রাইজ - দৈনিক ইনকাম ও নিট লাভ খতিয়ান'],
        [`সেক্টর: ${sectorName} | মাস: ${selectedMonth} | প্রিন্ট তারিখ: ${todayStr}`],
        [],
        ['তারিখ', 'বার', 'মোট ক্রয় (৳)', 'মোট বিক্রয় (৳)', 'COGS (বিক্রীত পণ্যের কেনা দাম ৳)', 'অন্যান্য খরচ (৳)', 'দৈনিক নিট ইনকাম (খরচ বাদে ৳)', 'মন্তব্য'],
      ];

      for (const r of dailyLedgerData.rows) {
        rows.push([
          r.date,
          r.dayOfWeek,
          r.purchasesAmt,
          r.salesAmt,
          r.cogsAmt,
          r.expensesAmt,
          r.netIncome,
          r.netIncome > 0 ? 'লাভ (+)' : r.netIncome < 0 ? 'লোকসান (-)' : 'সমতায়',
        ]);
      }

      rows.push([]);
      rows.push([
        'মোট যোগফল',
        '',
        dailyLedgerData.totals.purchasesAmt,
        dailyLedgerData.totals.salesAmt,
        dailyLedgerData.totals.cogsAmt,
        dailyLedgerData.totals.expensesAmt,
        dailyLedgerData.totals.netIncome,
        dailyLedgerData.totals.netIncome >= 0 ? 'সর্বমোট লাভ' : 'সর্বমোট লোকসান',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'দৈনিক_ইনকাম');
      XLSX.writeFile(wb, `maha_daily_income_${selectedMonth}_${todayStr}.xlsx`);
    } else if (activeTab === 'MONTHLY_PNL') {
      const summaryRows: any[][] = [
        ['মাহা এন্টারপ্রাইজ - মাসিক নিট লাভ-ক্ষতি বিবরণী'],
        [`সেক্টর: ${sectorName} | মাস: ${selectedMonth} | প্রস্তুত তারিখ: ${todayStr}`],
        [],
        ['বিবরণ / খাত', 'পরিমাণ (টাকা)'],
        ['১. মোট বিক্রয় রেভিনিউ', monthlyPnLData.totalSales],
        ['২. বিক্রীত পণ্যের কেনা দাম (COGS)', monthlyPnLData.totalCogs],
        ['৩. মোট গ্রস লাভ (Gross Profit)', monthlyPnLData.grossProfit],
        ['৪. মোট পরিচালন ও অন্যান্য খরচ', monthlyPnLData.totalExpenses],
        ['৫. মাসিক চূড়ান্ত নিট লাভ (খরচ বাদে)', monthlyPnLData.netProfit],
        ['নিট মুনাফা মার্জিন (%)', `${monthlyPnLData.profitMargin}%`],
        ['মোট ক্রয় ভলিউম', monthlyPnLData.totalPurchases],
        [],
        ['--- পরিচালন খরচ খাতওয়ারি বিভাজন ---'],
        ['ক্যাটাগরি', 'ভাউচার সংখ্যা', 'মোট টাকা', 'শতাংশ (%)'],
      ];

      for (const e of monthlyPnLData.expBreakdown) {
        const pct = monthlyPnLData.totalExpenses > 0
          ? ((e.amount / monthlyPnLData.totalExpenses) * 100).toFixed(1)
          : '0';
        summaryRows.push([e.category, e.count, e.amount, `${pct}%`]);
      }

      summaryRows.push([]);
      summaryRows.push(['--- শস্যভিত্তিক বিক্রয় ও লাভ বিভাজন ---']);
      summaryRows.push(['শস্যের নাম', 'ওজন (কেজি)', 'ওজন (মণ)', 'বস্তা', 'মোট বিক্রয় (৳)', 'COGS (৳)', 'অর্জিত লাভ (৳)']);

      for (const c of monthlyPnLData.commBreakdown) {
        summaryRows.push([
          c.name_bn,
          c.total_kg,
          c.total_mon.toFixed(2),
          isJute({ sector: c.sector, name_bn: c.name_bn }) ? '— (ওজনভিত্তিক)' : c.total_bags,
          c.total_revenue,
          c.total_cogs,
          c.profit,
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, ws, 'মাসিক_লাভ_ক্ষতি');
      XLSX.writeFile(wb, `maha_monthly_pnl_${selectedMonth}_${todayStr}.xlsx`);
    } else if (activeTab === 'YEARLY_PNL') {
      const rows: any[][] = [
        ['মাহা এন্টারপ্রাইজ - বাৎসরিক নিট লাভ-ক্ষতি পারফরম্যান্স রিপোর্ট'],
        [`সেক্টর: ${sectorName} | বছর: ${selectedYear} | প্রস্তুত তারিখ: ${todayStr}`],
        [],
        ['মাস', 'মোট ক্রয় (৳)', 'মোট বিক্রয় (৳)', 'COGS (৳)', 'গ্রস লাভ (৳)', 'পরিচালন খরচ (৳)', 'নিট লাভ-ক্ষতি (৳)', 'স্ট্যাটাস'],
      ];

      for (const m of yearlyPnLData.monthlyStats) {
        rows.push([
          m.monthName,
          m.purchasesAmt,
          m.salesAmt,
          m.cogsAmt,
          m.grossProfit,
          m.expensesAmt,
          m.netIncome,
          m.netIncome > 0 ? 'লাভজনক' : m.netIncome < 0 ? 'লোকসান' : 'লেনদেন নেই',
        ]);
      }

      rows.push([]);
      rows.push([
        'বাৎসরিক সর্বমোট',
        yearlyPnLData.grandTotals.purchasesAmt,
        yearlyPnLData.grandTotals.salesAmt,
        yearlyPnLData.grandTotals.cogsAmt,
        yearlyPnLData.grandTotals.grossProfit,
        yearlyPnLData.grandTotals.expensesAmt,
        yearlyPnLData.grandTotals.netIncome,
        yearlyPnLData.grandTotals.netIncome >= 0 ? 'চূড়ান্ত লাভ' : 'চূড়ান্ত লোকসান',
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'বাৎসরিক_পারফরম্যান্স');
      XLSX.writeFile(wb, `maha_yearly_pnl_${selectedYear}_${todayStr}.xlsx`);
    } else if (activeTab === 'STOCK_SUMMARY') {
      const rows: any[][] = [
        ['মাহা এন্টারপ্রাইজ - গুদাম শস্য মজুদ ও মূল্যায়ন সামারি'],
        [`সেক্টর: ${sectorName} | তারিখ: ${todayStr}`],
        [],
        ['ক্রম', 'শস্যের নাম', 'সেক্টর', 'মজুদ (মণ-কেজি)', 'বস্তা', 'গড় ক্রয় দর (WAC ৳/মণ)', 'সম্ভাব্য বিক্রয় দর (৳/মণ)', 'মজুদ মূল্য (৳)'],
      ];

      filteredCommodities.forEach((c, idx) => {
        const { mon, kg } = totalKgToMonKg(c.current_stock_kg);
        const rate = Math.round(c.current_wac_per_mon * 1.08) || c.current_wac_per_mon;
        const val = Math.round((c.current_stock_kg / 40.0) * rate);
        const bagsDisplay = isJute(c) ? '— (ওজনভিত্তিক)' : `${c.current_stock_bags} বস্তা`;

        rows.push([
          idx + 1,
          c.name_bn,
          getSectorLabel(c.sector as any),
          `${mon} মণ ${kg.toFixed(1)} কেজি`,
          bagsDisplay,
          c.current_wac_per_mon,
          rate,
          val,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'স্টক_সামারি');
      XLSX.writeFile(wb, `maha_stock_summary_${todayStr}.xlsx`);
    } else {
      // Transactions Log
      const rows: any[][] = [
        ['মাহা এন্টারপ্রাইজ - চালান ও লেনদেন রেজিস্টার'],
        [`সেক্টর: ${sectorName} | তারিখ: ${todayStr}`],
        [],
        ['চালান নং', 'তারিখ', 'ক্রেতা/পার্টি', 'শস্যের জাত', 'ওজন (মণ)', 'দর (৳/মণ)', 'মোট বিল (৳)', 'পরিশোধ (৳)', 'বাকি (৳)'],
      ];

      filteredSales.slice(0, 300).forEach((s) => {
        rows.push([
          s.invoice_no,
          s.sale_date,
          s.party_name || 'সাধারণ ক্রেতা',
          s.commodity_name || 'শস্য',
          s.net_weight_mon,
          s.rate_per_mon,
          s.net_invoice_amount ?? (s as any).total_amount ?? 0,
          s.paid_amount,
          s.due_amount,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'চালান_রেজিস্টার');
      XLSX.writeFile(wb, `maha_transactions_${todayStr}.xlsx`);
    }
  };

  return (
    <div className="p-1 md:p-3 space-y-4 max-w-[1600px] mx-auto w-full transition-colors">
      {/* 1. Module Header Bar with Action Buttons */}
      <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border-color)] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-emerald-600/20 text-amber-400 border border-amber-500/30 rounded-xl shadow-xs">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                রিপোর্ট ও নিট লাভ-ক্ষতি বিশ্লেষণ
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D4AF37]/15 text-[#FFEFA6] border border-[#D4AF37]/40 shadow-xs">
                {getSectorLabel(activeSector)}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              দৈনিক ইনকাম খতিয়ান, মাসিক নিট মুনাফা (খরচ বাদে) এবং বাৎসরিক আর্থিক পারফরম্যান্স
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
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
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--surface-secondary)] hover:bg-emerald-950/40 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition-all shadow-xs cursor-pointer"
            title="মাইক্রোসফট এক্সেল (.xlsx) ফাইল ডাউনলোড করুন"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>এক্সেল (.xlsx)</span>
          </button>

          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            title="রিপোর্ট প্রিন্ট বা PDF হিসেবে সংরক্ষণ করুন"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Tabs Navigation Bar */}
      <div className="bg-[var(--surface)] p-2 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center gap-2 print:hidden overflow-x-auto text-xs font-bold transition-colors">
        {[
          { key: 'DAILY_INCOME', label: '📅 দৈনিক ইনকাম ও নিট লাভ', desc: 'প্রতিদিনের আয়, ব্যয় ও মুনাফা খতিয়ান' },
          { key: 'MONTHLY_PNL', label: '🗓️ মাসিক নিট লাভ-ক্ষতি', desc: 'মাসিক KPI ও খরচ বাদে নিট মুনাফা' },
          { key: 'YEARLY_PNL', label: '📆 বাৎসরিক নিট লাভ-ক্ষতি', desc: '১২ মাসের পারফরম্যান্স খতিয়ান' },
          { key: 'STOCK_SUMMARY', label: '🌾 গুদাম স্টক সামারি', desc: 'শস্যের মজুদ ও বাজার মূল্যায়ন' },
          { key: 'TRANSACTIONS_LOG', label: '📋 চালান ও লেনদেন রেজিস্টার', desc: 'সর্বশেষ বিক্রয় চালান' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ReportTab)}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-gradient-to-r from-[#D4AF37] to-amber-500 text-slate-950 font-black shadow-md border border-[#FFEFA6]/50'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Report View Container */}
      <div className="bg-[var(--surface)] rounded-2xl p-4 md:p-6 border border-[var(--border-color)] shadow-sm space-y-6 transition-colors">
        {/* Printable Business Header Banner */}
        <div className="text-center border-b border-[var(--border-color)] pb-4 space-y-1">
          <div className="flex items-center justify-center gap-2.5 mb-1">
            <img
              src="/logo.png"
              alt="মাহা এন্টারপ্রাইজ লোগো"
              className="w-10 h-10 object-contain rounded-lg border border-slate-200 dark:border-amber-500/40 bg-white dark:bg-slate-950 p-0.5"
            />
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
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="inline-block px-3 py-1 bg-[var(--surface-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-bold text-amber-400">
              {currentDateText}
            </span>
            <span className="inline-block px-3 py-1 bg-[#D4AF37]/15 border border-[#D4AF37]/40 rounded-lg text-xs font-bold text-[#FFEFA6]">
              সেক্টর: {getSectorLabel(activeSector)}
            </span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: 📅 দৈনিক ইনকাম ও নিট লাভ (DAILY INCOME & NET PROFIT)   */}
        {/* ============================================================== */}
        {activeTab === 'DAILY_INCOME' && (
          <div className="space-y-5">
            {/* Filter Bar: Month Picker & Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-color)] print:hidden">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <CalendarDays className="w-4 h-4 text-amber-400" />
                  <span>মাস নির্বাচন:</span>
                </div>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg text-xs font-mono font-bold outline-none cursor-pointer focus:border-amber-400"
                />
                <button
                  onClick={() => setSelectedMonth(currentMonthStr)}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--surface)] text-amber-400 border border-[var(--border-color)] hover:bg-amber-500/10 transition-colors"
                >
                  চলতি মাস
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyActiveDays}
                    onChange={(e) => setShowOnlyActiveDays(e.target.checked)}
                    className="rounded border-[var(--border-color)] text-amber-500 focus:ring-0"
                  />
                  <span>শুধু লেনদেনকৃত দিনসমূহ দেখান</span>
                </label>
              </div>
            </div>

            {/* Monthly Highlight Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-xl text-center">
                <span className="text-[var(--text-secondary)] font-semibold block">মাসের মোট বিক্রয়</span>
                <span className="text-xl font-black text-sky-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(dailyLedgerData.totals.salesAmt.toLocaleString()) : dailyLedgerData.totals.salesAmt.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">গ্রাহক চালান রেভিনিউ</span>
              </div>

              <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-center">
                <span className="text-[var(--text-secondary)] font-semibold block">মাসের মোট ক্রয়</span>
                <span className="text-xl font-black text-purple-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(dailyLedgerData.totals.purchasesAmt.toLocaleString()) : dailyLedgerData.totals.purchasesAmt.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">স্টক-ইন মাল ক্রয়</span>
              </div>

              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-center">
                <span className="text-[var(--text-secondary)] font-semibold block">মাসের মোট খরচ</span>
                <span className="text-xl font-black text-rose-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(dailyLedgerData.totals.expensesAmt.toLocaleString()) : dailyLedgerData.totals.expensesAmt.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">দোকান ও কুলি খরচ</span>
              </div>

              <div
                className={`p-3.5 rounded-xl text-center border ${
                  dailyLedgerData.totals.netIncome >= 0
                    ? 'bg-emerald-500/15 border-emerald-500/40'
                    : 'bg-rose-500/15 border-rose-500/40'
                }`}
              >
                <span className="text-[var(--text-secondary)] font-semibold block">মাসের নিট ইনকাম</span>
                <span
                  className={`text-xl font-black font-sans mt-0.5 block ${
                    dailyLedgerData.totals.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {dailyLedgerData.totals.netIncome >= 0 ? '+ ' : '- '}
                  ৳ {isBn ? toBnDigits(Math.abs(dailyLedgerData.totals.netIncome).toLocaleString()) : Math.abs(dailyLedgerData.totals.netIncome).toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {dailyLedgerData.totals.netIncome >= 0 ? 'খরচ বাদে প্রকৃত লাভ' : 'খরচ বাদে নিট ক্ষতি'}
                </span>
              </div>
            </div>

            {/* Daily Date-by-Date Ledger Table */}
            <div className="overflow-x-auto pt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-extrabold text-[var(--text-primary)] text-sm flex items-center gap-2">
                  <span>তারিখ অনুযায়ী দৈনিক ইনকাম ও লাভ-ক্ষতি খতিয়ান ({selectedMonth})</span>
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  মোট হিসাবকৃত দিন: {isBn ? toBnDigits(dailyLedgerData.rows.length) : dailyLedgerData.rows.length} টি
                </span>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-y border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                    <th className="py-2.5 px-3">তারিখ ও বার</th>
                    <th className="py-2.5 px-3 text-right">মোট ক্রয় (৳)</th>
                    <th className="py-2.5 px-3 text-right">মোট বিক্রয় (৳)</th>
                    <th className="py-2.5 px-3 text-right">বিক্রীত পণ্যের কেনা দাম (COGS ৳)</th>
                    <th className="py-2.5 px-3 text-right">অন্যান্য খরচ (৳)</th>
                    <th className="py-2.5 px-3 text-right">দৈনিক নিট ইনকাম (খরচ বাদে)</th>
                    <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-sans">
                  {dailyLedgerData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--text-muted)] font-semibold">
                        নির্বাচিত মাসে কোনো লেনদেন রেকর্ড পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    dailyLedgerData.rows.map((row) => {
                      const isProfit = row.netIncome > 0;
                      const isLoss = row.netIncome < 0;

                      return (
                        <tr key={row.date} className="hover:bg-[var(--table-row-hover)] transition-colors">
                          <td className="py-2.5 px-3 font-medium">
                            <span className="font-bold text-[var(--text-primary)] font-mono block">
                              {row.date}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">{row.dayOfWeek}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] font-mono">
                            ৳ {isBn ? toBnDigits(row.purchasesAmt.toLocaleString()) : row.purchasesAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-sky-400 font-mono">
                            ৳ {isBn ? toBnDigits(row.salesAmt.toLocaleString()) : row.salesAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[var(--text-muted)] font-mono">
                            ৳ {isBn ? toBnDigits(row.cogsAmt.toLocaleString()) : row.cogsAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-400 font-mono">
                            ৳ {isBn ? toBnDigits(row.expensesAmt.toLocaleString()) : row.expensesAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black font-mono">
                            <span
                              className={`text-sm ${
                                isProfit
                                  ? 'text-emerald-400'
                                  : isLoss
                                  ? 'text-rose-400'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {isProfit ? '+ ' : isLoss ? '- ' : ''}
                              ৳ {isBn ? toBnDigits(Math.abs(row.netIncome).toLocaleString()) : Math.abs(row.netIncome).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isProfit ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                লাভ
                              </span>
                            ) : isLoss ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                লোকসান
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border-color)]">
                                সমতায়
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--surface-secondary)] font-bold border-t-2 border-[var(--border-color)] text-xs">
                    <td className="py-3 px-3 font-extrabold text-[var(--text-primary)]">সর্বমোট যোগফল:</td>
                    <td className="py-3 px-3 text-right font-mono text-[var(--text-primary)]">
                      ৳ {isBn ? toBnDigits(dailyLedgerData.totals.purchasesAmt.toLocaleString()) : dailyLedgerData.totals.purchasesAmt.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sky-400 font-extrabold">
                      ৳ {isBn ? toBnDigits(dailyLedgerData.totals.salesAmt.toLocaleString()) : dailyLedgerData.totals.salesAmt.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[var(--text-muted)]">
                      ৳ {isBn ? toBnDigits(dailyLedgerData.totals.cogsAmt.toLocaleString()) : dailyLedgerData.totals.cogsAmt.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-400">
                      ৳ {isBn ? toBnDigits(dailyLedgerData.totals.expensesAmt.toLocaleString()) : dailyLedgerData.totals.expensesAmt.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-black font-mono text-sm">
                      <span
                        className={
                          dailyLedgerData.totals.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {dailyLedgerData.totals.netIncome >= 0 ? '+ ' : '- '}
                        ৳ {isBn ? toBnDigits(Math.abs(dailyLedgerData.totals.netIncome).toLocaleString()) : Math.abs(dailyLedgerData.totals.netIncome).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                          dailyLedgerData.totals.netIncome >= 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {dailyLedgerData.totals.netIncome >= 0 ? 'নিট লাভ' : 'নিট লোকসান'}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: 🗓️ মাসিক নিট লাভ-ক্ষতি (MONTHLY NET PROFIT AFTER EXP)  */}
        {/* ============================================================== */}
        {activeTab === 'MONTHLY_PNL' && (
          <div className="space-y-6">
            {/* Month Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-color)] print:hidden">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-[var(--text-primary)]">মাসিক স্টেটমেন্টের মাস:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg text-xs font-mono font-bold outline-none cursor-pointer focus:border-amber-400"
                />
              </div>

              <div className="text-xs text-[var(--text-secondary)] font-medium">
                হিসাবকাল: <strong className="text-amber-400 font-mono">{monthStart}</strong> হতে <strong className="text-amber-400 font-mono">{monthEnd}</strong>
              </div>
            </div>

            {/* Top 5 KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="p-3.5 bg-[var(--surface-secondary)] border border-[var(--border-color)] rounded-xl">
                <span className="text-[var(--text-secondary)] font-semibold block">১. মোট ক্রয়</span>
                <span className="text-lg font-black text-purple-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(monthlyPnLData.totalPurchases.toLocaleString()) : monthlyPnLData.totalPurchases.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">চালান: {monthlyPnLData.purchasesCount} টি</span>
              </div>

              <div className="p-3.5 bg-[var(--surface-secondary)] border border-[var(--border-color)] rounded-xl">
                <span className="text-[var(--text-secondary)] font-semibold block">২. মোট বিক্রয় রেভিনিউ</span>
                <span className="text-lg font-black text-sky-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(monthlyPnLData.totalSales.toLocaleString()) : monthlyPnLData.totalSales.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">চালান: {monthlyPnLData.salesCount} টি</span>
              </div>

              <div className="p-3.5 bg-[var(--surface-secondary)] border border-[var(--border-color)] rounded-xl">
                <span className="text-[var(--text-secondary)] font-semibold block">৩. বিক্রীত পণ্যের কেনা দাম (COGS)</span>
                <span className="text-lg font-black text-amber-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(monthlyPnLData.totalCogs.toLocaleString()) : monthlyPnLData.totalCogs.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">WAC ভিত্তিতে কেনা খরচ</span>
              </div>

              <div className="p-3.5 bg-[var(--surface-secondary)] border border-[var(--border-color)] rounded-xl">
                <span className="text-[var(--text-secondary)] font-semibold block">৪. পরিচালন ও অন্যান্য খরচ</span>
                <span className="text-lg font-black text-rose-400 font-sans mt-0.5 block">
                  ৳ {isBn ? toBnDigits(monthlyPnLData.totalExpenses.toLocaleString()) : monthlyPnLData.totalExpenses.toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">ভাউচার: {monthlyPnLData.expensesCount} টি</span>
              </div>

              {/* Highlighted Grand KPI Card */}
              <div
                className={`p-3.5 rounded-xl border-2 shadow-md col-span-2 md:col-span-1 ${
                  monthlyPnLData.netProfit >= 0
                    ? 'bg-gradient-to-br from-emerald-500/20 via-[#0A3A2A] to-emerald-950/40 border-emerald-500/60'
                    : 'bg-gradient-to-br from-rose-500/20 via-slate-900 to-rose-950/40 border-rose-500/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-primary)] font-extrabold text-xs">
                    ৫. মাসিক নিট লাভ (খরচ বাদে)
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span
                  className={`text-xl font-black font-sans mt-1 block tracking-tight ${
                    monthlyPnLData.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {monthlyPnLData.netProfit >= 0 ? '+ ' : '- '}
                  ৳ {isBn ? toBnDigits(Math.abs(monthlyPnLData.netProfit).toLocaleString()) : Math.abs(monthlyPnLData.netProfit).toLocaleString()}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                  মার্জিন: {monthlyPnLData.profitMargin}% | গ্রস: ৳ {isBn ? toBnDigits(monthlyPnLData.grossProfit.toLocaleString()) : monthlyPnLData.grossProfit.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Hierarchical P&L Statement Box */}
            <div className="max-w-3xl mx-auto bg-[var(--surface-secondary)] p-6 rounded-2xl border border-[var(--border-color)] space-y-3.5 text-xs shadow-sm">
              <h3 className="font-extrabold text-[var(--text-primary)] text-base border-b border-[var(--border-color)] pb-2 flex items-center justify-between">
                <span>মাসিক চূড়ান্ত লাভ-ক্ষতি খতিয়ান বিবরণী</span>
                <span className="text-xs font-mono text-amber-400 font-bold">{selectedMonth}</span>
              </h3>

              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="font-bold text-[var(--text-primary)]">১. মোট বিক্রয় রেভিনিউ (+):</span>
                <span className="font-black text-sky-400 font-mono text-sm">
                  ৳ {isBn ? toBnDigits(monthlyPnLData.totalSales.toLocaleString()) : monthlyPnLData.totalSales.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--border-color)] text-rose-400">
                <span className="font-semibold">২. বিক্রীত পণ্যের কেনা দাম (COGS -):</span>
                <span className="font-bold font-mono">
                  - ৳ {isBn ? toBnDigits(monthlyPnLData.totalCogs.toLocaleString()) : monthlyPnLData.totalCogs.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-2.5 border-b border-[var(--border-color)] bg-emerald-500/10 px-3 rounded-xl border border-emerald-500/20">
                <span className="font-black text-emerald-400 text-xs">৩. মোট গ্রস লাভ (Gross Profit =):</span>
                <span className="font-black text-emerald-400 font-mono text-base">
                  ৳ {isBn ? toBnDigits(monthlyPnLData.grossProfit.toLocaleString()) : monthlyPnLData.grossProfit.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--border-color)] text-rose-400">
                <span className="font-semibold">৪. পরিচালন ও অন্যান্য খরচ (-):</span>
                <span className="font-bold font-mono">
                  - ৳ {isBn ? toBnDigits(monthlyPnLData.totalExpenses.toLocaleString()) : monthlyPnLData.totalExpenses.toLocaleString()}
                </span>
              </div>

              <div
                className={`flex justify-between py-3 px-4 rounded-xl border text-sm ${
                  monthlyPnLData.netProfit >= 0
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-gradient-to-r from-rose-500/20 to-orange-500/20 border-rose-500/40 text-rose-300'
                }`}
              >
                <span className="font-black">চূড়ান্ত নিট লাভ (খরচ বাদে Net Operating Profit):</span>
                <span className="font-black font-mono text-lg">
                  {monthlyPnLData.netProfit >= 0 ? '+ ' : '- '}
                  ৳ {isBn ? toBnDigits(Math.abs(monthlyPnLData.netProfit).toLocaleString()) : Math.abs(monthlyPnLData.netProfit).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 text-[11px] text-[var(--text-muted)] space-y-1">
                <p>* সমীকরণ: নিট লাভ = মোট বিক্রয় রেভিনিউ - বিক্রীত পণ্যের কেনা দাম (COGS) - পরিচালন ও অন্যান্য খরচ।</p>
                <p>* ৪১ কেজি স্কেলে কেনা মালের অতিরিক্ত ওজন ও মুনাফা স্বয়ংক্রিয়ভাবে COGS-এ সাশ্রয় ও নিট লাভে অন্তর্ভুক্ত।</p>
              </div>
            </div>

            {/* Itemized Expense Breakdown Table */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-[var(--text-primary)] text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>মাসের পরিচালন ও অন্যান্য খরচের খাতওয়ারি বিবরণ</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-y border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                      <th className="py-2.5 px-3 w-12 text-center">ক্রম</th>
                      <th className="py-2.5 px-3">খরচের খাত / ক্যাটাগরি</th>
                      <th className="py-2.5 px-3 text-center">ভাউচার সংখ্যা</th>
                      <th className="py-2.5 px-3 text-right">মোট ব্যয় (৳)</th>
                      <th className="py-2.5 px-3 text-right">ব্যয়ের অনুপাত (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-sans">
                    {monthlyPnLData.expBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[var(--text-muted)] font-semibold">
                          নির্বাচিত মাসে কোনো খরচের রেকর্ড নেই
                        </td>
                      </tr>
                    ) : (
                      monthlyPnLData.expBreakdown.map((e, idx) => {
                        const pct = monthlyPnLData.totalExpenses > 0
                          ? ((e.amount / monthlyPnLData.totalExpenses) * 100).toFixed(1)
                          : '0';
                        return (
                          <tr key={e.category} className="hover:bg-[var(--table-row-hover)] transition-colors">
                            <td className="py-2 px-3 text-center text-[var(--text-muted)] font-bold">
                              {isBn ? toBnDigits(idx + 1) : idx + 1}
                            </td>
                            <td className="py-2 px-3 font-bold text-[var(--text-primary)]">
                              {e.category}
                            </td>
                            <td className="py-2 px-3 text-center text-[var(--text-secondary)] font-mono">
                              {isBn ? toBnDigits(e.count) : e.count} টি
                            </td>
                            <td className="py-2 px-3 text-right font-black text-rose-400 font-mono">
                              ৳ {isBn ? toBnDigits(e.amount.toLocaleString()) : e.amount.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-[var(--text-secondary)] font-mono">
                              {isBn ? toBnDigits(pct) : pct}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[var(--surface-secondary)] font-bold border-t border-[var(--border-color)] text-xs">
                      <td colSpan={3} className="py-2.5 px-3 font-extrabold text-[var(--text-primary)]">
                        মোট পরিচালন ব্যয়:
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-400 font-mono">
                        ৳ {isBn ? toBnDigits(monthlyPnLData.totalExpenses.toLocaleString()) : monthlyPnLData.totalExpenses.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--text-primary)] font-mono">
                        ১০০%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Commodity-wise Breakdown Table */}
            <div className="space-y-3 pt-2">
              <h4 className="font-extrabold text-[var(--text-primary)] text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-400" />
                <span>শস্য ও জাতভিত্তিক বিক্রয় ও লাভ বিশ্লেষণ</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-y border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                      <th className="py-2.5 px-3 w-12 text-center">ক্রম</th>
                      <th className="py-2.5 px-3">শস্যের নাম ও জাত</th>
                      <th className="py-2.5 px-3 text-center">বিক্রীত ওজন (মণ-কেজি)</th>
                      <th className="py-2.5 px-3 text-center">বস্তা সংখ্যা</th>
                      <th className="py-2.5 px-3 text-right">বিক্রয় রেভিনিউ (৳)</th>
                      <th className="py-2.5 px-3 text-right">ক্রয় খরচ (COGS ৳)</th>
                      <th className="py-2.5 px-3 text-right">গ্রস লাভ (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-sans">
                    {monthlyPnLData.commBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[var(--text-muted)] font-semibold">
                          নির্বাচিত মাসে কোনো বিক্রয়ের রেকর্ড নেই
                        </td>
                      </tr>
                    ) : (
                      monthlyPnLData.commBreakdown.map((c, idx) => {
                        const { mon, kg } = totalKgToMonKg(c.total_kg);
                        const isCropJute = isJute({ sector: c.sector, name_bn: c.name_bn });
                        return (
                          <tr key={c.commodity_id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                            <td className="py-2 px-3 text-center text-[var(--text-muted)] font-bold">
                              {isBn ? toBnDigits(idx + 1) : idx + 1}
                            </td>
                            <td className="py-2 px-3 font-bold text-[var(--text-primary)]">
                              {c.name_bn}
                              <span className="text-[10px] text-[var(--text-muted)] block font-normal">
                                {getSectorLabel(c.sector as any)}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-[var(--text-primary)] font-mono">
                              {isBn ? toBnDigits(mon) : mon} মণ {isBn ? toBnDigits(kg.toFixed(1)) : kg.toFixed(1)} কেজি
                            </td>
                            <td className="py-2 px-3 text-center font-bold font-mono">
                              {isCropJute ? (
                                <span className="text-[var(--text-muted)] italic">— (ওজনভিত্তিক)</span>
                              ) : (
                                <span className="text-amber-400">{isBn ? toBnDigits(c.total_bags) : c.total_bags} বস্তা</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-sky-400 font-mono">
                              ৳ {isBn ? toBnDigits(c.total_revenue.toLocaleString()) : c.total_revenue.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--text-muted)] font-mono">
                              ৳ {isBn ? toBnDigits(c.total_cogs.toLocaleString()) : c.total_cogs.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-black text-emerald-400 font-mono">
                              ৳ {isBn ? toBnDigits(c.profit.toLocaleString()) : c.profit.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: 📆 বাৎসরিক নিট লাভ-ক্ষতি (YEARLY NET PROFIT AFTER EXP)   */}
        {/* ============================================================== */}
        {activeTab === 'YEARLY_PNL' && (
          <div className="space-y-6">
            {/* Year Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-color)] print:hidden">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-[var(--text-primary)]">বাৎসরিক আর্থিক বছর:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] px-3 py-1.5 rounded-lg text-xs font-mono font-bold outline-none cursor-pointer focus:border-amber-400"
                >
                  {[currentYearNum - 2, currentYearNum - 1, currentYearNum, currentYearNum + 1].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} সাল (অর্থবছর)
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-[var(--text-secondary)] font-medium">
                হিসাবকাল: <strong className="text-amber-400 font-mono">{yearStart}</strong> হতে <strong className="text-amber-400 font-mono">{yearEnd}</strong>
              </div>
            </div>

            {/* Grand Annual Summary Banner Card */}
            <div
              className={`p-5 rounded-2xl border-2 shadow-md ${
                yearlyPnLData.grandTotals.netIncome >= 0
                  ? 'bg-gradient-to-br from-emerald-500/20 via-[#0A3A2A] to-[#052317] border-emerald-500/60'
                  : 'bg-gradient-to-br from-rose-500/20 via-slate-900 to-[#2A0A0A] border-rose-500/60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {selectedYear} সালের বাৎসরিক চূড়ান্ত নিট লাভ (খরচ বাদে)
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    ১২ মাসের সকল ক্রয়, বিক্রয়, COGS এবং পরিচালন খরচ সমন্বয়ের পর অর্জিত নিট ফলাফল
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <span
                    className={`text-3xl font-black font-sans block tracking-tight ${
                      yearlyPnLData.grandTotals.netIncome >= 0 ? 'text-emerald-300' : 'text-rose-400'
                    }`}
                  >
                    {yearlyPnLData.grandTotals.netIncome >= 0 ? '+ ' : '- '}
                    ৳ {isBn ? toBnDigits(Math.abs(yearlyPnLData.grandTotals.netIncome).toLocaleString()) : Math.abs(yearlyPnLData.grandTotals.netIncome).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    বাৎসরিক নিট প্রফিট মার্জিন: {yearlyPnLData.annualMargin}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[var(--text-muted)] block">বাৎসরিক মোট বিক্রয়:</span>
                  <span className="font-extrabold text-sky-400 font-mono">
                    ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.salesAmt.toLocaleString()) : yearlyPnLData.grandTotals.salesAmt.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">বাৎসরিক মোট ক্রয়:</span>
                  <span className="font-extrabold text-purple-400 font-mono">
                    ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.purchasesAmt.toLocaleString()) : yearlyPnLData.grandTotals.purchasesAmt.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">বাৎসরিক COGS:</span>
                  <span className="font-extrabold text-amber-400 font-mono">
                    ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.cogsAmt.toLocaleString()) : yearlyPnLData.grandTotals.cogsAmt.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">বাৎসরিক পরিচালন খরচ:</span>
                  <span className="font-extrabold text-rose-400 font-mono">
                    ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.expensesAmt.toLocaleString()) : yearlyPnLData.grandTotals.expensesAmt.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 12-Month Performance Table */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-[var(--text-primary)] text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>১২ মাসের কর্মক্ষমতা ও লাভ-ক্ষতি তালিকা ({selectedYear})</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--table-header-bg)] border-y border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                      <th className="py-2.5 px-3">মাস (Month)</th>
                      <th className="py-2.5 px-3 text-right">মোট ক্রয় (৳)</th>
                      <th className="py-2.5 px-3 text-right">মোট বিক্রয় (৳)</th>
                      <th className="py-2.5 px-3 text-right">COGS (কেনা দাম ৳)</th>
                      <th className="py-2.5 px-3 text-right">গ্রস লাভ (৳)</th>
                      <th className="py-2.5 px-3 text-right">পরিচালন খরচ (৳)</th>
                      <th className="py-2.5 px-3 text-right">নিট লাভ-ক্ষতি (৳)</th>
                      <th className="py-2.5 px-3 text-center">পারফরম্যান্স</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-sans">
                    {yearlyPnLData.monthlyStats.map((m) => {
                      const isProfit = m.netIncome > 0;
                      const isLoss = m.netIncome < 0;

                      return (
                        <tr
                          key={m.monthKey}
                          className={`hover:bg-[var(--table-row-hover)] transition-colors ${
                            !m.hasActivity ? 'opacity-60' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
                            {m.monthName}
                            <span className="text-[10px] text-[var(--text-muted)] block font-mono">
                              {m.monthKey}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] font-mono">
                            ৳ {isBn ? toBnDigits(m.purchasesAmt.toLocaleString()) : m.purchasesAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-sky-400 font-mono">
                            ৳ {isBn ? toBnDigits(m.salesAmt.toLocaleString()) : m.salesAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[var(--text-muted)] font-mono">
                            ৳ {isBn ? toBnDigits(m.cogsAmt.toLocaleString()) : m.cogsAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-400 font-mono">
                            ৳ {isBn ? toBnDigits(m.grossProfit.toLocaleString()) : m.grossProfit.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-400 font-mono">
                            ৳ {isBn ? toBnDigits(m.expensesAmt.toLocaleString()) : m.expensesAmt.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black font-mono">
                            <span
                              className={`text-sm ${
                                isProfit
                                  ? 'text-emerald-400'
                                  : isLoss
                                  ? 'text-rose-400'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {isProfit ? '+ ' : isLoss ? '- ' : ''}
                              ৳ {isBn ? toBnDigits(Math.abs(m.netIncome).toLocaleString()) : Math.abs(m.netIncome).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isProfit ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                লাভজনক
                              </span>
                            ) : isLoss ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                লোকসান
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border-color)]">
                                লেনদেন নেই
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[var(--surface-secondary)] font-bold border-t-2 border-[var(--border-color)] text-xs">
                      <td className="py-3 px-3 font-extrabold text-[var(--text-primary)]">বাৎসরিক সর্বমোট:</td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--text-primary)]">
                        ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.purchasesAmt.toLocaleString()) : yearlyPnLData.grandTotals.purchasesAmt.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sky-400 font-extrabold">
                        ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.salesAmt.toLocaleString()) : yearlyPnLData.grandTotals.salesAmt.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[var(--text-muted)]">
                        ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.cogsAmt.toLocaleString()) : yearlyPnLData.grandTotals.cogsAmt.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-400 font-extrabold">
                        ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.grossProfit.toLocaleString()) : yearlyPnLData.grandTotals.grossProfit.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-400">
                        ৳ {isBn ? toBnDigits(yearlyPnLData.grandTotals.expensesAmt.toLocaleString()) : yearlyPnLData.grandTotals.expensesAmt.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-black font-mono text-sm">
                        <span
                          className={
                            yearlyPnLData.grandTotals.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {yearlyPnLData.grandTotals.netIncome >= 0 ? '+ ' : '- '}
                          ৳ {isBn ? toBnDigits(Math.abs(yearlyPnLData.grandTotals.netIncome).toLocaleString()) : Math.abs(yearlyPnLData.grandTotals.netIncome).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                            yearlyPnLData.grandTotals.netIncome >= 0
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {yearlyPnLData.grandTotals.netIncome >= 0 ? 'চূড়ান্ত লাভ' : 'চূড়ান্ত ক্ষতি'}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: 🌾 গুদাম স্টক সামারি (WAREHOUSE STOCK & VALUATION)       */}
        {/* ============================================================== */}
        {activeTab === 'STOCK_SUMMARY' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-[var(--text-primary)] text-sm">
                  গুদামে বর্তমান শস্যের মজুদ ও সম্ভাব্য বিক্রয় মূল্য (রিয়েল-টাইম স্টক)
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  ৪০ কেজি = ১ মণ স্কেলে স্টক স্থিতি ও বাজার বিক্রয় মূল্য
                </p>
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                মোট শস্যের জাত: {isBn ? toBnDigits(filteredCommodities.length) : filteredCommodities.length} টি
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--table-header-bg)] border-y border-[var(--border-color)] text-[var(--table-header-text)] font-bold">
                    <th className="py-2.5 px-3 text-center w-12">ক্রম</th>
                    <th className="py-2.5 px-3">শস্যের নাম ও জাত</th>
                    <th className="py-2.5 px-3 text-center">সেক্টর</th>
                    <th className="py-2.5 px-3 text-center">বর্তমান মজুদ (মণ - কেজি)</th>
                    <th className="py-2.5 px-3 text-center">বস্তা সংখ্যা</th>
                    <th className="py-2.5 px-3 text-right">গড় ক্রয় মূল্য (WAC ৳/মণ)</th>
                    <th className="py-2.5 px-3 text-right">বর্তমান বিক্রয় দর</th>
                    <th className="py-2.5 px-3 text-right">মজুদ সম্ভাব্য মূল্য (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] font-sans">
                  {filteredCommodities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[var(--text-muted)] font-semibold">
                        কোনো শস্যের রেকর্ড নেই
                      </td>
                    </tr>
                  ) : (
                    filteredCommodities.map((c, idx) => {
                      const { mon, kg } = totalKgToMonKg(c.current_stock_kg);
                      const sellingRate = Math.round(c.current_wac_per_mon * 1.08) || c.current_wac_per_mon;
                      const stockValue = Math.round((c.current_stock_kg / 40.0) * sellingRate);
                      const isCropJute = isJute(c);

                      return (
                        <tr key={c.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                          <td className="py-2.5 px-3 text-center font-bold text-[var(--text-muted)]">
                            {isBn ? toBnDigits(idx + 1) : idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[var(--text-primary)]">
                            {c.name_bn}
                            <span className="text-[10px] font-normal text-[var(--text-muted)] block">{c.name_en}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/15 text-[#FFEFA6] border border-[#D4AF37]/30">
                              {getSectorLabel(c.sector as any)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-[var(--text-primary)]">
                            {isBn ? toBnDigits(mon) : mon} মণ {isBn ? toBnDigits(kg.toFixed(1)) : kg.toFixed(1)} কেজি
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">
                            {isCropJute ? (
                              <span className="text-[var(--text-muted)] italic">— (ওজনভিত্তিক)</span>
                            ) : (
                              <span className="text-amber-400">{isBn ? toBnDigits(c.current_stock_bags) : c.current_stock_bags} বস্তা</span>
                            )}
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: 📋 চালান ও লেনদেন রেজিস্টার (TRANSACTIONS LOG)          */}
        {/* ============================================================== */}
        {activeTab === 'TRANSACTIONS_LOG' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">
                চালানভিত্তিক বিক্রয় ও পাওনা হিস্ট্রি (সর্বশেষ ৫০০ চালান)
              </h3>
              <span className="text-xs text-[var(--text-muted)]">
                মোট চালান: {isBn ? toBnDigits(filteredSales.length) : filteredSales.length} টি
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
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-[var(--text-muted)] font-semibold">
                        কোনো বিক্রয় রেকর্ড নেই
                      </td>
                    </tr>
                  ) : (
                    filteredSales.slice(0, 500).map((s) => {
                      const isCropJute = isJute({ sector: s.sector, commodity_name: s.commodity_name });
                      return (
                        <tr key={s.id} className="hover:bg-[var(--table-row-hover)] transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-amber-400">#{s.invoice_no}</td>
                          <td className="py-2 px-3 text-[var(--text-muted)] font-mono">{s.sale_date}</td>
                          <td className="py-2 px-3 font-sans font-bold text-[var(--text-primary)]">
                            {s.party_name || (s as any).buyer_name || 'সাধারণ ক্রেতা'}
                          </td>
                          <td className="py-2 px-3 text-[var(--text-muted)] font-mono">
                            {s.vehicle_no || (s as any).truck_no || '—'}
                          </td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">{s.commodity_name || 'শস্য'}</td>
                          <td className="py-2 px-3 text-center font-bold text-[var(--text-primary)] font-mono">
                            {isBn ? toBnDigits(s.net_weight_mon) : s.net_weight_mon}
                          </td>
                          <td className="py-2 px-3 text-center font-bold font-mono">
                            {isCropJute ? (
                              <span className="text-[var(--text-muted)] italic">— (ওজনভিত্তিক)</span>
                            ) : (
                              <span className="text-amber-400">{isBn ? toBnDigits(s.bags_count) : s.bags_count}</span>
                            )}
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
                      );
                    })
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
