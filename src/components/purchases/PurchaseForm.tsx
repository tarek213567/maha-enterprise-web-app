import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  UserPlus,
  Coins,
  Receipt,
  Truck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Commodity, Party, PaymentMethod, Purchase } from '../../types';
import { dbService } from '../../services/api';
import { WeightInput } from '../common/WeightInput';
import { PartyModal } from '../parties/PartyModal';
import { formatBanglaCurrency, parseSmartNumber, toBengaliDigits } from '../../utils/bengaliNumbers';
import { roundMoney, roundWeight, addMoney, subMoney, multiplyMoney } from '../../utils/precision';
import { useTheme } from '../../context/ThemeContext';

interface PurchaseFormProps {
  onPurchaseComplete: (purchase: Purchase) => void;
  onCancel?: () => void;
}

export const PurchaseForm: React.FC<PurchaseFormProps> = ({
  onPurchaseComplete,
  onCancel,
}) => {
  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';
  const todayStr = new Date().toISOString().split('T')[0];

  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  // Form Fields
  const [purchaseDate, setPurchaseDate] = useState<string>(todayStr);
  const [selectedPartyId, setSelectedPartyId] = useState<number | ''>('');
  const [selectedCommodityId, setSelectedCommodityId] = useState<number | ''>('');

  // Weight state
  const [bagsCount, setBagsCount] = useState<number>(0);
  const [grossWeightKg, setGrossWeightKg] = useState<number>(0);
  const [bagDeductionKg, setBagDeductionKg] = useState<number>(0);
  const [netWeightKg, setNetWeightKg] = useState<number>(0);
  const [netWeightMon, setNetWeightMon] = useState<number>(0);

  // Financial rates & costs (accepts English or Bangla digits)
  const [ratePerMon, setRatePerMon] = useState<string>('');
  const [laborCost, setLaborCost] = useState<string>('');
  const [transportCost, setTransportCost] = useState<string>('');
  const [bagCost, setBagCost] = useState<string>('');
  const [otherCost, setOtherCost] = useState<string>('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // UI state
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [comms, pts] = await Promise.all([
        dbService.commodities.getAll(),
        dbService.parties.getAll('SUPPLIER'),
      ]);
      setCommodities(comms);
      setParties(pts);

      if (comms.length > 0 && selectedCommodityId === '') {
        setSelectedCommodityId(comms[0].id);
      }
      if (pts.length > 0 && selectedPartyId === '') {
        setSelectedPartyId(pts[0].id);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Smart Number Parsing & High-Precision Calculations
  const rateMonNum = parseSmartNumber(ratePerMon);
  const grossAmount = multiplyMoney(netWeightMon, rateMonNum);

  const laborNum = parseSmartNumber(laborCost);
  const transportNum = parseSmartNumber(transportCost);
  const bagNum = parseSmartNumber(bagCost);
  const otherNum = parseSmartNumber(otherCost);
  const totalDirectExpenses = addMoney(addMoney(laborNum, transportNum), addMoney(bagNum, otherNum));

  const totalLandedCost = addMoney(grossAmount, totalDirectExpenses);
  const costPerKg = netWeightKg > 0 ? totalLandedCost / netWeightKg : 0;
  const costPerMon = roundMoney(costPerKg * 40.0);

  // Due calculation
  const enteredPaidAmount = parseSmartNumber(paidAmount);
  const actualPaid = paymentMethod === 'DUE' ? 0 : paymentMethod === 'CASH' || paymentMethod === 'BANK' ? (paidAmount === '' ? grossAmount : enteredPaidAmount) : enteredPaidAmount;
  const dueAmount = roundMoney(Math.max(0, subMoney(grossAmount, actualPaid)));

  // Selected commodity & projected new WAC
  const selectedCommodity = commodities.find(c => c.id === selectedCommodityId);
  let projectedWacPerMon = costPerMon;
  if (selectedCommodity && selectedCommodity.current_stock_kg > 0 && netWeightKg > 0) {
    const totalCost = (selectedCommodity.current_stock_kg * selectedCommodity.current_wac_per_kg) + totalLandedCost;
    const totalKg = selectedCommodity.current_stock_kg + netWeightKg;
    projectedWacPerMon = roundMoney((totalCost / totalKg) * 40.0);
  }

  const handlePartyCreated = (newParty: Party) => {
    setParties(prev => [...prev, newParty]);
    setSelectedPartyId(newParty.id);
  };

  const handleWeightChange = (vals: {
    bagsCount: number;
    grossWeightKg: number;
    bagDeductionKg: number;
    netWeightKg: number;
    netWeightMon: number;
  }) => {
    setBagsCount(vals.bagsCount);
    setGrossWeightKg(vals.grossWeightKg);
    setBagDeductionKg(vals.bagDeductionKg);
    setNetWeightKg(vals.netWeightKg);
    setNetWeightMon(vals.netWeightMon);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseDate) {
      setError('অনুগ্রহ করে ক্রয়ের তারিখ নির্বাচন করুন');
      return;
    }
    if (!selectedPartyId) {
      setError('অনুগ্রহ করে বেপারী বা বিক্রেতা নির্বাচন করুন');
      return;
    }
    if (!selectedCommodityId) {
      setError('অনুগ্রহ করে শস্য নির্বাচন করুন');
      return;
    }
    if (netWeightKg <= 0) {
      setError('শস্যের খাঁটি ওজন অবশ্যই ০ এর বেশি হতে হবে');
      return;
    }
    if (rateMonNum <= 0) {
      setError('মন প্রতি ক্রয় দর অবশ্যই লিখুন');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

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
      const resolvedPaymentMethod = paymentMap[paymentMethod] || (actualPaid >= grossAmount ? 'CASH' : actualPaid <= 0 ? 'DUE' : 'PARTIAL');

      const created = await dbService.purchases.create({
        purchase_date: purchaseDate,
        party_id: Number(selectedPartyId),
        commodity_id: Number(selectedCommodityId),
        bags_count: bagsCount,
        gross_weight_kg: grossWeightKg,
        bag_deduction_kg: bagDeductionKg,
        rate_per_mon: rateMonNum,
        labor_cost: laborNum,
        transport_cost: transportNum,
        bag_cost: bagNum,
        other_cost: otherNum,
        payment_method: resolvedPaymentMethod,
        paid_amount: actualPaid,
        notes: notes.trim(),
      });

      onPurchaseComplete(created);
    } catch (err: any) {
      setError(err.message || 'ক্রয় ভাউচার সংরক্ষণে ত্রুটি হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setBagsCount(0);
    setGrossWeightKg(0);
    setBagDeductionKg(0);
    setNetWeightKg(0);
    setNetWeightMon(0);
    setRatePerMon('');
    setLaborCost('');
    setTransportCost('');
    setBagCost('');
    setOtherCost('');
    setPaidAmount('');
    setNotes('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      {/* Title Bar */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-600/40 rounded-xl border border-amber-400/30">
            <ShoppingCart className="w-6 h-6 text-amber-200" />
          </div>
          <div>
            <h2 className="text-lg font-bold">নতুন শস্য ক্রয় ও স্টক-ইন (Purchase Entry)</h2>
            <p className="text-xs text-amber-100">
              বেপারী/চাষী থেকে ক্রয়, খাঁটি মন হিসাব এবং আনুষঙ্গিক কুলি-ভাড়াসহ ল্যান্ডেড কস্ট নির্ধারণ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="text-xs bg-amber-800/80 hover:bg-amber-800 text-amber-100 px-3 py-1.5 rounded-lg border border-amber-600 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>রিসেট</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Row 1: Date, Supplier, Commodity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Purchase Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ক্রয়ের তারিখ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* Supplier Selection with Quick Add */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                বেপারী / বিক্রেতা <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsPartyModalOpen(true)}
                className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ নতুন বেপারী</span>
              </button>
            </div>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">বেপারী নির্বাচন করুন...</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone}) - ব্যালেন্স: {formatBanglaCurrency(p.current_balance, isBn)}
                </option>
              ))}
            </select>
          </div>

          {/* Commodity Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              শস্যের প্রকার <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCommodityId}
              onChange={(e) => setSelectedCommodityId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">শস্য নির্বাচন করুন...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_bn} (বর্তমান স্টক: {(c.current_stock_kg / 40).toFixed(1)} মন / {c.current_stock_bags} বস্তা)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Traditional Grain Weight Calculator Input Component */}
        <WeightInput
          bagsCount={bagsCount}
          grossWeightKg={grossWeightKg}
          bagDeductionKg={bagDeductionKg}
          netWeightKg={netWeightKg}
          netWeightMon={netWeightMon}
          defaultDeductionPerBag={0.85}
          onChange={handleWeightChange}
        />

        {/* Row 2: Rate per Mon & Gross Amount */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
              ক্রয় দর (প্রতি মন টাকা) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="text-amber-800 dark:text-amber-400 font-bold absolute left-3 top-2.5 text-base">৳</span>
              <input
                type="text"
                value={ratePerMon}
                onChange={(e) => setRatePerMon(toBengaliDigits(e.target.value))}
                placeholder="যেমন: ৩২০০ বা 3200"
                className="w-full pl-8 pr-3 py-2.5 border border-amber-300 dark:border-amber-700 rounded-lg text-lg font-black text-amber-950 dark:text-amber-100 focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-slate-900"
              />
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1.5">
              ১ মন = ৪০ কেজি হিসাবে দর। বাংলা বা ইংরেজি যেকোনো সংখ্যায় লিখতে পারেন।
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">শস্যের মোট ক্রয়মূল্য (Gross Bill):</span>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {formatBanglaCurrency(grossAmount, isBn)}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
              = {netWeightMon.toFixed(2)} মন × ৳{rateMonNum} /মন
            </p>
          </div>
        </div>

        {/* Landed Cost Breakdown */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              অন্যান্য আনুষঙ্গিক খরচ (Landed Costs - স্টক মূল্যের সাথে যুক্ত হবে)
            </h4>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                কুলি / লেবার খরচ (টাকা)
              </label>
              <input
                type="text"
                value={laborCost}
                onChange={(e) => setLaborCost(toBengaliDigits(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                গাড়ি ভাড়া / পরিবহন (টাকা)
              </label>
              <input
                type="text"
                value={transportCost}
                onChange={(e) => setTransportCost(toBengaliDigits(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                খালি বস্তার খরচ (টাকা)
              </label>
              <input
                type="text"
                value={bagCost}
                onChange={(e) => setBagCost(toBengaliDigits(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                অন্যান্য খরচ (টাকা)
              </label>
              <input
                type="text"
                value={otherCost}
                onChange={(e) => setOtherCost(toBengaliDigits(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Landed Cost Summary Badges */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-600 dark:text-slate-300">
              মোট আনুষঙ্গিক ব্যয়: <strong className="text-slate-900 dark:text-slate-100">{formatBanglaCurrency(totalDirectExpenses, isBn)}</strong>
            </div>
            <div className="text-slate-600 dark:text-slate-300">
              মোট ল্যান্ডেড কস্ট: <strong className="text-emerald-700 dark:text-emerald-400 text-sm">{formatBanglaCurrency(totalLandedCost, isBn)}</strong>
            </div>
            <div className="text-slate-600 dark:text-slate-300">
              প্রতি মন কার্যকর ক্রয়মূল্য: <strong className="text-amber-800 dark:text-amber-300 text-sm">{formatBanglaCurrency(costPerMon, isBn)} /মন</strong>
            </div>
            <div className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 px-3 py-1 rounded-full font-bold">
              পরবর্তী স্টক গড় খরচ (WAC): {formatBanglaCurrency(projectedWacPerMon, isBn)} /মন
            </div>
          </div>
        </div>

        {/* Row 3: Payment Section */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
              টাকা পরিশোধ ও বাকির হিসাব (Payment & Due Settlement)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-200 mb-1">
                পরিশোধ মাধ্যম
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-100"
              >
                <option value="CASH">ক্যাশ ড্রয়ার থেকে নগদ পরিশোধ</option>
                <option value="BANK">ব্যাংক ট্রান্সফার / চেক</option>
                <option value="PARTIAL">আংশিক নগদ পরিশোধ (বাকি সহ)</option>
                <option value="DUE">সম্পূর্ণ বাকি (Supplier Payable)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-200 mb-1">
                পরিশোধিত টাকার পরিমাণ (টাকা)
              </label>
              <input
                type="text"
                disabled={paymentMethod === 'DUE'}
                value={paymentMethod === 'DUE' ? '০' : paidAmount}
                onChange={(e) => setPaidAmount(toBengaliDigits(e.target.value))}
                placeholder={paymentMethod === 'CASH' || paymentMethod === 'BANK' ? `সম্পূর্ণ ৳${grossAmount}` : '0.00'}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-bold text-emerald-900 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-xs text-emerald-800 dark:text-emerald-300">বেপারীর বকেয়া পাওনা (Due Amount):</span>
              <p className={`text-xl font-black ${dueAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {formatBanglaCurrency(dueAmount, isBn)}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            মন্তব্য / রসিদ নোট (ঐচ্ছিক)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="যেমন: নাটোর মোকাম থেকে আমদানিকৃত ভালো শুকানো সরিষা"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none text-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              বাতিল
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'ক্রয় ভাউচার সংরক্ষণ ও স্টক যুক্ত করুন'}</span>
          </button>
        </div>
      </form>

      {/* Quick Party Add Modal */}
      <PartyModal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        onPartyCreated={handlePartyCreated}
        defaultType="SUPPLIER"
      />
    </div>
  );
};
