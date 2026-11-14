import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  RefreshCw,
  Search,
  RotateCcw,
  AlertTriangle,
  FileText,
  ShoppingCart,
  TrendingDown,
  Wheat,
  Users,
  Wallet,
  Calculator,
  NotebookPen,
  Calendar,
  CheckCircle2,
  Eye,
  X,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { RecycleBinItem } from '../../types';
import { dbService } from '../../services/api';
import { toBnDigits, formatDate, formatTakaBn } from '../../utils/bengaliNumbers';

const MODULE_OPTIONS = [
  { id: 'ALL', label: 'সকল রেকর্ড', icon: Trash2 },
  { id: 'sale', label: 'বিক্রয় চালান', icon: ShoppingCart },
  { id: 'purchase', label: 'ক্রয় চালান', icon: TrendingDown },
  { id: 'crop', label: 'শস্য / ফসল', icon: Wheat },
  { id: 'party', label: 'পার্টি / গ্রাহক', icon: Users },
  { id: 'cashbook', label: 'দৈনিক ক্যাশ বই', icon: Wallet },
  { id: 'expense', label: 'পরিচালন খরচ', icon: Calculator },
  { id: 'shrinkage', label: 'শুকতি ও ঘাটতি', icon: TrendingDown },
  { id: 'note', label: 'নোটবুক', icon: NotebookPen },
  { id: 'ledger', label: 'লেজার ভাউচার', icon: FileText },
];

