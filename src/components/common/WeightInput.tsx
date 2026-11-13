import React, { useState, useEffect, useRef } from 'react';
import { Scale, Package, ArrowRightLeft } from 'lucide-react';
import { MON_KG, totalKgToMonKg, monKgToTotalKg, calculateNetWeight, formatWeightBn } from '../../utils/weightConverter';
import { parseSmartNumber, toBnDigits, toBengaliDigits, toEnglishDigits } from '../../utils/bengaliNumbers';
import { useTheme } from '../../context/ThemeContext';

interface WeightInputProps {
  bagsCount: number;
  grossWeightKg: number;
  bagDeductionKg: number;
  netWeightKg: number;
  netWeightMon: number;
  defaultDeductionPerBag?: number;
  onChange: (vals: {
    bagsCount: number;
    grossWeightKg: number;
    bagDeductionKg: number;
    netWeightKg: number;
    netWeightMon: number;
  }) => void;
}

export const WeightInput: React.FC<WeightInputProps> = ({
  bagsCount,
  grossWeightKg,
  bagDeductionKg,
  netWeightKg,
  netWeightMon,
  defaultDeductionPerBag = 0.85,
  onChange,
}) => {
  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';

  // Mode: 'MON_KG' or 'TOTAL_KG'
  const [inputMode, setInputMode] = useState<'MON_KG' | 'TOTAL_KG'>('MON_KG');

  const [monInput, setMonInput] = useState<string>(() => {
    const { mon } = totalKgToMonKg(grossWeightKg);
    return mon > 0 ? mon.toString() : '';
  });

  const [kgInput, setKgInput] = useState<string>(() => {
    const { kg } = totalKgToMonKg(grossWeightKg);
    return kg > 0 ? kg.toString() : '';
  });

  const [totalKgInput, setTotalKgInput] = useState<string>(() => {
    return grossWeightKg > 0 ? grossWeightKg.toString() : '';
  });

  const [bagDeductionRate, setBagDeductionRate] = useState<number>(defaultDeductionPerBag);
  const [autoDeductBags, setAutoDeductBags] = useState<boolean>(true);
  const lastReportedRef = useRef<number>(grossWeightKg);

  // Sync internal states when props change externally (e.g. form reset or parent change)
  useEffect(() => {
    if (grossWeightKg !== lastReportedRef.current) {
      lastReportedRef.current = grossWeightKg;
      if (grossWeightKg > 0) {
        const { mon, kg } = totalKgToMonKg(grossWeightKg);
        setMonInput(mon > 0 ? toBengaliDigits(mon.toString()) : '');
        setKgInput(kg > 0 ? toBengaliDigits(kg.toString()) : '');
        setTotalKgInput(toBengaliDigits(grossWeightKg.toString()));
      } else {
        setMonInput('');
        setKgInput('');
        setTotalKgInput('');
      }
    }
  }, [grossWeightKg]);

  const handleMonKgChange = (newMonStr: string, newKgStr: string, bags: number, rate: number, auto: boolean) => {
    const bnMon = toBengaliDigits(newMonStr);
    const bnKg = toBengaliDigits(newKgStr);
    setMonInput(bnMon);
    setKgInput(bnKg);

    const m = parseSmartNumber(bnMon);
    const k = parseSmartNumber(bnKg);
    const computedGrossKg = monKgToTotalKg(m, k);
    setTotalKgInput(computedGrossKg > 0 ? toBengaliDigits(computedGrossKg.toString()) : '');

    recalculate(computedGrossKg, bags, rate, auto);
  };

  const handleTotalKgChange = (newTotalKgStr: string, bags: number, rate: number, auto: boolean) => {
    const bnTotal = toBengaliDigits(newTotalKgStr);
    setTotalKgInput(bnTotal);
    const computedGrossKg = parseSmartNumber(bnTotal);
    const { mon, kg } = totalKgToMonKg(computedGrossKg);
    setMonInput(mon > 0 ? toBengaliDigits(mon.toString()) : '');
    setKgInput(kg > 0 ? toBengaliDigits(kg.toString()) : '');

    recalculate(computedGrossKg, bags, rate, auto);
  };

  const recalculate = (gross: number, bags: number, rate: number, auto: boolean) => {
    lastReportedRef.current = gross;
    const deduction = auto ? Number((bags * rate).toFixed(3)) : bagDeductionKg;
    const calc = calculateNetWeight(gross, bags, auto ? rate : deduction / (bags || 1));

    onChange({
      bagsCount: bags,
      grossWeightKg: gross,
      bagDeductionKg: deduction,
      netWeightKg: calc.netKg,
      netWeightMon: calc.netMon,
    });
  };

  const handleBagsChange = (newBagsStr: string) => {
    const bnBags = toBengaliDigits(newBagsStr);
    const bags = parseInt(toEnglishDigits(bnBags), 10) || 0;
    const gross = parseSmartNumber(totalKgInput);
    recalculate(gross, bags, bagDeductionRate, autoDeductBags);
  };

  const handleDeductionRateChange = (newRateStr: string) => {
    const bnRate = toBengaliDigits(newRateStr);
    const rate = parseSmartNumber(bnRate);
    setBagDeductionRate(rate);
    const gross = parseSmartNumber(totalKgInput);
    recalculate(gross, bagsCount, rate, autoDeductBags);
  };

  const { mon: netMonWhole, kg: netKgRemainder } = totalKgToMonKg(netWeightKg);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
            ওজন ও বস্তার হিসাব (১ মন = ৪০ কেজি)
          </h3>
        </div>

        {/* Toggle Mode Button */}
        <button
          type="button"
          onClick={() => setInputMode((prev) => (prev === 'MON_KG' ? 'TOTAL_KG' : 'MON_KG'))}
          className="text-xs px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:border-emerald-500 rounded-md font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <ArrowRightLeft className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          {inputMode === 'MON_KG' ? 'মোট কেজিতে লিখুন' : 'মন + কেজিতে লিখুন'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Bags count */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            মোট বস্তা (সংখ্যা) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Package className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={bagsCount ? toBengaliDigits(bagsCount) : ''}
              onChange={(e) => handleBagsChange(e.target.value)}
              placeholder="যেমন: ৫০"
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Weight input depending on mode */}
        {inputMode === 'MON_KG' ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                গ্রস ওজন (মন) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={monInput}
                onChange={(e) => handleMonKgChange(e.target.value, kgInput, bagsCount, bagDeductionRate, autoDeductBags)}
                placeholder="যেমন: ৫০"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                অতিরিক্ত কেজি (০-৩৯)
              </label>
              <input
                type="text"
                value={kgInput}
                onChange={(e) => handleMonKgChange(monInput, e.target.value, bagsCount, bagDeductionRate, autoDeductBags)}
                placeholder="যেমন: ২০"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </>
        ) : (
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              মোট গ্রস ওজন (সরাসরি কেজি) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={totalKgInput}
                onChange={(e) => handleTotalKgChange(e.target.value, bagsCount, bagDeductionRate, autoDeductBags)}
                placeholder="যেমন: ২০২০ কেজি"
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="inline-flex items-center px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium rounded-lg border border-emerald-200 dark:border-emerald-800">
                = {isBn ? toBnDigits(monInput || '০') : (monInput || '0')} মন {isBn ? toBnDigits(kgInput || '০') : (kgInput || '0')} কেজি
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Empty Bag Deduction */}
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoDeduct"
            checked={autoDeductBags}
            onChange={(e) => {
              setAutoDeductBags(e.target.checked);
              recalculate(parseSmartNumber(totalKgInput), bagsCount, bagDeductionRate, e.target.checked);
            }}
            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="autoDeduct" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            খালি বস্তার ওজন বাদ দিন (বস্তা প্রতি কেজি):
          </label>
          <input
            type="text"
            disabled={!autoDeductBags}
            value={toBengaliDigits(bagDeductionRate)}
            onChange={(e) => handleDeductionRateChange(e.target.value)}
            className="w-20 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded font-medium disabled:opacity-50 outline-none"
          />
        </div>

        <div className="text-right text-xs text-slate-600 dark:text-slate-400">
          মোট বস্তার ওজর বাদ: <span className="font-semibold text-rose-600 dark:text-rose-400">-{isBn ? toBnDigits(bagDeductionKg.toFixed(2)) : bagDeductionKg.toFixed(2)} কেজি</span>
        </div>
      </div>

      {/* Net Result Badges */}
      <div className="mt-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-inner">
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400">মোট খাঁটি ওজন (কেজি):</span>
          <p className="text-base font-bold text-slate-800 dark:text-slate-100">
            {isBn ? toBnDigits(netWeightKg.toFixed(2)) : netWeightKg.toFixed(2)} কেজি
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400">খাঁটি ওজন (মন + কেজি):</span>
          <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
            {isBn ? toBnDigits(netMonWhole) : netMonWhole} মন {isBn ? toBnDigits(netKgRemainder.toFixed(2)) : netKgRemainder.toFixed(2)} কেজি
          </p>
        </div>

        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

        <div className="text-right">
          <span className="text-xs text-slate-500 dark:text-slate-400">হিসাবি মোট মন:</span>
          <p className="text-lg font-black text-emerald-800 dark:text-emerald-300">
            {isBn ? toBnDigits(netWeightMon.toFixed(3)) : netWeightMon.toFixed(3)} <span className="text-xs font-normal">মন</span>
          </p>
        </div>
      </div>
    </div>
  );
};
