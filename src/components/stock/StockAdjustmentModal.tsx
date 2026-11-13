import React, { useState } from 'react';
import { X, TrendingDown, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Commodity, StockAdjustment, AdjustmentType } from '../../types';
import { dbService } from '../../services/api';
import { MON_KG, monKgToTotalKg } from '../../utils/weightConverter';
import { formatBanglaCurrency, parseSmartNumber, toBengaliDigits } from '../../utils/bengaliNumbers';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  commodities: Commodity[];
  onAdjustmentComplete: (adj: StockAdjustment) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  commodities,
  onAdjustmentComplete,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [adjustmentDate, setAdjustmentDate] = useState<string>(todayStr);
  const [selectedCommodityId, setSelectedCommodityId] = useState<number | ''>(
    commodities.length > 0 ? commodities[0].id : ''
  );
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('SHRINKAGE');

  // Lost Weight
  const [monInput, setMonInput] = useState<string>('');
  const [kgInput, setKgInput] = useState<string>('');
  const [lostBags, setLostBags] = useState<string>('0');

  const [reason, setReason] = useState<string>('রোদে শুকানো ও আর্দ্রতা হ্রাসজনিত ওজন ঘাটতি');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const selectedCommodity = commodities.find(c => c.id === selectedCommodityId);

  const m = parseSmartNumber(monInput);
  const k = parseSmartNumber(kgInput);
  const totalLostKg = monKgToTotalKg(m, k);
  const totalLostMon = totalLostKg / MON_KG;
  const bagsNum = parseInt(parseSmartNumber(lostBags).toString(), 10) || 0;

  const wacAtTime = selectedCommodity ? selectedCommodity.current_wac_per_kg : 0;
  const financialCostValue = totalLostKg * wacAtTime;

  const reasonPresets = [
    { label: 'রোদে শুকানো আর্দ্রতা ঘাটতি (Moisture Loss)', type: 'SHRINKAGE', reason: 'রোদে শুকানো ও আর্দ্রতা হ্রাসজনিত ওজন ঘাটতি' },
    { label: 'ধুলোবালি ও চিটা ছাঁটাই (Cleaning/Chaff)', type: 'DAMAGE', reason: 'চালুনি দিয়ে ধুলোবালি ও চিটা পরিষ্কারে ঘাটতি' },
    { label: 'ইঁদুর ও পোকার ক্ষয় (Pest Damage)', type: 'DAMAGE', reason: 'গুদামে ইঁদুর ও পোকার উপদ্রবে বস্তা নষ্ট' },
    { label: 'ফিজিক্যাল অডিট ওজন সংশোধন (Audit)', type: 'AUDIT_CORRECTION', reason: 'গুদাম ফিজিক্যাল ওজন যাচাইয়ে প্রাপ্ত ব্যবধান সংশোধন' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentDate) {
      setError('তারিখ নির্বাচন করুন');
      return;
    }
    if (!selectedCommodityId) {
      setError('শস্য নির্বাচন করুন');
      return;
    }
    if (totalLostKg <= 0) {
      setError('ঘাটতি ওজনের পরিমাণ অবশ্যই লিখুন');
      return;
    }
    if (!reason.trim()) {
      setError('ঘাটতির কারণ অবশ্যই লিখুন');
      return;
    }
    if (selectedCommodity && totalLostKg > selectedCommodity.current_stock_kg) {
      setError('ঘাটতি ওজন গুদামে থাকা মোট মজুতের চেয়ে বেশি হতে পারে না!');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const result = await dbService.stockAdjustments.create({
        adjustment_date: adjustmentDate,
        commodity_id: Number(selectedCommodityId),
        adjustment_type: adjustmentType,
        lost_weight_kg: totalLostKg,
        lost_bags: bagsNum,
        reason: reason.trim(),
        notes: notes.trim(),
      });

      onAdjustmentComplete(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'স্টক সমন্বয় সংরক্ষণে ত্রুটি হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 dark:border-slate-700 transition-colors">
        <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TrendingDown className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-base">শুকতি ও আর্দ্রতা ঘাটতি সমন্বয় (Wastage)</h3>
              <p className="text-xs text-rose-200">
                ঐতিহাসিক ক্রয় বিল পরিবর্তন না করে বর্তমান ফিজিক্যাল স্টক হ্রাস করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rose-200 hover:text-white p-1 rounded-lg hover:bg-rose-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                তারিখ <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                শস্য নির্বাচন <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCommodityId}
                onChange={(e) => setSelectedCommodityId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
              >
                {commodities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_bn} (বর্তমান: {(c.current_stock_kg / 40).toFixed(1)} মন)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick preset reasons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              ঘাটতির সাধারণ কারণসমূহ (ক্লিক করে নির্বাচন করুন):
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {reasonPresets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAdjustmentType(p.type as AdjustmentType);
                    setReason(p.reason);
                  }}
                  className={`text-left text-[11px] p-2 rounded-lg border transition-colors ${
                    reason === p.reason
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-700 font-bold text-rose-900 dark:text-rose-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lost Weight Input */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3 transition-colors">
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              ঘাটতি ওজনের পরিমাণ (১ মন = ৪০ কেজি):
            </span>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">ঘাটতি মন</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={monInput}
                  onChange={(e) => setMonInput(toBengaliDigits(e.target.value))}
                  placeholder="যেমন: ৩"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-rose-900 dark:text-rose-300 focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">অতিরিক্ত কেজি (০-৩৯)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={kgInput}
                  onChange={(e) => setKgInput(toBengaliDigits(e.target.value))}
                  placeholder="যেমন: ১৫"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-rose-900 dark:text-rose-300 focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">ঘাটতি বস্তা (যদি থাকে)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={lostBags}
                  onChange={(e) => setLostBags(toBengaliDigits(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Calculations preview */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                মোট ঘাটতি ওজন: <strong className="text-rose-700 dark:text-rose-400">{totalLostKg.toFixed(2)} কেজি ({totalLostMon.toFixed(2)} মন)</strong>
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                ঘাটতি আর্থিক ক্ষতি: <strong className="text-rose-900 dark:text-rose-300">{formatBanglaCurrency(financialCostValue)}</strong>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              বিস্তারিত বিবরণ / কারণ
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              নোট (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="যেমন: ৩ নং চাতাল রোদে শুকানোর পর ওজন কম হয়েছে"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none transition-colors"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'স্টক হ্রাস ও সমন্বয় সম্পন্ন করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

