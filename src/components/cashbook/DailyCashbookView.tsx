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

  // Manual Cash Entry Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW');
  const [category, setCategory] = useState<CashbookCategory>('CAPITAL_IN');
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK'>('CASH');
  const [desc, setDesc] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadCashbook(selectedDate);
  }, [selectedDate]);

  const loadCashbook = async (date: string) => {
    try {
      const data = await dbService.cashbook.getDaily(date);
      setOpeningBalance(data.opening_balance);
      setEntries(data.entries);
      setTotalInflow(data.total_inflow);
      setTotalOutflow(data.total_outflow);
      setClosingBalance(data.closing_balance);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAddEntry = (type: 'INFLOW' | 'OUTFLOW') => {
    setEntryType(type);
    setCategory(type === 'INFLOW' ? 'CAPITAL_IN' : 'DRAWING');
    setAmount('');
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
      loadCashbook(selectedDate);
    } catch (err: any) {
      alert(err.message || 'ক্যাশ এন্ট্রি সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const countedNum = parseSmartNumber(countedCash);
  const cashDiscrepancy = countedCash.trim() !== '' ? countedNum - closingBalance : null;

  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';

  return (
    <div className="space-y-6">
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
            className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ ক্যাশ জমা (Inflow)</span>
          </button>

          <button
            onClick={() => handleOpenAddEntry('OUTFLOW')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <MinusCircle className="w-4 h-4" />
            <span>- ক্যাশ খরচ (Outflow)</span>
          </button>

          <button
            onClick={() => dbService.system.print()}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors flex items-center gap-1"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Metric Cards: Opening, Inflows, Outflows, Closing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Opening Cash */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">প্রারম্ভিক ক্যাশ জের (Opening)</span>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatBanglaCurrency(openingBalance)}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">গতদিনের শেষ অবশিষ্ট নগদ</span>
        </div>

        {/* 2. Total Inflows */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">মোট নগদ জমা (Inflows)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            +{formatBanglaCurrency(totalInflow, isBn, true)}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">বিক্রয় ও বকেয়া আদায়</span>
        </div>

        {/* 3. Total Outflows */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">মোট নগদ খরচ (Outflows)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1">
            -{formatBanglaCurrency(totalOutflow, isBn, true)}
          </p>
          <span className="text-[11px] text-rose-600 dark:text-rose-500 font-medium">ক্রয়, পাওনা ও ব্যয়</span>
        </div>

        {/* 4. Closing Cash */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-sm transition-colors">
          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">সমাপনী ক্যাশ ব্যালেন্স (Closing)</span>
          <p className="text-2xl font-black text-emerald-950 dark:text-emerald-200 mt-1">
            {formatBanglaCurrency(closingBalance)}
          </p>
          <span className="text-[11px] text-emerald-800 dark:text-emerald-400">আজকের ক্যাশ ড্রয়ারে থাকার কথা</span>
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
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              দৈনিক লেনদেন রেজিস্টার ({formatDate(selectedDate)})
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            মোট {isBn ? toBnDigits(entries.length) : entries.length} টি ভাউচার
          </span>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 dark:text-slate-500">
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
                          {e.payment_mode === 'CASH' ? 'ক্যাশ' : 'ব্যাংক'}
                        </span>
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
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Manual Cash Entry Modal */}
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
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  <option value="CASH">ক্যাশ ড্রয়ার (নগদ)</option>
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
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow transition-colors ${
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

