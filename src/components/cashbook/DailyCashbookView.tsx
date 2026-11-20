import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  MinusCircle,
  Coins,
  CheckCircle2,
  AlertCircle,
  Printer,
  FileText,
  Edit2,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { CashbookEntry, CashbookCategory } from '../../types';
import { dbService } from '../../services/api';
import { formatBanglaCurrency, formatDate, toBnDigits, parseSmartNumber, toBengaliDigits } from '../../utils/bengaliNumbers';
import { useTheme } from '../../context/ThemeContext';

export const DailyCashbookView: React.FC = () => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [totalInflow, setTotalInflow] = useState<number>(0);
  const [totalOutflow, setTotalOutflow] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);

  // Drawer Reconciliation State
  const [countedCash, setCountedCash] = useState<string>('');

  // Manual Cash Entry Modal (Add New)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW');
  const [category, setCategory] = useState<CashbookCategory>('CAPITAL_IN');
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [desc, setDesc] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Top 4 KPI Edit Modal State
  const [kpiModal, setKpiModal] = useState<{
    type: 'OPENING' | 'INFLOW' | 'OUTFLOW' | 'CLOSING';
    value: string;
  } | null>(null);
  const [isSavingKpi, setIsSavingKpi] = useState(false);

  // Row Edit Modal State
  const [editingEntry, setEditingEntry] = useState<CashbookEntry | null>(null);
  const [editRowType, setEditRowType] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW');
  const [editRowPartyName, setEditRowPartyName] = useState<string>('');
  const [editRowDesc, setEditRowDesc] = useState<string>('');
  const [editRowAmount, setEditRowAmount] = useState<string>('');
  const [editRowPaymentMode, setEditRowPaymentMode] = useState<string>('CASH');
  const [editRowDate, setEditRowDate] = useState<string>('');
  const [editRowCategory, setEditRowCategory] = useState<CashbookCategory>('CAPITAL_IN');
  const [isSavingRow, setIsSavingRow] = useState(false);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    loadCashbook(selectedDate);
  }, [selectedDate]);

  const loadCashbook = async (date: string) => {
    try {
      const data = await dbService.cashbook.getDaily(date);
      setOpeningBalance(data.opening_balance || 0);
      setEntries(data.entries || []);
      setTotalInflow(data.total_inflow || 0);
      setTotalOutflow(data.total_outflow || 0);
      setClosingBalance(data.closing_balance || 0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAddEntry = (type: 'INFLOW' | 'OUTFLOW') => {
    setEntryType(type);
    setCategory(type === 'INFLOW' ? 'CAPITAL_IN' : 'DRAWING');
    setAmount('');
    setPaymentMode('CASH');
    setDesc(type === 'INFLOW' ? 'ক্যাশ ড্রয়ারে নগদ জমা' : 'ক্যাশ ড্রয়ার থেকে নগদ উত্তোলন');
    setIsModalOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseSmartNumber(amount);
    if (!amt || amt <= 0) {
      alert('সঠিক টাকার পরিমাণ লিখুন (টাকা শূন্য বা ঋণাত্মক হতে পারবে না)');
      return;
    }
    if (!desc.trim()) {
      alert('অনুগ্রহ করে বিবরণ বা নোট লিখুন');
      return;
    }

    try {
      setIsSubmitting(true);
      await dbService.cashbook.addEntry({
        entry_date: selectedDate,
        entry_type: entryType,
        category,
        amount: amt,
        payment_mode: paymentMode,
        description: desc.trim(),
      });

      setIsModalOpen(false);
      showToast('নতুন ক্যাশ এন্ট্রি সফলভাবে যুক্ত হয়েছে!');
      await loadCashbook(selectedDate);
    } catch (err: any) {
      alert(err.message || 'ক্যাশ এন্ট্রি সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  // KPI Edit Handlers
  const handleOpenKpiEdit = (type: 'OPENING' | 'INFLOW' | 'OUTFLOW' | 'CLOSING') => {
    let initialVal = 0;
    if (type === 'OPENING') initialVal = openingBalance;
    else if (type === 'INFLOW') initialVal = totalInflow;
    else if (type === 'OUTFLOW') initialVal = totalOutflow;
    else if (type === 'CLOSING') initialVal = closingBalance;

    setKpiModal({
      type,
      value: toBengaliDigits(String(initialVal)),
    });
  };

  const handleSaveKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kpiModal) return;

    const parsedVal = parseSmartNumber(kpiModal.value);
    if (isNaN(parsedVal)) {
      alert('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    try {
      setIsSavingKpi(true);

      if (kpiModal.type === 'OPENING') {
        await dbService.cashbook.updateDailySummary({
          date: selectedDate,
          opening_balance: parsedVal,
          notes: 'ইউজার কর্তৃক প্রারম্ভিক জের সংশোধন',
        });
        showToast('প্রারম্ভিক ক্যাশ জের সফলভাবে সংরক্ষিত হয়েছে!');
      } else if (kpiModal.type === 'INFLOW') {
        const delta = Math.round((parsedVal - totalInflow) * 100) / 100;
        if (delta !== 0) {
          const existingAdj = entries.find(
            (item) =>
              item.description.includes('নগদ জমা হিসাব সংশোধন') ||
              item.description.includes('নগদ জমা সমন্বয়')
          );
          if (existingAdj) {
            const updatedAmt = Math.round((existingAdj.amount + delta) * 100) / 100;
            if (updatedAmt === 0) {
              await dbService.cashbook.delete(existingAdj.id);
            } else {
              await dbService.cashbook.update(existingAdj.id, {
                amount: updatedAmt,
                description: 'নগদ জমা হিসাব সংশোধন / সমন্বয়',
              });
            }
          } else {
            await dbService.cashbook.addEntry({
              entry_date: selectedDate,
              entry_type: 'INFLOW',
              category: 'CAPITAL_IN',
              amount: delta,
              payment_mode: 'CASH',
              description: 'নগদ জমা হিসাব সংশোধন / সমন্বয়',
            });
          }
          showToast('মোট নগদ জমা সংশোধন ও সমন্বয় এন্ট্রি সম্পন্ন হয়েছে!');
        }
      } else if (kpiModal.type === 'OUTFLOW') {
        const delta = Math.round((parsedVal - totalOutflow) * 100) / 100;
        if (delta !== 0) {
          const existingAdj = entries.find(
            (item) =>
              item.description.includes('নগদ খরচ হিসাব সংশোধন') ||
              item.description.includes('নগদ খরচ সমন্বয়')
          );
          if (existingAdj) {
            const updatedAmt = Math.round((existingAdj.amount + delta) * 100) / 100;
            if (updatedAmt === 0) {
              await dbService.cashbook.delete(existingAdj.id);
            } else {
              await dbService.cashbook.update(existingAdj.id, {
                amount: updatedAmt,
                description: 'নগদ খরচ হিসাব সংশোধন / সমন্বয়',
              });
            }
          } else {
            await dbService.cashbook.addEntry({
              entry_date: selectedDate,
              entry_type: 'OUTFLOW',
              category: 'EXPENSE',
              amount: delta,
              payment_mode: 'CASH',
              description: 'নগদ খরচ হিসাব সংশোধন / সমন্বয়',
            });
          }
          showToast('মোট নগদ খরচ সংশোধন ও সমন্বয় এন্ট্রি সম্পন্ন হয়েছে!');
        }
      } else if (kpiModal.type === 'CLOSING') {
        const diff = Math.round((parsedVal - closingBalance) * 100) / 100;
        if (diff !== 0) {
          if (diff > 0) {
            await dbService.cashbook.addEntry({
              entry_date: selectedDate,
              entry_type: 'INFLOW',
              category: 'CAPITAL_IN',
              amount: diff,
              payment_mode: 'CASH',
              description: 'ক্যাশ জের সমন্বয় (Closing Adjustment)',
            });
          } else {
            await dbService.cashbook.addEntry({
              entry_date: selectedDate,
              entry_type: 'OUTFLOW',
              category: 'DRAWING',
              amount: Math.abs(diff),
              payment_mode: 'CASH',
              description: 'ক্যাশ জের সমন্বয় (Closing Adjustment)',
            });
          }
          showToast('সমাপনী ক্যাশ ব্যালেন্স সমন্বয় সম্পন্ন হয়েছে!');
        }
      }

      setKpiModal(null);
      await loadCashbook(selectedDate);
    } catch (err: any) {
      alert(err.message || 'সমন্বয় সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setIsSavingKpi(false);
    }
  };

  // Row Edit & Delete Handlers
  const handleOpenEditRow = (entry: CashbookEntry) => {
    setEditingEntry(entry);
    setEditRowType(entry.entry_type);
    setEditRowPartyName(entry.party_name || '');
    setEditRowDesc(entry.description || '');
    setEditRowAmount(toBengaliDigits(String(entry.amount)));
    setEditRowPaymentMode(entry.payment_mode || 'CASH');
    setEditRowDate(entry.entry_date || selectedDate);
    setEditRowCategory(entry.category || (entry.entry_type === 'INFLOW' ? 'CAPITAL_IN' : 'EXPENSE'));
  };

  const handleSaveEditRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const amt = parseSmartNumber(editRowAmount);
    if (!amt || amt <= 0) {
      alert('সঠিক টাকার পরিমাণ লিখুন');
      return;
    }
    if (!editRowDesc.trim()) {
      alert('অনুগ্রহ করে বিবরণ বা নোট লিখুন');
      return;
    }

    try {
      setIsSavingRow(true);
      await dbService.cashbook.update(editingEntry.id, {
        entry_date: editRowDate,
        entry_type: editRowType,
        category: editRowCategory,
        amount: amt,
        payment_mode: editRowPaymentMode,
        party_name: editRowPartyName.trim(),
        description: editRowDesc.trim(),
      });

      setEditingEntry(null);
      showToast('ক্যাশ লেনদেন এন্ট্রি সফলভাবে আপডেট করা হয়েছে!');
      await loadCashbook(selectedDate);
    } catch (err: any) {
      alert(err.message || 'আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setIsSavingRow(false);
    }
  };

  const handleDeleteRow = async (entry: CashbookEntry) => {
    const confirmed = window.confirm(
      'আপনি কি নিশ্চিতভাবে এই ক্যাশ এন্ট্রিটি মুছে ফেলতে চান? মুছে ফেলা ডাটা ৬০ দিন পর্যন্ত রিসাইকেল বিনে সংরক্ষিত থাকবে।'
    );
    if (!confirmed) return;

    try {
      await dbService.cashbook.delete(entry.id);
      showToast('ক্যাশ এন্ট্রি মুছে ফেলা হয়েছে এবং রিসাইকেল বিনে সংরক্ষিত আছে!');
      await loadCashbook(selectedDate);
    } catch (err: any) {
      alert(err.message || 'মুছে ফেলতে সমস্যা হয়েছে');
    }
  };

  const formatPaymentLabel = (mode?: string) => {
    if (!mode) return 'ক্যাশ';
    const m = mode.toUpperCase();
    if (m === 'CASH') return 'ক্যাশ';
    if (m === 'BANK') return 'ব্যাংক';
    if (m === 'BKASH') return 'বিকাশ';
    if (m === 'NAGAD') return 'নগদ';
    if (m === 'ROCKET') return 'রকেট';
    return mode;
  };

  const countedNum = parseSmartNumber(countedCash);
  const cashDiscrepancy = countedCash.trim() !== '' ? countedNum - closingBalance : null;

  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-400 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* Top Controls & Date Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">দৈনিক ক্যাশ বই (Cashbook)</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            দৈনিক নগদ জমা ও খরচ, প্রারম্ভিক ক্যাশ জের এবং সমাপনী ড্রয়ার ব্যালেন্স
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>তারিখ:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none"
            />
          </div>

          <button
            onClick={() => handleOpenAddEntry('INFLOW')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ ক্যাশ জমা (Inflow)</span>
          </button>

          <button
            onClick={() => handleOpenAddEntry('OUTFLOW')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <MinusCircle className="w-4 h-4" />
            <span>- ক্যাশ খরচ (Outflow)</span>
          </button>

          <button
            onClick={() => dbService.system.print()}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Metric Cards: Opening, Inflows, Outflows, Closing with Edit Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Opening Cash */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">প্রারম্ভিক ক্যাশ জের (Opening)</span>
            <button
              type="button"
              onClick={() => handleOpenKpiEdit('OPENING')}
              className="px-2 py-0.5 text-[11px] font-bold rounded-lg border border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1"
              title="প্রারম্ভিক ক্যাশ জের এডিট করুন"
            >
              <Edit2 className="w-3 h-3" />
              <span>এডিট</span>
            </button>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {formatBanglaCurrency(openingBalance)}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">গতদিনের শেষ অবশিষ্ট নগদ</span>
        </div>

        {/* 2. Total Inflows */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">মোট নগদ জমা (Inflows)</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <button
              type="button"
              onClick={() => handleOpenKpiEdit('INFLOW')}
              className="px-2 py-0.5 text-[11px] font-bold rounded-lg border border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1"
              title="মোট নগদ জমা এডিট ও সমন্বয় করুন"
            >
              <Edit2 className="w-3 h-3" />
              <span>এডিট</span>
            </button>
          </div>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-2">
            +{formatBanglaCurrency(totalInflow, isBn, true)}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium mt-1">বিক্রয় ও বকেয়া আদায়</span>
        </div>

        {/* 3. Total Outflows */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">মোট নগদ খরচ (Outflows)</span>
              <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <button
              type="button"
              onClick={() => handleOpenKpiEdit('OUTFLOW')}
              className="px-2 py-0.5 text-[11px] font-bold rounded-lg border border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-300 hover:bg-sky-500/20 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1"
              title="মোট নগদ খরচ এডিট ও সমন্বয় করুন"
            >
              <Edit2 className="w-3 h-3" />
              <span>এডিট</span>
            </button>
          </div>
          <p className="text-xl font-black text-rose-700 dark:text-rose-400 mt-2">
            -{formatBanglaCurrency(totalOutflow, isBn, true)}
          </p>
          <span className="text-[11px] text-rose-600 dark:text-rose-500 font-medium mt-1">ক্রয়, পাওনা ও ব্যয়</span>
        </div>

        {/* 4. Closing Cash */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-sm transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">সমাপনী ক্যাশ ব্যালেন্স (Closing)</span>
            <button
              type="button"
              onClick={() => handleOpenKpiEdit('CLOSING')}
              className="px-2 py-0.5 text-[11px] font-bold rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/25 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1"
              title="সমাপনী ক্যাশ ব্যালেন্স এডিট ও সমন্বয় করুন"
            >
              <Edit2 className="w-3 h-3" />
              <span>এডিট</span>
            </button>
          </div>
          <p className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-2">
            {formatBanglaCurrency(closingBalance)}
          </p>
          <span className="text-[11px] text-emerald-800 dark:text-emerald-400 mt-1">আজকের ক্যাশ ড্রয়ারে থাকার কথা</span>
        </div>
      </div>

      {/* Cash Drawer Physical Reconciliation Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">ড্রয়ারের ক্যাশ চেক (Physical Drawer Reconciliation)</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">ড্রয়ারে থাকা নগদ টাকা গুনে লিখুন এবং কোনো তারতম্য আছে কিনা যাচাই করুন</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">গণনাকৃত নগদ: ৳</span>
              <input
                type="text"
                inputMode="decimal"
                value={countedCash}
                onChange={(e) => setCountedCash(toBengaliDigits(e.target.value))}
                placeholder="যেমন: ১,২০,০০০"
                className="w-36 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
              />
            </div>

            {cashDiscrepancy !== null && (
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                  cashDiscrepancy === 0
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : cashDiscrepancy > 0
                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                }`}
              >
                {cashDiscrepancy === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>হিসাব হুবহু মিলেছে (OK)</span>
                  </>
                ) : cashDiscrepancy > 0 ? (
                  <>
                    <span>ক্যাশ উদ্বৃত্ত (Surplus): +{formatBanglaCurrency(cashDiscrepancy)}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>ক্যাশ ঘাটতি (Deficit): -{formatBanglaCurrency(Math.abs(cashDiscrepancy))}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cashbook Ledger Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              দৈনিক লেনদেন রেজিস্টার ({formatDate(selectedDate)})
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              মোট {isBn ? toBnDigits(entries.length) : entries.length} টি ভাউচার
            </span>
            <button
              type="button"
              onClick={() => handleOpenAddEntry('INFLOW')}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ নতুন ক্যাশ এন্ট্রি</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3 w-16">টাইম</th>
                <th className="py-2.5 px-3">ধরন</th>
                <th className="py-2.5 px-3">রেফারেন্স / বিল নং</th>
                <th className="py-2.5 px-3">পার্টি / প্রাপক</th>
                <th className="py-2.5 px-3">বিবরণ</th>
                <th className="py-2.5 px-3 text-right">জমা (Inflow ৳)</th>
                <th className="py-2.5 px-3 text-right">খরচ (Outflow ৳)</th>
                <th className="py-2.5 px-3 text-center">মাধ্যম</th>
                <th className="py-2.5 px-3 text-center w-28">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 dark:text-slate-500">
                    এই তারিখে কোনো ক্যাশ লেনদেন হয়নি
                  </td>
                </tr>
              ) : (
                entries.map((e) => {
                  const isInflow = e.entry_type === 'INFLOW';
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500 font-mono">
                        {e.created_at ? e.created_at.substring(11, 16) : '--:--'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isInflow
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {isInflow ? 'জমা' : 'খরচ'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {e.reference_no || `CB-${e.id}`}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {e.party_name || '---'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {e.description}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700 dark:text-emerald-400">
                        {isInflow ? formatBanglaCurrency(e.amount, false, false) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-700 dark:text-rose-400">
                        {!isInflow ? formatBanglaCurrency(e.amount, false, false) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {formatPaymentLabel(e.payment_mode)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRow(e)}
                            className="px-2 py-1 text-xs font-semibold rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="লেনদেন এডিট করুন"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>এডিট</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(e)}
                            className="px-2 py-1 text-xs font-semibold rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="মুছে ফেলুন (৬০ দিন রিসাইকেল বিনে থাকবে)"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>ডিলিট</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer */}
            {entries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800/80 font-black text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={5} className="py-2.5 px-3 text-right">আজকের মোট জমা ও খরচ:</td>
                  <td className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-400 font-black">
                    ৳ {formatBanglaCurrency(totalInflow, false, false)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-800 dark:text-rose-400 font-black">
                    ৳ {formatBanglaCurrency(totalOutflow, false, false)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Top 4 KPI Edit Modal */}
      {kpiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-300 dark:border-slate-700 overflow-hidden transition-colors">
            <div className="px-5 py-4 bg-gradient-to-r from-sky-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-200" />
                <h3 className="font-bold text-sm">
                  {kpiModal.type === 'OPENING' && 'প্রারম্ভিক ক্যাশ জের এডিট করুন'}
                  {kpiModal.type === 'INFLOW' && 'মোট নগদ জমা (Inflow) সমন্বয় ও এডিট'}
                  {kpiModal.type === 'OUTFLOW' && 'মোট নগদ খরচ (Outflow) সমন্বয় ও এডিট'}
                  {kpiModal.type === 'CLOSING' && 'সমাপনী ক্যাশ ব্যালেন্স (Closing) সমন্বয়'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setKpiModal(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveKpi} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span>তারিখ:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatDate(selectedDate)}</span>
                </div>
                {kpiModal.type === 'OPENING' && (
                  <div className="flex justify-between">
                    <span>বর্তমান প্রারম্ভিক জের:</span>
                    <span className="font-black text-slate-800 dark:text-slate-100">৳ {formatBanglaCurrency(openingBalance)}</span>
                  </div>
                )}
                {kpiModal.type === 'INFLOW' && (
                  <div className="flex justify-between">
                    <span>বর্তমান মোট জমা:</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">৳ {formatBanglaCurrency(totalInflow)}</span>
                  </div>
                )}
                {kpiModal.type === 'OUTFLOW' && (
                  <div className="flex justify-between">
                    <span>বর্তমান মোট খরচ:</span>
                    <span className="font-black text-rose-600 dark:text-rose-400">৳ {formatBanglaCurrency(totalOutflow)}</span>
                  </div>
                )}
                {kpiModal.type === 'CLOSING' && (
                  <div className="flex justify-between">
                    <span>বর্তমান সমাপনী ব্যালেন্স:</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300">৳ {formatBanglaCurrency(closingBalance)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {kpiModal.type === 'OPENING' && 'সংশোধিত প্রারম্ভিক জের (৳)'}
                  {kpiModal.type === 'INFLOW' && 'সংশোধিত মোট নগদ জমার পরিমাণ (৳)'}
                  {kpiModal.type === 'OUTFLOW' && 'সংশোধিত মোট নগদ খরচের পরিমাণ (৳)'}
                  {kpiModal.type === 'CLOSING' && 'সংশোধিত সমাপনী ব্যালেন্সের পরিমাণ (৳)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={kpiModal.value}
                  onChange={(e) =>
                    setKpiModal({ ...kpiModal, value: toBengaliDigits(e.target.value) })
                  }
                  placeholder="যেমন: ১,৫০,০০০"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-sky-400 dark:border-sky-600 rounded-xl text-lg font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                />
              </div>

              {/* Dynamic Delta Preview */}
              {(() => {
                const parsed = parseSmartNumber(kpiModal.value);
                if (isNaN(parsed)) return null;

                if (kpiModal.type === 'INFLOW') {
                  const delta = Math.round((parsed - totalInflow) * 100) / 100;
                  return (
                    <div className="p-2.5 rounded-lg text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      সমন্বয় এন্ট্রি: ৳ {formatBanglaCurrency(Math.abs(delta))} ({delta >= 0 ? 'জমা হিসেবে যোগ হবে +' : 'হিসাব থেকে বাদ যাবে -'})
                    </div>
                  );
                }
                if (kpiModal.type === 'OUTFLOW') {
                  const delta = Math.round((parsed - totalOutflow) * 100) / 100;
                  return (
                    <div className="p-2.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      সমন্বয় এন্ট্রি: ৳ {formatBanglaCurrency(Math.abs(delta))} ({delta >= 0 ? 'খরচ হিসেবে যোগ হবে +' : 'হিসাব থেকে বাদ যাবে -'})
                    </div>
                  );
                }
                if (kpiModal.type === 'CLOSING') {
                  const diff = Math.round((parsed - closingBalance) * 100) / 100;
                  return (
                    <div className="p-2.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      প্রয়োজনীয় স্বয়ংক্রিয় জের সমন্বয়: ৳ {formatBanglaCurrency(Math.abs(diff))} ({diff >= 0 ? 'নগদ জমা (+ Inflow)' : 'নগদ খরচ (- Outflow)'})
                    </div>
                  );
                }
                return null;
              })()}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setKpiModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingKpi}
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingKpi ? 'সংরক্ষণ হচ্ছে...' : '💾 সেভ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Row Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-300 dark:border-slate-700 overflow-hidden transition-colors">
            <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-sm">
                  লেনদেন এডিট করুন (Edit Cashbook Entry #{editingEntry.reference_no || `CB-${editingEntry.id}`})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRow} className="p-5 space-y-3.5">
              {/* Type Toggle: Inflow vs Outflow */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  লেনদেনের ধরন (Type)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditRowType('INFLOW');
                      setEditRowCategory('CAPITAL_IN');
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editRowType === 'INFLOW'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>জমা (Inflow +)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditRowType('OUTFLOW');
                      setEditRowCategory('EXPENSE');
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editRowType === 'OUTFLOW'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>খরচ (Outflow -)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    তারিখ (Date)
                  </label>
                  <input
                    type="date"
                    value={editRowDate}
                    onChange={(e) => setEditRowDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ক্যাটাগরি (Category)
                  </label>
                  <select
                    value={editRowCategory}
                    onChange={(e) => setEditRowCategory(e.target.value as CashbookCategory)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {editRowType === 'INFLOW' ? (
                      <>
                        <option value="CAPITAL_IN">মূলধন বিনিয়োগ (Capital In)</option>
                        <option value="SALE_CASH">নগদ বিক্রয় (Cash Sale)</option>
                        <option value="DUE_COLLECTION">বকেয়া আদায় (Due Collection)</option>
                        <option value="BANK_TRANSFER">ব্যাংক থেকে ড্রয়ারে উত্তোলন</option>
                        <option value="OTHER">অন্যান্য প্রাপ্তি</option>
                      </>
                    ) : (
                      <>
                        <option value="DRAWING">মালিকের ব্যক্তিগত উত্তোলন (Drawings)</option>
                        <option value="EXPENSE">দৈনিক সাধারণ খরচ (Expense)</option>
                        <option value="PURCHASE_CASH">নগদ শস্য ক্রয় (Cash Purchase)</option>
                        <option value="SUPPLIER_PAYMENT">সাপ্লায়ার পাওনা পরিশোধ</option>
                        <option value="BANK_TRANSFER">ক্যাশ থেকে ব্যাংকে জমা</option>
                        <option value="OTHER">অন্যান্য ব্যয়</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    টাকার পরিমাণ (৳)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editRowAmount}
                    onChange={(e) => setEditRowAmount(toBengaliDigits(e.target.value))}
                    placeholder="যেমন: ৫০,০০০"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-base font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    লেনদেনের মাধ্যম
                  </label>
                  <select
                    value={editRowPaymentMode}
                    onChange={(e) => setEditRowPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="CASH">ক্যাশ / নগদ ড্রয়ার</option>
                    <option value="BKASH">বিকাশ (bKash)</option>
                    <option value="NAGAD">নগদ (Nagad)</option>
                    <option value="ROCKET">রকেট (Rocket)</option>
                    <option value="BANK">ব্যাংক ট্রান্সফার</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  পার্টি / প্রাপক (Party Name)
                </label>
                <input
                  type="text"
                  value={editRowPartyName}
                  onChange={(e) => setEditRowPartyName(e.target.value)}
                  placeholder="যেমন: মোঃ করিম বেপারী"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  বিবরণ / নোট (Description)
                </label>
                <input
                  type="text"
                  value={editRowDesc}
                  onChange={(e) => setEditRowDesc(e.target.value)}
                  placeholder="লেনদেনের সংক্ষিপ্ত বিবরণ"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingRow}
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingRow ? 'সংরক্ষণ হচ্ছে...' : '💾 পরিবর্তন সেভ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Cash Entry Modal (Add New) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-300 dark:border-slate-700 overflow-hidden transition-colors">
            <div
              className={`px-5 py-4 text-white flex items-center justify-between ${
                entryType === 'INFLOW' ? 'bg-emerald-800' : 'bg-rose-800'
              }`}
            >
              <h3 className="font-bold text-sm">
                {entryType === 'INFLOW' ? 'ক্যাশ ড্রয়ারে টাকা জমা (Inflow)' : 'ক্যাশ ড্রয়ার থেকে খরচ/উত্তোলন (Outflow)'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ক্যাটাগরি</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CashbookCategory)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  {entryType === 'INFLOW' ? (
                    <>
                      <option value="CAPITAL_IN">মূলধন বিনিয়োগ (Capital In)</option>
                      <option value="SALE_CASH">নগদ বিক্রয় (Cash Sale)</option>
                      <option value="DUE_COLLECTION">বকেয়া আদায় (Due Collection)</option>
                      <option value="BANK_TRANSFER">ব্যাংক থেকে ড্রয়ারে উত্তোলন</option>
                      <option value="OTHER">অন্যান্য প্রাপ্তি</option>
                    </>
                  ) : (
                    <>
                      <option value="DRAWING">মালিকের ব্যক্তিগত উত্তোলন (Drawings)</option>
                      <option value="EXPENSE">দৈনিক সাধারণ খরচ (Expense)</option>
                      <option value="PURCHASE_CASH">নগদ শস্য ক্রয় (Cash Purchase)</option>
                      <option value="SUPPLIER_PAYMENT">সাপ্লায়ার পাওনা পরিশোধ</option>
                      <option value="BANK_TRANSFER">ক্যাশ থেকে ব্যাংকে জমা</option>
                      <option value="OTHER">অন্যান্য ব্যয়</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">টাকার পরিমাণ (৳)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(toBengaliDigits(e.target.value))}
                  placeholder="যেমন: ৫০০০০"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-base font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">মাধ্যম</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  <option value="CASH">ক্যাশ ড্রয়ার (নগদ)</option>
                  <option value="BKASH">বিকাশ (bKash)</option>
                  <option value="NAGAD">নগদ (Nagad)</option>
                  <option value="ROCKET">রকেট (Rocket)</option>
                  <option value="BANK">ব্যাংক একাউন্ট</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">বিবরণ / নোট</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow transition-colors cursor-pointer ${
                    entryType === 'INFLOW' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
