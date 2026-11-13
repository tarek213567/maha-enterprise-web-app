import React, { useState } from 'react';
import { Wheat, Plus, Edit2, Save, X, Trash2 } from 'lucide-react';
import { Commodity } from '../../types';
import { dbService } from '../../services/api';
import { toBnDigits, parseSmartNumber } from '../../utils/bengaliNumbers';

interface GrainSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  commodities: Commodity[];
  onRefresh: () => void;
}

export const GrainSettingsModal: React.FC<GrainSettingsModalProps> = ({
  isOpen,
  onClose,
  commodities,
  onRefresh,
}) => {
  const [editingCommId, setEditingCommId] = useState<number | null>(null);
  const [editCommName, setEditCommName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [bagKg, setBagKg] = useState('75');

  if (!isOpen) return null;

  const handleUpdate = async (id: number) => {
    if (!editCommName.trim()) return;
    try {
      await dbService.commodities.update(id, { name_bn: editCommName.trim() });
      setEditingCommId(null);
      onRefresh();
    } catch (err: any) {
      alert(`আপডেট ত্রুটি: ${err.message}`);
    }
  };

  const handleDelete = async (c: Commodity) => {
    if (!confirm(`আপনি কি "${c.name_bn}" শস্যের রেকর্ডটি মুছতে চান?`)) return;
    try {
      const res = await dbService.commodities.delete(c.id, false);
      if (!res.success) {
        alert(`⚠️ সতর্কবার্তা: ${res.message || 'এই শস্যের অধীনে সক্রিয় লেনদেন বা গুদামে মজুত রয়েছে। মুছে ফেলা যাবে না।'}`);
        return;
      }
      alert(`✅ "${c.name_bn}" সফলভাবে মুছে ফেলা হয়েছে!`);
      onRefresh();
    } catch (err: any) {
      alert(`মুছতে ব্যর্থ হয়েছে: ${err.message}`);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameBn.trim()) return;
    try {
      await dbService.commodities.create({
        name_bn: nameBn.trim(),
        name_en: nameEn.trim() || nameBn.trim(),
        default_bag_weight_kg: parseSmartNumber(bagKg) || 75,
      });
      setNameBn('');
      setNameEn('');
      setShowAdd(false);
      onRefresh();
    } catch (err: any) {
      alert(`নতুন শস্য যোগ করতে সমস্যা হয়েছে: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-300 dark:border-slate-700 animate-in fade-in zoom-in-95">
        <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wheat className="w-5 h-5 text-amber-200" />
            <h3 className="font-bold text-sm">শস্যের জাতের নাম ও তালিকা সেটিংস</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">শস্যের জাতসমূহ ({commodities.length} টি)</span>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ নতুন জাত</span>
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAdd} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
              <input
                type="text"
                placeholder="শস্যের নাম (বাংলা)"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="ইংরেজি নাম (ঐচ্ছিক)"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border rounded-lg"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs text-slate-500">
                  বাতিল
                </button>
                <button type="submit" className="px-3 py-1 text-xs bg-emerald-600 text-white font-bold rounded-lg">
                  সংরক্ষণ
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {commodities.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs"
              >
                {editingCommId === c.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={editCommName}
                      onChange={(e) => setEditCommName(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border rounded-lg bg-white dark:bg-slate-900 font-bold"
                    />
                    <button onClick={() => handleUpdate(c.id)} className="p-1 bg-emerald-600 text-white rounded">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingCommId(null)} className="p-1 text-slate-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{c.name_bn}</span>
                      <span className="text-slate-400 text-[10px] ml-2 font-mono">
                        [{toBnDigits((c.current_stock_kg / 40).toFixed(1))} মণ]
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingCommId(c.id);
                          setEditCommName(c.name_bn);
                        }}
                        className="px-2 py-1 text-cyan-500 hover:bg-cyan-500/10 rounded-lg flex items-center gap-1 font-bold text-xs border border-cyan-500/20"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>সম্পাদনা</span>
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="px-2 py-1 text-rose-500 hover:bg-rose-500/10 rounded-lg flex items-center gap-1 font-bold text-xs border border-rose-500/20"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>মুছুন</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrainSettingsModal;

