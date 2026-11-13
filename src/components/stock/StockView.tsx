import React, { useState, useEffect } from 'react';
import {
  Boxes,
  TrendingDown,
  Plus,
  Scale,
  Package,
  Coins,
  History,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Commodity, StockAdjustment } from '../../types';
import { dbService } from '../../services/api';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { formatBanglaCurrency, formatDate, toBnDigits, toBengaliDigits, parseSmartNumber } from '../../utils/bengaliNumbers';
import { totalKgToMonKg } from '../../utils/weightConverter';
import { useTheme } from '../../context/ThemeContext';

export const StockView: React.FC = () => {
  const { digitMode } = useTheme();
  const isBn = digitMode === 'BN';

  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [isNewCommodityOpen, setIsNewCommodityOpen] = useState(false);

  // Stock Integrity Audit State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // New commodity form states
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [defaultBagWeight, setDefaultBagWeight] = useState('75');
  const [commNotes, setCommNotes] = useState('');

  // Warehouse Stock Edit State
  const [editingStockComm, setEditingStockComm] = useState<Commodity | null>(null);
  const [editMon, setEditMon] = useState('');
  const [editKg, setEditKg] = useState('');
  const [editBags, setEditBags] = useState('');
  const [editRateMon, setEditRateMon] = useState('');
  const [editDefaultBagKg, setEditDefaultBagKg] = useState('75');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingStock, setIsSavingStock] = useState(false);

  // Warehouse Stock 2-Step Delete State
  const [deleteTargetComm, setDeleteTargetComm] = useState<Commodity | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingStock, setIsDeletingStock] = useState(false);

  useEffect(() => {
    loadStockData();
  }, []);

  const loadStockData = async () => {
    try {
      const [comms, adjs] = await Promise.all([
        dbService.commodities.getAll(),
        dbService.stockAdjustments.getAll(50),
      ]);
      setCommodities(comms);
      setAdjustments(adjs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdjustmentComplete = () => {
    loadStockData();
  };

  const handleRunStockAudit = async () => {
    try {
      setIsAuditing(true);
      const res = await dbService.reports.verifyStockIntegrity();
      setAuditData(res);
      setIsAuditModalOpen(true);
    } catch (e: any) {
      alert(`অডিট ত্রুটি: ${e.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCreateCommodity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameBn.trim()) {
      alert('শস্যের নাম (বাংলায়) অবশ্যই দিতে হবে');
      return;
    }
    try {
      await dbService.commodities.create({
        name_bn: nameBn.trim(),
        name_en: nameEn.trim() || nameBn.trim(),
        default_bag_weight_kg: parseSmartNumber(defaultBagWeight) || 75,
        notes: commNotes.trim(),
      });
      setNameBn('');
      setNameEn('');
      setCommNotes('');
      setIsNewCommodityOpen(false);
      loadStockData();
    } catch (err: any) {
      alert(err.message || 'শস্য যোগ করতে সমস্যা হয়েছে');
    }
  };

  // Stock Edit Handlers
  const handleOpenStockEdit = (comm: Commodity) => {
    setEditingStockComm(comm);
    const { mon, kg } = totalKgToMonKg(comm.current_stock_kg);
    setEditMon(String(mon));
    setEditKg(String(kg));
    setEditBags(String(comm.current_stock_bags));
    setEditRateMon(String(comm.current_wac_per_mon || Math.round(comm.current_wac_per_kg * 40)));
    setEditDefaultBagKg(String(comm.default_bag_weight_kg || 75));
    setEditNotes(comm.notes || '');
  };

  const handleSaveStockEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStockComm) return;

    const monVal = parseSmartNumber(editMon);
    const kgVal = parseSmartNumber(editKg);
    const totalKg = Math.max(0, (monVal * 40.0) + kgVal);
    const bagsVal = Math.max(0, Math.round(parseSmartNumber(editBags)));
    const rateMonVal = Math.max(0, parseSmartNumber(editRateMon));
    const rateKgVal = rateMonVal > 0 ? rateMonVal / 40.0 : 0;
    const defaultBag = Math.max(1, parseSmartNumber(editDefaultBagKg) || 75);

    try {
      setIsSavingStock(true);
      await dbService.commodities.update(editingStockComm.id, {
        current_stock_kg: totalKg,
        current_stock_bags: bagsVal,
        current_wac_per_mon: rateMonVal,
        current_wac_per_kg: rateKgVal,
        default_bag_weight_kg: defaultBag,
        notes: editNotes.trim(),
      });
      alert(`✅ "${editingStockComm.name_bn}" এর গুদাম স্টক সফলভাবে আপডেট করা হয়েছে!`);
      setEditingStockComm(null);
      await loadStockData();
    } catch (err: any) {
      alert(`স্টক আপডেট ত্রুটি: ${err.message}`);
    } finally {
      setIsSavingStock(false);
    }
  };

  // Stock 2-Step Delete Handlers
  const handleStartDeleteStock = (comm: Commodity) => {
    setDeleteTargetComm(comm);
    setDeleteStep(1);
    setDeleteConfirmText('');
  };

  const handleProceedToDeleteStep2 = () => {
    setDeleteStep(2);
    setDeleteConfirmText('');
  };

  const handleExecutePermanentDelete = async () => {
    if (!deleteTargetComm) return;
    if (deleteConfirmText.trim() !== 'DELETE') {
      alert("ত্রুটি: নিশ্চিত করতে হুবহু 'DELETE' টাইপ করুন!");
      return;
    }

    try {
      setIsDeletingStock(true);
      const res = await dbService.commodities.delete(deleteTargetComm.id, true);
      if (res.success) {
        alert(`✅ "${deleteTargetComm.name_bn}" এর স্টক রেকর্ড স্থায়ীভাবে ডাটাবেজ থেকে মুছে ফেলা হয়েছে!`);
        setDeleteTargetComm(null);
        await loadStockData();
      } else {
        alert(`❌ মুছতে ব্যর্থ হয়েছে: ${res.message}`);
      }
    } catch (err: any) {
      alert(`মুছতে ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setIsDeletingStock(false);
    }
  };

  // Aggregates
  const totalStockKg = commodities.reduce((sum, c) => sum + c.current_stock_kg, 0);
  const totalStockMon = totalStockKg / 40.0;
  const totalStockBags = commodities.reduce((sum, c) => sum + c.current_stock_bags, 0);
  const totalValuation = commodities.reduce((sum, c) => sum + (c.current_stock_kg * c.current_wac_per_kg), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">গুদাম স্টক ও শুকতি ট্র্যাকিং</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            মজুত শস্যের রিয়েল-টাইম ওজন, বস্তা, গড় ক্রয়মূল্য (WAC) ও শুকানো ঘাটতি সমন্বয় খাতা
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunStockAudit}
            disabled={isAuditing}
            title="গুদাম মজুত সমীকরণ সত্যতা যাচাই (Double-Check Equation)"
            className="px-3.5 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{isAuditing ? 'অডিট হচ্ছে...' : 'স্টক নির্ভুলতা অডিট'}</span>
          </button>

          <button
            onClick={() => setIsNewCommodityOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন শস্য যোগ</span>
          </button>

          <button
            onClick={() => setIsAdjModalOpen(true)}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <TrendingDown className="w-4 h-4" />
            <span>+ শুকতি / ঘাটতি এন্ট্রি</span>
          </button>
        </div>
      </div>

      {/* Aggregate Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">মোট গুদাম মজুত</span>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100">
              {isBn ? toBnDigits(totalStockMon.toFixed(2)) : totalStockMon.toFixed(2)} মণ
            </p>
            <span className="text-[11px] text-slate-400">
              ({isBn ? toBnDigits(totalStockKg.toFixed(0)) : totalStockKg.toFixed(0)} কেজি)
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">মোট বস্তার সংখ্যা</span>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100">
              {isBn ? toBnDigits(totalStockBags) : totalStockBags} বস্তা
            </p>
            <span className="text-[11px] text-slate-400">সকল গুদাম মিলিয়ে</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">মোট বর্তমান স্টক মূল্য</span>
            <p className="text-lg font-black text-indigo-900 dark:text-indigo-300">
              {formatBanglaCurrency(totalValuation, isBn)}
            </p>
            <span className="text-[11px] text-slate-400">WAC গড় খরচ মূল্যে</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 transition-colors">
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">সর্বমোট শুকতি সমন্বয়</span>
            <p className="text-lg font-black text-rose-900 dark:text-rose-300">
              {isBn ? toBnDigits(adjustments.length) : adjustments.length} টি রেকর্ড
            </p>
            <span className="text-[11px] text-slate-400">আর্দ্রতা ও ওজন ঘাটতি</span>
          </div>
        </div>
      </div>

      {/* Commodity Inventory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commodities.map((c) => {
          const { mon, kg } = totalKgToMonKg(c.current_stock_kg);
          const stockMon = (c.current_stock_kg / 40.0).toFixed(2);
          const totalVal = c.current_stock_kg * c.current_wac_per_kg;

          return (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-600 transition-all"
            >
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{c.name_bn}</h3>
                  <span className="text-[11px] text-slate-400 font-mono">{c.name_en}</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-800">
                  {isBn ? toBnDigits(stockMon) : stockMon} মন
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg">
                  <span className="text-slate-500 dark:text-slate-400">মোট খাঁটি ওজন:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {isBn ? toBnDigits(mon) : mon} মন {isBn ? toBnDigits(kg) : kg} কেজি
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ({isBn ? toBnDigits(c.current_stock_kg.toFixed(0)) : c.current_stock_kg.toFixed(0)} কেজি)
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg">
                  <span className="text-slate-500 dark:text-slate-400">বস্তার সংখ্যা:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                    {isBn ? toBnDigits(c.current_stock_bags) : c.current_stock_bags} বস্তা
                  </p>
                  <p className="text-[10px] text-slate-400">
                    প্রতি বস্তা ~{isBn ? toBnDigits(c.default_bag_weight_kg) : c.default_bag_weight_kg} কেজি
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg">
                  <span className="text-slate-500 dark:text-slate-400">গড় ক্রয়মূল্য (WAC):</span>
                  <p className="font-bold text-amber-900 dark:text-amber-300 mt-0.5">
                    {formatBanglaCurrency(c.current_wac_per_mon, isBn)} /মন
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ({formatBanglaCurrency(c.current_wac_per_kg, isBn)} /কেজি)
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg">
                  <span className="text-slate-500 dark:text-slate-400">মোট বর্তমান মূল্য:</span>
                  <p className="font-bold text-emerald-800 dark:text-emerald-400 mt-0.5">
                    {formatBanglaCurrency(totalVal, isBn)}
                  </p>
                </div>
              </div>

              {c.notes && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic border-t border-slate-100 dark:border-slate-800 pt-2 mb-3">
                  নোট: {c.notes}
                </p>
              )}

              {/* Action Buttons: গুদাম স্টক সম্পাদনা ও ২-ধাপ ডিলিট */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleOpenStockEdit(c)}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="ওজন, বস্তা ও প্রারম্ভিক দর পরিবর্তন করুন"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>সম্পাদনা</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartDeleteStock(c)}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="গুদাম স্টক রেকর্ড মুছুন (২-ধাপ নিশ্চিতকরণ)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>মুছুন</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock Adjustments & Moisture Loss History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
              শুকতি ও আর্দ্রতা ঘাটতি সমন্বয়ের ইতিহাস (Recent Shrinkage Losses)
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            সর্বশেষ {isBn ? toBnDigits(adjustments.length) : adjustments.length} টি রেকর্ড
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                <th className="py-2.5 px-4">তারিখ</th>
                <th className="py-2.5 px-4">শস্য</th>
                <th className="py-2.5 px-4">ঘাটতি ওজন (মন ও কেজি)</th>
                <th className="py-2.5 px-4">ঘাটতি বস্তা</th>
                <th className="py-2.5 px-4">আর্থিক ক্ষতি মূল্য</th>
                <th className="py-2.5 px-4">কারণ ও বিবরণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    কোনো শুকতি বা ঘাটতি সমন্বয় রেকর্ড নেই
                  </td>
                </tr>
              ) : (
                adjustments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">{formatDate(a.adjustment_date, isBn)}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">{a.commodity_name}</td>
                    <td className="py-2.5 px-4 font-bold text-rose-600 dark:text-rose-400">
                      -{isBn ? toBnDigits(a.lost_weight_mon.toFixed(2)) : a.lost_weight_mon.toFixed(2)} মন (-{isBn ? toBnDigits(a.lost_weight_kg.toFixed(1)) : a.lost_weight_kg.toFixed(1)} কেজি)
                    </td>
                    <td className="py-2.5 px-4 font-medium">{a.lost_bags > 0 ? `-${isBn ? toBnDigits(a.lost_bags) : a.lost_bags} বস্তা` : '০'}</td>
                    <td className="py-2.5 px-4 font-bold text-rose-800 dark:text-rose-300">
                      {formatBanglaCurrency(a.cost_value, isBn)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                      {a.reason} {a.notes && <span className="text-slate-400">({a.notes})</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        commodities={commodities}
        onAdjustmentComplete={handleAdjustmentComplete}
      />

      {/* Stock Equation Integrity Audit Modal */}
      {isAuditModalOpen && auditData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-300 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="bg-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base">গুদাম স্টক নির্ভুলতা সমীকরণ অডিট (Stock Integrity)</h3>
              </div>
              <button onClick={() => setIsAuditModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200">
                <strong>সমীকরণ সূত্র:</strong> মোট নেট মজুত = (সর্বমোট ক্রয়কৃত কেজি) - (সর্বমোট বিক্রিত কেজি) - (শুকতি ও আর্দ্রতা ক্ষতি কেজি)
                <p className="mt-1 text-[11px] opacity-90">
                  ঐতিহাসিক প্রতিটি ক্রয়, বিক্রয় ও শুকতি ভাউচারের সমন্বয়ে বর্তমান ডাটাবেস ব্যালেন্স যাচাই করা হয়েছে।
                </p>
              </div>

              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b">
                      <th className="py-2 px-3">শস্য</th>
                      <th className="py-2 px-3 text-right">মোট ক্রয় (কেজি)</th>
                      <th className="py-2 px-3 text-right">মোট বিক্রয় (কেজি)</th>
                      <th className="py-2 px-3 text-right">শুকতি ক্ষতি (কেজি)</th>
                      <th className="py-2 px-3 text-right">হিসাবকৃত মজুত</th>
                      <th className="py-2 px-3 text-right">বর্তমান মজুত</th>
                      <th className="py-2 px-3 text-center">স্থিতি</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditData.reports.map((r: any) => (
                      <tr key={r.commodity_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">{r.commodity_name}</td>
                        <td className="py-2 px-3 text-right">{isBn ? toBnDigits(r.purchased_kg) : r.purchased_kg}</td>
                        <td className="py-2 px-3 text-right">{isBn ? toBnDigits(r.sold_kg) : r.sold_kg}</td>
                        <td className="py-2 px-3 text-right text-rose-600">{isBn ? toBnDigits(r.lost_kg) : r.lost_kg}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                          {isBn ? toBnDigits(r.calculated_stock_kg) : r.calculated_stock_kg}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-emerald-700 dark:text-emerald-400">
                          {isBn ? toBnDigits(r.current_stock_kg) : r.current_stock_kg}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.is_matching ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>১০০% নির্ভুল</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>পার্থক্য {r.difference_kg} কেজি</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Commodity Modal */}
      {isNewCommodityOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-300 dark:border-slate-700">
            <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">নতুন শস্য যুক্ত করুন</h3>
              <button onClick={() => setIsNewCommodityOpen(false)} className="text-emerald-200 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCommodity} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  শস্যের নাম (বাংলায়) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nameBn}
                  onChange={(e) => setNameBn(e.target.value)}
                  placeholder="যেমন: তিল / তিসি / সয়াবিন"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ইংরেজি নাম
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="যেমন: Sesame"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ডিফল্ট প্রতি বস্তার ওজন (কেজি)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={toBengaliDigits(defaultBagWeight)}
                  onChange={(e) => setDefaultBagWeight(toBengaliDigits(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  বিবরণ / নোট
                </label>
                <input
                  type="text"
                  value={commNotes}
                  onChange={(e) => setCommNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewCommodityOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Warehouse Stock Edit Modal (ওজন, বস্তা ও প্রারম্ভিক দর পরিবর্তন) */}
      {editingStockComm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="bg-blue-800 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-sm">শস্যের গুদাম স্টক সম্পাদনা</h3>
                  <span className="text-[11px] text-blue-200">
                    {editingStockComm.name_bn} ({editingStockComm.name_en})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStockComm(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockEdit} className="p-5 space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-900 dark:text-blue-200">
                💡 <strong>নির্দেশনা:</strong> গুদামের প্রকৃত মজুত অনুযায়ী মোট মণ, অতিরিক্ত কেজি, বস্তা সংখ্যা ও প্রারম্ভিক গড় দর এখানে সরাসরি হালনাগাদ করা যাবে।
              </div>

              {/* Weight: Mon and Kg */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    মোট ওজন (মণ) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={toBengaliDigits(editMon)}
                    onChange={(e) => setEditMon(toBengaliDigits(e.target.value))}
                    placeholder="যেমন: ১০০"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">৪০ কেজিতে ১ মণ</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    অতিরিক্ত কেজি (০-৩৯)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={toBengaliDigits(editKg)}
                    onChange={(e) => setEditKg(toBengaliDigits(e.target.value))}
                    placeholder="যেমন: ২০"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    মোট = {toBnDigits((((parseSmartNumber(editMon) || 0) * 40) + (parseSmartNumber(editKg) || 0)).toFixed(0))} কেজি
                  </span>
                </div>
              </div>

              {/* Bags and Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    বস্তার সংখ্যা (বস্তা) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={toBengaliDigits(editBags)}
                    onChange={(e) => setEditBags(toBengaliDigits(e.target.value))}
                    placeholder="যেমন: ৫০"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    প্রারম্ভিক / গড় দর (৳/মণ) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={toBengaliDigits(editRateMon)}
                    onChange={(e) => setEditRateMon(toBengaliDigits(e.target.value))}
                    placeholder="যেমন: ৩২০০"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    required
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ~{formatBanglaCurrency((parseSmartNumber(editRateMon) || 0) / 40.0, isBn)} /কেজি
                  </span>
                </div>
              </div>

              {/* Default Bag Weight */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  প্রতি বস্তার আদর্শ ওজন (কেজি)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={toBengaliDigits(editDefaultBagKg)}
                  onChange={(e) => setEditDefaultBagKg(toBengaliDigits(e.target.value))}
                  placeholder="যেমন: ৭৫"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  মন্তব্য / বিবরণ
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="যেমন: গুদাম-১ এ সংরক্ষিত"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStockComm(null)}
                  disabled={isSavingStock}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingStock}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isSavingStock ? 'সংরক্ষণ হচ্ছে...' : 'হালনাগাদ সংরক্ষণ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Warehouse Stock 2-Step Delete Modal */}
      {deleteTargetComm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-300 dark:border-rose-900 animate-in fade-in zoom-in-95">
            {deleteStep === 1 ? (
              // Step 1: Standard Confirmation Dialog
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/30">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      গুদাম স্টক ডিলিট নিশ্চিতকরণ (ধাপ ১/২)
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      প্রাথমিক নিশ্চিতকরণ যাচাই
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300">
                  আপনি কি <strong className="text-rose-600 dark:text-rose-400 font-bold font-mono">"{deleteTargetComm.name_bn}"</strong> এর গুদাম স্টক রেকর্ডটি মুছতে চান?
                </p>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">বর্তমান মজুত:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {toBnDigits((deleteTargetComm.current_stock_kg / 40.0).toFixed(2))} মণ ({toBnDigits(deleteTargetComm.current_stock_kg.toFixed(0))} কেজি)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">মোট বস্তা:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {toBnDigits(deleteTargetComm.current_stock_bags)} বস্তা
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetComm(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToDeleteStep2}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <span>পরবর্তী ধাপ (Next) ➡️</span>
                  </button>
                </div>
              </div>
            ) : (
              // Step 2: Strict Double-Confirmation Dialog with 'DELETE' typing
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/30">
                    <Trash2 className="w-6 h-6 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-rose-600 dark:text-rose-400">
                      সতর্কতা: স্থায়ীভাবে মুছে ফেলা (ধাপ ২/২)
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      চূড়ান্ত ও অপরিবর্তনীয় ডিলিট নিশ্চিতকরণ
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-900 dark:text-rose-200 font-semibold">
                  ⚠️ সতর্কতা: এটি স্থায়ীভাবে ডাটাবেজ থেকে মুছে যাবে! নিশ্চিত করতে নিচের ইনপুটে হুবহু <span className="font-mono text-rose-600 dark:text-rose-400 underline font-black">'DELETE'</span> লিখুন:
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    নিশ্চিতকরণ টাইপ করুন:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                    placeholder="DELETE"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border-2 border-rose-400 dark:border-rose-600 rounded-xl text-sm font-black text-rose-600 dark:text-rose-400 tracking-widest font-mono text-center outline-none focus:ring-2 focus:ring-rose-500"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    disabled={isDeletingStock}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    ⬅️ পূর্ববর্তী ধাপ
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePermanentDelete}
                    disabled={deleteConfirmText.trim() !== 'DELETE' || isDeletingStock}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeletingStock ? 'মুছে ফেলা হচ্ছে...' : 'স্থায়ীভাবে মুছুন (Permanent Delete)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
