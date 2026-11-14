import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  UserPlus,
  Truck,
  Coins,
  Receipt,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Commodity, Party, PaymentMethod, Sale } from '../../types';
import { dbService } from '../../services/api';
import { WeightInput } from '../common/WeightInput';
import { PartyModal } from '../parties/PartyModal';
import { formatBanglaCurrency, parseSmartNumber, toBengaliDigits } from '../../utils/bengaliNumbers';
import { roundMoney, roundWeight, addMoney, subMoney, multiplyMoney } from '../../utils/precision';
import { useTheme } from '../../context/ThemeContext';

interface SaleFormProps {
  onSaleComplete: (sale: Sale) => void;
  onCancel?: () => void;
}

export const SaleForm: React.FC<SaleFormProps> = ({
  onSaleComplete,
  onCancel,
}) => {
  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';
  const todayStr = new Date().toISOString().split('T')[0];

  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  // Form Fields
  const [saleDate, setSaleDate] = useState<string>(todayStr);
  const [selectedPartyId, setSelectedPartyId] = useState<number | ''>('');
  const [selectedCommodityId, setSelectedCommodityId] = useState<number | ''>('');

  // Transport details
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [destination, setDestination] = useState<string>('');

  // Weight state
  const [bagsCount, setBagsCount] = useState<number>(0);
  const [grossWeightKg, setGrossWeightKg] = useState<number>(0);
  const [bagDeductionKg, setBagDeductionKg] = useState<number>(0);
  const [netWeightKg, setNetWeightKg] = useState<number>(0);
  const [netWeightMon, setNetWeightMon] = useState<number>(0);

  // Financial rates & adjustments (accepts English or Bangla digits)
  const [ratePerMon, setRatePerMon] = useState<string>('');
  const [loadingCharge, setLoadingCharge] = useState<string>('');
  const [damagedBagDeduction, setDamagedBagDeduction] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');

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
        dbService.parties.getAll('BUYER'),
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

  const selectedCommodity = commodities.find((c) => c.id === selectedCommodityId);

  // Smart Number Parsing & High-Precision Calculations
  const rateMonNum = parseSmartNumber(ratePerMon);
  const grossAmount = multiplyMoney(netWeightMon, rateMonNum);

  const loadingNum = parseSmartNumber(loadingCharge);
  const damageNum = parseSmartNumber(damagedBagDeduction);
  const discountNum = parseSmartNumber(discountAmount);

  const subTotalWithLoading = addMoney(grossAmount, loadingNum);
  const totalDeductions = addMoney(damageNum, discountNum);
  const netInvoiceAmount = roundMoney(Math.max(0, subMoney(subTotalWithLoading, totalDeductions)));

  // Due calculation
  const enteredPaid = parseSmartNumber(paidAmount);
  const actualPaid = paymentMethod === 'DUE' ? 0 : paymentMethod === 'CASH' || paymentMethod === 'BANK' ? (paidAmount === '' ? netInvoiceAmount : enteredPaid) : enteredPaid;
  const dueAmount = roundMoney(Math.max(0, subMoney(netInvoiceAmount, actualPaid)));

  // COGS and Realized Gross Profit
  const cogsAmount = selectedCommodity ? roundMoney(netWeightKg * selectedCommodity.current_wac_per_kg) : 0;
  const realizedProfit = subMoney(netInvoiceAmount, cogsAmount);

  // Strict Stock check
  const stockAvailableKg = selectedCommodity ? selectedCommodity.current_stock_kg : 0;
  const isStockInsufficient = netWeightKg > stockAvailableKg;

  const handlePartyCreated = (newParty: Party) => {
    setParties((prev) => [...prev, newParty]);
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
    if (!saleDate) {
      setError('অনুগ্রহ করে বিক্রয়ের তারিখ নির্বাচন করুন');
      return;
    }
    if (!selectedPartyId && actualPaid < netInvoiceAmount) {
      setError('বাকি বিক্রয়ের ক্ষেত্রে অবশ্যই মিলার বা ক্রেতা নির্বাচন করুন');
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
    if (isStockInsufficient) {
      setError(`গুদামে পর্যাপ্ত মজুত নেই! বর্তমান মজুত ${(stockAvailableKg / 40).toFixed(2)} মন, আপনি বিক্রয় করতে চাচ্ছেন ${netWeightMon.toFixed(2)} মন।`);
      return;
    }
    if (rateMonNum <= 0) {
      setError('মন প্রতি বিক্রয় দর অবশ্যই লিখুন');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const selectedParty = parties.find(p => p.id === Number(selectedPartyId));

      const created = await dbService.sales.create({
        sale_date: saleDate,
        party_id: selectedPartyId ? Number(selectedPartyId) : 0,
        customer_name: selectedParty ? selectedParty.name : 'সাধারণ খুচরা ক্রেতা',
        buyer_name: selectedParty ? selectedParty.name : 'সাধারণ খুচরা ক্রেতা',
        phone: selectedParty ? selectedParty.phone : '',
        commodity_id: Number(selectedCommodityId),
        bags_count: bagsCount,
        gross_weight_kg: grossWeightKg,
        bag_deduction_kg: bagDeductionKg,
        rate_per_mon: rateMonNum,
        loading_charge: loadingNum,
        damaged_bag_deduction: damageNum,
        discount_amount: discountNum,
        payment_method: paymentMethod,
        paid_amount: actualPaid,
        vehicle_no: vehicleNo.trim(),
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        destination: destination.trim(),
        notes: notes.trim(),
      });

      onSaleComplete(created);
    } catch (err: any) {
      setError(err.message || 'বিক্রয় চালান সংরক্ষণে ত্রুটি হয়েছে');
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
    setLoadingCharge('');
    setDamagedBagDeduction('');
    setDiscountAmount('');
    setPaidAmount('');
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setDestination('');
    setNotes('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
      {/* Title Bar */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600/40 rounded-xl border border-emerald-400/30">
            <TrendingUp className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <h2 className="text-lg font-bold">নতুন বিক্রয় ও ডেলিভারি চালান (Sales & Challan)</h2>
            <p className="text-xs text-emerald-100">
              মিলার/পাইকারকে বিক্রয়, গাড়ি চালান, লোডিং চার্জ ও লাভ-ক্ষতি স্বয়ংক্রিয় হিসাব
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="text-xs bg-emerald-800/80 hover:bg-emerald-800 text-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-600 flex items-center gap-1 transition-colors"
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

        {/* Row 1: Date, Buyer, Commodity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              বিক্রয়ের তারিখ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ক্রেতা / মিল মালিক <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsPartyModalOpen(true)}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ নতুন ক্রেতা</span>
              </button>
            </div>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">সাধারণ খুচরা ক্রেতা (নগদ কেনাবেচা)</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone}) - পূর্বের পাওনা: {formatBanglaCurrency(p.current_balance, isBn)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              শস্যের প্রকার <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCommodityId}
              onChange={(e) => setSelectedCommodityId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">শস্য নির্বাচন করুন...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_bn} (মজুত: {(c.current_stock_kg / 40).toFixed(1)} মন | গড়: {formatBanglaCurrency(c.current_wac_per_mon, isBn)}/মন)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stock Status Notification */}
        {selectedCommodity && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              isStockInsufficient
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">{selectedCommodity.name_bn} গুদাম মজুত:</span>
              <span>
                <strong>{(selectedCommodity.current_stock_kg / 40).toFixed(2)} মন</strong> ({selectedCommodity.current_stock_kg.toFixed(0)} কেজি) / {selectedCommodity.current_stock_bags} বস্তা
              </span>
              <span className="text-slate-400">|</span>
              <span>গড় ক্রয় খরচ (WAC): <strong>{formatBanglaCurrency(selectedCommodity.current_wac_per_mon, isBn)} /মন</strong></span>
            </div>
            {isStockInsufficient && (
              <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded">
                সতর্কতা: বিক্রয়ের পরিমাণ মজুত স্টকের চেয়ে বেশি!
              </span>
            )}
          </div>
        )}

        {/* Traditional Grain Weight Calculator */}
        <WeightInput
          bagsCount={bagsCount}
          grossWeightKg={grossWeightKg}
          bagDeductionKg={bagDeductionKg}
          netWeightKg={netWeightKg}
          netWeightMon={netWeightMon}
          defaultDeductionPerBag={0.85}
          onChange={handleWeightChange}
        />

        {/* Transport & Delivery Challan Info */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              পরিবহন ও ডেলিভারি তথ্য (চালানের জন্য আবশ্যক)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                ট্রাক / গাড়ি নম্বর
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="যেমন: ঢাকা মেট্রো-ট-১২-৩৪৫৬"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                চালকের নাম
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="যেমন: মোঃ রফিকুল ইসলাম"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                চালকের মোবাইল নম্বর
              </label>
              <input
                type="text"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="যেমন: 01712000000"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                গন্তব্য / ডেলিভারি স্থান
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="যেমন: সিটি অটো রাইস মিল, কুষ্টিয়া"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Pricing & Adjustments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <label className="block text-xs font-bold text-emerald-950 dark:text-emerald-200 mb-1">
              বিক্রয় দর (প্রতি মন টাকা) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="text-emerald-800 dark:text-emerald-400 font-bold absolute left-3 top-2.5 text-base">৳</span>
              <input
                type="text"
                value={ratePerMon}
                onChange={(e) => setRatePerMon(toBengaliDigits(e.target.value))}
                placeholder="যেমন: ৩৫০০ বা 3500"
                className="w-full pl-8 pr-3 py-2.5 border border-emerald-300 dark:border-emerald-700 rounded-lg text-lg font-black text-emerald-950 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-slate-900"
              />
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1.5 font-mono">
              মোট শস্য মূল্য = {netWeightMon.toFixed(2)} মন × ৳{rateMonNum} = {formatBanglaCurrency(grossAmount, isBn)}
            </p>
          </div>

          {/* Adjustments: Loading, Damage cut, Discount */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                  লোডিং চার্জ (+)
                </label>
                <input
                  type="text"
                  value={loadingCharge}
                  onChange={(e) => setLoadingCharge(toBengaliDigits(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                  ঘাটতি / ছেঁড়া কর্তন (-)
                </label>
                <input
                  type="text"
                  value={damagedBagDeduction}
                  onChange={(e) => setDamagedBagDeduction(toBengaliDigits(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold text-rose-600 dark:text-rose-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                  নগদ ছাড় / ছাড় (-)
                </label>
                <input
                  type="text"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(toBengaliDigits(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">সর্বমোট ইনভয়েস মূল্য:</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">{formatBanglaCurrency(netInvoiceAmount, isBn)}</span>
            </div>
          </div>
        </div>

        {/* Profit Insight Badge */}
        {selectedCommodity && selectedCommodity.current_wac_per_kg > 0 && netWeightKg > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span className="text-amber-900 dark:text-amber-200">
                আনুমানিক ক্রয় ব্যয় (COGS): <strong>{formatBanglaCurrency(cogsAmount, isBn)}</strong>
              </span>
            </div>
            <div className="font-bold">
              আনুমানিক লাভ: <span className={realizedProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400 text-sm' : 'text-rose-600 dark:text-rose-400 text-sm'}>
                {formatBanglaCurrency(realizedProfit, isBn)}
              </span>
            </div>
          </div>
        )}

        {/* Payment Handling */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-200">
              টাকা গ্রহণ ও বাকির হিসাব (Customer Collection & Due)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-200 mb-1">
                পরিশোধের মাধ্যম
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-100"
              >
                <option value="CASH">ক্যাশ ড্রয়ারে নগদ গ্রহণ</option>
                <option value="BANK">ব্যাংক ট্রান্সফার / চেক জমা</option>
                <option value="PARTIAL">আংশিক নগদ আদায় (বাকি সহ)</option>
                <option value="DUE">সম্পূর্ণ বাকি (Customer Receivable)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-200 mb-1">
                আদায়কৃত টাকা (নগদ প্রাপ্তি)
              </label>
              <input
                type="text"
                disabled={paymentMethod === 'DUE'}
                value={paymentMethod === 'DUE' ? '০' : paidAmount}
                onChange={(e) => setPaidAmount(toBengaliDigits(e.target.value))}
                placeholder={paymentMethod === 'CASH' || paymentMethod === 'BANK' ? `সম্পূর্ণ ৳${netInvoiceAmount}` : '0.00'}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm font-bold text-emerald-900 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-xs text-emerald-800 dark:text-emerald-300">ক্রেতার বর্তমান বকেয়া (Due Amount):</span>
              <p className={`text-xl font-black ${dueAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {formatBanglaCurrency(dueAmount, isBn)}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            মন্তব্য / চালান নোট (ঐচ্ছিক)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="যেমন: মিলের নিজস্ব ট্রাকে মাল খালাস হবে"
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-100"
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
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'চালান সংরক্ষণ ও বিল প্রিন্ট করুন'}</span>
          </button>
        </div>
      </form>

      {/* Quick Party Add Modal */}
      <PartyModal
        isOpen={isPartyModalOpen}
        onClose={() => setIsPartyModalOpen(false)}
        onPartyCreated={handlePartyCreated}
        defaultType="BUYER"
      />
    </div>
  );
};
