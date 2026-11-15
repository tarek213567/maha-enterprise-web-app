import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  PlusCircle,
  SlidersHorizontal,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  parseStockFromExcel,
  ParsedStockRow,
} from '../../utils/smartExcelParser';
import { dbService } from '../../services/api';
import { Commodity } from '../../types';
import {
  toBnDigits,
  formatTakaBn,
  parseSmartNumber,
} from '../../utils/bengaliNumbers';

interface StockExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const StockExcelImportModal: React.FC<StockExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [existingCommodities, setExistingCommodities] = useState<Commodity[]>([]);
  const [fileList, setFileList] = useState<File[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [globalMode, setGlobalMode] = useState<'ADD' | 'REPLACE'>('ADD');
  const [importProgress, setImportProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const fetchComms = async () => {
      try {
        const comms = await dbService.commodities.getAll();
        setExistingCommodities(comms || []);
      } catch (e) {
        console.warn('Failed to fetch commodities:', e);
      }
    };
    fetchComms();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(Array.from(files));
  };

  const processFiles = async (files: File[]) => {
    setLoading(true);
    setError('');
    setFileList(files);

    try {
      const allRows: ParsedStockRow[] = [];
      for (const file of files) {
        const rows = await parseStockFromExcel(file, existingCommodities);
        allRows.push(...rows);
      }

      if (allRows.length === 0) {
        setError('ফাইল থেকে কোনো শস্যের মজুদ বা স্টক রেকর্ড শনাক্ত করা যায়নি। অনুগ্রহ করে সঠিক এক্সেল ফাইল যাচাই করুন।');
      } else {
        setParsedRows(allRows);
      }
    } catch (err: any) {
      console.error(err);
      setError(`স্টক এক্সেল প্রসেস করতে ত্রুটি: ${err.message || 'অজানা ত্রুটি'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const handleToggleRow = (id: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleSetGlobalMode = (mode: 'ADD' | 'REPLACE') => {
    setGlobalMode(mode);
    setParsedRows((prev) => prev.map((r) => ({ ...r, mode })));
  };

  const handleRowChange = (id: string, field: keyof ParsedStockRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        let updated: any = { ...r, [field]: value };

        if (field === 'bags_count') {
          updated.bags_count = Math.max(0, Math.round(parseSmartNumber(value)));
        } else if (field === 'weight_mon') {
          const mon = parseSmartNumber(value);
          updated.weight_mon = mon;
          updated.weight_kg = Math.round(mon * 40 * 100) / 100;
        } else if (field === 'weight_kg') {
          const kg = parseSmartNumber(value);
          updated.weight_kg = kg;
          updated.weight_mon = Math.round((kg / 40) * 100) / 100;
        } else if (field === 'rate_per_mon') {
          const rateM = parseSmartNumber(value);
          updated.rate_per_mon = rateM;
          updated.rate_per_kg = Math.round((rateM / 40) * 100) / 100;
        }

        updated.total_value = Math.round(updated.weight_kg * updated.rate_per_kg);
        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const selectedRows = parsedRows.filter((r) => r.selected);
  const totalBags = selectedRows.reduce((sum, r) => sum + (r.bags_count || 0), 0);
  const totalKg = selectedRows.reduce((sum, r) => sum + (r.weight_kg || 0), 0);
  const totalMon = totalKg / 40.0;
  const totalVal = selectedRows.reduce((sum, r) => sum + (r.total_value || 0), 0);

  const handleExecuteImport = async () => {
    if (selectedRows.length === 0) {
      alert('ইমপোর্ট করার জন্য অন্তত একটি শস্য নির্বাচন করুন।');
      return;
    }

    setSubmitting(true);
    setImportProgress(`০ / ${toBnDigits(selectedRows.length)} টি শস্য প্রস্তুত হচ্ছে...`);

    try {
      // Send to server import-excel endpoint or update commodities individually
      let count = 0;
      for (const row of selectedRows) {
        count++;
        setImportProgress(`${toBnDigits(count)} / ${toBnDigits(selectedRows.length)}: ${row.name_bn}`);

        const matching = existingCommodities.find(
          (c) => c.name_bn.trim() === row.name_bn.trim() || c.id === row.matchedCommodityId
        );

        if (matching) {
          if (row.mode === 'ADD') {
            // Add to existing stock
            const oldKg = matching.current_stock_kg || 0;
            const oldBags = matching.current_stock_bags || 0;
            const oldWacKg = matching.current_wac_per_kg || 0;
            const addedKg = row.weight_kg || 0;
            const addedBags = row.bags_count || 0;
            const addedRateKg = row.rate_per_kg || 0;

            const newTotalKg = oldKg + addedKg;
            const newTotalBags = oldBags + addedBags;
            let newWacKg = oldWacKg;
            if (newTotalKg > 0) {
              newWacKg = ((oldKg * oldWacKg) + (addedKg * addedRateKg)) / newTotalKg;
            }
            const newWacMon = Math.round(newWacKg * 40 * 100) / 100;

            await dbService.commodities.update(matching.id, {
              current_stock_kg: newTotalKg,
              current_stock_bags: newTotalBags,
              current_wac_per_kg: Math.round(newWacKg * 100) / 100,
              current_wac_per_mon: newWacMon,
            });
          } else {
            // Replace / Set exact stock
            await dbService.commodities.update(matching.id, {
              current_stock_kg: row.weight_kg,
              current_stock_bags: row.bags_count,
              current_wac_per_kg: row.rate_per_kg,
              current_wac_per_mon: row.rate_per_mon,
            });
          }
        } else {
          // Create new commodity card
          const created = await dbService.commodities.create({
            name_bn: row.name_bn.trim(),
            name_en: row.name_en || row.name_bn,
            default_bag_weight_kg: row.default_bag_weight_kg || 75.0,
          });

          if (created?.id) {
            await dbService.commodities.update(created.id, {
              current_stock_kg: row.weight_kg,
              current_stock_bags: row.bags_count,
              current_wac_per_kg: row.rate_per_kg,
              current_wac_per_mon: row.rate_per_mon,
            });
          }
        }
      }

      onImportSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`স্টক ইমপোর্ট ত্রুটি: ${err.message || 'অজানা সমস্যা'}`);
    } finally {
      setSubmitting(false);
      setImportProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-blue-500/70 rounded-2xl max-w-6xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-inner">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide text-amber-300 flex items-center gap-2">
                <span>স্মার্ট স্টক এক্সেল ইমপোর্ট — গুদাম মজুত ও ওজন</span>
              </h2>
              <p className="text-xs text-slate-300">
                আমাদের ব্যাকআপ এক্সেলের <b>‘১. সকল শস্যের স্টক’</b> শিট অথবা যেকোনো শপের স্টক এক্সেল ফাইল থেকে সরাসরি গুদামের মজুদ আপডেট
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* File Upload Zone */}
          {parsedRows.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-500/50 hover:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl p-8 text-center cursor-pointer transition-all hover:shadow-lg flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 transition-colors">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                গুদাম স্টকের এক্সেল (.xlsx, .xls, .csv) ফাইল নির্বাচন করুন
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                সিস্টেম স্বয়ংক্রিয়ভাবে শস্যের নাম (সরিষা, ভুট্টা, তোষা পাট, গম, ধান ইত্যাদি), বস্তার সংখ্যা, মোট ওজন (মণ/কেজি) এবং ক্রয়দর শনাক্ত করবে।
              </p>
              {loading && (
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>স্টক এক্সেল বিশ্লেষণ করা হচ্ছে...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">নির্বাচিত ফাইল:</span>
                {fileList.map((f, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-white dark:bg-slate-700 rounded-lg text-blue-600 dark:text-blue-400 font-mono font-bold border border-slate-200 dark:border-slate-600 shadow-sm"
                  >
                    📦 {f.name}
                  </span>
                ))}
              </div>

              {/* Global Mode Switcher */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">সকল আইটেমের ডিফল্ট মোড:</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleSetGlobalMode('ADD')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      globalMode === 'ADD'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    + যোগ করুন (Add)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetGlobalMode('REPLACE')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                      globalMode === 'REPLACE'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    = আপডেট / প্রতিস্থাপন
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setParsedRows([]);
                    setFileList([]);
                  }}
                  className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>নতুন ফাইল</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <Boxes className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">শস্য আইটেম সংখ্যা</div>
                    <div className="text-sm font-black text-blue-700 dark:text-blue-300">
                      {toBnDigits(parsedRows.length)} টি জাত
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">মোট বস্তা সংখ্যা</div>
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                      {toBnDigits(totalBags)} বস্তা
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <SlidersHorizontal className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">মোট ওজন (মণ / কেজি)</div>
                    <div className="text-sm font-black text-amber-700 dark:text-amber-300">
                      {toBnDigits(totalMon.toFixed(2))} মণ ({toBnDigits(Math.round(totalKg))} কেজি)
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">আনুমানিক মোট মজুদ মূল্য</div>
                    <div className="text-sm font-black text-purple-700 dark:text-purple-300">
                      {formatTakaBn(totalVal, true)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[46vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-800 text-white font-bold select-none text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.length === parsedRows.length && parsedRows.length > 0}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">শস্যের নাম ও বিবরণ *</th>
                        <th className="py-2.5 px-3 text-right">বস্তার সংখ্যা</th>
                        <th className="py-2.5 px-3 text-right">মোট ওজন (মণ) *</th>
                        <th className="py-2.5 px-3 text-right">ওজন (কেজি)</th>
                        <th className="py-2.5 px-3 text-right">ক্রয়দর (৳/মণ)</th>
                        <th className="py-2.5 px-3 text-center">ইমপোর্ট মোড</th>
                        <th className="py-2.5 px-3 text-center">অবস্থা</th>
                        <th className="py-2.5 px-3 text-center w-12">মুছুন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                      {parsedRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-blue-50/50 dark:hover:bg-slate-800/60 transition-colors ${
                            row.selected ? '' : 'opacity-40 bg-slate-50 dark:bg-slate-900/40'
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleRow(row.id)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.name_bn}
                              onChange={(e) => handleRowChange(row.id, 'name_bn', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="text"
                              value={row.bags_count}
                              onChange={(e) => handleRowChange(row.id, 'bags_count', e.target.value)}
                              className="w-20 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-slate-900 dark:text-white font-mono outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="text"
                              value={row.weight_mon}
                              onChange={(e) => handleRowChange(row.id, 'weight_mon', e.target.value)}
                              className="w-24 text-right bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-md px-2 py-1 text-emerald-700 dark:text-emerald-300 font-bold font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="text"
                              value={row.weight_kg}
                              onChange={(e) => handleRowChange(row.id, 'weight_kg', e.target.value)}
                              className="w-24 text-right bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-slate-900 dark:text-white font-mono outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="text"
                              value={row.rate_per_mon}
                              onChange={(e) => handleRowChange(row.id, 'rate_per_mon', e.target.value)}
                              className="w-24 text-right bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-md px-2 py-1 text-amber-700 dark:text-amber-300 font-bold font-mono outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleRowChange(row.id, 'mode', row.mode === 'ADD' ? 'REPLACE' : 'ADD')
                              }
                              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                row.mode === 'ADD'
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {row.mode === 'ADD' ? '+ যোগ' : '= প্রতিস্থাপন'}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.isNew ? (
                              <span className="px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/30">
                                🆕 নতুন শস্য
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                                🔗 মিল পেয়েছে
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                              title="বাদ দিন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 dark:bg-slate-800/80 px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {submitting && (
              <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{importProgress}</span>
              </span>
            )}
            {!submitting && parsedRows.length > 0 && (
              <span>
                নির্বাচিত শস্য: <b>{toBnDigits(selectedRows.length)}</b> টি | মোট বস্তা:{' '}
                <b>{toBnDigits(totalBags)}</b> | মোট ওজন:{' '}
                <b className="text-emerald-600 dark:text-emerald-400">
                  {toBnDigits(totalMon.toFixed(2))} মণ
                </b>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={submitting || selectedRows.length === 0}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'মজুদ আপডেট হচ্ছে...'
                  : `✅ গুদাম স্টকে ইমপোর্ট সম্পন্ন করুন (${toBnDigits(selectedRows.length)} টি শস্য)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
