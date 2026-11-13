import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart,
  Calendar,
  UserPlus,
  Search,
  X,
  Check,
  Plus,
  Trash2,
  Save,
  Printer,
  FileText,
  RefreshCw,
  User,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { Commodity, Party, Sale } from '../../types';
import { dbService } from '../../services/api';
import { PrintableInvoice } from '../invoices/PrintableInvoice';
import { toBnDigits, formatBanglaCurrency, formatDate, parseSmartNumber, toBengaliDigits, toEnglishDigits, formatTaka, formatTakaBn } from '../../utils/bengaliNumbers';
import { totalKgToMonKg } from '../../utils/weightConverter';
import { roundMoney } from '../../utils/precision';

interface CartItem {
  id: string;
  commodityId: number;
  name: string;
  bags: number;
  weightMon: number;
  weightKg: number;
  ratePerMon: number;
  totalAmount: number;
  availableStockKg: number;
  availableStockBags: number;
}

export const SalesView: React.FC<{ initialMode?: string }> = () => {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // Sales History Tab
  const [salesTab, setSalesTab] = useState<'TODAY' | 'ALL'>('TODAY');

  // Customer selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [walkinName, setWalkinName] = useState<string>('সাধারণ খুচরা ক্রেতা');
  const [walkinPhone, setWalkinPhone] = useState<string>('');

  // Quick Customer Creation Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustOpeningDue, setNewCustOpeningDue] = useState<string>('0');
  const [addingCustomer, setAddingCustomer] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCommodityId, setSelectedCommodityId] = useState<number | ''>('');
  const [entryBags, setEntryBags] = useState<number>(1);
  const [entryRate, setEntryRate] = useState<number>(2800);
  const [entryWeightMon, setEntryWeightMon] = useState<number>(2.0); // 2 Mon = 80kg approx

  // Settlement State
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [cashPaidTouched, setCashPaidTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Invoice Print Preview
  const [selectedInvoice, setSelectedInvoice] = useState<Sale | null>(null);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [comms, pts, sList] = await Promise.all([
        dbService.commodities.getAll(),
        dbService.parties.getAll('BUYER'),
        dbService.sales.getAll(150),
      ]);
      setCommodities(comms);
      setParties(pts);
      setSales(sList);

      if (comms.length > 0 && selectedCommodityId === '') {
        setSelectedCommodityId(comms[0].id);
        const bagWeight = comms[0].default_bag_weight_kg || 80;
        setEntryWeightMon(Number((bagWeight / 40).toFixed(2)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedCommodityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Customer details
  const selectedCustomer = parties.find((p) => p.id === selectedCustomerId);
  const previousDue = selectedCustomer ? Number(selectedCustomer.current_balance) || 0 : 0;

  // Selected Commodity details
  const activeCommodity = commodities.find((c) => c.id === selectedCommodityId);

  const handleCommodityChange = (commId: number) => {
    setSelectedCommodityId(commId);
    const comm = commodities.find((c) => c.id === commId);
    if (comm) {
      const bagWeight = comm.default_bag_weight_kg || 80;
      setEntryWeightMon(Number(((entryBags * bagWeight) / 40).toFixed(2)));
    }
  };

  const handleBagsChange = (bags: number) => {
    setEntryBags(bags);
    if (activeCommodity) {
      const bagWeight = activeCommodity.default_bag_weight_kg || 80;
      setEntryWeightMon(Number(((bags * bagWeight) / 40).toFixed(2)));
    }
  };

  // Add Item to Cart
  const handleAddToCart = () => {
    if (!activeCommodity) {
      alert('অনুগ্রহ করে একটি শস্য নির্বাচন করুন।');
      return;
    }
    const bagsToAdd = Math.max(1, entryBags || 1);
    const monToAdd = Math.max(0.01, entryWeightMon || (bagsToAdd * (activeCommodity.default_bag_weight_kg || 80)) / 40);
    const kgToAdd = monToAdd * 40;
    const rate = Math.max(0, entryRate || 0);

    const existingIndex = cart.findIndex((i) => i.commodityId === activeCommodity.id);
    const currentBagsInCart = existingIndex >= 0 ? cart[existingIndex].bags : 0;
    const totalRequiredBags = currentBagsInCart + bagsToAdd;
    const totalRequiredKg = (existingIndex >= 0 ? cart[existingIndex].weightKg : 0) + kgToAdd;

    if (totalRequiredKg > activeCommodity.current_stock_kg) {
      const curMon = (activeCommodity.current_stock_kg / 40).toFixed(1);
      alert(
        `পর্যাপ্ত স্টক নেই! ${activeCommodity.name_bn}-এর বর্তমান স্টক ${toBnDigits(curMon)} মণ (${toBnDigits(activeCommodity.current_stock_bags)} বস্তা)। আপনি ইতিমধ্যে কার্টে ${toBnDigits(currentBagsInCart)} বস্তা রেখেছেন।`
      );
      return;
    }

    const itemTotal = monToAdd * rate;

    if (existingIndex >= 0) {
      const updated = [...cart];
      const newBags = updated[existingIndex].bags + bagsToAdd;
      const newMon = updated[existingIndex].weightMon + monToAdd;
      const newKg = newMon * 40;
      updated[existingIndex] = {
        ...updated[existingIndex],
        bags: newBags,
        weightMon: Number(newMon.toFixed(2)),
        weightKg: Number(newKg.toFixed(2)),
        ratePerMon: rate,
        totalAmount: Number((newMon * rate).toFixed(2)),
      };
      setCart(updated);
    } else {
      const newItem: CartItem = {
        id: `${activeCommodity.id}_${Date.now()}`,
        commodityId: activeCommodity.id,
        name: activeCommodity.name_bn,
        bags: bagsToAdd,
        weightMon: Number(monToAdd.toFixed(2)),
        weightKg: Number(kgToAdd.toFixed(2)),
        ratePerMon: rate,
        totalAmount: Number(itemTotal.toFixed(2)),
        availableStockKg: activeCommodity.current_stock_kg,
        availableStockBags: activeCommodity.current_stock_bags,
      };
      setCart([...cart, newItem]);
    }

    setEntryBags(1);
    if (activeCommodity) {
      const bagWeight = activeCommodity.default_bag_weight_kg || 80;
      setEntryWeightMon(Number((bagWeight / 40).toFixed(2)));
    }
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Financial Computations
  const todayTotal = cart.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalBags = cart.reduce((sum, item) => sum + item.bags, 0);
  const totalWeightMon = cart.reduce((sum, item) => sum + item.weightMon, 0);
  const grandTotal = todayTotal + previousDue;

  useEffect(() => {
    if (!cashPaidTouched) {
      if (selectedCustomerId) {
        setCashPaid(0); // Wholesale buyers default to zero or custom paid
      } else {
        setCashPaid(todayTotal); // Retail buyers default to full payment
      }
    }
  }, [todayTotal, selectedCustomerId, cashPaidTouched]);

  const closingDue = Math.max(0, grandTotal - (cashPaid || 0));

  // Quick Preset Handlers
  const handleSetZeroCash = () => {
    setCashPaidTouched(true);
    setCashPaid(0);
  };
  const handleSetTodayBill = () => {
    setCashPaidTouched(true);
    setCashPaid(todayTotal);
  };
  const handleSetGrandTotal = () => {
    setCashPaidTouched(true);
    setCashPaid(grandTotal);
  };

  // Submit Sale Handler
  const handleProcessSale = async (shouldPrint: boolean) => {
    if (cart.length === 0) {
      alert('অনুগ্রহ করে কার্টে কমপক্ষে একটি শস্যের জাত যুক্ত করুন।');
      return;
    }

    if (closingDue > 0 && !selectedCustomerId && (!walkinName || walkinName.trim() === '' || walkinName === 'সাধারণ খুচরা ক্রেতা')) {
      alert('বাকি বিক্রয়ের ক্ষেত্রে অবশ্যই নির্দিষ্ট পাইকারি ক্রেতা নির্বাচন করতে হবে।');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sale_date: saleDate,
        party_id: selectedCustomerId || 0,
        customer_name: selectedCustomer ? selectedCustomer.name : walkinName.trim(),
        customer_phone: selectedCustomer ? selectedCustomer.phone : walkinPhone.trim() || '০১৭০০-০০০০০০',
        items: cart.map((i) => ({
          commodity_id: i.commodityId,
          bags_count: i.bags,
          net_weight_mon: i.weightMon,
          gross_weight_kg: i.weightKg,
          bag_deduction_kg: 0,
          rate_per_mon: i.ratePerMon,
          total_amount: i.totalAmount,
        })),
        cash_paid: cashPaid || 0,
        payment_method: 'CASH',
        notes: notes.trim() || undefined,
      };

      const res = await dbService.sales.createBatch(payload);
      if (!res.success) {
        throw new Error('বিক্রয় সম্পন্ন হতে পারেনি');
      }

      await fetchData();

      setCart([]);
      setCashPaid(0);
      setCashPaidTouched(false);
      setNotes('');

      if (shouldPrint && res.sales && res.sales.length > 0) {
        setSelectedInvoice(res.sales[0]);
      } else {
        alert(`✅ বিক্রয় সফল হয়েছে! চালান নং: ${res.invoice_no}`);
      }
    } catch (err: any) {
      alert(`বিক্রয় ত্রুটি: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Quick Add Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      alert('অনুগ্রহ করে ক্রেতার নাম লিখুন।');
      return;
    }
    setAddingCustomer(true);
    try {
      const created = await dbService.parties.create({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || '',
        address: newCustAddress.trim() || 'চাঁচকৈড় বাজার, গুরুদাসপুর',
        party_type: 'BUYER',
        opening_balance: parseSmartNumber(newCustOpeningDue) || 0,
      });

      setParties((prev) => [created, ...prev]);
      setSelectedCustomerId(created.id);
      setCustomerSearch(created.name);
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustOpeningDue('0');
      alert('নতুন পাইকারি ক্রেতা সফলভাবে তৈরি হয়েছে!');
    } catch (err: any) {
      alert(`ত্রুটি: ${err.message}`);
    } finally {
      setAddingCustomer(false);
    }
  };

  // Filtered customer list for search dropdown
  const filteredCustomers = parties.filter((c) => {
    const q = customerSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone ? c.phone.includes(q) : false) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  // Today & Past Sales
  const isToday = (dateVal: string) => {
    if (!dateVal) return false;
    const nowStr = new Date().toISOString().split('T')[0];
    return dateVal.startsWith(nowStr);
  };

  const todaySales = sales.filter((s) => isToday(s.sale_date));
  const pastSales = sales.filter((s) => !isToday(s.sale_date));
  const displayedSales = salesTab === 'TODAY' ? todaySales : pastSales;

  return (
    <div className="p-2 sm:p-4 space-y-6 max-w-[1550px] mx-auto min-h-screen text-[var(--text-primary)]">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-sm">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>পাইকারি বিক্রয় ও চালান (POS)</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                মাল্টি-আইটেম বিলিং
              </span>
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              একাধিক শস্যের জাত, পূর্বের বকেয়া সমন্বয় এবং তাৎক্ষণিক পাইকারি চালান প্রিন্ট
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border-color)] rounded-xl font-mono text-[var(--text-primary)]">
            <Calendar className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span className="text-[var(--text-muted)]">চালানের তারিখ:</span>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="bg-transparent text-amber-600 dark:text-amber-400 font-bold border-none outline-none cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 2. Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Customer Selection + Multi-Item Cart (7 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* CARD 1: ১. পাইকারি ক্রেতা নির্বাচন */}
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl p-4 md:p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  ১. পাইকারি ক্রেতা নির্বাচন
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ নতুন পাইকারি ক্রেতা</span>
              </button>
            </div>

            {/* Customer Search Autocomplete */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                নাম অথবা মোবাইল দিয়ে খুঁজুন (যেমন: রফিক)...
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerDropdownOpen(true);
                  }}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  placeholder="নাম অথবা মোবাইল দিয়ে খুঁজুন (যেমন: রফিক)..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all pl-9"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                {selectedCustomerId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerSearch('');
                    }}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Customer Dropdown Results */}
              {customerDropdownOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  <div
                    onClick={() => {
                      setSelectedCustomerId(null);
                      setCustomerSearch('');
                      setCustomerDropdownOpen(false);
                    }}
                    className={`p-3 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between ${
                      !selectedCustomerId ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold">সাধারণ খুচরা ক্রেতা (নগদ বিক্রয়)</div>
                      <div className="text-[10px] text-slate-500">বাকি ছাড়া সরাসরি ক্যাশ বিক্রি</div>
                    </div>
                    {!selectedCustomerId && <Check className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
                  </div>

                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 text-center">
                      কোনো ক্রেতা পাওয়া যায়নি।
                    </div>
                  ) : (
                    filteredCustomers.map((cust) => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setCustomerSearch(`${cust.name} ${cust.phone ? `(${cust.phone})` : ''}`);
                          setCustomerDropdownOpen(false);
                        }}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between ${
                          selectedCustomerId === cust.id ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{cust.name}</span>
                            {cust.phone && (
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{cust.phone}</span>
                            )}
                          </div>
                          {cust.address && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{cust.address}</div>
                          )}
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              (cust.current_balance || 0) > 0
                                ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            বকেয়া: {formatTakaBn(cust.current_balance || 0, true)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Customer Alert or Walkin Name Fields */}
            {selectedCustomer ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    👤
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                      {selectedCustomer.name}
                      {selectedCustomer.phone && (
                        <span className="font-mono text-slate-500 dark:text-slate-400 ml-1.5 font-normal">({selectedCustomer.phone})</span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{selectedCustomer.address || 'চাঁচকৈড় মোকাম'}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">পূর্বের বকেয়া হিসাব</div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {formatTakaBn(previousDue, true)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-400 mb-1">
                    খুচরা ক্রেতার নাম:
                  </label>
                  <input
                    type="text"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-400 mb-1">
                    মোবাইল নম্বর (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    placeholder="০১৭১২-৩৪৫৬৭৮"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: ২. শস্যের আইটেম যোগ করুন (মাল্টি-আইটেম কার্ট) */}
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl p-4 md:p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  ২. শস্যের আইটেম যোগ করুন (মাল্টি-আইটেম কার্ট)
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                আইটেম সংখ্যা: {toBnDigits(cart.length)}
              </span>
            </div>

            {/* Inputs: শস্যের জাত, বস্তা, মোট ওজন, দর, বাটন */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl items-end">
              {/* Variety Selector */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  শস্যের জাত নির্বাচন
                </label>
                <select
                  value={selectedCommodityId}
                  onChange={(e) => handleCommodityChange(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white outline-none font-bold cursor-pointer"
                >
                  {commodities.map((c) => {
                    const isZero = (c.current_stock_kg || 0) <= 0;
                    const monStock = (c.current_stock_kg / 40).toFixed(1);
                    return (
                      <option key={c.id} value={c.id} disabled={isZero}>
                        {c.name_bn} {isZero ? '(স্টক নেই)' : `(মজুদ: ${toBnDigits(monStock)} মণ, ${toBnDigits(c.current_stock_bags)} বস্তা)`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Bags Input */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  বস্তার সংখ্যা
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={entryBags !== undefined && (entryBags as any) !== '' ? toBengaliDigits(entryBags) : ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const norm = toEnglishDigits(e.target.value);
                    const val = parseInt(norm, 10);
                    handleBagsChange(isNaN(val) ? (norm === '' ? ('' as any) : 1) : Math.max(1, val));
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white font-mono font-bold outline-none text-center"
                />
              </div>

              {/* Total Weight Mon */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  মোট ওজন (মণ)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={entryWeightMon !== undefined && (entryWeightMon as any) !== '' ? toBengaliDigits(entryWeightMon) : ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const norm = toEnglishDigits(e.target.value);
                    const val = parseFloat(norm);
                    setEntryWeightMon(isNaN(val) ? (norm === '' ? ('' as any) : 0) : val);
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs text-cyan-600 dark:text-cyan-300 font-mono font-bold outline-none text-center"
                />
              </div>

              {/* Rate per Mon */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  দর (প্রতি মণ)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={entryRate !== undefined && (entryRate as any) !== '' ? toBengaliDigits(entryRate) : ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const norm = toEnglishDigits(e.target.value);
                    const val = parseFloat(norm);
                    setEntryRate(isNaN(val) ? (norm === '' ? ('' as any) : 0) : Math.max(0, val));
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400 font-mono font-bold outline-none text-right"
                />
              </div>

              {/* Add Button */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ যোগ করুন</span>
                </button>
              </div>
            </div>

            {/* Cart Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[var(--border-color)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">শস্যের নাম</th>
                    <th className="py-2.5 px-3 text-center">বস্তা</th>
                    <th className="py-2.5 px-3 text-center">মোট ওজন</th>
                    <th className="py-2.5 px-3 text-right">দর (প্রতি মণ)</th>
                    <th className="py-2.5 px-3 text-right">মোট টাকা</th>
                    <th className="py-2.5 px-3 text-center w-16">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#162231]">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        কার্ট খালি! উপরের তালিকা থেকে শস্যের জাত নির্বাচন করে কার্টে যোগ করুন।
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-mono">
                          {toBnDigits(index + 1)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">{item.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white font-mono">
                          {toBnDigits(item.bags)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-cyan-600 dark:text-cyan-300 font-mono">
                          {toBnDigits(item.weightMon)} মণ
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                          {formatTakaBn(item.ratePerMon, true)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-amber-600 dark:text-amber-400 font-mono">
                          {formatTakaBn(item.totalAmount, true)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(index)}
                            className="p-1 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                            title="মুছুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {cart.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 font-bold">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        মোট বস্তা: <span className="text-slate-900 dark:text-white font-mono font-black">{toBnDigits(totalBags)}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-cyan-700 dark:text-cyan-300 font-mono font-bold">
                        {toBnDigits(totalWeightMon.toFixed(2))} মণ
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 font-bold">
                        আজকের মোট:
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                        {formatTakaBn(todayTotal, true)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Financial Settlement Box & Actions (5 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* CARD 3: ৩. হিসাব নিষ্পত্তি ও বকেয়া সমন্বয় */}
          <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="border-b border-[var(--border-color)] pb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span>৩. হিসাব নিষ্পত্তি ও বকেয়া সমন্বয়</span>
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                চালান নিষ্পত্তি
              </span>
            </div>

            {/* Calculations Breakdown Cards */}
            <div className="space-y-2.5">
              {/* 1. আজকের মোট বিল */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">১. আজকের মোট বিল:</div>
                <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                  {formatTakaBn(todayTotal, true)}
                </div>
              </div>

              {/* 2. পূর্বের বকেয়া (+) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">২. পূর্বের বকেয়া (+):</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {selectedCustomer ? selectedCustomer.name : 'সাধারণ কাস্টমার (০)'}
                  </div>
                </div>
                <div className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                  {formatTakaBn(previousDue, true)}
                </div>
              </div>

              {/* 3. সর্বমোট পাওনা (=) */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">৩. সর্বমোট পাওনা (=):</div>
                <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                  {formatTakaBn(grandTotal, true)}
                </div>
              </div>

              {/* 4. আজকের পরিশোধ / জমা (-) */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ৪. আজকের পরিশোধ / জমা (-):
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">টাকা গ্রহণ</span>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">৳</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashPaid !== undefined && (cashPaid as any) !== '' ? toBengaliDigits(cashPaid) : ''}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      setCashPaidTouched(true);
                      const norm = toEnglishDigits(e.target.value);
                      const parsed = parseSmartNumber(norm);
                      setCashPaid(norm === '' ? ('' as any) : parsed);
                    }}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900 dark:text-white font-mono font-black outline-none text-right"
                  />
                </div>

                {/* Quick Presets Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSetZeroCash}
                    className="py-1 px-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded text-[10px] font-bold transition-colors text-center cursor-pointer"
                  >
                    বাকি (০)
                  </button>
                  <button
                    type="button"
                    onClick={handleSetTodayBill}
                    className="py-1 px-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-bold transition-colors text-center cursor-pointer"
                  >
                    আজকের বিল
                  </button>
                  <button
                    type="button"
                    onClick={handleSetGrandTotal}
                    className="py-1 px-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold transition-colors text-center cursor-pointer"
                  >
                    সম্পূর্ণ পাওনা
                  </button>
                </div>
              </div>

              {/* 5. বর্তমান অবশিষ্ট বকেয়া (=) */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  closingDue > 0
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-300'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                <div>
                  <div className="text-xs font-black uppercase">৫. বর্তমান অবশিষ্ট বকেয়া (=):</div>
                  <div className="text-[10px] opacity-75">
                    {closingDue > 0 ? 'চালান শেষে ক্রেতার মোট দেনা' : 'সম্পূর্ণ পরিশোধিত (বাকি শূন্য)'}
                  </div>
                </div>
                <div className="text-lg font-black font-mono">
                  {formatTakaBn(closingDue, true)}
                </div>
              </div>
            </div>

            {/* Notes / Remarks */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-400 mb-1">
                মন্তব্য / নোট (ঐচ্ছিক):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="চালানের বিশেষ কোনো নোট..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
              />
            </div>

            {/* Action Buttons: 💾 বিক্রয় সম্পন্ন করুন and 🖨️ বিক্রয় ও চালান প্রিন্ট */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleProcessSale(false)}
                disabled={submitting || cart.length === 0}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'সংরক্ষণ হচ্ছে...' : '💾 বিক্রয় সম্পন্ন করুন'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleProcessSale(true)}
                disabled={submitting || cart.length === 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{submitting ? 'প্রিন্ট হচ্ছে...' : '🖨️ বিক্রয় ও চালান প্রিন্ট'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. RECENT INVOICE LEDGER SECTION (সাম্প্রতিক চালানের হিসাব ও খতিয়ান) */}
      <div className="bg-[var(--surface)] border border-[var(--border-color)] rounded-2xl shadow-xl overflow-hidden mt-8">
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">সাম্প্রতিক চালানের হিসাব ও খতিয়ান</h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs: আজকের চালানসমূহ / পূর্বের সকল চালান */}
            <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSalesTab('TODAY')}
                className={`px-3 py-1 text-xs rounded-md font-bold transition-all cursor-pointer ${
                  salesTab === 'TODAY'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                আজকের চালানসমূহ ({toBnDigits(todaySales.length)} টি)
              </button>
              <button
                type="button"
                onClick={() => setSalesTab('ALL')}
                className={`px-3 py-1 text-xs rounded-md font-bold transition-all cursor-pointer ${
                  salesTab === 'ALL'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                পূর্বের সকল চালান ({toBnDigits(pastSales.length)} টি)
              </button>
            </div>

            <button
              onClick={fetchData}
              className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="তাত্ক্ষণিক রিফ্রেশ"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">চালান নং</th>
                <th className="py-3 px-4">তারিখ</th>
                <th className="py-3 px-4">ক্রেতার বিবরণ</th>
                <th className="py-3 px-4 text-center">মোট বস্তা/ওজন</th>
                <th className="py-3 px-4 text-right">আজকের বিল (৳)</th>
                <th className="py-3 px-4 text-right">পূর্বের বকেয়া (৳)</th>
                <th className="py-3 px-4 text-right">পরিশোধ (৳)</th>
                <th className="py-3 px-4 text-right">অবশিষ্ট বকেয়া (৳)</th>
                <th className="py-3 px-4 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#162231]">
              {displayedSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                    কোনো চালানের রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                displayedSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {s.invoice_no}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {formatDate(s.sale_date)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">{s.party_name}</div>
                      {s.party_phone && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{s.party_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-slate-900 dark:text-white font-mono">{toBnDigits(s.bags_count)} বস্তা</span>
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-300 block font-mono">
                        {toBnDigits(s.net_weight_mon?.toFixed(1) || 0)} মণ
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white font-mono">
                      {formatTakaBn(s.net_invoice_amount, true)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 font-mono">
                      {formatTakaBn(0, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatTakaBn(s.paid_amount, true)}
                    </td>
                    <td className="py-3 px-4 text-right font-black font-mono">
                      <span
                        className={
                          s.due_amount > 0 ? 'text-rose-500 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400 font-normal'
                        }
                      >
                        {formatTakaBn(s.due_amount, true)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(s)}
                        className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 dark:text-amber-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mx-auto cursor-pointer"
                        title="চালান দেখুন ও প্রিন্ট করুন"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>প্রিন্ট / ভিউ</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span>+ নতুন পাইকারি ক্রেতা যোগ করুন</span>
              </h3>
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ক্রেতার নাম *</label>
                <input
                  type="text"
                  placeholder="যেমন: হাজী রফিকুল ইসলাম"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">মোবাইল নম্বর (ঐচ্ছিক)</label>
                <input
                  type="text"
                  placeholder="যেমন: ০১৭১২-৩৪৫৬৭৮ (ঐচ্ছিক)"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">ঠিকানা / মোকাম</label>
                <input
                  type="text"
                  placeholder="চাঁচকৈড় বাজার, গুরুদাসপুর"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">প্রারম্ভিক বকেয়া (যদি থাকে)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={newCustOpeningDue}
                  onChange={(e) => setNewCustOpeningDue(toBengaliDigits(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-amber-600 dark:text-amber-400 font-bold font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={addingCustomer}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-md disabled:opacity-50"
                >
                  {addingCustomer ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE INVOICE MODAL */}
      {selectedInvoice && (
        <PrintableInvoice
          sale={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
};
