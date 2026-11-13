import React, { useState, useEffect, useMemo } from 'react';
import {
  Wheat,
  DollarSign,
  Scale,
  AlertCircle,
  Plus,
  Printer,
  Trash2,
  CheckCircle2,
  X,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { dbService } from '../../services/api';
import { Commodity, Purchase } from '../../types';
import { APP_CONFIG } from '../../config/appConfig';
import { toBnDigits, parseSmartNumber, formatBanglaCurrency, toBengaliDigits, formatTakaBn } from '../../utils/bengaliNumbers';
import { monKgToTotalKg } from '../../utils/weightConverter';
import { roundMoney } from '../../utils/precision';

const toBengaliNumber = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null) return '০';
  return toBnDigits(num);
};

const toBengaliMoney = (num: number | string | undefined | null): string => {
  return formatTakaBn(num);
};

interface PurchasesViewProps {
  initialMode?: string;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ initialMode }) => {
  // Commodities & Purchases State
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [selectedCommodityId, setSelectedCommodityId] = useState<number>(0);
  const [quantityMonInput, setQuantityMonInput] = useState('');
  const [quantityKgInput, setQuantityKgInput] = useState('');
  const [pricePerMonInput, setPricePerMonInput] = useState('');
  const [bagsCountInput, setBagsCountInput] = useState('');
  const [paymentType, setPaymentType] = useState<'CASH' | 'DUE' | 'PARTIAL'>('CASH');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Right Panel State
  const [selectedTab, setSelectedTab] = useState<'TODAY' | 'ALL'>('TODAY');
  const [postSubmitPurchase, setPostSubmitPurchase] = useState<Purchase | null>(null);
  const [printModalPurchase, setPrintModalPurchase] = useState<Purchase | null>(null);
  const [deleteConfirmPurchase, setDeleteConfirmPurchase] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [comms, purs] = await Promise.all([
        dbService.commodities.getAll(),
        dbService.purchases.getAll(200),
      ]);
      setCommodities(comms);
      if (comms.length > 0 && selectedCommodityId === 0) {
        setSelectedCommodityId(comms[0].id);
      }
      setPurchases(purs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectedCommodity = useMemo(() => {
    return commodities.find((c) => c.id === selectedCommodityId) || commodities[0];
  }, [commodities, selectedCommodityId]);

  // High-Precision Calculations (1 Mon = 40 KG, Total KG = (Mon * 40) + KG)
  const rawMon = parseSmartNumber(quantityMonInput) || 0;
  const rawKg = parseSmartNumber(quantityKgInput) || 0;
  const totalKg = monKgToTotalKg(rawMon, rawKg);
  const quantityMon = totalKg > 0 ? totalKg / 40.0 : 0;
  const pricePerMon = parseSmartNumber(pricePerMonInput) || 0;
  const totalAmount = roundMoney(quantityMon * pricePerMon);

  const defaultBags = useMemo(() => {
    if (!selectedCommodity || totalKg <= 0) return 0;
    const bagKg = selectedCommodity.default_bag_weight_kg || 80;
    return Math.max(1, Math.round(totalKg / bagKg));
  }, [selectedCommodity, totalKg]);

  const bagsCount = bagsCountInput.trim() !== '' ? parseSmartNumber(bagsCountInput) || 0 : defaultBags;

  const paidAmount = useMemo(() => {
    if (paymentType === 'CASH') return totalAmount;
    if (paymentType === 'DUE') return 0;
    const parsed = parseSmartNumber(paidAmountInput) || 0;
    return Math.min(totalAmount, parsed);
  }, [paymentType, paidAmountInput, totalAmount]);

  const dueAmount = Math.max(0, totalAmount - paidAmount);

  // Grouping Today vs Past Purchases
  const todayStr = new Date().toISOString().split('T')[0];

  const todayPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const pDate = p.purchase_date ? p.purchase_date.split('T')[0] : '';
      return pDate === todayStr;
    });
  }, [purchases, todayStr]);

  const pastPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const pDate = p.purchase_date ? p.purchase_date.split('T')[0] : '';
      return pDate !== todayStr;
    });
  }, [purchases, todayStr]);

  const displayPurchases = selectedTab === 'TODAY' ? todayPurchases : purchases;

  // Today's 4 Summary Metrics
  const todaySummary = useMemo(() => {
    let todayTotalAmount = 0;
    let todayTotalMon = 0;
    let todayTotalKg = 0;
    let todayPaidAmount = 0;
    let todayDueAmount = 0;
    let todayTotalBags = 0;

    for (const p of todayPurchases) {
      todayTotalAmount += p.gross_amount || 0;
      todayTotalMon += p.net_weight_mon || 0;
      todayTotalKg += p.net_weight_kg || 0;
      todayPaidAmount += p.paid_amount || 0;
      todayDueAmount += p.due_amount || 0;
      todayTotalBags += p.bags_count || 0;
    }

    return {
      todayCount: todayPurchases.length,
      todayTotalAmount,
      todayTotalMon: Number(todayTotalMon.toFixed(2)),
      todayTotalKg,
      todayPaidAmount,
      todayDueAmount,
      todayTotalBags,
    };
  }, [todayPurchases]);

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalKg <= 0) {
      alert('সঠিক ওজন (মণ বা কেজি) প্রদান করুন');
      return;
    }
    if (pricePerMon <= 0) {
      alert('শস্যের দর (প্রতি মণ ৳) প্রদান করুন');
      return;
    }

    setSubmitting(true);
    try {
      const paymentMap: Record<string, 'CASH' | 'BANK' | 'DUE' | 'PARTIAL'> = {
        'নগদ পরিশোধ': 'CASH',
        'নগদ': 'CASH',
        'CASH': 'CASH',
        'সম্পূর্ণ বাকি': 'DUE',
        'বাকি': 'DUE',
        'DUE': 'DUE',
        'CREDIT': 'DUE',
        'UNPAID': 'DUE',
        'আংশিক বাকি': 'PARTIAL',
        'আংশিক': 'PARTIAL',
        'PARTIAL': 'PARTIAL',
        'ব্যাংক': 'BANK',
        'BANK': 'BANK',
      };
      const resolvedPaymentMethod: 'CASH' | 'BANK' | 'DUE' | 'PARTIAL' = 
        paymentMap[paymentType] || 
        (paidAmount >= totalAmount ? 'CASH' : paidAmount <= 0 ? 'DUE' : 'PARTIAL');

      const newPurchase = await dbService.purchases.create({
        purchase_date: todayStr,
        party_id: 0,
        seller_name: sellerName.trim() || 'সাধারণ বিক্রেতা',
        seller_phone: sellerPhone.trim() || '',
        commodity_id: selectedCommodityId || (commodities[0]?.id ?? 1),
        bags_count: bagsCount,
        gross_weight_kg: totalKg,
        bag_deduction_kg: 0,
        rate_per_mon: pricePerMon,
        labor_cost: 0,
        transport_cost: 0,
        bag_cost: 0,
        other_cost: 0,
        payment_method: resolvedPaymentMethod,
        paid_amount: paidAmount,
        notes: notes.trim(),
      });

      setSuccessMessage('শস্য ক্রয় সফলভাবে সম্পন্ন এবং মজুদে যোগ করা হয়েছে!');
      setPostSubmitPurchase(newPurchase);

      // Reset form
      setSellerName('');
      setSellerPhone('');
      setQuantityMonInput('');
      setQuantityKgInput('');
      setPricePerMonInput('');
      setBagsCountInput('');
      setPaidAmountInput('');
      setNotes('');
      setPaymentType('CASH');

      await loadData();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Purchase
  const handleDeletePurchase = async () => {
    if (!deleteConfirmPurchase) return;
    setDeleting(true);
    try {
      await dbService.purchases.delete(deleteConfirmPurchase.id);
      setDeleteConfirmPurchase(null);
      await loadData();
    } catch (err: any) {
      alert(`মুছতে ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const now = new Date();

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto w-full text-[var(--text-primary)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/30">
            <Wheat className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white">
                শস্য ক্রয় ও স্টক-ইন (Grain Purchase)
              </h1>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-md border border-amber-500/40">
                পাইকারি আড়ত চালান
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              কৃষক ও ব্যাপারীদের থেকে শস্য ক্রয়, স্টক এন্ট্রি ও তাৎক্ষণিক ভাউচার প্রস্তুতকরণ
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>রিফ্রেশ</span>
        </button>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Card 1: Gold / Amber Accent - আজকের মোট ক্রয় */}
        <div className="bg-gradient-to-br from-amber-500/15 to-[var(--surface)] border border-amber-500/30 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
              <DollarSign className="w-3.5 h-3.5" />
              <span>আজকের মোট ক্রয়</span>
            </div>
            <div className="text-xl font-black text-white">
              {formatTakaBn(todaySummary.todayTotalAmount, true)}
            </div>
            <div className="text-[11px] text-amber-300 font-medium">
              মোট {toBengaliNumber(todaySummary.todayCount)}টি চালান
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
            ৳
          </div>
        </div>

        {/* Card 2: Orange Accent - আজকের মোট শস্য ও বস্তা */}
        <div className="bg-gradient-to-br from-orange-500/15 to-[var(--surface)] border border-orange-500/30 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-orange-400 font-semibold text-xs">
              <Wheat className="w-3.5 h-3.5" />
              <span>আজকের মোট শস্য ও বস্তা</span>
            </div>
            <div className="text-xl font-black text-white">
              {toBengaliNumber(todaySummary.todayTotalMon)} মণ
            </div>
            <div className="text-[11px] text-orange-300 font-medium">
              ~{toBengaliNumber(todaySummary.todayTotalBags)} বস্তা ({toBengaliNumber(todaySummary.todayTotalKg)} কেজি)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Emerald Green Accent - পরিশোধিত নগদ */}
        <div className="bg-gradient-to-br from-emerald-500/15 to-[var(--surface)] border border-emerald-500/30 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>পরিশোধিত নগদ</span>
            </div>
            <div className="text-xl font-black text-white">
              {formatTakaBn(todaySummary.todayPaidAmount, true)}
            </div>
            <div className="text-[11px] text-emerald-300 font-medium">
              নগদ ক্যাশ প্রদান সম্পন্ন
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            ✓
          </div>
        </div>

        {/* Card 4: Rose Red Accent - আজকের বকেয়া দেনা */}
        <div className="bg-gradient-to-br from-rose-500/15 to-[var(--surface)] border border-rose-500/30 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>আজকের বকেয়া দেনা</span>
            </div>
            <div className="text-xl font-black text-white">
              {formatTakaBn(todaySummary.todayDueAmount, true)}
            </div>
            <div className="text-[11px] text-rose-300 font-medium">
              পরিশোধ বাকি
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold">
            !
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg flex items-center gap-2 text-sm font-medium print:hidden">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main 2-Panel Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
        {/* Left Panel: Purchase Form */}
        <div className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm space-y-4">
          <div className="border-b border-[var(--border-color)] pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              নতুন শস্য ক্রয় এন্ট্রি ফর্ম
            </h2>
            <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--app-bg)] px-2.5 py-1 rounded border border-[var(--border-color)] font-mono">
              {toBengaliNumber(now.getDate())}/{toBengaliNumber(now.getMonth() + 1)}/{toBengaliNumber(now.getFullYear())}
            </span>
          </div>

          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                বিক্রেতার নাম (ঐচ্ছিক)
              </label>
              <input
                type="text"
                placeholder="যেমন: কৃষক রহিম উদ্দিন (খালি রাখলে 'সাধারণ বিক্রেতা')"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                মোবাইল নম্বর (ঐচ্ছিক)
              </label>
              <input
                type="text"
                placeholder="যেমন: ০১৭০০-০০০০০০"
                value={sellerPhone}
                onChange={(e) => setSellerPhone(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                শস্যের জাত নির্বাচন করুন *
              </label>
              <select
                value={selectedCommodityId}
                onChange={(e) => setSelectedCommodityId(Number(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              >
                {commodities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_bn} (বর্তমান মজুদ: {toBengaliNumber(Math.round(c.current_stock_kg / 40))} মণ, {toBengaliNumber(c.current_stock_bags)} বস্তা)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  মোট ওজন (মণ) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="যেমন: ২০ বা ২৫.৫"
                  value={quantityMonInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQuantityMonInput(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold font-mono"
                />
                <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 block font-medium">
                  {toBengaliNumber(totalKg)} কেজি [৪০ কেজিতে মণ]
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  + কেজি (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="০-৩৯"
                  value={quantityKgInput}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQuantityKgInput(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold font-mono"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block font-medium">
                  = {toBengaliNumber(quantityMon.toFixed(2))} মণ
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                দর (মণ ৳) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="যেমন: ৩২০০"
                value={pricePerMonInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPricePerMonInput(toBengaliDigits(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold font-mono"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block font-medium">
                ৳{toBengaliNumber((pricePerMon / 40).toFixed(1))}/কেজি
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                বস্তার সংখ্যা (ঐচ্ছিক)
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder={`স্বয়ংক্রিয়: ~${toBengaliNumber(defaultBags)} বস্তা`}
                value={bagsCountInput}
                onChange={(e) => setBagsCountInput(toBengaliDigits(e.target.value))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            {/* Total Amount Badge */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">মোট শস্যের মূল্য:</span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                {formatTakaBn(totalAmount, true)}
              </span>
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                পরিশোধের ধরন *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'DUE', 'PARTIAL'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      paymentType === type
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md font-bold'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-amber-500/50'
                    }`}
                  >
                    {type === 'CASH' && 'নগদ পরিশোধ'}
                    {type === 'DUE' && 'সম্পূর্ণ বাকি'}
                    {type === 'PARTIAL' && 'আংশিক বাকি'}
                  </button>
                ))}
              </div>
            </div>

            {/* Partial Cash Input */}
            {paymentType === 'PARTIAL' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    নগদ জমা টাকা (৳) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="যেমন: ৫০০০০"
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(toBengaliDigits(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-500/40 rounded-lg px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex justify-between text-xs text-rose-600 dark:text-rose-300 font-semibold pt-1 border-t border-amber-500/20">
                  <span>অবশিষ্ট বাকি থাকবে:</span>
                  <span>{formatTakaBn(dueAmount, true)}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                মন্তব্য / ওজন স্লিপ নং (ঐচ্ছিক)
              </label>
              <input
                type="text"
                placeholder="যেমন: ওজন স্লিপ নং ৫২৮, ড্রাইভার করিম"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Wheat className="w-4 h-4" />
              {submitting ? 'সংরক্ষণ হচ্ছে...' : '🌾 শস্য ক্রয় ও মজুদে জমা'}
            </button>
          </form>
        </div>

        {/* Right Panel: Itemized Purchase List Table */}
        <div className="lg:col-span-7 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  শস্য ক্রয় খতিয়ান ও তালিকা
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedTab === 'TODAY' ? 'আজকের দিনের আইটেমাইজড তালিকা' : 'সকল সাম্প্রতিক শস্য ক্রয় চালানের রেকর্ড'}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTab('TODAY')}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                    selectedTab === 'TODAY'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  আজকের শস্য ক্রয় ({toBengaliNumber(todayPurchases.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab('ALL')}
                  className={`px-3 py-1 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                    selectedTab === 'ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  পূর্বের শস্য ক্রয় ({toBengaliNumber(pastPurchases.length)})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 sticky top-0">
                    <th className="py-2.5 px-3">চালান ও সময়</th>
                    <th className="py-2.5 px-3">বিক্রেতা ও ফোন</th>
                    <th className="py-2.5 px-3">জাত</th>
                    <th className="py-2.5 px-3 text-right">মণ ও বস্তা (কেজি)</th>
                    <th className="py-2.5 px-3 text-right">দর (৳)</th>
                    <th className="py-2.5 px-3 text-right">মোট টাকা</th>
                    <th className="py-2.5 px-3 text-center">পরিশোধ অবস্থা</th>
                    <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {displayPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        {selectedTab === 'TODAY' ? 'আজকের দিনে কোনো শস্য ক্রয় চালান এন্ট্রি হয়নি' : 'কোনো শস্য ক্রয় চালান রেকর্ড নেই'}
                      </td>
                    </tr>
                  ) : (
                    displayPurchases.map((p) => {
                      const dt = p.purchase_date ? new Date(p.purchase_date) : new Date();
                      const timeStr = p.created_at ? new Date(p.created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) : '';
                      const dateStr = `${toBengaliNumber(dt.getDate())}/${toBengaliNumber(dt.getMonth() + 1)}`;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{p.invoice_no}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {dateStr} {timeStr ? `• ${timeStr}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-900 dark:text-white">{p.party_name || 'সাধারণ বিক্রেতা'}</div>
                            {p.party_phone ? (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400/80 font-mono">{p.party_phone}</div>
                            ) : (
                              <div className="text-[10px] text-slate-400">-</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium border border-amber-500/20">
                              {p.commodity_name || 'শস্য'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {toBengaliNumber(p.net_weight_mon)} মণ
                            </div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              ~{toBengaliNumber(p.bags_count)} বস্তা ({toBengaliNumber(p.net_weight_kg)} কেজি)
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 font-mono font-medium">
                            {formatTakaBn(p.rate_per_mon, true)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {formatTakaBn(p.gross_amount, true)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {p.due_amount <= 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30">
                                নগদ পরিশোধ
                              </span>
                            ) : p.paid_amount <= 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold border border-rose-500/30">
                                সম্পূর্ণ বাকি
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">
                                আংশিক বাকি
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPrintModalPurchase(p)}
                                className="px-2 py-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded hover:bg-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                title="চালান প্রিন্ট করুন"
                              >
                                <Printer className="w-3 h-3" />
                                <span>প্রিন্ট</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmPurchase(p)}
                                className="px-2 py-1 text-xs bg-red-600/20 text-red-400 border border-red-500/30 rounded hover:bg-red-600 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                                title="চালান মুছে ফেলুন"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>মুছুন</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Summary Bar: আজকের সর্বমোট */}
          <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-[#111827] to-emerald-500/15 border border-amber-500/30 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5" />
                আজকের সর্বমোট কেনা শস্য ও হিসাব:
              </span>
              <span className="text-sm font-black text-white">
                মোট মূল্য: {formatTakaBn(todaySummary.todayTotalAmount, true)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] border-t border-[var(--border-color)]/60 pt-1.5">
              <span>
                মোট শস্য: <strong className="text-white">{toBengaliNumber(todaySummary.todayTotalMon)} মণ</strong> ({toBengaliNumber(todaySummary.todayTotalKg)} কেজি, ~{toBengaliNumber(todaySummary.todayTotalBags)} বস্তা)
              </span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-semibold">
                  নগদ প্রদান: {formatTakaBn(todaySummary.todayPaidAmount, true)}
                </span>
                <span className="text-[var(--border-color)]">|</span>
                <span className="text-rose-400 font-semibold">
                  বাকি পাওনা: {formatTakaBn(todaySummary.todayDueAmount, true)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Post-Submission Instant Modal */}
      {postSubmitPurchase && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">শস্য ক্রয় সফল হয়েছে!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">চালানটি সংরক্ষণ ও স্টকে জমা সম্পন্ন</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">চালান নং:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{postSubmitPurchase.invoice_no}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">বিক্রেতা:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{postSubmitPurchase.party_name || 'সাধারণ বিক্রেতা'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">পরিমাণ:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {toBengaliNumber(postSubmitPurchase.net_weight_mon)} মণ ({toBengaliNumber(postSubmitPurchase.net_weight_kg)} কেজি)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">মোট শস্যের মূল্য:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{formatTakaBn(postSubmitPurchase.gross_amount, true)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPostSubmitPurchase(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                পরবর্তী এন্ট্রি
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = postSubmitPurchase;
                  setPostSubmitPurchase(null);
                  setPrintModalPurchase(p);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                চালান প্রিন্ট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPurchase && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 dark:text-red-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">চালান মুছে ফেলার নিশ্চিতকরণ</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">চালান নং: {deleteConfirmPurchase.invoice_no}</p>
              </div>
            </div>

            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-3 rounded-lg leading-relaxed">
              সতর্কতা: এই চালানটি মুছে ফেললে স্বয়ংক্রিয়ভাবে সংশ্লিষ্ট শস্যের স্টক ({toBengaliNumber(deleteConfirmPurchase.net_weight_mon)} মণ) কমিয়ে পূর্বাবস্থায় ফিরিয়ে আনা হবে এবং ক্যাশ ও খতিয়ানের হিসাব সংশোধন হবে।
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmPurchase(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeletePurchase}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'মোছা হচ্ছে...' : 'হ্যাঁ, ডিলিট করুন'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Challan Modal */}
      {printModalPurchase && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">শস্য ক্রয় চালান প্রিভিউ</h3>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalPurchase(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Slip Layout */}
            <div id="printable-purchase-receipt" className="bg-white text-slate-900 p-6 rounded-lg shadow-sm border border-slate-300 font-sans text-xs space-y-4">
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-400 pb-3">
                <h1 className="text-xl font-black text-slate-950 tracking-tight">
                  {APP_CONFIG.name}
                </h1>
                <p className="text-[11px] font-semibold text-slate-700">
                  {APP_CONFIG.tagline}
                </p>
                <p className="text-[10px] text-slate-600">
                  {APP_CONFIG.location} | ফোন: {APP_CONFIG.contacts}
                </p>
                <div className="mt-2 inline-block px-3 py-0.5 rounded border border-slate-800 text-[11px] font-bold uppercase tracking-wider bg-slate-100">
                  কৃষক ও ব্যাপারী শস্য ক্রয় চালান
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2">
                <div className="flex justify-between font-bold">
                  <span>চালান নং: {printModalPurchase.invoice_no}</span>
                  <span>
                    তারিখ: {printModalPurchase.purchase_date}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>
                    বিক্রেতা: <strong>{printModalPurchase.party_name || 'সাধারণ বিক্রেতা'}</strong>
                  </span>
                  {printModalPurchase.party_phone && (
                    <span>মোবাইল: {printModalPurchase.party_phone}</span>
                  )}
                </div>
                {printModalPurchase.notes && (
                  <div className="text-slate-600 text-[10px]">
                    মন্তব্য/স্লিপ: {printModalPurchase.notes}
                  </div>
                )}
              </div>

              {/* Table */}
              <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                    <th className="p-2 border-r border-slate-300">বিবরণ / জাত</th>
                    <th className="p-2 text-right border-r border-slate-300">পরিমাণ (মণ)</th>
                    <th className="p-2 text-right border-r border-slate-300">দর (৳)</th>
                    <th className="p-2 text-right">মোট (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-300">
                      <div className="font-bold">{printModalPurchase.commodity_name || 'শস্য'}</div>
                      <div className="text-[9px] text-slate-500">১ মণ = ৪০ কেজি strictly</div>
                    </td>
                    <td className="p-2 text-right border-r border-slate-300">
                      <div className="font-bold">{toBengaliNumber(printModalPurchase.net_weight_mon)} মণ</div>
                      <div className="text-[9px] text-slate-500">
                        (~{toBengaliNumber(printModalPurchase.bags_count)} বস্তা / {toBengaliNumber(printModalPurchase.net_weight_kg)} কেজি)
                      </div>
                    </td>
                    <td className="p-2 text-right border-r border-slate-300 font-mono">
                      {formatTakaBn(printModalPurchase.rate_per_mon, true)}
                    </td>
                    <td className="p-2 text-right font-bold text-slate-900 font-mono">
                      {formatTakaBn(printModalPurchase.gross_amount, true)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Bottom Totals */}
              <div className="border-t border-slate-300 pt-2 space-y-1 text-right text-[11px]">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>মোট বিল:</span>
                  <span>{formatTakaBn(printModalPurchase.gross_amount, true)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>নগদ পরিশোধ:</span>
                  <span>{formatTakaBn(printModalPurchase.paid_amount, true)}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>বকেয়া দেনা:</span>
                  <span>{formatTakaBn(printModalPurchase.due_amount, true)}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-8 text-[10px] text-slate-600">
                <div className="text-center">
                  <div className="border-t border-slate-400 w-28 pt-1">বিক্রেতার স্বাক্ষর</div>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-400 w-28 pt-1">ক্যাশিয়ার / আড়তদার</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)] print:hidden">
              <button
                type="button"
                onClick={() => setPrintModalPurchase(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                বন্ধ করুন
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                প্রিন্ট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
