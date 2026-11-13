import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Plus,
  Printer,
  X,
  Calendar,
  Edit2,
  Trash2,
  AlertTriangle,
  User,
  UserPlus,
  Phone,
  MapPin,
  ArrowRight,
  Search,
  CheckCircle2,
  DollarSign,
  Wallet,
  History,
  ShieldAlert,
  Pin,
  PinOff,
  MoreVertical,
} from 'lucide-react';
import { Party, LedgerEntry } from '../../types';
import { dbService } from '../../services/api';
import { toBnDigits, formatBanglaCurrency, formatDate, parseSmartNumber, toBengaliDigits, formatTaka, formatTakaBn } from '../../utils/bengaliNumbers';

export const PartyLedgerView: React.FC = () => {
  const [dues, setDues] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Collect Due Payment Modal (টাকা জমা নিন)
  const [payCustomer, setPayCustomer] = useState<Party | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // 2. Add Previous Due Modal (+ [আগের বকেয়া তুলুন])
  const [prevDueCustomer, setPreviousDueCustomer] = useState<Party | null>(null);
  const [prevDueDate, setPrevDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [prevDueDescription, setPrevDueDescription] = useState<string>('শস্য ক্রয় বাকি');
  const [prevDueAmount, setPrevDueAmount] = useState<string>('');
  const [prevDueSubmitting, setPrevDueSubmitting] = useState(false);

  // 3. Customer Statement Modal (লেজার স্টেটমেন্ট ও লেনদেন ইতিহাস)
  const [statementCustomer, setStatementCustomer] = useState<Party | null>(null);
  const [statementData, setStatementData] = useState<{
    party: Party;
    ledger: LedgerEntry[];
    sales: any[];
    payments: LedgerEntry[];
    invoices: LedgerEntry[];
    totalInflow: number;
    totalInvoices: number;
    openingDue: number;
    netDue: number;
  } | null>(null);
  const [customerEntries, setCustomerEntries] = useState<LedgerEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // 3-Dot Dropdown State & Pinning
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  // 4. New Customer Modal (নতুন গ্রাহক / বাকি খাতা এন্ট্রি)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const isNewModalOpen = isAddModalOpen;
  const setIsNewModalOpen = setIsAddModalOpen;
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newOpeningDue, setNewOpeningDue] = useState('0');
  const [newNotes, setNewNotes] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);

  // 5. Edit Customer Modal (সম্পাদনা)
  const [editCustomer, setEditCustomer] = useState<Party | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneError, setEditPhoneError] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // 6. Delete Customer Confirmation Modal (মুছুন)
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchParties = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dbService.parties.getAll('BUYER');
      setDues(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleCloseMenu = () => setActiveDropdownId(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // 1. Toggle Pin (সর্বোচ্চ ১০টি পিন নিশ্চিতকরণ)
  const handleTogglePin = async (party: Party) => {
    setActiveDropdownId(null);
    const isCurrentlyPinned = party.is_pinned === 1;

    // Check maximum 10 pins rule
    if (!isCurrentlyPinned) {
      const currentPinnedCount = dues.filter((d) => d.is_pinned === 1).length;
      if (currentPinnedCount >= 10) {
        alert('সর্বোচ্চ ১০টি হিসাব পিন করে রাখা যাবে');
        return;
      }
    }

    try {
      const nextPinState = isCurrentlyPinned ? 0 : 1;
      // Optimistic update with strict sorting hierarchy
      setDues((prev) => {
        const updated = prev.map((p) =>
          p.id === party.id
            ? { ...p, is_pinned: nextPinState, updated_at: new Date().toISOString() }
            : p
        );
        return [...updated].sort((a, b) => {
          if ((b.is_pinned || 0) !== (a.is_pinned || 0)) {
            return (b.is_pinned || 0) - (a.is_pinned || 0);
          }
          return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
        });
      });

      await dbService.parties.togglePin(party.id);
      await fetchParties();
    } catch (err: any) {
      alert(err.message || 'পিন আপডেট ব্যর্থ হয়েছে');
      await fetchParties();
    }
  };

  // Open Full-Featured Two-Column Statement
  const openCustomerStatement = async (customer: Party) => {
    setStatementCustomer(customer);
    setLoadingEntries(true);
    try {
      const res = await dbService.parties.getDetailedStatement(customer.id);
      if (res && res.party) {
        setStatementData(res);
        setCustomerEntries(res.ledger || []);
      } else {
        const entries = await dbService.ledgers.getByParty(customer.id);
        const payments = entries.filter((e) => e.credit > 0 || e.transaction_type === 'PAYMENT_RECEIVED');
        const invoices = entries.filter((e) => e.debit > 0 && e.transaction_type !== 'OPENING');
        setCustomerEntries(entries || []);
        setStatementData({
          party: customer,
          ledger: entries || [],
          sales: [],
          payments,
          invoices,
          totalInflow: payments.reduce((s, p) => s + (p.credit || 0), 0),
          totalInvoices: invoices.reduce((s, i) => s + (i.debit || 0), 0),
          openingDue: customer.opening_balance || 0,
          netDue: customer.current_balance,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEntries(false);
    }
  };

  // Delete Voucher from Statement
  const handleDeleteVoucher = async (voucherId: number, amount: number) => {
    if (!confirm(`আপনি কি এই জমার রেকর্ডটি (${formatTakaBn(amount, true)}) মুছে ফেলতে চান?\n\nএটি মুছে ফেললে উক্ত টাকা পুনরায় গ্রাহকের বকেয়া হিসেবে যোগ হবে।`)) {
      return;
    }
    try {
      const res = await dbService.parties.deleteVoucher(voucherId);
      alert(res.message || 'রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে');
      if (statementCustomer) {
        await openCustomerStatement(statementCustomer);
      }
      await fetchParties();
    } catch (err: any) {
      alert(`মুছতে ব্যর্থ: ${err.message}`);
    }
  };

  // 1. Submit Collect Payment (টাকা জমা নিন)
  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDate) {
      alert('অনুগ্রহ করে তারিখ নির্বাচন করুন।');
      return;
    }
    const amount = parseSmartNumber(paymentAmount);
    if (!payCustomer || amount <= 0) {
      alert('সঠিক জমার পরিমাণ উল্লেখ করুন (টাকা শূন্য বা ঋণাত্মক হতে পারবে না)।');
      return;
    }

    setSubmittingPayment(true);
    try {
      await dbService.ledgers.recordVoucher({
        entry_date: paymentDate,
        party_id: payCustomer.id,
        type: 'PAYMENT_RECEIVED',
        amount: amount,
        payment_mode: paymentMethod,
        description: paymentNotes.trim() || 'বকেয়া টাকা জমা / আদায়',
      });

      alert(`✅ ${formatTakaBn(amount, true)} টাকা জমা সফলভাবে সংরক্ষিত হয়েছে!`);
      setPayCustomer(null);
      setPaymentAmount('0');
      setPaymentNotes('');
      await fetchParties();
      if (statementCustomer && statementCustomer.id === payCustomer.id) {
        const updated = await dbService.parties.getById(payCustomer.id);
        if (updated) openCustomerStatement(updated);
      }
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // 2. Submit Previous Due (+ [আগের বকেয়া তুলুন])
  const handleAddPreviousDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prevDueDate) {
      alert('অনুগ্রহ করে তারিখ নির্বাচন করুন।');
      return;
    }
    const amount = parseSmartNumber(prevDueAmount);
    if (!prevDueCustomer || amount <= 0) {
      alert('সঠিক বকেয়া টাকার পরিমাণ উল্লেখ করুন (টাকা শূন্য বা ঋণাত্মক হতে পারবে না)।');
      return;
    }

    setPrevDueSubmitting(true);
    try {
      await dbService.parties.adjustDue({
        party_id: prevDueCustomer.id,
        amount: amount,
        entry_date: prevDueDate,
        description: prevDueDescription.trim() || 'পূর্বের বকেয়া হিসাব সংযোজন',
      });

      alert(`✅ পূর্বের বকেয়া ${formatTakaBn(amount, true)} টাকা সফলভাবে যুক্ত হয়েছে!`);
      setPreviousDueCustomer(null);
      setPrevDueAmount('');
      await fetchParties();
      if (statementCustomer && statementCustomer.id === prevDueCustomer.id) {
        const updated = await dbService.parties.getById(prevDueCustomer.id);
        if (updated) openCustomerStatement(updated);
      }
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setPrevDueSubmitting(false);
    }
  };

  // 4. Submit New Customer (নতুন গ্রাহক / বাকি খাতা এন্ট্রি)
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    if (!newName.trim()) {
      alert('ক্রেতা / প্রতিষ্ঠানের নাম আবশ্যক');
      return;
    }

    // Optional 11-digit mobile number validation (only validate if phone is provided)
    const trimmedPhone = newPhone.trim();
    if (trimmedPhone) {
      const bnDigits = '০১২৩৪৫৬৭৮৯';
      const enPhone = trimmedPhone.replace(/[০-৯]/g, (d) => bnDigits.indexOf(d).toString()).replace(/\D/g, '');
      const isValidPhone =
        (enPhone.length === 11 && enPhone.startsWith('01')) ||
        (enPhone.length === 13 && enPhone.startsWith('8801'));

      if (!isValidPhone) {
        setPhoneError('সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন (যেমন: ০১৭১২-৩৪৫৬৭৮)');
        return;
      }
    }

    setSubmittingNew(true);
    try {
      const openBal = parseSmartNumber(newOpeningDue) || 0;
      const createdParty = await dbService.parties.create({
        name: newName.trim(),
        phone: trimmedPhone,
        address: newAddress.trim() || 'চাঁচকৈড় বাজার, গুরুদাসপুর, নাটোর',
        party_type: 'BUYER',
        opening_balance: openBal,
        notes: newNotes.trim(),
      });

      // Immediate zero-latency UI update
      if (createdParty && createdParty.id) {
        setDues((prev) => [createdParty, ...prev.filter((p) => p.id !== createdParty.id)]);
      }

      setIsAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewOpeningDue('0');
      setNewNotes('');
      setPhoneError('');

      await fetchParties();
    } catch (err: any) {
      alert(`সংরক্ষণ ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setSubmittingNew(false);
    }
  };

  // 5. Submit Edit Customer (সম্পাদনা)
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditPhoneError('');

    if (!editCustomer) return;
    if (!editName.trim()) {
      alert('ক্রেতার নাম আবশ্যক');
      return;
    }

    // Optional 11-digit mobile validation (only validate if phone is provided)
    const trimmedEditPhone = editPhone.trim();
    if (trimmedEditPhone) {
      const bnDigits = '০১২৩৪৫৬৭৮৯';
      const enPhone = trimmedEditPhone.replace(/[০-৯]/g, (d) => bnDigits.indexOf(d).toString()).replace(/\D/g, '');
      const isValidPhone =
        (enPhone.length === 11 && enPhone.startsWith('01')) ||
        (enPhone.length === 13 && enPhone.startsWith('8801'));

      if (!isValidPhone) {
        setEditPhoneError('সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন (যেমন: ০১৭১২-৩৪৫৬৭৮)');
        return;
      }
    }

    setSubmittingEdit(true);
    try {
      await dbService.parties.update(editCustomer.id, {
        name: editName.trim(),
        phone: trimmedEditPhone,
        address: editAddress.trim(),
      });

      // Immediate optimistic update of the party row in table
      setDues((prev) =>
        prev.map((p) =>
          p.id === editCustomer.id
            ? { ...p, name: editName.trim(), phone: trimmedEditPhone, address: editAddress.trim() }
            : p
        )
      );

      alert('ক্রেতার তথ্য সফলভাবে আপডেট হয়েছে!');
      setEditCustomer(null);
      await fetchParties();
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // 6. Submit Delete Customer (মুছুন)
  const handleConfirmDelete = async () => {
    if (!deleteTargetCustomer) return;

    setDeleting(true);
    try {
      const res = await dbService.parties.delete(deleteTargetCustomer.id);
      alert(res.message);
      setDeleteTargetCustomer(null);
      if (statementCustomer?.id === deleteTargetCustomer.id) {
        setStatementCustomer(null);
      }
      await fetchParties();
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Calculations
  const totalOutstanding = dues.reduce((sum, d) => sum + (Number(d.current_balance) || 0), 0);

  const filteredDues = dues.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.phone && d.phone.includes(q)) ||
      (d.address && d.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-2 sm:p-4 space-y-4 max-w-[1550px] mx-auto w-full text-[var(--text-primary)]">
      {/* 1. Top Header & Summary */}
      <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border-color)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/30">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">বাকি খাতা (গ্রাহক খতিয়ান, সংশোধন ও আদায়)</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              মোট অনাদায়ী বাকি: <strong className="text-orange-400 font-bold font-mono text-sm">{formatTakaBn(totalOutstanding, true)}</strong> ({toBnDigits(dues.length)} জন ক্রেতা)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dbService.system.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--surface-secondary)] hover:bg-slate-200 dark:hover:bg-[#334155] text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-[var(--border-color)] transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>খতিয়ান প্রিন্ট</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPhoneError('');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-95 select-none"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন বাকি খাতা এন্ট্রি</span>
          </button>
        </div>
      </div>

      {/* 2. Live Search Bar */}
      <div className="bg-[var(--surface)] rounded-2xl shadow-sm border border-[var(--border-color)] p-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 ক্রেতার নাম, মোবাইল নম্বর বা ঠিকানা দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Customer Ledger Table (গ্রাহক খতিয়ান টেবিল) */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-color)] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">ক্রেতার নাম ও প্রতিষ্ঠান</th>
                <th className="py-3 px-4">মোবাইল নম্বর</th>
                <th className="py-3 px-4">ঠিকানা</th>
                <th className="py-3 px-4 text-right">প্রারম্ভিক বাকি (৳)</th>
                <th className="py-3 px-4 text-right">বর্তমান মোট বাকি (৳)</th>
                <th className="py-3 px-4 text-right">সর্বশেষ আদায় (৳)</th>
                <th className="py-3 px-4 text-center">ব্যবস্থাপনা ও অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#162231]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredDues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {searchQuery ? (
                      <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">কোনো ক্রেতার হিসাব পাওয়া যায়নি।</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">অনুগ্রহ করে ভিন্ন কোনো নাম বা নম্বর দিয়ে খুঁজুন।</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <p className="text-slate-700 dark:text-slate-300 font-semibold">কোনো গ্রাহকের হিসাব পাওয়া যায়নি।</p>
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneError('');
                            setIsAddModalOpen(true);
                          }}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-md text-xs active:scale-95 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ নতুন বাকি খাতা এন্ট্রি</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredDues.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 flex-wrap">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{d.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(d);
                          }}
                          className={`p-0.5 rounded transition-colors ${
                            d.is_pinned === 1
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-slate-400 hover:text-amber-500 opacity-60 hover:opacity-100'
                          }`}
                          title={d.is_pinned === 1 ? 'আনপিন করুন' : 'উপরে পিন করুন'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        {d.is_pinned === 1 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-xs animate-in fade-in duration-200">
                            <span>পিন করা</span>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openCustomerStatement(d)}
                        className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline font-semibold mt-0.5 flex items-center gap-1 cursor-pointer"
                      >
                        <span>লেজার স্টেটমেন্ট ও লেনদেন ইতিহাস</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {d.phone && d.phone.trim() ? (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{d.phone}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {d.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{d.address}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300 font-semibold">
                      {formatTakaBn(d.opening_balance || 0, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-black font-mono text-rose-600 dark:text-rose-400 text-sm">
                      {formatTakaBn(d.current_balance, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {(d as any).last_payment ? formatTakaBn((d as any).last_payment, true) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* ১. টাকা জমা (সবুজ বাটন - Receive Payment Modal) */}
                        <button
                          type="button"
                          onClick={() => {
                            setPayCustomer(d);
                            setPaymentAmount(String(d.current_balance > 0 ? d.current_balance : 0));
                            setPaymentMethod('CASH');
                            setPaymentDate(new Date().toISOString().split('T')[0]);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs transition-all text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          title="টাকা জমা নিন"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>টাকা জমা</span>
                        </button>

                        {/* ২. বকেয়া তুলুন (হলুদ/অরেঞ্জ বাটন - Add Previous/New Due Modal) */}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviousDueCustomer(d);
                            setPrevDueDate(new Date().toISOString().split('T')[0]);
                            setPrevDueDescription('শস্য ক্রয় বাকি');
                            setPrevDueAmount('');
                          }}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-xs transition-all text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          title="আগের বকেয়া হিসাব তুলুন"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>বকেয়া তুলুন</span>
                        </button>

                        {/* ৩. সম্পাদনা (নীল বাটন - Edit Details Modal) */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditCustomer(d);
                            setEditName(d.name);
                            setEditPhone(d.phone || '');
                            setEditAddress(d.address || '');
                            setEditPhoneError('');
                          }}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-xs transition-all text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          title="খতিয়ান বিবরণ সম্পাদনা"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>

                        {/* ৪. মুছুন (লাল বাটন - কনফার্মেশন সহ খতিয়ান মুছে ফেলা) */}
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTargetCustomer(d);
                          }}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-xs transition-all text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                          title="খতিয়ান ও পার্টি রেকর্ড মুছুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>মুছুন</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD PREVIOUS DUE (+ আগের বকেয়া তুলুন)             */}
      {/* ======================================================== */}
      {prevDueCustomer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>+ আগের বকেয়া হিসাব তুলুন</span>
              </h3>
              <button
                onClick={() => setPreviousDueCustomer(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">{prevDueCustomer.name}</div>
              <div className="text-[11px] text-amber-700 dark:text-amber-300">
                বর্তমান বকেয়া: {formatTakaBn(prevDueCustomer.current_balance, true)}
              </div>
            </div>

            <form onSubmit={handleAddPreviousDue} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">তারিখ *</label>
                <input
                  type="date"
                  value={prevDueDate}
                  onChange={(e) => setPrevDueDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">বিবরণ / কারণ</label>
                <input
                  type="text"
                  value={prevDueDescription}
                  onChange={(e) => setPrevDueDescription(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">বকেয়া টাকার পরিমাণ (৳) *</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="যেমন: ২৫০০০"
                  value={prevDueAmount}
                  onChange={(e) => setPrevDueAmount(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-amber-600 dark:text-amber-400 font-bold font-mono text-base outline-none focus:ring-2 focus:ring-amber-500 text-right"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPreviousDueCustomer(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={prevDueSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-md disabled:opacity-50"
                >
                  {prevDueSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'বকেয়া যুক্ত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 2: COLLECT PAYMENT (টাকা জমা নিন)                   */}
      {/* ======================================================== */}
      {payCustomer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span>টাকা জমা নিন (আদায় ভাউচার)</span>
              </h3>
              <button
                onClick={() => setPayCustomer(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">{payCustomer.name}</div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                বর্তমান মোট বকেয়া: {formatTakaBn(payCustomer.current_balance, true)}
              </div>
            </div>

            <form onSubmit={handleCollectPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">তারিখ *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">পেমেন্ট মাধ্যম</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 rounded-lg font-bold border transition-colors ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    ক্যাশ (নগদ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`py-2 rounded-lg font-bold border transition-colors ${
                      paymentMethod === 'BANK'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    ব্যাংক / অনলাইন
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">জমার পরিমাণ (৳) *</label>
                <input
                  type="text"
                  autoFocus
                  value={paymentAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setPaymentAmount(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-emerald-600 dark:text-emerald-400 font-bold font-mono text-base outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মন্তব্য / নোট</label>
                <input
                  type="text"
                  placeholder="যেমন: চেক নং বা নগদ প্রদান..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayCustomer(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg shadow-md disabled:opacity-50"
                >
                  {submittingPayment ? 'সংরক্ষণ হচ্ছে...' : 'টাকা জমা নিন'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 3: TRADITIONAL TWO-COLUMN KHOTIAN STATEMENT MODAL   */}
      {/* ======================================================== */}
      {statementCustomer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-6xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* 1. Header */}
            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-blue-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl border border-blue-500/30 shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg truncate">
                      {statementCustomer.name} — খতিয়ান লেজার হিসাব
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setEditCustomer(statementCustomer);
                        setEditName(statementCustomer.name);
                        setEditPhone(statementCustomer.phone || '');
                        setEditAddress(statementCustomer.address || '');
                        setEditPhoneError('');
                      }}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 transition-all cursor-pointer"
                      title="গ্রাহকের তথ্য সম্পাদনা"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>সম্পাদনা</span>
                    </button>
                    {statementCustomer.is_pinned === 1 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                        📌 পিন করা
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                    মোবাইল: <strong className="text-slate-800 dark:text-slate-200 font-mono">{statementCustomer.phone && statementCustomer.phone.trim() ? statementCustomer.phone : '-'}</strong> &bull; ঠিকানা: <strong className="text-slate-800 dark:text-slate-200">{statementCustomer.address || 'চাঁচকৈড় বাজার, গুরুদাসপুর'}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => dbService.system.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="সম্পূর্ণ খতিয়ান প্রিন্ট করুন"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>🖨️ খতিয়ান প্রিন্ট</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementCustomer(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="বন্ধ করুন"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. Top 4 Balance Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-slate-600 dark:text-slate-400 block font-semibold">প্রারম্ভিক বকেয়া</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-base mt-1 block">
                  {formatTakaBn(statementData?.openingDue ?? statementCustomer.opening_balance ?? 0, true)}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-500/30">
                <span className="text-blue-700 dark:text-blue-300 block font-semibold">মোট ক্রয় (চালান)</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-base mt-1 block">
                  {formatTakaBn(statementData?.totalInvoices ?? 0, true)}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-700 dark:text-emerald-300 block font-semibold">মোট জমা (পরিশোধ)</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base mt-1 block">
                  {formatTakaBn(statementData?.totalInflow ?? 0, true)}
                </span>
              </div>
              <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 rounded-xl shadow-md border-2 border-amber-300">
                <span className="text-slate-950 block font-black text-xs uppercase tracking-wide">বর্তমান নীট বাকি</span>
                <span className="font-mono font-black text-slate-950 text-lg mt-0.5 block">
                  {formatTakaBn(statementData?.netDue ?? statementCustomer.current_balance ?? 0, true)}
                </span>
              </div>
            </div>

            {/* 3. Traditional Dual Side-by-Side Tables */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Side: জমা / পরিশোধ (Cash Received) */}
                <div className="bg-white dark:bg-slate-900 border border-emerald-500/40 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:via-emerald-900 dark:to-emerald-950 border-b border-emerald-500/40 px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                      <h4 className="font-bold text-emerald-900 dark:text-emerald-300">জমা / পরিশোধ (Cash Received)</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      {toBnDigits(statementData?.payments.length || 0)} টি এন্ট্রি
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[380px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">তারিখ</th>
                          <th className="py-2.5 px-3">রশিদ নং / মাধ্যম</th>
                          <th className="py-2.5 px-3 text-right">জমার পরিমাণ (৳)</th>
                          <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {loadingEntries ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-400">লোড হচ্ছে...</td></tr>
                        ) : !statementData || statementData.payments.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-500">কোনো জমার এন্ট্রি নেই</td></tr>
                        ) : (
                          statementData.payments.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(p.entry_date)}</td>
                              <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                                <div>{p.description || p.reference_no || 'ক্যাশ জমা'}</div>
                                {p.reference_no && <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{p.reference_no}</div>}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {formatTakaBn(p.credit || 0, true)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVoucher(p.id, p.credit || 0)}
                                  className="p-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-500/20 rounded transition-colors cursor-pointer"
                                  title="জমার রেকর্ড বাতিল / মুছুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-emerald-50 dark:bg-emerald-950/80 border-t-2 border-emerald-500 text-emerald-900 dark:text-emerald-200 px-4 py-2.5 font-bold flex items-center justify-between text-xs">
                    <span>মোট জমা:</span>
                    <span className="font-mono text-sm text-emerald-700 dark:text-emerald-300 font-black">
                      = {formatTakaBn(statementData?.totalInflow || 0, true)}
                    </span>
                  </div>
                </div>

                {/* Right Side: খরচ বা ক্রয় / চালান (Invoices & Dues) */}
                <div className="bg-white dark:bg-slate-900 border border-blue-500/40 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:via-blue-900 dark:to-blue-950 border-b border-blue-500/40 px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse"></span>
                      <h4 className="font-bold text-blue-900 dark:text-blue-300">খরচ বা ক্রয় / চালান (Invoices & Dues)</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-300 text-[10px] font-bold border border-blue-500/30">
                      {toBnDigits(statementData?.invoices.length || 0)} টি চালান
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[380px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">তারিখ</th>
                          <th className="py-2.5 px-3">চালান নং / আইটেম বিবরণ</th>
                          <th className="py-2.5 px-3 text-right">মোট বিল (৳)</th>
                          <th className="py-2.5 px-3 text-center">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {loadingEntries ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-400">লোড হচ্ছে...</td></tr>
                        ) : !statementData || statementData.invoices.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-500">কোনো ক্রয়ের চালান নেই</td></tr>
                        ) : (
                          statementData.invoices.map((inv) => {
                            const matchingSale = statementData.sales?.find((s: any) => s.invoice_no === inv.reference_no);
                            return (
                              <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(inv.entry_date)}</td>
                                <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                                  <div className="font-semibold text-blue-600 dark:text-blue-300 font-mono">{inv.reference_no || 'চালান'}</div>
                                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                                    {matchingSale
                                      ? `${matchingSale.commodity_name_bn || 'শস্য'} • ${toBnDigits(matchingSale.net_weight_mon || 0)} মণ`
                                      : inv.description}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                  {formatTakaBn(inv.debit || 0, true)}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span className="text-[10px] text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono">
                                    {inv.transaction_type === 'SALE' ? 'চালান' : inv.transaction_type === 'ADJUSTMENT' ? 'পূর্বের বাকি' : inv.transaction_type}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/80 border-t-2 border-blue-500 text-blue-900 dark:text-blue-200 px-4 py-2.5 font-bold flex items-center justify-between text-xs">
                    <span>মোট ক্রয়:</span>
                    <span className="font-mono text-sm text-blue-700 dark:text-blue-300 font-black">
                      = {formatTakaBn(statementData?.totalInvoices || 0, true)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Modal Footer Equation Bar */}
            <div className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap font-medium text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">প্রারম্ভিক বকেয়া:</span>
                <strong className="text-slate-900 dark:text-white font-mono">{formatTakaBn(statementData?.openingDue || 0, true)}</strong>
                <span className="text-amber-500 dark:text-amber-400 font-bold">+</span>
                <span className="text-blue-600 dark:text-blue-300">মোট ক্রয়:</span>
                <strong className="text-blue-600 dark:text-blue-400 font-mono">{formatTakaBn(statementData?.totalInvoices || 0, true)}</strong>
                <span className="text-emerald-500 dark:text-emerald-400 font-bold">-</span>
                <span className="text-emerald-600 dark:text-emerald-300">মোট জমা:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatTakaBn(statementData?.totalInflow || 0, true)}</strong>
                <span className="text-slate-500 dark:text-slate-400 font-bold">=</span>
                <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold inline-flex items-center gap-1.5 shadow-xs">
                  <span>বর্তমান নীট বাকি:</span>
                  <span className="font-mono font-black text-sm">{formatTakaBn(statementData?.netDue || 0, true)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => dbService.system.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>🖨️ খতিয়ান প্রিন্ট করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementCustomer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 4: NEW CUSTOMER (নতুন গ্রাহক / বাকি খাতা এন্ট্রি)    */}
      {/* ======================================================== */}
      {isAddModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 my-auto relative animate-in zoom-in-95 duration-150 text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-orange-500" />
                <span>নতুন গ্রাহক / বাকি খাতা এন্ট্রি</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  ক্রেতা / প্রতিষ্ঠানের নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="যেমন: মোঃ রফিকুল ইসলাম বা জনতা ট্রেডার্স"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium text-xs outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  মোবাইল নম্বর (ঐচ্ছিক)
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal ml-1.5">(১১ ডিজিট)</span>
                </label>
                <input
                  type="tel"
                  maxLength={15}
                  placeholder="যেমন: ০১৭১২-৩৪৫৬৭৮ (ঐচ্ছিক)"
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(toBengaliDigits(e.target.value));
                    if (phoneError) setPhoneError('');
                  }}
                  className={`w-full bg-white dark:bg-slate-800 border rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono font-medium text-xs outline-none transition-all ${
                    phoneError ? 'border-rose-500 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-orange-500'
                  }`}
                />
                {phoneError && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{phoneError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ঠিকানা (গ্রাম / বাজার / থানা)</label>
                <input
                  type="text"
                  placeholder="যেমন: চাঁচকৈড় বাজার, গুরুদাসপুর, নাটোর"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  প্রারম্ভিক বকেয়া (৳)
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal ml-1.5">(যদি পূর্বের কোনো বাকি থেকে থাকে, ডিফল্ট: 0)</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={newOpeningDue}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewOpeningDue(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-orange-600 dark:text-orange-400 font-bold font-mono text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মন্তব্য / রেফারেন্স (ঐচ্ছিক)</label>
                <input
                  type="text"
                  placeholder="যেমন: পুরাতন খাতার জের বা পরিচিতির বিবরণ..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-xs transition-colors"
                >
                  <span>💾</span>
                  <span>{submittingNew ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 5: EDIT CUSTOMER (সম্পাদনা)                         */}
      {/* ======================================================== */}
      {editCustomer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>ক্রেতার তথ্য সম্পাদনা</span>
              </h3>
              <button onClick={() => setEditCustomer(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ক্রেতার নাম *</label>
                <input
                  type="text"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  মোবাইল নম্বর (ঐচ্ছিক)
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal ml-1.5">(১১ ডিজিট)</span>
                </label>
                <input
                  type="tel"
                  maxLength={15}
                  placeholder="যেমন: ০১৭১২-৩৪৫৬৭৮ (ঐচ্ছিক)"
                  value={editPhone}
                  onChange={(e) => {
                    setEditPhone(toBengaliDigits(e.target.value));
                    if (editPhoneError) setEditPhoneError('');
                  }}
                  className={`w-full bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono text-xs outline-none transition-all ${
                    editPhoneError ? 'border-rose-500 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500'
                  }`}
                />
                {editPhoneError && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{editPhoneError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ঠিকানা / মোকাম</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditCustomer(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-md disabled:opacity-50"
                >
                  {submittingEdit ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 6: DELETE CUSTOMER (নিরাপদ মোছা)                     */}
      {/* ======================================================== */}
      {deleteTargetCustomer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 my-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">ক্রেতার হিসাব মুছবেন?</h3>
                <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">
                  {deleteTargetCustomer.name} (বাকি: {formatTakaBn(deleteTargetCustomer.current_balance, true)})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              সতর্কতা: যদি এই গ্রাহকের পূর্বে কোনো বিক্রয় বা ক্রয়ের ইতিহাস থাকে, তবে ডাটাবেসের ইন্টিগ্রিটি রক্ষার্থে তার অ্যাকাউন্টটি আর্কাইভ/নিষ্ক্রিয় করা হবে। আপনি কি নিশ্চিত?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetCustomer(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-xs"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-md disabled:opacity-50 text-xs"
              >
                {deleting ? 'মুছে ফেলা হচ্ছে...' : 'হ্যাঁ, নিশ্চিত মুছুন'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
