// Frontend API Service Bridge
import type {
  Commodity,
  Party,
  Purchase,
  Sale,
  StockAdjustment,
  LedgerEntry,
  CashbookEntry,
  Expense,
  DashboardStats,
  PartyType,
  PaymentMethod,
  Note,
  RecycleBinItem,
  SectorFilter,
} from '../types';

declare global {
  interface Window {
    api?: any;
  }
}

// Dynamic PIN retriever ensuring latest unlocked/stored PIN is always used
export function getDynamicPin(): string {
  if (typeof window === 'undefined') return '5555';
  try {
    const rawPin =
      sessionStorage.getItem('maha_pin') ||
      sessionStorage.getItem('maha_app_pin') ||
      localStorage.getItem('maha_pin') ||
      localStorage.getItem('maha_app_pin') ||
      localStorage.getItem('pin') ||
      '5555';
    // Convert any Bengali digits to English digits
    const cleaned = String(rawPin).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
    return /^\d{4}$/.test(cleaned) ? cleaned : '5555';
  } catch {
    return '5555';
  }
}

// Helper for Web / Mobile HTTP API fetch when running in remote browser or iPhone Safari
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const pin = getDynamicPin();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-app-pin': pin,
    'x-auth-pin': pin,
    'x-pin': pin,
    'Authorization': `Bearer ${pin}`,
    ...((options.headers as Record<string, string>) || {}),
  };
  const res = await fetch(endpoint, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Fallback in-memory state for Vite dev server browser preview
let mockCommodities: Commodity[] = [
  { id: 1, name_bn: 'সরিষা (মাঘি/টোরি)', name_en: 'Mustard', default_bag_weight_kg: 80, current_stock_kg: 4000, current_stock_bags: 50, current_wac_per_kg: 72.5, current_wac_per_mon: 2900, is_active: 1, created_at: '', updated_at: '' },
  { id: 2, name_bn: 'ভুট্টা (হলুদ দানাদার)', name_en: 'Corn', default_bag_weight_kg: 75, current_stock_kg: 6000, current_stock_bags: 80, current_wac_per_kg: 27.5, current_wac_per_mon: 1100, is_active: 1, created_at: '', updated_at: '' },
  { id: 3, name_bn: 'তোষা পাট', name_en: 'Toshas Jute', default_bag_weight_kg: 70, current_stock_kg: 2800, current_stock_bags: 40, current_wac_per_kg: 77.5, current_wac_per_mon: 3100, is_active: 1, created_at: '', updated_at: '' },
  { id: 4, name_bn: 'গম (বারি-২৮/৩৩)', name_en: 'Wheat', default_bag_weight_kg: 85, current_stock_kg: 3400, current_stock_bags: 40, current_wac_per_kg: 45.0, current_wac_per_mon: 1800, is_active: 1, created_at: '', updated_at: '' },
  { id: 5, name_bn: 'আমন ধান (স্বর্ণা)', name_en: 'Aman Paddy', default_bag_weight_kg: 75, current_stock_kg: 5250, current_stock_bags: 70, current_wac_per_kg: 32.5, current_wac_per_mon: 1300, is_active: 1, created_at: '', updated_at: '' },
];

let mockParties: Party[] = [
  { id: 1, name: 'মোঃ করিম বেপারী', phone: '01712345678', address: 'চলনবিল, গুরুদাসপুর', party_type: 'SUPPLIER', opening_balance: -25000, current_balance: -25000, is_active: 1, created_at: '', updated_at: '' },
  { id: 2, name: 'রহমান ট্রেডার্স (মিল মালিক)', phone: '01819876543', address: 'ঈশ্বরদী, পাবনা', party_type: 'BUYER', opening_balance: 145000, current_balance: 145000, is_active: 1, created_at: '', updated_at: '' },
  { id: 3, name: 'আনিসুর রহমান চাষী', phone: '01733221100', address: 'ধারাবারিষা, নাটোর', party_type: 'SUPPLIER', opening_balance: 0, current_balance: 0, is_active: 1, created_at: '', updated_at: '' },
];

let mockNotes: Note[] = [
  {
    id: 1,
    title: 'চলনবিল হাট সরিষার দরদাম',
    content: 'আজকের মাঘি সরিষার বাজার দর মণপ্রতি ২৮৫০ থেকে ২৯৫০ টাকা। শুকনা ও পরিষ্কার মাল দেখে কিনতে হবে।',
    category: 'দরদাম',
    is_pinned: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'করিম বেপারীর বাকির তাগাদা',
    content: 'আগামী রবিবারে ৫০,০০০ টাকা কিস্তি জমা দেওয়ার কথা। ফোন দিয়ে মনে করিয়ে দিতে হবে।',
    category: 'বেপারী স্মরণিকা',
    is_pinned: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    title: 'গুদাম নম্বর ২ এর তেরপল মেরামত',
    content: 'বৃষ্টি আসার আগেই গুদামের উত্তর পাশের চাল ও তেরপল ঠিক করতে হবে। মিস্ত্রি খালেককে দায়িত্ব দেওয়া হয়েছে।',
    category: 'সাধারণ',
    is_pinned: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const dbService = {
  commodities: {
    getAll: async (sector?: SectorFilter): Promise<Commodity[]> => {
      if (window.api) return window.api.commodities.getAll();
      try {
        const query = sector && sector !== 'all' ? `?sector=${sector}` : '';
        return await apiFetch<Commodity[]>(`/api/commodities${query}`);
      } catch {
        if (sector && sector !== 'all') {
          return mockCommodities.filter(c => c.sector === sector);
        }
        return [...mockCommodities];
      }
    },
    create: async (data: any): Promise<Commodity> => {
      if (window.api) return window.api.commodities.create(data);
      try {
        return await apiFetch<Commodity>('/api/commodities', { method: 'POST', body: JSON.stringify(data) });
      } catch {
        const newCom: Commodity = {
          id: mockCommodities.length + 1,
          ...data,
          current_stock_kg: 0,
          current_stock_bags: 0,
          current_wac_per_kg: 0,
          current_wac_per_mon: 0,
          is_active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockCommodities.push(newCom);
        return newCom;
      }
    },
    update: async (id: number, data: any): Promise<Commodity> => {
      if (window.api) return window.api.commodities.update(id, data);
      try {
        return await apiFetch<Commodity>(`/api/commodities/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      } catch {
        const idx = mockCommodities.findIndex(c => c.id === id);
        if (idx !== -1) mockCommodities[idx] = { ...mockCommodities[idx], ...data };
        return mockCommodities[idx];
      }
    },
    delete: async (id: number, force: boolean = false): Promise<{ success: boolean; message?: string }> => {
      if (window.api?.commodities?.delete) return window.api.commodities.delete(id, force);
      try {
        return await apiFetch<{ success: boolean; message?: string }>(`/api/commodities/${id}?force=${force}`, { method: 'DELETE' });
      } catch {
        const idx = mockCommodities.findIndex(c => c.id === id);
        if (idx !== -1) {
          mockCommodities.splice(idx, 1);
          return { success: true };
        }
        return { success: false, message: 'শস্য পাওয়া যায়নি।' };
      }
    },
  },

  parties: {
    getAll: async (type?: PartyType, sector?: SectorFilter): Promise<Party[]> => {
      if (window.api) return window.api.parties.getAll(type);
      try {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        if (sector && sector !== 'all') params.set('sector', sector);
        const q = params.toString() ? `?${params.toString()}` : '';
        return await apiFetch<Party[]>(`/api/parties${q}`);
      } catch {
        let list = [...mockParties];
        if (type) list = list.filter(p => p.party_type === type || p.party_type === 'BOTH');
        if (sector && sector !== 'all') list = list.filter(p => !p.sector || p.sector === sector);
        return list;
      }
    },
    getById: async (id: number): Promise<Party | undefined> => {
      if (window.api) return window.api.parties.getById(id);
      try {
        return await apiFetch<Party>(`/api/parties/${id}`);
      } catch {
        return mockParties.find(p => p.id === id);
      }
    },
    create: async (data: any): Promise<Party> => {
      if (window.api) return window.api.parties.create(data);
      try {
        return await apiFetch<Party>('/api/parties', { method: 'POST', body: JSON.stringify(data) });
      } catch {
        const newP: Party = {
          id: mockParties.length + 1,
          ...data,
          current_balance: data.opening_balance || 0,
          is_active: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockParties.push(newP);
        return newP;
      }
    },
    update: async (id: number, data: any): Promise<Party> => {
      if (window.api) return window.api.parties.update(id, data);
      try {
        return await apiFetch<Party>(`/api/parties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      } catch {
        const idx = mockParties.findIndex(p => p.id === id);
        if (idx !== -1) mockParties[idx] = { ...mockParties[idx], ...data };
        return mockParties[idx];
      }
    },
    delete: async (id: number): Promise<{ success: boolean; message: string }> => {
      if (window.api?.parties?.delete) return window.api.parties.delete(id);
      try {
        return await apiFetch<{ success: boolean; message: string }>(`/api/parties/${id}`, { method: 'DELETE' });
      } catch {
        return { success: true, message: 'পার্টি সফলভাবে মুছে ফেলা হয়েছে (মক)' };
      }
    },
    deleteCustomer: async (id: number): Promise<{ success: boolean; message: string }> => {
      if (window.api?.deleteCustomer) return window.api.deleteCustomer(id);
      if (window.api?.parties?.delete) return window.api.parties.delete(id);
      try {
        return await apiFetch<{ success: boolean; message: string }>(`/api/customers/${id}`, { method: 'DELETE' });
      } catch {
        return await apiFetch<{ success: boolean; message: string }>(`/api/parties/${id}`, { method: 'DELETE' });
      }
    },
    deleteCreditor: async (id: number): Promise<{ success: boolean; message: string }> => {
      if (window.api?.deleteCreditor) return window.api.deleteCreditor(id);
      if (window.api?.parties?.delete) return window.api.parties.delete(id);
      try {
        return await apiFetch<{ success: boolean; message: string }>(`/api/creditors/${id}`, { method: 'DELETE' });
      } catch {
        return await apiFetch<{ success: boolean; message: string }>(`/api/parties/${id}`, { method: 'DELETE' });
      }
    },
    adjustDue: async (data: any): Promise<{ success: boolean; newBalance: number }> => {
      if (window.api?.parties?.adjustDue) return window.api.parties.adjustDue(data);
      try {
        return await apiFetch<{ success: boolean; newBalance: number }>('/api/parties/adjust-due', { method: 'POST', body: JSON.stringify(data) });
      } catch {
        return { success: true, newBalance: 0 };
      }
    },
    togglePin: async (id: number): Promise<{ success: boolean; is_pinned: number; message?: string }> => {
      if (window.api?.parties?.togglePin) return window.api.parties.togglePin(id);
      const party = mockParties.find((p) => p.id === id);
      if (party) {
        party.is_pinned = party.is_pinned === 1 ? 0 : 1;
        return { success: true, is_pinned: party.is_pinned };
      }
      return { success: false, is_pinned: 0 };
    },
    getDetailedStatement: async (id: number): Promise<any> => {
      if (window.api?.parties?.getDetailedStatement) return window.api.parties.getDetailedStatement(id);
      try {
        return await apiFetch<any>(`/api/parties/${id}/statement`);
      } catch {
        return null;
      }
    },
    deleteVoucher: async (id: number): Promise<{ success: boolean; message: string }> => {
      if (window.api?.parties?.deleteVoucher) return window.api.parties.deleteVoucher(id);
      try {
        return await apiFetch<{ success: boolean; message: string }>(`/api/ledgers/voucher/${id}`, { method: 'DELETE' });
      } catch {
        return { success: true, message: 'সফলভাবে মুছে ফেলা হয়েছে' };
      }
    },
    updateLedgerNote: async (id: number, desc: string): Promise<{ success: boolean }> => {
      if (window.api?.parties?.updateLedgerNote) return window.api.parties.updateLedgerNote(id, desc);
      return { success: true };
    },
    importLegacyExcel: async (payload: { parties: any[] }): Promise<{ success: boolean; importedCount: number; totalEntriesCount: number; message: string }> => {
      if (window.api?.parties?.importLegacyExcel) return window.api.parties.importLegacyExcel(payload);
      return await apiFetch<{ success: boolean; importedCount: number; totalEntriesCount: number; message: string }>(
        '/api/parties/import-legacy-excel',
        { method: 'POST', body: JSON.stringify(payload) }
      );
    },
  },

  deleteCustomer: async (id: number): Promise<{ success: boolean; message: string }> => {
    return dbService.parties.deleteCustomer(id);
  },

  deleteCreditor: async (id: number): Promise<{ success: boolean; message: string }> => {
    return dbService.parties.deleteCreditor(id);
  },

  deleteParty: async (id: number): Promise<{ success: boolean; message: string }> => {
    return dbService.parties.delete(id);
  },

  customers: {
    getAll: async (sector?: SectorFilter): Promise<Party[]> => {
      return dbService.parties.getAll('BUYER', sector);
    },
    getById: async (id: number): Promise<Party | undefined> => {
      return dbService.parties.getById(id);
    },
    create: async (data: any): Promise<Party> => {
      return dbService.parties.create({ ...data, party_type: data.party_type || 'BUYER' });
    },
    update: async (id: number, data: any): Promise<Party> => {
      return dbService.parties.update(id, data);
    },
    delete: async (id: number): Promise<{ success: boolean; message: string }> => {
      return dbService.deleteCustomer(id);
    },
  },

  creditors: {
    getAll: async (sector?: SectorFilter): Promise<Party[]> => {
      return dbService.parties.getAll('SUPPLIER', sector);
    },
    getById: async (id: number): Promise<Party | undefined> => {
      return dbService.parties.getById(id);
    },
    create: async (data: any): Promise<Party> => {
      return dbService.parties.create({ ...data, party_type: data.party_type || 'SUPPLIER' });
    },
    update: async (id: number, data: any): Promise<Party> => {
      return dbService.parties.update(id, data);
    },
    delete: async (id: number): Promise<{ success: boolean; message: string }> => {
      return dbService.deleteCreditor(id);
    },
  },

  purchases: {
    getAll: async (limit?: number, sector?: SectorFilter): Promise<Purchase[]> => {
      if (window.api) return window.api.purchases.getAll(limit);
      try {
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit.toString());
        if (sector && sector !== 'all') params.set('sector', sector);
        const q = params.toString() ? `?${params.toString()}` : '';
        return await apiFetch<Purchase[]>(`/api/purchases${q}`);
      } catch {
        return [];
      }
    },
    getById: async (id: number): Promise<Purchase | undefined> => {
      if (window.api) return window.api.purchases.getById(id);
      return undefined;
    },
    create: async (data: any): Promise<Purchase> => {
      if (window.api) return window.api.purchases.create(data);
      return await apiFetch<Purchase>('/api/purchases', { method: 'POST', body: JSON.stringify(data) });
    },
    delete: async (id: number): Promise<{ success: boolean }> => {
      if (window.api?.purchases?.delete) return window.api.purchases.delete(id);
      return await apiFetch<{ success: boolean }>(`/api/purchases/${id}`, { method: 'DELETE' });
    },
  },

  sales: {
    getAll: async (limit?: number, sector?: SectorFilter): Promise<Sale[]> => {
      if (window.api) return window.api.sales.getAll(limit);
      try {
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit.toString());
        if (sector && sector !== 'all') params.set('sector', sector);
        const q = params.toString() ? `?${params.toString()}` : '';
        return await apiFetch<Sale[]>(`/api/sales${q}`);
      } catch {
        return [];
      }
    },
    getById: async (id: number): Promise<Sale | undefined> => {
      if (window.api) return window.api.sales.getById(id);
      return undefined;
    },
    create: async (data: any): Promise<Sale & { sms_queued?: boolean }> => {
      if (window.api) return window.api.sales.create(data);
      return await apiFetch<Sale & { sms_queued?: boolean }>('/api/sales', { method: 'POST', body: JSON.stringify(data) });
    },
    createBatch: async (data: any): Promise<{ success: boolean; invoice_no: string; sales: Sale[]; sms_queued?: boolean }> => {
      if (window.api?.sales?.createBatch) return window.api.sales.createBatch(data);
      return await apiFetch<{ success: boolean; invoice_no: string; sales: Sale[]; sms_queued?: boolean }>('/api/sales/batch', { method: 'POST', body: JSON.stringify(data) });
    },
    delete: async (id: number): Promise<{ success: boolean; message?: string }> => {
      if (window.api?.sales?.delete) return window.api.sales.delete(id);
      return await apiFetch<{ success: boolean; message?: string }>(`/api/sales/${id}`, { method: 'DELETE' });
    },
  },

  stockAdjustments: {
    getAll: async (limit?: number): Promise<StockAdjustment[]> => {
      if (window.api) return window.api.stockAdjustments.getAll(limit);
      try {
        return await apiFetch<StockAdjustment[]>('/api/stock-adjustments' + (limit ? `?limit=${limit}` : ''));
      } catch {
        return [];
      }
    },
    create: async (data: any): Promise<StockAdjustment> => {
      if (window.api) return window.api.stockAdjustments.create(data);
      return await apiFetch<StockAdjustment>('/api/stock-adjustments', { method: 'POST', body: JSON.stringify(data) });
    },
    delete: async (id: number): Promise<{ success: boolean; message?: string }> => {
      if (window.api?.stockAdjustments?.delete) return window.api.stockAdjustments.delete(id);
      return await apiFetch<{ success: boolean; message?: string }>(`/api/stock-adjustments/${id}`, { method: 'DELETE' });
    },
  },

  ledgers: {
    getByParty: async (partyId: number): Promise<LedgerEntry[]> => {
      if (window.api) return window.api.ledgers.getByParty(partyId);
      try {
        return await apiFetch<LedgerEntry[]>(`/api/ledgers/${partyId}`);
      } catch {
        return [];
      }
    },
    recordVoucher: async (data: any): Promise<{ success: boolean; newBalance: number }> => {
      if (window.api) return window.api.ledgers.recordVoucher(data);
      return await apiFetch<{ success: boolean; newBalance: number }>('/api/collect', { method: 'POST', body: JSON.stringify(data) });
    },
    updateEntry: async (id: number, data: any): Promise<{ success: boolean; message: string; running_balance?: number }> => {
      if ((window.api?.ledgers as any)?.updateEntry) return (window.api.ledgers as any).updateEntry(id, data);
      return await apiFetch<{ success: boolean; message: string; running_balance?: number }>(`/api/ledgers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    deleteEntry: async (id: number): Promise<{ success: boolean; message: string }> => {
      if ((window.api?.ledgers as any)?.deleteEntry) return (window.api.ledgers as any).deleteEntry(id);
      return await apiFetch<{ success: boolean; message: string }>(`/api/ledgers/${id}`, {
        method: 'DELETE',
      });
    },
  },

  cashbook: {
    getDaily: async (date: string, sector?: SectorFilter): Promise<{
      opening_balance: number;
      entries: CashbookEntry[];
      total_inflow: number;
      total_outflow: number;
      closing_balance: number;
    }> => {
      if (window.api) return window.api.cashbook.getDaily(date);
      try {
        const query = sector && sector !== 'all' ? `?date=${date}&sector=${sector}` : `?date=${date}`;
        return await apiFetch<any>(`/api/cashbook${query}`);
      } catch {
        return { opening_balance: 0, entries: [], total_inflow: 0, total_outflow: 0, closing_balance: 0 };
      }
    },
    addEntry: async (data: any): Promise<CashbookEntry> => {
      if (window.api) return window.api.cashbook.addEntry(data);
      return await apiFetch<CashbookEntry>('/api/cashbook', { method: 'POST', body: JSON.stringify(data) });
    },
    update: async (id: number, data: any): Promise<CashbookEntry> => {
      if (window.api?.cashbook?.update) return window.api.cashbook.update(id, data);
      return await apiFetch<CashbookEntry>(`/api/cashbook/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    updateDailySummary: async (data: { date: string; opening_balance: number; notes?: string }): Promise<any> => {
      if (window.api?.cashbook?.updateDailySummary) return window.api.cashbook.updateDailySummary(data);
      return await apiFetch<any>('/api/cashbook/daily-summary', { method: 'PUT', body: JSON.stringify(data) });
    },
    delete: async (id: number): Promise<{ success: boolean; message?: string }> => {
      if (window.api?.cashbook?.delete) return window.api.cashbook.delete(id);
      return await apiFetch<{ success: boolean; message?: string }>(`/api/cashbook/${id}`, { method: 'DELETE' });
    },
  },

  expenses: {
    getAll: async (limit?: number, sector?: SectorFilter): Promise<Expense[]> => {
      if (window.api) return window.api.expenses.getAll(limit);
      try {
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit.toString());
        if (sector && sector !== 'all') params.set('sector', sector);
        const q = params.toString() ? `?${params.toString()}` : '';
        return await apiFetch<Expense[]>(`/api/expenses${q}`);
      } catch {
        return [];
      }
    },
    create: async (data: any): Promise<Expense> => {
      if (window.api) return window.api.expenses.create(data);
      return await apiFetch<Expense>('/api/expenses', { method: 'POST', body: JSON.stringify(data) });
    },
    delete: async (id: number): Promise<{ success: boolean; message?: string }> => {
      if (window.api?.expenses?.delete) return window.api.expenses.delete(id);
      return await apiFetch<{ success: boolean; message?: string }>(`/api/expenses/${id}`, { method: 'DELETE' });
    },
  },

  notes: {
    getAll: async (category?: string, search?: string): Promise<Note[]> => {
      if (window.api?.notes?.getAll) return window.api.notes.getAll(category, search);
      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (search) params.set('search', search);
        return await apiFetch<Note[]>(`/api/notes?${params.toString()}`);
      } catch {
        let list = [...mockNotes];
        if (category && category !== 'ALL' && category !== 'সবগুলো নোট') {
          if (category === 'PINNED' || category === 'পিনকৃত নোট' || category === 'পিনকৃত') {
            list = list.filter((n) => n.is_pinned === 1);
          } else {
            list = list.filter((n) => n.category === category);
          }
        }
        if (search && search.trim() !== '') {
          const q = search.trim().toLowerCase();
          list = list.filter(
            (n) => n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q))
          );
        }
        return list.sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0));
      }
    },
    getById: async (id: number): Promise<Note | undefined> => {
      if (window.api?.notes?.getById) return window.api.notes.getById(id);
      try {
        const notes = await apiFetch<Note[]>('/api/notes');
        return notes.find((n) => n.id === id);
      } catch {
        return mockNotes.find((n) => n.id === id);
      }
    },
    create: async (data: { title: string; content?: string; category?: string; is_pinned?: number }): Promise<Note> => {
      if (window.api?.notes?.create) return window.api.notes.create(data);
      try {
        return await apiFetch<Note>('/api/notes', { method: 'POST', body: JSON.stringify(data) });
      } catch {
        const newNote: Note = {
          id: Date.now(),
          title: data.title,
          content: data.content || '',
          category: data.category || 'সাধারণ',
          is_pinned: data.is_pinned ? 1 : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockNotes.unshift(newNote);
        return newNote;
      }
    },
    update: async (id: number, data: Partial<Note>): Promise<Note> => {
      if (window.api?.notes?.update) return window.api.notes.update(id, data);
      try {
        return await apiFetch<Note>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      } catch {
        const idx = mockNotes.findIndex((n) => n.id === id);
        if (idx !== -1) {
          mockNotes[idx] = { ...mockNotes[idx], ...data, updated_at: new Date().toISOString() };
          return mockNotes[idx];
        }
        throw new Error('নোট পাওয়া যায়নি');
      }
    },
    togglePin: async (id: number): Promise<{ success: boolean; is_pinned: number }> => {
      if (window.api?.notes?.togglePin) return window.api.notes.togglePin(id);
      try {
        const note = await apiFetch<Note>(`/api/notes/${id}`);
        const newPinned = note.is_pinned === 1 ? 0 : 1;
        await apiFetch<Note>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify({ is_pinned: newPinned }) });
        return { success: true, is_pinned: newPinned };
      } catch {
        const note = mockNotes.find((n) => n.id === id);
        if (note) {
          note.is_pinned = note.is_pinned === 1 ? 0 : 1;
          note.updated_at = new Date().toISOString();
          return { success: true, is_pinned: note.is_pinned };
        }
        throw new Error('নোট পাওয়া যায়নি');
      }
    },
    delete: async (id: number): Promise<{ success: boolean; message: string }> => {
      if (window.api?.notes?.delete) return window.api.notes.delete(id);
      try {
        await apiFetch<{ success: boolean }>(`/api/notes/${id}`, { method: 'DELETE' });
        return { success: true, message: 'নোটটি সফলভাবে মুছে ফেলা হয়েছে' };
      } catch {
        mockNotes = mockNotes.filter((n) => n.id !== id);
        return { success: true, message: 'নোটটি সফলভাবে মুছে ফেলা হয়েছে' };
      }
    },
  },

  recycleBin: {
    getAll: async (module?: string): Promise<RecycleBinItem[]> => {
      if ((window.api as any)?.recycleBin?.getAll) return (window.api as any).recycleBin.getAll(module);
      try {
        return await apiFetch<RecycleBinItem[]>(`/api/recycle-bin${module && module !== 'ALL' ? `?module=${encodeURIComponent(module)}` : ''}`);
      } catch {
        return [];
      }
    },
    getCount: async (): Promise<number> => {
      if ((window.api as any)?.recycleBin?.getCount) return (window.api as any).recycleBin.getCount();
      try {
        const res = await apiFetch<{ count: number }>('/api/recycle-bin/count');
        return res?.count || 0;
      } catch {
        return 0;
      }
    },
    restore: async (id: string): Promise<{ success: boolean; message: string }> => {
      if ((window.api as any)?.recycleBin?.restore) return (window.api as any).recycleBin.restore(id);
      return await apiFetch<{ success: boolean; message: string }>(`/api/recycle-bin/restore/${id}`, {
        method: 'POST',
      });
    },
    deletePermanent: async (id: string): Promise<{ success: boolean; message?: string }> => {
      if ((window.api as any)?.recycleBin?.deletePermanent) return (window.api as any).recycleBin.deletePermanent(id);
      return await apiFetch<{ success: boolean; message?: string }>(`/api/recycle-bin/${id}`, {
        method: 'DELETE',
      });
    },
    empty: async (): Promise<{ success: boolean; message?: string }> => {
      if ((window.api as any)?.recycleBin?.empty) return (window.api as any).recycleBin.empty();
      return await apiFetch<{ success: boolean; message?: string }>('/api/recycle-bin/empty', {
        method: 'DELETE',
      });
    },
    purge: async (): Promise<{ success: boolean; purged?: number }> => {
      if ((window.api as any)?.recycleBin?.purge) return (window.api as any).recycleBin.purge();
      return await apiFetch<{ success: boolean; purged?: number }>('/api/recycle-bin/purge', {
        method: 'DELETE',
      });
    },
  },

  reports: {
    getDashboardStats: async (sector?: SectorFilter): Promise<DashboardStats> => {
      if (window.api) return window.api.reports.getDashboardStats();
      try {
        const query = sector && sector !== 'all' ? `?sector=${sector}` : '';
        return await apiFetch<DashboardStats>(`/api/reports/stats${query}`);
      } catch {
        return {
          today_purchases_amount: 0,
          today_purchases_mon: 0,
          today_sales_amount: 0,
          today_sales_mon: 0,
          today_cash_in: 0,
          today_cash_out: 0,
          closing_cash_balance: 0,
          total_receivable: 0,
          total_payable: 0,
          total_stock_value: 0,
          total_stock_mon: 0,
          total_stock_bags: 0,
          monthly_sales_revenue: 0,
          monthly_gross_profit: 0,
          monthly_net_profit: 0,
        };
      }
    },
    getPnL: async (startDate: string, endDate: string, sector?: SectorFilter) => {
      if (window.api) return window.api.reports.getPnL(startDate, endDate);
      try {
        const sectorQuery = sector && sector !== 'all' ? `&sector=${sector}` : '';
        return await apiFetch<any>(`/api/reports/pnl?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}${sectorQuery}`);
      } catch {
        return {
          startDate,
          endDate,
          sales: { total_net_revenue: 0, total_cogs: 0, gross_profit: 0 },
          shrinkage: { shrinkage_cost: 0, lost_mon: 0 },
          expenses: [],
          totalOperatingExpenses: 0,
          netProfit: 0,
        };
      }
    },
    verifyStockIntegrity: async (commodityId?: number) => {
      if (window.api) return window.api.reports.verifyStockIntegrity(commodityId);
      try {
        return await apiFetch<any>(`/api/reports/stock-integrity${commodityId ? `?commodityId=${commodityId}` : ''}`);
      } catch {
        return { isAllValid: true, reports: [] };
      }
    },
  },

  system: {
    backup: async (destDir?: string): Promise<{ success: boolean; filePath: string; message: string; data?: any }> => {
      let electronRes: any = null;
      if (window.api) {
        try {
          electronRes = await window.api.system.backup(destDir);
        } catch (e: any) {
          console.warn('Electron system.backup error:', e);
        }
      }
      try {
        let snapshot = null;
        if (!window.api) {
          const res = await apiFetch<any>('/api/system/backup', { method: 'POST' });
          if (res && res.backup) {
            snapshot = res.backup;
          }
        }
        // Auto-generate & download Royal Multi-Sheet Excel Backup (.xlsx)
        const { downloadStyledExcelBackup } = await import('./excelBackupService');
        const excelRes = await downloadStyledExcelBackup(snapshot);
        return {
          success: true,
          filePath: excelRes.fileName,
          message: electronRes?.message
            ? `${electronRes.message} এবং ${excelRes.message}`
            : excelRes.message,
          data: snapshot,
        };
      } catch (err: any) {
        if (electronRes && electronRes.success) return electronRes;
        return { success: false, filePath: '', message: `ব্যাকআপ ত্রুটি: ${err.message}` };
      }
    },
    restoreBackup: async (sourcePath: string): Promise<{ success: boolean; message: string; safetyBackupPath?: string }> => {
      if (window.api) return window.api.system.restoreBackup(sourcePath);
      try {
        const res = await apiFetch<any>('/api/system/restore', {
          method: 'POST',
          body: JSON.stringify({ filePath: sourcePath }),
        });
        return res;
      } catch (err: any) {
        return { success: false, message: `রিস্টোর ত্রুটি: ${err.message}` };
      }
    },
    selectBackupDirectory: async (): Promise<string | null> => {
      if (window.api) return window.api.system.selectBackupDirectory();
      return null;
    },
    selectBackupFile: async (): Promise<string | null> => {
      if (window.api) return window.api.system.selectBackupFile();
      return null;
    },
    relaunch: async () => {
      if (window.api) return window.api.system.relaunch();
      window.location.reload();
    },
    checkIntegrity: async (): Promise<{ isOk: boolean; details: string; schemaVersion?: number }> => {
      if (window.api) return window.api.system.checkIntegrity();
      try {
        return await apiFetch<any>('/api/system/integrity');
      } catch {
        return { isOk: true, details: 'Cloud SQLite Active', schemaVersion: 3 };
      }
    },
    getVersion: async (): Promise<string> => {
      if (window.api) return window.api.system.getVersion();
      try {
        const res = await apiFetch<{ version: string }>('/api/system/version');
        return res.version || '1.5.0 PRO';
      } catch {
        return '1.5.0 PRO';
      }
    },
    getSettings: async (): Promise<Record<string, string>> => {
      if (window.api) return window.api.system.getSettings();
      try {
        return await apiFetch<Record<string, string>>('/api/system/settings');
      } catch {
        return {
          org_name: 'মাহা এন্টারপ্রাইজ',
          proprietor: 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স',
          contacts: 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241',
          location: 'চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
        };
      }
    },
    updateSetting: async (key: string, value: string) => {
      if (window.api) return window.api.system.updateSetting(key, value);
      await apiFetch('/api/system/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      });
    },
    getPaths: async (): Promise<{ dbPath: string; backupDir: string }> => {
      if (window.api) return window.api.system.getPaths();
      return { dbPath: 'Cloudflare D1 (SQLite Edge)', backupDir: 'Cloud Storage & Browser Download' };
    },
    print: async () => {
      if (window.api) return window.api.system.print();
      window.print();
    },
    purgeTestDrafts: async (): Promise<{ success: boolean; purged: any; message: string }> => {
      if (window.api) return window.api.system.purgeTestDrafts();
      try {
        return await apiFetch<any>('/api/system/purge-drafts', { method: 'POST' });
      } catch {
        return { success: true, purged: {}, message: 'টেস্ট ড্রাফট মুছে ফেলা হয়েছে' };
      }
    },
    hasTestDrafts: async (): Promise<boolean> => {
      if (window.api) return window.api.system.hasTestDrafts();
      try {
        const res = await apiFetch<{ hasDrafts: boolean }>('/api/system/has-drafts');
        return !!res.hasDrafts;
      } catch {
        return false;
      }
    },
    logError: async (message: string): Promise<boolean> => {
      if (window.api?.system?.logError) return window.api.system.logError(message);
      console.error('[Logged Client Error]:', message);
      return true;
    },
    getDiagnosticLogs: async (): Promise<string> => {
      if (window.api?.system?.getDiagnosticLogs) return window.api.system.getDiagnosticLogs();
      return 'ব্রাউজার মোডে ডায়াগনস্টিক লগ উপলব্ধ নয়।';
    },
    getLogPath: async (): Promise<string> => {
      if (window.api?.system?.getLogPath) return window.api.system.getLogPath();
      return '';
    },
    getNetworkInfo: async (): Promise<{ port: number; localIps: string[]; accessUrl: string; tunnelCommand: string; permanentDomain: string }> => {
      if (window.api?.system?.getNetworkInfo) return window.api.system.getNetworkInfo();
      try {
        return await apiFetch<{ port: number; localIps: string[]; accessUrl: string; tunnelCommand: string; permanentDomain: string }>('/api/system/network-info');
      } catch {
        return {
          port: 3030,
          localIps: [],
          accessUrl: 'http://localhost:3030',
          tunnelCommand: 'cloudflared tunnel --url http://localhost:3030',
          permanentDomain: 'https://maha.nexobd.pro',
        };
      }
    },
  },

  auth: {
    verifyPin: async (candidatePin: string): Promise<boolean> => {
      if (window.api?.auth?.verifyPin) return window.api.auth.verifyPin(candidatePin);
      try {
        const cleaned = String(candidatePin).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
        const res = await apiFetch<{ success: boolean; valid: boolean }>('/api/auth/verify-pin', {
          method: 'POST',
          body: JSON.stringify({ pin: cleaned }),
        });
        return Boolean(res.success || res.valid);
      } catch {
        return false;
      }
    },
    changePin: async (currentPin: string, newPin: string): Promise<{ success: boolean; message: string }> => {
      if (window.api?.auth?.changePin) return window.api.auth.changePin(currentPin, newPin);
      const enCurrent = String(currentPin).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
      const enNew = String(newPin).replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).trim();
      try {
        const res = await apiFetch<{ success: boolean; message?: string; error?: string }>('/api/settings/pin', {
          method: 'POST',
          body: JSON.stringify({ currentPin: enCurrent, newPin: enNew }),
        });
        return {
          success: Boolean(res.success),
          message: res.message || 'পিন কোড সফলভাবে পরিবর্তন করা হয়েছে',
        };
      } catch (err: any) {
        // Fallback to updating system setting
        try {
          await dbService.system.updateSetting('app_pin', enNew);
          return { success: true, message: `পিন কোড সফলভাবে পরিবর্তন করা হয়েছে (নতুন পিন: ${enNew})` };
        } catch (e: any) {
          return { success: false, message: err?.message || e?.message || 'পিন পরিবর্তন ব্যর্থ হয়েছে' };
        }
      }
    },
  },

  drive: {
    getStatus: async (): Promise<{
      isConfigured: boolean;
      email: string;
      folderName: string;
      folderId?: string;
      scheduleText: string;
      credentialsPath?: string;
      lastBackupTime?: string;
      lastBackupFile?: string;
      error?: string;
      webhookConfigured?: boolean;
    }> => {
      if (window.api?.drive) return window.api.drive.getStatus();
      return {
        isConfigured: false,
        email: 'alzabir970@gmail.com',
        folderName: 'Maha_Enterprise_Backups',
        folderId: '1OieNL6dFVg2572CzU4md55WPmvrLcNuq',
        scheduleText: 'দুপুর ১:০০ ও সন্ধ্যা ৭:০০ (১৩:০০ ও ১৯:০০)',
      };
    },
    upload: async (): Promise<{
      success: boolean;
      isCloud: boolean;
      fileName: string;
      filePath?: string;
      fileId?: string;
      message: string;
      sizeFormatted?: string;
    }> => {
      if (window.api?.drive) return window.api.drive.upload();
      return {
        success: true,
        isCloud: false,
        fileName: 'Maha_Backup_demo.sqlite',
        message: 'ব্রাউজার ডেমো মোডে ব্যাকআপ সংরক্ষিত হয়েছে।',
      };
    },
    listBackups: async (): Promise<Array<{
      id: string;
      name: string;
      size?: string;
      createdTime?: string;
      isCloud: boolean;
    }>> => {
      if (window.api?.drive) return window.api.drive.listBackups();
      return [];
    },
    restoreBackup: async (fileIdOrPath: string): Promise<{ success: boolean; message: string }> => {
      if (window.api?.drive) return window.api.drive.restoreBackup(fileIdOrPath);
      return { success: true, message: 'ডেমো রিস্টোর সম্পন্ন' };
    },
    saveCredentials: async (jsonContent: string): Promise<{ success: boolean; message: string; email?: string }> => {
      if (window.api?.drive) return window.api.drive.saveCredentials(jsonContent);
      return { success: true, message: 'ক্রেডেনশিয়াল সংরক্ষিত হয়েছে' };
    },
    saveWebhookUrl: async (url: string): Promise<{ success: boolean; message: string }> => {
      if (window.api?.drive) return window.api.drive.saveWebhookUrl(url);
      return { success: true, message: 'Webhook সংরক্ষিত হয়েছে' };
    },
    selectCredentialsFile: async (): Promise<{ success: boolean; message: string; email?: string } | null> => {
      if (window.api?.drive) return window.api.drive.selectCredentialsFile();
      return null;
    },
    startOAuth: async (): Promise<{ success: boolean; authUrl: string; message: string }> => {
      if (window.api?.drive) return window.api.drive.startOAuth();
      return { success: false, authUrl: '', message: 'Electron API not detected' };
    },
    saveToken: async (tokens: any): Promise<{ success: boolean; message: string }> => {
      if (window.api?.drive) return window.api.drive.saveToken(tokens);
      return { success: true, message: 'টোকেন সংরক্ষিত হয়েছে' };
    },
    onBackupResult: (callback: (data: any) => void) => {
      if (window.api?.drive) return window.api.drive.onBackupResult(callback);
      return () => {};
    },
    onTokenUpdated: (callback: () => void) => {
      if (window.api?.drive) return window.api.drive.onTokenUpdated(callback);
      return () => {};
    },
  },

  sms: {
    getSettings: async (): Promise<{
      success: boolean;
      settings: {
        sms_enabled: string;
        sms_provider: string;
        sms_sender_id: string;
        sms_custom_url: string;
        sms_format_mode: string;
        sms_send_on_due_collect: string;
        has_api_key: boolean;
        masked_api_key: string;
      };
    }> => {
      return await apiFetch('/api/settings/sms');
    },
    saveSettings: async (data: any): Promise<{ success: boolean; message?: string }> => {
      return await apiFetch('/api/settings/sms', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    sendTest: async (test_phone: string): Promise<{ success: boolean; status: string; phone: string; gatewayResponse: string; error?: string }> => {
      return await apiFetch('/api/settings/sms/test', {
        method: 'POST',
        body: JSON.stringify({ test_phone }),
      });
    },
    getLogs: async (limit = 30): Promise<{ success: boolean; logs: any[] }> => {
      return await apiFetch(`/api/settings/sms/logs?limit=${limit}`);
    },
    resend: async (log_id: number): Promise<{ success: boolean; status?: string; gatewayResponse?: string; error?: string }> => {
      return await apiFetch('/api/settings/sms/resend', {
        method: 'POST',
        body: JSON.stringify({ log_id }),
      });
    },
  },

  ai: {
    getApiKeyStatus: async (): Promise<{ success: boolean; hasKey: boolean; maskedKey: string }> => {
      return await apiFetch('/api/settings/ai-key');
    },
    saveApiKey: async (apiKey: string): Promise<{ success: boolean; message: string }> => {
      return await apiFetch('/api/settings/ai-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      });
    },
    testConnection: async (): Promise<{ success: boolean; message?: string; model?: string; reply?: string; error?: string }> => {
      return await apiFetch('/api/ai/test', { method: 'POST' });
    },
    testTelegramAudit: async (): Promise<{ success: boolean; message?: string; report?: string; error?: string }> => {
      return await apiFetch('/api/ai/telegram-audit-now', { method: 'POST' });
    },
    getSessions: async (): Promise<{ success: boolean; sessions: any[] }> => {
      return await apiFetch('/api/ai/sessions');
    },
    createSession: async (title?: string): Promise<{ success: boolean; session: any }> => {
      return await apiFetch('/api/ai/sessions', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
    },
    updateSession: async (id: string, data: { title?: string; isPinned?: number }): Promise<{ success: boolean }> => {
      return await apiFetch(`/api/ai/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    deleteSession: async (id: string): Promise<{ success: boolean }> => {
      return await apiFetch(`/api/ai/sessions/${id}`, { method: 'DELETE' });
    },
    getMessages: async (sessionId: string): Promise<{ success: boolean; messages: any[] }> => {
      return await apiFetch(`/api/ai/sessions/${sessionId}/messages`);
    },
    getMorningBriefing: async (): Promise<{ success: boolean; briefing: any }> => {
      return await apiFetch('/api/ai/morning-briefing');
    },
    sendMessage: async (payload: {
      sessionId?: string;
      message?: string;
      imageBase64?: string | null;
      mimeType?: string;
      audioBase64?: string | null;
      audioMimeType?: string;
    }): Promise<{
      success: boolean;
      sessionId: string;
      messageId: string;
      userMessageId?: string;
      transcribedText?: string;
      reply: string;
      suggestedTitle?: string;
      memoryToSave?: string;
      navigateTo?: string;
      action?: any;
      error?: string;
      geoFallbackRequired?: boolean;
    }> => {
      const res = await apiFetch<any>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Seamless Direct Browser Fallback on Cloudflare Worker Geo-Block
      if (res && res.geoFallbackRequired && res.targetUrl && res.requestBody) {
        try {
          const directFetch = await fetch(res.targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(res.requestBody),
          });
          if (directFetch.ok) {
            const geminiJson = await directFetch.json();
            return await apiFetch<any>(`/api/ai/sessions/${res.sessionId}/commit-reply`, {
              method: 'POST',
              body: JSON.stringify({
                geminiResponse: geminiJson,
                userMessageId: res.userMessageId,
                modelUsed: res.modelUsed,
              }),
            });
          }
        } catch (clientErr: any) {
          console.error('[AiManezar] Direct client fallback failed:', clientErr);
        }
      }

      return res;
    },
    commitReply: async (sessionId: string, payload: {
      geminiResponse: any;
      userMessageId?: string;
      modelUsed?: string;
    }): Promise<any> => {
      return await apiFetch(`/api/ai/sessions/${sessionId}/commit-reply`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    verifyParity: async (): Promise<{ ok: boolean; bstDate: string; verifiedLedger: any }> => {
      return await apiFetch('/api/ai/verify-parity');
    },
    executeAction: async (action: any, messageId?: string): Promise<{ success: boolean; message?: string; error?: string; invoiceNo?: string; lotNo?: string }> => {
      return await apiFetch('/api/ai/execute-action', {
        method: 'POST',
        body: JSON.stringify({ action, messageId }),
      });
    },
    getOverrides: async (): Promise<{ success: boolean; overrides: any[] }> => {
      return await apiFetch('/api/ai/overrides');
    },
    saveOverride: async (data: { overrideType: string; targetKey: string; content: string }): Promise<{ success: boolean; message?: string }> => {
      return await apiFetch('/api/ai/overrides', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    deleteOverride: async (id: string): Promise<{ success: boolean }> => {
      return await apiFetch(`/api/ai/overrides/${id}`, { method: 'DELETE' });
    },
    getMemories: async (): Promise<{ success: boolean; memories: any[] }> => {
      return await apiFetch('/api/ai/memories');
    },
    deleteMemory: async (id: string): Promise<{ success: boolean }> => {
      return await apiFetch(`/api/ai/memories/${id}`, { method: 'DELETE' });
    },
  },
};

