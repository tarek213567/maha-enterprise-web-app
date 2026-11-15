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
  Users,
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
  HandCoins,
  Coins,
  CreditCard,
  Building,
  Lock,
} from 'lucide-react';
import { Party, LedgerEntry } from '../../types';
import { dbService } from '../../services/api';
import {
  toBnDigits,
  formatBanglaCurrency,
  formatDate,
  parseSmartNumber,
  toBengaliDigits,
  toEnglishDigits,
  formatTaka,
  formatTakaBn,
} from '../../utils/bengaliNumbers';
import { CreditorExcelImportModal } from '../common/CreditorExcelImportModal';
import { ENABLE_EXCEL_IMPORT, EXCEL_IMPORT_LOCKED_MESSAGE } from '../../config/featureFlags';

export const CreditorLedgerView: React.FC = () => {
  const [creditors, setCreditors] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

  // 1. Pay Creditor Modal (টাকা পরিশোধ)
  const [payCreditor, setPayCreditor] = useState<Party | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // 2. Add Payable Due Modal (+ পাওনা যোগ)
  const [prevDueCreditor, setPrevDueCreditor] = useState<Party | null>(null);
  const [prevDueDate, setPrevDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [prevDueDescription, setPrevDueDescription] = useState<string>('শস্য ক্রয় বাকি');
  const [prevDueAmount, setPrevDueAmount] = useState<string>('');
  const [prevDueSubmitting, setPrevDueSubmitting] = useState(false);

  // 3. Creditor Statement Modal (লেজার স্টেটমেন্ট ও লেনদেন ইতিহাস)
  const [statementCreditor, setStatementCreditor] = useState<Party | null>(null);
  const [statementData, setStatementData] = useState<{
    party: Party;
    ledger: LedgerEntry[];
    purchases: any[];
    payments: LedgerEntry[];
    invoices: LedgerEntry[];
    totalPaid: number;
    totalPurchases: number;
    openingDue: number;
    netDue: number;
  } | null>(null);
  const [creditorEntries, setCreditorEntries] = useState<LedgerEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Royal Excel Ledger State
  const [statementViewMode, setStatementViewMode] = useState<'EXCEL' | 'COLUMNS'>('EXCEL');
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  const [partyNoteText, setPartyNoteText] = useState<string>('');
  const [savingPartyNote, setSavingPartyNote] = useState<boolean>(false);
  const [editingLedgerId, setEditingLedgerId] = useState<number | null>(null);
  const [editLedgerDate, setEditLedgerDate] = useState<string>('');
  const [editLedgerDesc, setEditLedgerDesc] = useState<string>('');
  const [editLedgerDebit, setEditLedgerDebit] = useState<string>('0');
  const [editLedgerCredit, setEditLedgerCredit] = useState<string>('0');
  const [editLedgerNotes, setEditLedgerNotes] = useState<string>('');
  const [savingLedgerRow, setSavingLedgerRow] = useState<boolean>(false);

  // 3-Dot Dropdown State & Pinning
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  // 4. New Creditor Modal (নতুন পাওনাদার এন্ট্রি)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newOpeningPayable, setNewOpeningPayable] = useState('0');
  const [newNotes, setNewNotes] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submittingNew, setSubmittingNew] = useState(false);

  // 5. Edit Creditor Modal (সম্পাদনা)
  const [editCreditor, setEditCreditor] = useState<Party | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneError, setEditPhoneError] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // 6. Delete Creditor Confirmation Modal (মুছুন)
  const [deleteTargetCreditor, setDeleteTargetCreditor] = useState<Party | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCreditors = useCallback(async () => {
    try {
      setLoading(true);
      const data = await dbService.parties.getAll('SUPPLIER');
      setCreditors(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreditors();
  }, [fetchCreditors]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleCloseMenu = () => setActiveDropdownId(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Live Bengali Clock & Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setCurrentDateTime(`${dateStr}, ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Toggle Pin
  const handleTogglePin = async (party: Party) => {
    setActiveDropdownId(null);
    const isCurrentlyPinned = party.is_pinned === 1;

    if (!isCurrentlyPinned) {
      const currentPinnedCount = creditors.filter((d) => d.is_pinned === 1).length;
      if (currentPinnedCount >= 10) {
        alert('সর্বোচ্চ ১০টি হিসাব পিন করে রাখা যাবে');
        return;
      }
    }

    try {
      const nextPinState = isCurrentlyPinned ? 0 : 1;
      setCreditors((prev) => {
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
      await fetchCreditors();
    } catch (err: any) {
      alert(err.message || 'পিন আপডেট ব্যর্থ হয়েছে');
      await fetchCreditors();
    }
  };

  // Open Royal Excel Statement for Creditor
  const openCreditorStatement = async (creditor: Party) => {
    setStatementCreditor(creditor);
    setPartyNoteText(creditor.notes || '');
    setEditingLedgerId(null);
    setLoadingEntries(true);
    try {
      const res = await dbService.parties.getDetailedStatement(creditor.id);
      if (res && res.party) {
        const safeEntries = res.ledger || [];
        const payments = safeEntries.filter((e: LedgerEntry) => (e.debit || 0) > 0 || e.transaction_type === 'PAYMENT_GIVEN');
        const purchases = safeEntries.filter((e: LedgerEntry) => (e.credit || 0) > 0 && e.transaction_type !== 'OPENING');
        const totalPaid = payments.reduce((s: number, p: LedgerEntry) => s + (p.debit || 0), 0);
        const totalPurchases = purchases.reduce((s: number, p: LedgerEntry) => s + (p.credit || 0), 0);

        setCreditorEntries(safeEntries);
        setStatementData({
          party: creditor,
          ledger: safeEntries,
          purchases: res.purchases || [],
          payments,
          invoices: purchases,
          totalPaid,
          totalPurchases,
          openingDue: Math.abs(creditor.opening_balance || 0),
          netDue: Math.abs(creditor.current_balance || 0),
        });
      } else {
        const entries = await dbService.ledgers.getByParty(creditor.id);
        const safeEntries = entries || [];
        const payments = safeEntries.filter((e) => (e.debit || 0) > 0 || e.transaction_type === 'PAYMENT_GIVEN');
        const purchases = safeEntries.filter((e) => (e.credit || 0) > 0 && e.transaction_type !== 'OPENING');
        const totalPaid = payments.reduce((s, p) => s + (p.debit || 0), 0);
        const totalPurchases = purchases.reduce((s, p) => s + (p.credit || 0), 0);

        setCreditorEntries(safeEntries);
        setStatementData({
          party: creditor,
          ledger: safeEntries,
          purchases: [],
          payments,
          invoices: purchases,
          totalPaid,
          totalPurchases,
          openingDue: Math.abs(creditor.opening_balance || 0),
          netDue: Math.abs(creditor.current_balance || 0),
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEntries(false);
    }
  };

  // Submit Payment to Creditor (💸 টাকা পরিশোধ)
  const handlePayCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDate) {
      alert('অনুগ্রহ করে তারিখ নির্বাচন করুন।');
      return;
    }
    const amount = parseSmartNumber(paymentAmount);
    if (!payCreditor || amount <= 0) {
      alert('সঠিক পরিশোধের পরিমাণ উল্লেখ করুন।');
      return;
    }

    setSubmittingPayment(true);
    try {
      await dbService.ledgers.recordVoucher({
        entry_date: paymentDate,
        party_id: payCreditor.id,
        type: 'PAYMENT_GIVEN',
        amount: amount,
        payment_mode: paymentMethod,
        description: paymentNotes.trim() || 'পাওনাদার নগদ পরিশোধ',
      });

      setPayCreditor(null);
      setPaymentAmount('0');
      setPaymentNotes('');
      await fetchCreditors();
    } catch (err: any) {
      alert(`পরিশোধ ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Submit Add Due to Creditor (+ পাওনা যোগ)
  const handleAddDueCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseSmartNumber(prevDueAmount);
    if (!prevDueCreditor || amount <= 0) {
      alert('সঠিক পাওনার পরিমাণ উল্লেখ করুন।');
      return;
    }

    setPrevDueSubmitting(true);
    try {
      await dbService.parties.adjustDue({
        party_id: prevDueCreditor.id,
        amount: -amount, // Negative to increase payable for supplier
        entry_date: prevDueDate,
        description: prevDueDescription.trim() || 'অতিরিক্ত পাওনা সমন্বয়',
      });

      setPrevDueCreditor(null);
      setPrevDueAmount('');
      setPrevDueDescription('শস্য ক্রয় বাকি');
      await fetchCreditors();
    } catch (err: any) {
      alert(`পাওনা যোগ ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setPrevDueSubmitting(false);
    }
  };

  // Submit Create New Creditor
  const handleCreateCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('পাওনাদারের নাম অবশ্যই দিতে হবে।');
      return;
    }

    setSubmittingNew(true);
    try {
      const openPayable = parseSmartNumber(newOpeningPayable);
      await dbService.parties.create({
        name: newName.trim(),
        phone: newPhone.trim(),
        address: newAddress.trim() || 'চাচকৈড় বাজার',
        party_type: 'SUPPLIER',
        opening_balance: -Math.abs(openPayable), // Negative indicates shop owes them
        current_balance: -Math.abs(openPayable),
        notes: newNotes.trim(),
      });

      setIsAddModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setNewOpeningPayable('0');
      setNewNotes('');
      await fetchCreditors();
    } catch (err: any) {
      alert(`পাওনাদার তৈরিতে সমস্যা হয়েছে: ${err.message}`);
    } finally {
      setSubmittingNew(false);
    }
  };

  // Submit Edit Creditor
  const handleEditCreditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCreditor || !editName.trim()) return;

    setSubmittingEdit(true);
    try {
      await dbService.parties.update(editCreditor.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
      });

      setEditCreditor(null);
      await fetchCreditors();
    } catch (err: any) {
      alert(`সম্পাদনা ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Creditor (Move to Recycle Bin)
  const handleDeleteCreditor = async () => {
    if (!deleteTargetCreditor) return;
    setDeleting(true);
    try {
      await dbService.parties.delete(deleteTargetCreditor.id);
      setDeleteTargetCreditor(null);
      await fetchCreditors();
    } catch (err: any) {
      alert(`মুছতে ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // Save Party Note inside Statement Modal
  const handleSavePartyNotes = async () => {
    if (!statementCreditor) return;
    setSavingPartyNote(true);
    try {
      await dbService.parties.update(statementCreditor.id, { notes: partyNoteText });
      setStatementCreditor((prev) => (prev ? { ...prev, notes: partyNoteText } : null));
    } catch (err: any) {
      alert(err.message || 'নোট সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setSavingPartyNote(false);
    }
  };

  // Filtered Creditors List
  const filteredCreditors = creditors.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q))
    );
  });

  // KPI Calculations:
  // For suppliers, current_balance < 0 means shop owes them (payable).
  const totalCreditorsCount = creditors.length;
  const totalPayableAmount = creditors.reduce((sum, p) => {
    const bal = p.current_balance || 0;
    return sum + (bal < 0 ? Math.abs(bal) : 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <HandCoins className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-amber-300 tracking-wide">
                  পাওনাদার খাতা ও মহাজন লেজার
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  {toBnDigits(totalCreditorsCount)} জন মহাজন
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-0.5">
                যাদের নিকট হতে বাকিতে শস্য ক্রয় করা হয়েছে বা যারা টাকা পাবেন তাদের সম্পূর্ণ হিসাব ও পরিশোধ বিবরণী
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!ENABLE_EXCEL_IMPORT) {
                  alert(EXCEL_IMPORT_LOCKED_MESSAGE);
                  return;
                }
                setIsExcelImportOpen(true);
              }}
              className={
                ENABLE_EXCEL_IMPORT
                  ? "px-3.5 py-2 text-xs font-bold text-teal-950 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  : "px-3.5 py-2 text-xs font-bold bg-slate-800/70 text-slate-400 opacity-60 cursor-not-allowed border border-slate-600/60 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
              }
              title={ENABLE_EXCEL_IMPORT ? "পূর্বের মহাজন এক্সেল ফাইল ইমপোর্ট করুন" : EXCEL_IMPORT_LOCKED_MESSAGE}
            >
              {ENABLE_EXCEL_IMPORT ? (
                <FileSpreadsheet className="w-4 h-4" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{ENABLE_EXCEL_IMPORT ? '📥 স্মার্ট এক্সেল ইমপোর্ট' : '🔒 এক্সেল ইমপোর্ট (লক করা)'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>🖨️ খতিয়ান প্রিন্ট</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ নতুন পাওনাদার / পাওনা এন্ট্রি</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Summary Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">মোট পাওনাদার সংখ্যা</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">
              {toBnDigits(totalCreditorsCount)} <span className="text-xs font-normal">জন</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">মোট বকেয়া পাওনা (দেনা)</div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {formatTakaBn(totalPayableAmount, true)}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">গড় পাওনা প্রতি মহাজন</div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatTakaBn(totalCreditorsCount > 0 ? totalPayableAmount / totalCreditorsCount : 0, true)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="পাওনাদারের নাম, মোবাইল নম্বর বা মোকাম দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          প্রদর্শিত হচ্ছে: <b>{toBnDigits(filteredCreditors.length)}</b> জন
        </div>
      </div>

      {/* 4. Creditors Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white font-bold select-none text-[11px]">
              <tr>
                <th className="py-3 px-4 w-10 text-center">#</th>
                <th className="py-3 px-4">পাওনাদারের নাম ও প্রতিষ্ঠান</th>
                <th className="py-3 px-4">মোবাইল নম্বর</th>
                <th className="py-3 px-4">ঠিকানা</th>
                <th className="py-3 px-4 text-right">প্রারম্ভিক পাওনা (৳)</th>
                <th className="py-3 px-4 text-right">বর্তমান মোট পাওনা (৳)</th>
                <th className="py-3 px-4 text-center">ব্যবস্থাপনা ও অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : filteredCreditors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    কোনো পাওনাদার পাওয়া যায়নি। নতুন পাওনাদার যোগ করতে বা এক্সেল ফাইল ইমপোর্ট করতে ওপরের বাটনে চাপুন।
                  </td>
                </tr>
              ) : (
                filteredCreditors.map((party, idx) => {
                  const payableDue = party.current_balance < 0 ? Math.abs(party.current_balance) : 0;
                  const isPositiveCredit = party.current_balance > 0;
                  const isPinned = party.is_pinned === 1;

                  return (
                    <tr
                      key={party.id}
                      className={`hover:bg-amber-50/40 dark:hover:bg-slate-800/60 transition-colors ${
                        isPinned ? 'bg-amber-50/20 dark:bg-amber-950/15' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {toBnDigits(idx + 1)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(party)}
                            className="text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                            title={isPinned ? 'আনপিন করুন' : 'উপরে পিন করুন'}
                          >
                            {isPinned ? (
                              <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            ) : (
                              <Pin className="w-3.5 h-3.5 hover:text-amber-500" />
                            )}
                          </button>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm hover:text-amber-600 transition-colors block">
                              {party.name}
                            </span>
                            {party.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                💬 {party.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {party.phone && party.phone.trim() ? (
                          <a
                            href={`tel:${party.phone}`}
                            className="hover:text-emerald-500 flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{party.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {party.address || 'চাচকৈড় বাজার'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                        {formatTakaBn(Math.abs(party.opening_balance || 0))}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-black text-sm">
                        {payableDue > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
                            {formatTakaBn(payableDue, true)}
                          </span>
                        ) : isPositiveCredit ? (
                          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                            অ্যাডভান্স: {formatTakaBn(party.current_balance, true)}
                          </span>
                        ) : (
                          <span className="text-slate-400">০.০০</span>
                        )}
                      </td>

                      {/* Row Action Buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setPayCreditor(party);
                              setPaymentAmount(String(payableDue || ''));
                              setPaymentDate(new Date().toISOString().split('T')[0]);
                              setPaymentNotes('');
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            title="পাওনাদারকে টাকা পরিশোধ করুন"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>💸 টাকা পরিশোধ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPrevDueCreditor(party);
                              setPrevDueAmount('');
                              setPrevDueDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="px-2.5 py-1.5 bg-amber-600/15 hover:bg-amber-600/25 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            title="অতিরিক্ত পাওনা যোগ করুন"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ পাওনা যোগ</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openCreditorStatement(party)}
                            className="px-2.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold border border-blue-500/30 transition-all flex items-center gap-1 cursor-pointer"
                            title="লেজার স্টেটমেন্ট ও লেনদেন ইতিহাস"
                          >
                            <span>লেজার স্টেটমেন্ট</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {/* 3-Dot Options */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(activeDropdownId === party.id ? null : party.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeDropdownId === party.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 py-1 text-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownId(null);
                                    setEditCreditor(party);
                                    setEditName(party.name);
                                    setEditPhone(party.phone || '');
                                    setEditAddress(party.address || '');
                                    setEditNotes(party.notes || '');
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                  <span>সম্পাদনা</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownId(null);
                                    setDeleteTargetCreditor(party);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>মুছুন</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: PAY CREDITOR (টাকা পরিশোধ)                      */}
      {/* ======================================================== */}
      {payCreditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  💸
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">টাকা পরিশোধ (পাওনাদার)</h3>
                  <p className="text-xs text-slate-500">{payCreditor.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayCreditor(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePayCreditor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">তারিখ *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">পরিশোধের মাধ্যম</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    💵 নগদ ক্যাশ
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK')}
                    className={`py-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                      paymentMethod === 'BANK'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    🏦 ব্যাংক / অনলাইন
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  টাকার পরিমাণ (৳) *
                </label>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="০.০০"
                  className="w-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-lg px-3 py-2 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-base outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মন্তব্য / বিবরণ</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="যেমন: ধান ক্রয়ের বাকি বিল পরিশোধ"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayCreditor(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md disabled:opacity-50"
                >
                  {submittingPayment ? 'পরিশোধ হচ্ছে...' : '💸 পরিশোধ নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD DUE TO CREDITOR (+ পাওনা যোগ)               */}
      {/* ======================================================== */}
      {prevDueCreditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  +
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">পাওনা যোগ (মহাজন/সাপ্লায়ার)</h3>
                  <p className="text-xs text-slate-500">{prevDueCreditor.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrevDueCreditor(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDueCreditor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">তারিখ *</label>
                <input
                  type="date"
                  value={prevDueDate}
                  onChange={(e) => setPrevDueDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">পাওনা টাকার পরিমাণ (৳) *</label>
                <input
                  type="text"
                  value={prevDueAmount}
                  onChange={(e) => setPrevDueAmount(e.target.value)}
                  placeholder="০.০০"
                  className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-lg px-3 py-2 text-amber-700 dark:text-amber-300 font-mono font-bold text-base outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">বিবরণ / কারণ</label>
                <input
                  type="text"
                  value={prevDueDescription}
                  onChange={(e) => setPrevDueDescription(e.target.value)}
                  placeholder="যেমন: পূর্বের শস্য ক্রয় চালান বা সাবেক বাকি"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrevDueCreditor(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={prevDueSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-md disabled:opacity-50"
                >
                  {prevDueSubmitting ? 'যোগ হচ্ছে...' : '+ পাওনা যুক্ত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ROYAL EXCEL STATEMENT & LEDGER MODAL            */}
      {/* ======================================================== */}
      {statementCreditor && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-600 dark:border-amber-500/60 rounded-2xl max-w-7xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Top Royal Banner */}
            <div className="bg-gradient-to-r from-slate-950 via-amber-950 to-slate-950 text-white p-4 sm:p-5 border-b-4 border-amber-400 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 text-xl font-bold shadow-inner">
                    👑
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black tracking-wide text-white drop-shadow-sm">
                        মেসার্স মাহা এন্টারপ্রাইজ
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950 border border-amber-300">
                        পাওনাদার ও মহাজন লেজার
                      </span>
                    </div>
                    <p className="text-xs text-amber-200/80 flex items-center gap-2 mt-0.5">
                      <span>চাঁচকৈড় বাজার, গুরুদাসপুর, নাটোর</span>
                      <span>•</span>
                      <span>স্বত্বাধিকারী: মো: আব্দুর রশিদ সরকার এন্ড সন্স</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-black/40 backdrop-blur-xs border border-amber-400/40 rounded-xl px-3.5 py-1.5 text-right shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">বর্তমান সময় ও তারিখ</span>
                    <span className="font-mono font-bold text-xs text-white">{currentDateTime}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    title="এক্সেল শিট প্রিন্ট করুন"
                  >
                    <Printer className="w-4 h-4" />
                    <span>প্রিন্ট শিট</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatementCreditor(null)}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Creditor Info Bar inside Banner */}
              <div className="mt-3.5 pt-3 border-t border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-amber-300">মহাজন / সরবরাহকারী:</span>
                  <strong className="text-white text-sm font-black underline decoration-amber-400 decoration-2 underline-offset-4">
                    {statementCreditor.name}
                  </strong>
                  <span className="text-amber-200 font-mono">
                    📞 {statementCreditor.phone || 'ফোন নেই'}
                  </span>
                  <span className="text-amber-100/80">
                    📍 {statementCreditor.address || 'চাঁচকৈড় বাজার'}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-amber-400 shrink-0">টীকা/মন্তব্য:</span>
                  <input
                    type="text"
                    placeholder="পাওনাদারের বিশেষ মন্তব্য লিখুন..."
                    value={partyNoteText}
                    onChange={(e) => setPartyNoteText(e.target.value)}
                    className="bg-black/40 border border-amber-400/40 rounded-lg px-2.5 py-1 text-xs text-white placeholder-amber-200/50 outline-none focus:border-amber-400 w-full sm:w-56 font-sans"
                  />
                  <button
                    type="button"
                    onClick={handleSavePartyNotes}
                    disabled={savingPartyNote}
                    className="px-2.5 py-1 bg-amber-700 hover:bg-amber-600 border border-amber-400/50 text-amber-200 hover:text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {savingPartyNote ? 'সেভ...' : '💾 সেভ'}
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Colored KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-amber-500/40 shadow-xs">
                <span className="text-amber-700 dark:text-amber-300 block font-bold text-[11px]">১. প্রারম্ভিক পাওনা (Opening Due)</span>
                <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-base mt-1 block">
                  {formatTakaBn(statementData?.openingDue ?? 0, true)}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-blue-500/40 shadow-xs">
                <span className="text-blue-700 dark:text-blue-300 block font-bold text-[11px]">২. মোট শস্য ক্রয় (+ দেনা বৃদ্ধি)</span>
                <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-base mt-1 block">
                  {formatTakaBn(statementData?.totalPurchases ?? 0, true)}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-emerald-500/40 shadow-xs">
                <span className="text-emerald-700 dark:text-emerald-300 block font-bold text-[11px]">৩. মোট পরিশোধ (- পরিশোধ)</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base mt-1 block">
                  {formatTakaBn(statementData?.totalPaid ?? 0, true)}
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border-2 border-rose-500/50 shadow-xs">
                <span className="text-rose-700 dark:text-rose-400 block font-bold text-[11px]">৪. বর্তমান মোট দেনা (Net Payable)</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-base mt-1 block">
                  {formatTakaBn(statementData?.netDue ?? 0, true)}
                </span>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800 text-white font-bold select-none text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">তারিখ</th>
                      <th className="py-2.5 px-3">লেনদেনের ধরন</th>
                      <th className="py-2.5 px-3">চালান / রেফারেন্স</th>
                      <th className="py-2.5 px-3">বিবরণ</th>
                      <th className="py-2.5 px-3 text-right">পরিশোধ (ডেবিট ৳)</th>
                      <th className="py-2.5 px-3 text-right">ক্রয় / পাওনা (ক্রেডিট ৳)</th>
                      <th className="py-2.5 px-3 text-right">ব্যালেন্স (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {loadingEntries ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          লেজার ডাটা লোড হচ্ছে...
                        </td>
                      </tr>
                    ) : creditorEntries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          কোনো পূর্ববর্তী লেনদেন পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      creditorEntries.map((entry, i) => (
                        <tr key={entry.id || i} className="hover:bg-amber-50/30 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">
                            {toBnDigits(i + 1)}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">
                            {formatDate(entry.entry_date)}
                          </td>
                          <td className="py-2 px-3">
                            {entry.transaction_type === 'PAYMENT_GIVEN' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                💸 পরিশোধ
                              </span>
                            ) : entry.transaction_type === 'PURCHASE' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                🌾 শস্য ক্রয়
                              </span>
                            ) : entry.transaction_type === 'OPENING' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                                📜 প্রারম্ভিক
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                ⚙️ সমন্বয়
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {entry.reference_no || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200">
                            {entry.description || '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {entry.debit > 0 ? formatTakaBn(entry.debit) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                            {entry.credit > 0 ? formatTakaBn(entry.credit) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                            {formatTakaBn(Math.abs(entry.running_balance || 0))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="bg-slate-100 dark:bg-slate-800/80 px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                মোট লেনদেন ভাউচার: <b>{toBnDigits(creditorEntries.length)}</b> টি
              </span>
              <button
                type="button"
                onClick={() => setStatementCreditor(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* MODAL 4: NEW CREDITOR (+ নতুন পাওনাদার)                 */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">নতুন পাওনাদার / মহাজন এন্ট্রি</h3>
                  <p className="text-xs text-slate-500">সরবরাহকারী বা কৃষকের তথ্য যুক্ত করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCreditor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  পাওনাদার / প্রতিষ্ঠানের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="যেমন: মোঃ করিম বেপারী বা মেসার্স সততা রাইস মিল"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মোবাইল নম্বর</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ঠিকানা / মোকাম</label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="যেমন: চলনবিল, গুরুদাসপুর"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  প্রারম্ভিক পাওনা (টাকা পাবেন ৳)
                </label>
                <input
                  type="text"
                  value={newOpeningPayable}
                  onChange={(e) => setNewOpeningPayable(e.target.value)}
                  placeholder="০.০০"
                  className="w-full bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 rounded-lg px-3 py-2 text-rose-700 dark:text-rose-300 font-mono font-bold text-base outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মন্তব্য</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="বিশেষ তথ্য বা শর্ত"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black rounded-lg shadow-md disabled:opacity-50"
                >
                  {submittingNew ? 'সংরক্ষণ হচ্ছে...' : '+ পাওনাদার সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: EDIT CREDITOR (সম্পাদনা)                        */}
      {/* ======================================================== */}
      {editCreditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">পাওনাদার তথ্য সম্পাদনা</h3>
              <button
                type="button"
                onClick={() => setEditCreditor(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditCreditor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">নাম *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মোবাইল নম্বর</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ঠিকানা</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মন্তব্য</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditCreditor(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-md disabled:opacity-50"
                >
                  {submittingEdit ? 'আপডেট হচ্ছে...' : 'আপডেট সম্পন্ন করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: DELETE CONFIRMATION MODAL                      */}
      {/* ======================================================== */}
      {deleteTargetCreditor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">পাওনাদার মুছে ফেলবেন?</h3>
              <p className="text-xs text-slate-500 mt-1">
                <b>{deleteTargetCreditor.name}</b>-এর হিসাবটি ৬০ দিনের জন্য <b>রিসাইকেল বিনে</b> সংরক্ষিত থাকবে। প্রয়োজন হলে পরবর্তীতে পুনরুদ্ধার করা যাবে।
              </p>
            </div>
            <div className="pt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetCreditor(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                না, রাখুন
              </button>
              <button
                type="button"
                onClick={handleDeleteCreditor}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
              >
                {deleting ? 'মুছছে...' : 'হ্যাঁ, মুছে ফেলুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SMART EXCEL IMPORT MODAL                                */}
      {/* ======================================================== */}
      <CreditorExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onImportSuccess={() => {
          fetchCreditors();
        }}
      />
    </div>
  );
};
