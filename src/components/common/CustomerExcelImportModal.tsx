import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Users,
  Coins,
  RefreshCw,
} from 'lucide-react';
import {
  parsePartiesFromExcel,
  ParsedPartyRow,
} from '../../utils/smartExcelParser';
import { dbService } from '../../services/api';
import {
  toBnDigits,
  formatTakaBn,
  parseSmartNumber,
} from '../../utils/bengaliNumbers';

interface CustomerExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const CustomerExcelImportModal: React.FC<CustomerExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [fileList, setFileList] = useState<File[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedPartyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [importProgress, setImportProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const allRows: ParsedPartyRow[] = [];
      for (const file of files) {
        const rows = await parsePartiesFromExcel(file, 'BUYER');
        allRows.push(...rows);
      }

      if (allRows.length === 0) {
        setError('ফাইল(সমূহ) থেকে কোনো গ্রাহক বা বাকি রেকর্ড শনাক্ত করা যায়নি। অনুগ্রহ করে সঠিক এক্সেল ফাইল যাচাই করুন।');
      } else {
        setParsedRows(allRows);
      }
    } catch (err: any) {
      console.error(err);
      setError(`এক্সেল ফাইল প্রসেস করতে সমস্যা হয়েছে: ${err.message || 'অজানা ত্রুটি'}`);
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

  const handleRowChange = (id: string, field: keyof ParsedPartyRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === 'currentDue' || field === 'openingDue') {
          const num = parseSmartNumber(value);
          return { ...r, [field]: num, openingDue: num };
        }
        return { ...r, [field]: value };
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  const selectedRows = parsedRows.filter((r) => r.selected);
  const totalSelectedDue = selectedRows.reduce((sum, r) => sum + (r.currentDue || 0), 0);
  const dualLedgerCount = parsedRows.filter((r) => r.sourceType === 'DUAL_COLUMN_LEDGER').length;

  const handleExecuteImport = async () => {
    if (selectedRows.length === 0) {
      alert('ইমপোর্ট করার জন্য অন্তত একজন গ্রাহক নির্বাচন করুন।');
      return;
    }

    setSubmitting(true);
    setImportProgress(`০ / ${toBnDigits(selectedRows.length)} জন প্রস্তুত হচ্ছে...`);

    try {
      let count = 0;
      for (const row of selectedRows) {
        count++;
        setImportProgress(`${toBnDigits(count)} / ${toBnDigits(selectedRows.length)}: ${row.name}`);

        // 1. Create or update party
        const partyData = {
          name: row.name.trim(),
          phone: row.phone.trim(),
          address: row.address.trim() || 'চাচকৈড় বাজার',
          party_type: 'BUYER' as const,
          opening_balance: row.currentDue || 0,
          current_balance: row.currentDue || 0,
          notes: row.notes || 'এক্সেল থেকে স্মার্ট ইমপোর্ট',
        };

        const created = await dbService.parties.create(partyData);

        // 2. If dual-column ledger rows were parsed, insert them into party_ledger
        if (row.ledgerEntries && row.ledgerEntries.length > 0 && created?.id) {
          for (const entry of row.ledgerEntries) {
            try {
              await dbService.ledgers.recordVoucher({
                entry_date: entry.date,
                party_id: created.id,
                type: entry.credit > 0 ? 'PAYMENT_RECEIVED' : 'OPENING',
                amount: entry.credit > 0 ? entry.credit : entry.debit,
                payment_mode: 'CASH',
                description: entry.description || 'পূর্বের খতিয়ান হতে ইমপোর্ট',
              });
            } catch (e) {
              console.warn('[LedgerEntryImport]', e);
            }
          }
        }
      }

      onImportSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`ইমপোর্ট করার সময় ত্রুটি ঘটেছে: ${err.message || 'অজানা সমস্যা'}`);
    } finally {
      setSubmitting(false);
      setImportProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-2 border-emerald-600 dark:border-emerald-500/70 rounded-2xl max-w-6xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide text-amber-300 flex items-center gap-2">
                <span>স্মার্ট এক্সেল ইমপোর্ট — বাকি খাতা (কাস্টমার খতিয়ান)</span>
              </h2>
              <p className="text-xs text-slate-300">
                একসাথে একাধিক এক্সেল (.xlsx, .xls, .csv) ফাইল বা দ্বৈত-কলাম জমা-খরচ খতিয়ান শিট স্বয়ংক্রিয়ভাবে শনাক্ত ও ইমপোর্ট
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
              className="border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl p-8 text-center cursor-pointer transition-all hover:shadow-lg flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 transition-colors">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
                আপনার বাকি খাতার এক্সেল (.xlsx, .xls, .csv) ফাইল নির্বাচন করুন
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                ল্যাপটপ বা মোবাইল থেকে এক বা একাধিক ফাইল নির্বাচন করুন। সিস্টেম স্বয়ংক্রিয়ভাবে মেসার্স/গ্রাহকের নাম, মোবাইল, দ্বৈত-কলাম জমা ও খরচ খতিয়ান শনাক্ত করবে।
              </p>
              {loading && (
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>এক্সেল ফাইল বিশ্লেষণ করা হচ্ছে...</span>
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
                    className="px-2.5 py-1 bg-white dark:bg-slate-700 rounded-lg text-emerald-600 dark:text-emerald-400 font-mono font-bold border border-slate-200 dark:border-slate-600 shadow-sm"
                  >
                    📄 {f.name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setFileList([]);
                }}
                className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>নতুন ফাইল বাছুন</span>
              </button>
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
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">মোট কাস্টমার প্রাপ্ত</div>
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                      {toBnDigits(parsedRows.length)} জন
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">ইমপোর্টের জন্য নির্বাচিত</div>
                    <div className="text-sm font-black text-blue-700 dark:text-blue-300">
                      {toBnDigits(selectedRows.length)} জন
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">মোট নির্বাচিত বকেয়া</div>
                    <div className="text-sm font-black text-amber-700 dark:text-amber-300">
                      {formatTakaBn(totalSelectedDue, true)}
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 p-2.5 rounded-xl flex items-center gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">লেজার শিট ফরম্যাট</div>
                    <div className="text-sm font-black text-purple-700 dark:text-purple-300">
                      {toBnDigits(dualLedgerCount)} টি খতিয়ান
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
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">গ্রাহক / প্রতিষ্ঠানের নাম *</th>
                        <th className="py-2.5 px-3">মোবাইল নম্বর</th>
                        <th className="py-2.5 px-3">ঠিকানা / মোকাম</th>
                        <th className="py-2.5 px-3 text-right">বাকি টাকা (৳) *</th>
                        <th className="py-2.5 px-3">উৎস / শিট</th>
                        <th className="py-2.5 px-3 text-center w-12">মুছুন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                      {parsedRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`hover:bg-emerald-50/50 dark:hover:bg-slate-800/60 transition-colors ${
                            row.selected ? '' : 'opacity-40 bg-slate-50 dark:bg-slate-900/40'
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => handleToggleRow(row.id)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleRowChange(row.id, 'name', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-slate-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.phone}
                              placeholder="01XXXXXXXXX"
                              onChange={(e) => handleRowChange(row.id, 'phone', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-slate-900 dark:text-white font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.address}
                              onChange={(e) => handleRowChange(row.id, 'address', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="text"
                              value={row.currentDue}
                              onChange={(e) => handleRowChange(row.id, 'currentDue', e.target.value)}
                              className="w-28 text-right bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-md px-2 py-1 text-amber-700 dark:text-amber-300 font-bold font-mono outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[130px]">
                            {row.sourceType === 'DUAL_COLUMN_LEDGER' ? (
                              <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-300 rounded border border-purple-500/20 font-bold">
                                📊 খতিয়ান ({row.sheetName})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-500/10 text-slate-600 dark:text-slate-400 rounded">
                                📋 টেবিল
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
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{importProgress}</span>
              </span>
            )}
            {!submitting && parsedRows.length > 0 && (
              <span>
                নির্বাচিত: <b>{toBnDigits(selectedRows.length)}</b> জন | মোট বকেয়া:{' '}
                <b className="text-amber-600 dark:text-amber-400">{formatTakaBn(totalSelectedDue, true)}</b>
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
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'ইমপোর্ট হচ্ছে...'
                  : `✅ বাকি খাতায় ইমপোর্ট সম্পন্ন করুন (${toBnDigits(selectedRows.length)} জন)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