export const RecycleBinView: React.FC = () => {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);
  const [viewDetailsItem, setViewDetailsItem] = useState<RecycleBinItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((cur) => (cur?.message === message ? null : cur));
    }, 4500);
  };

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dbService.recycleBin.getAll(selectedModule !== 'ALL' ? selectedModule : undefined);
      setItems(data || []);
    } catch (err: any) {
      console.error(err);
      showToast(`ডাটা লোড ত্রুটি: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedModule]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleRestore = async (item: RecycleBinItem) => {
    setRestoringId(item.id);
    try {
      const res = await dbService.recycleBin.restore(item.id);
      showToast(res.message || 'রেকর্ড সফলভাবে রিস্টোর করা হয়েছে!', 'success');
      await fetchItems();
    } catch (err: any) {
      showToast(`রিস্টোর ব্যর্থ হয়েছে: ${err.message}`, 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    if (!confirm(`আপনি কি "${item.title}" রেকর্ডটি স্থায়ীভাবে মুছে ফেলতে চান?\n\nসতর্কতা: এটি স্থায়ীভাবে মুছে যাবে এবং আর কখনো রিস্টোর করা যাবে না!`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await dbService.recycleBin.deletePermanent(item.id);
      showToast(res.message || 'স্থায়ীভাবে মুছে ফেলা হয়েছে', 'info');
      await fetchItems();
    } catch (err: any) {
      showToast(`মুছতে ব্যর্থ হয়েছে: ${err.message}`, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEmptyBin = async () => {
    if (!confirm('আপনি কি নিশ্চিত যে রিসাইকেল বিন সম্পূর্ণ খালি করতে চান?\n\nএর ফলে সংরক্ষিত সকল মুছে ফেলা রেকর্ড স্থায়ীভাবে বিলুপ্ত হবে!')) {
      return;
    }
    setEmptying(true);
    try {
      const res = await dbService.recycleBin.empty();
      showToast(res.message || 'রিসাইকেল বিন সম্পূর্ণ খালি করা হয়েছে', 'success');
      await fetchItems();
    } catch (err: any) {
      showToast(`খালি করতে ব্যর্থ হয়েছে: ${err.message}`, 'error');
    } finally {
      setEmptying(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (item.title || '').toLowerCase().includes(q);
    const modMatch = (item.module_label || '').toLowerCase().includes(q);
    const idMatch = (item.original_id || '').toLowerCase().includes(q);
    return titleMatch || modMatch || idMatch;
  });

  const getModuleBadgeColor = (mod: string) => {
    switch (mod) {
      case 'sale':
        return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
      case 'purchase':
        return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
      case 'crop':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'party':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      case 'cashbook':
        return 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30';
      case 'expense':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
      case 'shrinkage':
        return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
      case 'note':
        return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      case 'ledger':
        return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
      default:
        return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
    }
  };

  const calculateDaysLeft = (expiresAtStr: string) => {
    try {
      const expTime = new Date(expiresAtStr).getTime();
      const diffMs = expTime - Date.now();
      const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      return days;
    } catch {
      return 60;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#080d1a] p-4 sm:p-6 space-y-5 text-slate-900 dark:text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-white" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 border border-rose-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/40 shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  ৬০-দিনের রিসাইকেল বিন (Recycle Bin)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {toBnDigits(items.length)} টি মুছে ফেলা রেকর্ড
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                মুছে ফেলা যেকোনো চালান, শস্য, খতিয়ান বা হিসাব ৬০ দিন পর্যন্ত সংরক্ষিত থাকে। ১-ক্লিকে ফিরিয়ে আনতে <strong>"রিস্টোর"</strong> চাপুন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchItems}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>রিফ্রেশ</span>
            </button>

            {items.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyBin}
                disabled={emptying}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="রিসাইকেল বিন সম্পূর্ণ খালি করুন"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{emptying ? 'খালি হচ্ছে...' : 'রিসাইকেল বিন খালি করুন'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Security / Expiry Notice */}
        <div className="mt-4 pt-3 border-t border-rose-500/20 flex items-center gap-2 text-xs text-rose-200/80">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>নিরাপত্তা নীতি: ৬০ দিন পর মেয়াদোত্তীর্ণ রেকর্ডগুলো স্বয়ংক্রিয়ভাবে পার্জ (স্থায়ীভাবে বিলুপ্ত) করা হয়।</span>
        </div>
      </div>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="space-y-3">
        {/* Module Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {MODULE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedModule === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedModule(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? 'bg-[#0d2847] text-[#fbbf24] border-amber-400 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="মুছে ফেলা রেকর্ড খুঁজুন (নাম, চালান নং, বা বিবরণ)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-rose-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Items List / Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
            <span>ডাটা লোড হচ্ছে...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              রিসাইকেল বিন সম্পূর্ণ পরিষ্কার!
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? 'আপনার খোঁজের সাথে কোনো মুছে ফেলা রেকর্ড মেলেনি।'
                : 'এই ক্যাটাগরিতে কোনো মুছে ফেলা রেকর্ড নেই। সকল ডাটা অক্ষত রয়েছে।'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 w-32">মডিউল</th>
                  <th className="py-3 px-4">রেকর্ডের শিরোনাম / বিবরণ</th>
                  <th className="py-3 px-3 text-right w-28">পরিমাণ / টাকা</th>
                  <th className="py-3 px-3 text-center w-32">মুছে ফেলার সময়</th>
                  <th className="py-3 px-3 text-center w-28">মেয়াদ অবশিষ্ট</th>
                  <th className="py-3 px-4 text-center w-48">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredItems.map((item, idx) => {
                  const daysLeft = calculateDaysLeft(item.expires_at);
                  const isRestoring = restoringId === item.id;
                  const isDeleting = deletingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. ক্রম */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                        {toBnDigits(idx + 1)}
                      </td>

                      {/* 2. মডিউল ব্যাজ */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block whitespace-nowrap ${getModuleBadgeColor(
                            item.module_type
                          )}`}
                        >
                          {item.module_label || item.module_type}
                        </span>
                      </td>

                      {/* 3. শিরোনাম */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          ID: {item.original_id}
                        </div>
                      </td>

                      {/* 4. পরিমাণ / টাকা */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {item.amount > 0 ? formatTakaBn(item.amount, true) : '-'}
                      </td>

                      {/* 5. মুছে ফেলার সময় */}
                      <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="font-mono text-[11px]">{formatDate(item.deleted_at)}</div>
                      </td>

                      {/* 6. মেয়াদ অবশিষ্ট */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold flex items-center justify-center gap-1 w-fit mx-auto ${
                            daysLeft <= 7
                              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{toBnDigits(daysLeft)} দিন বাকি</span>
                        </span>
                      </td>

                      {/* 7. অ্যাকশন বাটন */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1-Click Restore Button */}
                          <button
                            type="button"
                            onClick={() => handleRestore(item)}
                            disabled={isRestoring || isDeleting}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                            title="১-ক্লিকে ফিরিয়ে আনুন"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                            <span>{isRestoring ? 'রিস্টোর...' : 'রিস্টোর'}</span>
                          </button>

                          {/* View Snapshot JSON Details */}
                          <button
                            type="button"
                            onClick={() => setViewDetailsItem(item)}
                            className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
                            title="রেকর্ডের বিস্তারিত স্ন্যাপশট দেখুন"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Permanent Delete */}
                          <button
                            type="button"
                            onClick={() => handlePermanentDelete(item)}
                            disabled={isRestoring || isDeleting}
                            className="p-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer border border-rose-500/20"
                            title="স্থায়ীভাবে মুছুন (পুনরুদ্ধার সম্ভব নয়)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snapshot Details Modal */}
      {viewDetailsItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {viewDetailsItem.module_label}: {viewDetailsItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailsItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto">
                <pre>{JSON.stringify(JSON.parse(viewDetailsItem.payload_json || '{}'), null, 2)}</pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewDetailsItem(null)}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-xs"
              >
                বন্ধ করুন
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = viewDetailsItem;
                  setViewDetailsItem(null);
                  handleRestore(it);
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>এখনই রিস্টোর করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
