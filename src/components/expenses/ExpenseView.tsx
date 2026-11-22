import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Coins,
  Calendar,
  Tag,
  Building,
  Zap,
  Users,
  Coffee,
  Wrench,
  Truck,
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../../types';
import { dbService } from '../../services/api';
import { formatBanglaCurrency, formatDate, parseSmartNumber, toBengaliDigits } from '../../utils/bengaliNumbers';
import { useSector } from '../../context/SectorContext';
import { SectorType } from '../../../electron/types';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: any }[] = [
  { key: 'RENT', label: 'গুদাম ভাড়া', icon: Building },
  { key: 'ELECTRICITY', label: 'বিদ্যুৎ ও জেনারেটর বিল', icon: Zap },
  { key: 'SALARY', label: 'কর্মচারীর বেতন ও মজুরি', icon: Users },
  { key: 'LABOR', label: 'লেবার / চাতাল কুলি খরচ', icon: Users },
  { key: 'FOOD_ENTERTAINMENT', label: 'নাস্তা ও আপ্যায়ন (চা/খাবার)', icon: Coffee },
  { key: 'TRANSPORT', label: 'যাতায়াত ও লোকাল পরিবহন', icon: Truck },
  { key: 'REPAIR', label: 'যন্ত্রপাতি ও ওজন স্কেল মেরামত', icon: Wrench },
  { key: 'TAX_LEGAL', label: 'পৌর ট্যাক্স / লাইসেন্স ফি', icon: Receipt },
  { key: 'MISC', label: 'অন্যান্য বিবিধ খরচ', icon: Tag },
];

export const ExpenseView: React.FC = () => {
  const { activeSector } = useSector();
  const todayStr = new Date().toISOString().split('T')[0];

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [category, setCategory] = useState<ExpenseCategory>('FOOD_ENTERTAINMENT');
  const [expenseSector, setExpenseSector] = useState<SectorType>('general');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK'>('CASH');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setExpenseSector(activeSector !== 'all' ? activeSector : 'general');
  }, [activeSector]);

  useEffect(() => {
    loadExpenses();
  }, [activeSector]);

  const loadExpenses = async () => {
    try {
      const data = await dbService.expenses.getAll(200, activeSector);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDate) {
      alert('অনুগ্রহ করে খরচের তারিখ নির্বাচন করুন');
      return;
    }
    const amt = parseSmartNumber(amount);
    if (!amt || amt <= 0) {
      alert('সঠিক খরচের পরিমাণ লিখুন (টাকা শূন্য বা ঋণাত্মক হতে পারবে না)');
      return;
    }

    try {
      setIsSubmitting(true);
      await dbService.expenses.create({
        expense_date: expenseDate,
        category,
        amount: amt,
        paid_to: paidTo.trim() || 'প্রযোজ্য নয়',
        payment_mode: paymentMode,
        notes: notes.trim(),
        sector: expenseSector || (activeSector !== 'all' ? activeSector : 'general'),
      });

      setIsModalOpen(false);
      setAmount('');
      setPaidTo('');
      setNotes('');
      loadExpenses();
    } catch (err: any) {
      alert(err.message || 'খরচ সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">আড়ত পরিচালন খরচ খাতা (Operating Expenses)</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            গুদাম ভাড়া, বিদ্যুৎ বিল, কর্মচারীর বেতন, নাস্তা-আপ্যায়ন ও দৈনন্দিন সাধারণ খরচ রেজিস্টার
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>+ নতুন খরচ এন্ট্রি</span>
        </button>
      </div>

      {/* Category Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CATEGORIES.slice(0, 5).map((cat) => {
          const Icon = cat.icon;
          const catTotal = expenses
            .filter((e) => e.category === cat.key)
            .reduce((sum, e) => sum + e.amount, 0);

          return (
            <div key={cat.key} className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold">{cat.label}</span>
              </div>
              <p className="text-base font-black text-slate-900 dark:text-slate-100 mt-1">
                {formatBanglaCurrency(catTotal)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Expense History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">সর্বশেষ খরচের তালিকা</h3>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            সর্বমোট খরচ: <span className="text-rose-700 dark:text-rose-400 text-sm font-black">{formatBanglaCurrency(totalExpenseAmount)}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3">তারিখ</th>
                <th className="py-2.5 px-3">ক্যাটাগরি</th>
                <th className="py-2.5 px-3">প্রাপক / ব্যক্তি</th>
                <th className="py-2.5 px-3 text-right">টাকার পরিমাণ</th>
                <th className="py-2.5 px-3 text-center">মাধ্যম</th>
                <th className="py-2.5 px-3">মন্তব্য / বিবরণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    কোনো খরচের এন্ট্রি পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                expenses.map((e) => {
                  const catObj = CATEGORIES.find((c) => c.key === e.category);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">{formatDate(e.expense_date)}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{catObj?.label || e.category}</span>
                          {e.sector && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                              {e.sector === 'jute' ? '🌿 পাট' : e.sector === 'maize' ? '🌽 ভুট্টা' : e.sector === 'mustard' ? '🌼 সরিষা' : '🏢 সাধারণ'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{e.paid_to}</td>
                      <td className="py-2.5 px-3 text-right font-black text-rose-700 dark:text-rose-400">
                        {formatBanglaCurrency(e.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {e.payment_mode === 'CASH' ? 'ক্যাশ' : 'ব্যাংক'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{e.notes || '---'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-300 dark:border-slate-700 overflow-hidden transition-colors">
            <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">নতুন পরিচালন খরচ এন্ট্রি</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">তারিখ</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">খরচের খাত (Category)</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">সেক্টর নির্বাচন *</label>
                <select
                  value={expenseSector}
                  onChange={(e) => setExpenseSector(e.target.value as SectorType)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-slate-100 font-bold"
                >
                  <option value="general">🏢 সাধারণ অফিস / শেয়ার্ড (General)</option>
                  <option value="mustard">🌼 সরিষা (Mustard)</option>
                  <option value="jute">🌿 পাট (Jute)</option>
                  <option value="maize">🌽 ভুট্টা (Maize)</option>
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
                  placeholder="যেমন: ১৫০০"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-base font-black text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">প্রাপক / ব্যক্তি</label>
                <input
                  type="text"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="যেমন: বিদ্যুৎ অফিস / করিম ভাই"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">মন্তব্য / বিবরণ</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="যেমন: চলতি মাসের গুদাম ভাড়া পরিশোধ"
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
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow transition-colors"
                >
                  {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'খরচ সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

