import React, { useState } from 'react';
import { X, UserPlus, Phone, MapPin } from 'lucide-react';
import { Party, PartyType } from '../../types';
import { dbService } from '../../services/api';
import { parseSmartNumber, toBengaliDigits } from '../../utils/bengaliNumbers';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPartyCreated: (party: Party) => void;
  defaultType?: PartyType;
}

export const PartyModal: React.FC<PartyModalProps> = ({
  isOpen,
  onClose,
  onPartyCreated,
  defaultType = 'SUPPLIER',
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [partyType, setPartyType] = useState<PartyType>(defaultType);
  const [openingBalance, setOpeningBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('পার্টির নাম অবশ্যই লিখতে হবে');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const created = await dbService.parties.create({
        name: name.trim(),
        phone: phone.trim() || '',
        address: address.trim() || 'চাঁচকৈড় মোকাম',
        party_type: partyType,
        opening_balance: parseSmartNumber(openingBalance) || 0,
        notes: notes.trim(),
      });
      onPartyCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'পার্টি তৈরিতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150 transition-colors">
        <div className="bg-emerald-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-base">নতুন পার্টি (বেপারী / মিলার / চাষী) যোগ করুন</h3>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              পার্টির ধরন (Role) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'SUPPLIER', label: 'বেপারী / সাপ্লায়ার' },
                { type: 'BUYER', label: 'মিলার / ক্রেতা' },
                { type: 'BOTH', label: 'উভয় (Both)' },
              ].map(opt => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setPartyType(opt.type as PartyType)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    partyType === opt.type
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              পার্টি / ব্যক্তির নাম <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: মোঃ জাহিদুল ইসলাম বেপারী"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              মোবাইল নম্বর (ঐচ্ছিক)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(toBengaliDigits(e.target.value))}
                placeholder="যেমন: 01712345678"
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ঠিকানা / গ্রাম / মোকাম
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="যেমন: চলনবিল, গুরুদাসপুর, নাটোর"
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              প্রারম্ভিক বকেয়া (টাকা)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(toBengaliDigits(e.target.value))}
              placeholder="পূর্বে কোনো টাকা পেলে বা দিলে লিখুন (নয়তো ০)"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-colors"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              (ধনাত্মক সংখ্যা = আমাদের পাওনা / দেনাদার, ঋণাত্মক সংখ্যা = পার্টির পাওনা / আমাদের দেনা)
            </p>
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
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

