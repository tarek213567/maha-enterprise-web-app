import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { runMigrations, APP_VERSION } from './migrations';
import {
  roundMoney,
  roundWeight,
  addMoney,
  subMoney,
  multiplyMoney,
  addWeight,
  subWeight,
} from './precision';
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
} from '../types';

export class AppDatabase {
  private db: Database.Database;
  private dbPath: string;
  private backupDir: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else {
      const baseDir = app ? app.getPath('userData') : path.join(process.cwd(), 'data');
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      this.dbPath = path.join(baseDir, 'maha_enterprise.db');
    }

    this.backupDir = path.join(path.dirname(this.dbPath), 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.initDatabase();
  }

  private initDatabase() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    runMigrations(this.db);
    this.db.exec('CREATE VIEW IF NOT EXISTS ledger_transactions AS SELECT * FROM party_ledger;');
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public getBackupDir(): string {
    const saved = this.getSetting('backup_dir');
    if (saved && fs.existsSync(saved)) {
      this.backupDir = saved;
    }
    return this.backupDir;
  }

  public setBackupDir(newDir: string): boolean {
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    this.backupDir = newDir;
    this.updateSetting('backup_dir', newDir);
    return true;
  }

  public getSetting(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  public getAppVersion(): string {
    return APP_VERSION;
  }

  // ==================== COMMODITIES ====================
  public getAllCommodities(): Commodity[] {
    const stmt = this.db.prepare('SELECT * FROM commodities WHERE is_active = 1 ORDER BY id ASC');
    return stmt.all() as Commodity[];
  }

  public getCommodityById(id: number): Commodity | undefined {
    const stmt = this.db.prepare('SELECT * FROM commodities WHERE id = ?');
    return stmt.get(id) as Commodity | undefined;
  }

  public createCommodity(data: {
    name_bn: string;
    name_en: string;
    default_bag_weight_kg: number;
    notes?: string;
  }): Commodity {
    const stmt = this.db.prepare(`
      INSERT INTO commodities (name_bn, name_en, default_bag_weight_kg, notes)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(data.name_bn, data.name_en, roundWeight(data.default_bag_weight_kg), data.notes || '');
    return this.getCommodityById(Number(info.lastInsertRowid))!;
  }

  public updateCommodity(id: number, data: Partial<Commodity>): Commodity {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name_bn !== undefined) { fields.push('name_bn = ?'); values.push(data.name_bn); }
    if (data.name_en !== undefined) { fields.push('name_en = ?'); values.push(data.name_en); }
    if (data.default_bag_weight_kg !== undefined) { fields.push('default_bag_weight_kg = ?'); values.push(roundWeight(data.default_bag_weight_kg)); }
    if (data.current_stock_kg !== undefined) { fields.push('current_stock_kg = ?'); values.push(roundWeight(data.current_stock_kg)); }
    if (data.current_stock_bags !== undefined) { fields.push('current_stock_bags = ?'); values.push(Math.round(data.current_stock_bags)); }
    if (data.current_wac_per_kg !== undefined) { fields.push('current_wac_per_kg = ?'); values.push(roundMoney(data.current_wac_per_kg)); }
    if (data.current_wac_per_mon !== undefined) { fields.push('current_wac_per_mon = ?'); values.push(roundMoney(data.current_wac_per_mon)); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    fields.push("updated_at = datetime('now', 'localtime')");
    values.push(id);

    this.db.prepare(`UPDATE commodities SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getCommodityById(id)!;
  }

  public deleteCommodity(id: number, force: boolean = false): { success: boolean; message?: string } {
    const commodity = this.getCommodityById(id);
    if (!commodity) {
      return { success: false, message: 'শস্যের তথ্য পাওয়া যায়নি।' };
    }

    const pRow = this.db.prepare('SELECT COUNT(*) as count FROM purchases WHERE commodity_id = ?').get(id) as { count: number };
    const sRow = this.db.prepare('SELECT COUNT(*) as count FROM sales WHERE commodity_id = ?').get(id) as { count: number };
    const aRow = this.db.prepare('SELECT COUNT(*) as count FROM stock_adjustments WHERE commodity_id = ?').get(id) as { count: number };

    const hasTransactions = (pRow?.count || 0) > 0 || (sRow?.count || 0) > 0 || (aRow?.count || 0) > 0;
    const hasStock = (commodity.current_stock_kg || 0) > 0 || (commodity.current_stock_bags || 0) > 0;

    if (!force && (hasTransactions || hasStock)) {
      const reasons: string[] = [];
      if (hasTransactions) reasons.push('সক্রিয় লেনদেন');
      if (hasStock) reasons.push('গুদামে মজুত স্টক');
      return {
        success: false,
        message: `এই শস্যের অধীনে ${reasons.join(' ও ')} রয়েছে। মুছে ফেলা সম্ভব নয়।`
      };
    }

    const delTx = this.db.transaction(() => {
      if (force) {
        this.db.prepare('DELETE FROM stock_adjustments WHERE commodity_id = ?').run(id);
        this.db.prepare('DELETE FROM sales WHERE commodity_id = ?').run(id);
        this.db.prepare('DELETE FROM purchases WHERE commodity_id = ?').run(id);
      }
      this.db.prepare('DELETE FROM commodities WHERE id = ?').run(id);
    });

    delTx();
    return { success: true };
  }

  // ==================== PARTIES ====================
  public getAllParties(type?: PartyType): Party[] {
    let sql = `
      SELECT p.*,
        (SELECT credit FROM party_ledger WHERE party_id = p.id AND credit > 0 ORDER BY datetime(entry_date) DESC, id DESC LIMIT 1) as last_payment
      FROM parties p
      WHERE p.is_active = 1
    `;
    const params: any[] = [];
    if (type) {
      sql += " AND (p.party_type = ? OR p.party_type = 'BOTH')";
      params.push(type);
    }
    sql += ' ORDER BY p.is_pinned DESC, p.updated_at DESC, p.id DESC';
    return this.db.prepare(sql).all(...params) as Party[];
  }

  public togglePartyPin(id: number): { success: boolean; is_pinned: number; message?: string } {
    const party = this.getPartyById(id);
    if (!party) throw new Error('গ্রাহক পাওয়া যায়নি');

    const currentlyPinned = (party as any).is_pinned === 1;
    if (!currentlyPinned) {
      const countRes = this.db.prepare("SELECT COUNT(*) as c FROM parties WHERE is_active = 1 AND is_pinned = 1").get() as { c: number };
      if (countRes.c >= 10) {
        throw new Error('সর্বোচ্চ ১০টি হিসাব পিন করে রাখা যাবে');
      }
    }

    const nextState = currentlyPinned ? 0 : 1;
    this.db.prepare("UPDATE parties SET is_pinned = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(nextState, id);
    return { success: true, is_pinned: nextState };
  }

  public getPartyById(id: number): Party | undefined {
    return this.db.prepare(`
      SELECT p.*,
        (SELECT credit FROM party_ledger WHERE party_id = p.id AND credit > 0 ORDER BY datetime(entry_date) DESC, id DESC LIMIT 1) as last_payment
      FROM parties p WHERE p.id = ?
    `).get(id) as Party | undefined;
  }

  public createParty(data: {
    name: string;
    phone?: string;
    address: string;
    party_type: PartyType;
    opening_balance: number;
    notes?: string;
    is_test_draft?: number;
  }): Party {
    const isTest = data.is_test_draft ? 1 : 0;
    const createTx = this.db.transaction(() => {
      const openBal = roundMoney(data.opening_balance);
      const cleanPhone = (data.phone && data.phone.trim()) ? data.phone.trim() : '';
      const stmt = this.db.prepare(`
        INSERT INTO parties (name, phone, address, party_type, opening_balance, current_balance, notes, is_test_draft)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        data.name.trim(),
        cleanPhone,
        data.address.trim() || 'চাঁচকৈড় বাজার, গুরুদাসপুর',
        data.party_type,
        openBal,
        openBal,
        data.notes || '',
        isTest
      );
      const partyId = Number(info.lastInsertRowid);

      if (openBal !== 0) {
        this.db.prepare(`
          INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
          VALUES (date('now', 'localtime'), ?, 'OPENING', 'OPN-001', ?, ?, ?, ?, ?)
        `).run(
          partyId,
          openBal > 0 ? openBal : 0,
          openBal < 0 ? Math.abs(openBal) : 0,
          openBal,
          isTest,
          'প্রারম্ভিক জের (Opening Balance)'
        );
      }
      return partyId;
    });

    const newId = createTx();
    return this.getPartyById(newId)!;
  }

  public updateParty(id: number, data: Partial<Party>): Party {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name.trim()); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone ? data.phone.trim() : ''); }
    if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address.trim()); }
    if (data.party_type !== undefined) { fields.push('party_type = ?'); values.push(data.party_type); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    fields.push("updated_at = datetime('now', 'localtime')");
    values.push(id);

    this.db.prepare(`UPDATE parties SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getPartyById(id)!;
  }

  public deleteParty(id: number): { success: boolean; message: string } {
    const salesCount = (this.db.prepare('SELECT COUNT(*) as c FROM sales WHERE party_id = ?').get(id) as any)?.c || 0;
    const purchasesCount = (this.db.prepare('SELECT COUNT(*) as c FROM purchases WHERE party_id = ?').get(id) as any)?.c || 0;
    if (salesCount > 0 || purchasesCount > 0) {
      this.db.prepare("UPDATE parties SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?").run(id);
      return { success: true, message: 'পার্টির পূর্বের লেনদেন রেকর্ড থাকায় অ্যাকাউন্টটি নিষ্ক্রিয় (Archived) করা হয়েছে।' };
    } else {
      this.db.prepare('DELETE FROM party_ledger WHERE party_id = ?').run(id);
      this.db.prepare('DELETE FROM parties WHERE id = ?').run(id);
      return { success: true, message: 'পার্টি সফলভাবে মুছে ফেলা হয়েছে।' };
    }
  }

  public recordPartyDueAdjustment(data: {
    party_id: number;
    amount: number;
    entry_date: string;
    description: string;
    is_test_draft?: number;
  }): { success: boolean; newBalance: number } {
    const party = this.getPartyById(data.party_id);
    if (!party) throw new Error('পার্টি পাওয়া যায়নি');

    const amt = roundMoney(data.amount);
    const newBalance = addMoney(party.current_balance, amt);
    const isTest = data.is_test_draft ? 1 : 0;

    const tx = this.db.transaction(() => {
      this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(newBalance, data.party_id);

      this.db.prepare(`
        INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
        VALUES (?, ?, 'ADJUSTMENT', ?, 0, ?, ?, ?)
      `).run(data.entry_date, data.party_id, amt, newBalance, isTest, data.description || 'পূর্বের বকেয়া হিসাব সংযোজন');
    });

    tx();
    return { success: true, newBalance };
  }

  // ==================== PURCHASES (ক্রয় ও স্টক-ইন) ====================
  public createPurchase(data: {
    purchase_date: string;
    party_id: number;
    commodity_id: number;
    bags_count: number;
    gross_weight_kg: number;
    bag_deduction_kg: number;
    rate_per_mon: number;
    labor_cost: number;
    transport_cost: number;
    bag_cost: number;
    other_cost: number;
    payment_method: PaymentMethod;
    paid_amount: number;
    notes?: string;
    seller_name?: string;
    seller_phone?: string;
    is_test_draft?: number;
  }): Purchase {
    const isTest = data.is_test_draft ? 1 : 0;
    const purchaseTx = this.db.transaction(() => {
      // Resolve party if not provided
      let partyId = data.party_id;
      if (!partyId || partyId <= 0) {
        const sellerName = (data.seller_name || (data as any).supplier_name || 'সাধারণ বিক্রেতা').trim();
        const sellerPhone = (data.seller_phone || (data as any).phone || '').trim();
        let existing = this.db.prepare("SELECT id FROM parties WHERE name = ? AND (party_type = 'SUPPLIER' OR party_type = 'BOTH')").get(sellerName) as { id: number } | undefined;
        if (!existing) {
          existing = this.db.prepare("SELECT id FROM parties WHERE name = ?").get(sellerName) as { id: number } | undefined;
        }
        if (!existing) {
          const ins = this.db.prepare("INSERT INTO parties (name, phone, address, party_type, opening_balance, current_balance, is_test_draft) VALUES (?, ?, 'চাঁচকৈড় বাজার, গুরুদাসপুর', 'SUPPLIER', 0, 0, ?)").run(sellerName, sellerPhone, isTest);
          partyId = Number(ins.lastInsertRowid);
        } else {
          partyId = existing.id;
        }
      }

      // 1. High-precision calculations
      const grossKg = roundWeight(data.gross_weight_kg);
      const bagDedKg = roundWeight(data.bag_deduction_kg !== undefined ? data.bag_deduction_kg : (data as any).empty_bag_weight_kg || 0);
      const net_weight_kg = roundWeight(Math.max(0, grossKg - bagDedKg));
      const net_weight_mon = roundWeight(net_weight_kg / 40.0);
      const rateMon = roundMoney(data.rate_per_mon);
      const gross_amount = roundMoney((net_weight_kg / 40.0) * rateMon);

      const labor = roundMoney(data.labor_cost || 0);
      const transport = roundMoney(data.transport_cost || 0);
      const bag = roundMoney(data.bag_cost || 0);
      const other = roundMoney(data.other_cost || 0);
      const totalDirectExpenses = addMoney(addMoney(labor, transport), addMoney(bag, other));
      const total_landed_cost = addMoney(gross_amount, totalDirectExpenses);
      const cost_per_kg = net_weight_kg > 0 ? total_landed_cost / net_weight_kg : 0;
      const cost_per_mon = roundMoney(cost_per_kg * 40.0);

      const paid_amount = roundMoney(Math.min(gross_amount, data.paid_amount || 0));
      const due_amount = roundMoney(Math.max(0, subMoney(gross_amount, paid_amount)));

      // Strict Payment Method Mapping adhering to CHECK(payment_method IN ('CASH', 'BANK', 'DUE', 'PARTIAL'))
      const rawMethod = String(data.payment_method || (data as any).payment_mode || '').trim().toUpperCase();
      let paymentMethod: 'CASH' | 'BANK' | 'DUE' | 'PARTIAL' = 'CASH';
      if (rawMethod === 'CASH' || rawMethod === 'নগদ' || rawMethod === 'নগদ পরিশোধ') {
        paymentMethod = 'CASH';
      } else if (rawMethod === 'BANK' || rawMethod === 'ব্যাংক') {
        paymentMethod = 'BANK';
      } else if (rawMethod === 'DUE' || rawMethod === 'CREDIT' || rawMethod === 'UNPAID' || rawMethod === 'সম্পূর্ণ বাকি' || rawMethod === 'বাকি') {
        paymentMethod = 'DUE';
      } else if (rawMethod === 'PARTIAL' || rawMethod === 'আংশিক বাকি' || rawMethod === 'আংশিক') {
        paymentMethod = 'PARTIAL';
      } else if (due_amount <= 0) {
        paymentMethod = 'CASH';
      } else if (paid_amount <= 0) {
        paymentMethod = 'DUE';
      } else {
        paymentMethod = 'PARTIAL';
      }

      // Invoice number
      const countRes = this.db.prepare('SELECT COUNT(*) as c FROM purchases').get() as { c: number };
      const nextNum = (countRes.c + 1).toString().padStart(4, '0');
      const dateStr = data.purchase_date.replace(/-/g, '');
      const invoice_no = `PUR-${dateStr}-${nextNum}`;

      // 2. Fetch commodity to calculate new Weighted Average Cost (WAC)
      const commodity = this.getCommodityById(data.commodity_id);
      if (!commodity) throw new Error('শস্যের তথ্য পাওয়া যায়নি');

      const oldStockKg = roundWeight(commodity.current_stock_kg);
      const oldWacPerKg = commodity.current_wac_per_kg;
      let newWacPerKg = cost_per_kg;

      if (oldStockKg > 0) {
        newWacPerKg = ((oldStockKg * oldWacPerKg) + total_landed_cost) / (oldStockKg + net_weight_kg);
      }
      const newWacPerMon = roundMoney(newWacPerKg * 40.0);
      const newStockKg = addWeight(oldStockKg, net_weight_kg);
      const newStockBags = commodity.current_stock_bags + data.bags_count;

      // 3. Insert Purchase Record
      const insertPurchase = this.db.prepare(`
        INSERT INTO purchases (
          invoice_no, purchase_date, party_id, commodity_id, bags_count,
          gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
          rate_per_mon, gross_amount, labor_cost, transport_cost, bag_cost, other_cost,
          total_landed_cost, cost_per_mon, cost_per_kg, payment_method,
          paid_amount, due_amount, previous_wac_per_kg, new_wac_per_kg, is_test_draft, notes
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      const res = insertPurchase.run(
        invoice_no, data.purchase_date, partyId, data.commodity_id, data.bags_count,
        grossKg, bagDedKg, net_weight_kg, net_weight_mon,
        rateMon, gross_amount, labor, transport, bag, other,
        total_landed_cost, cost_per_mon, cost_per_kg, paymentMethod,
        paid_amount, due_amount, oldWacPerKg, newWacPerKg, isTest, data.notes || ''
      );
      const purchaseId = Number(res.lastInsertRowid);

      // 4. Update Commodity Stock and WAC
      this.db.prepare(`
        UPDATE commodities SET
          current_stock_kg = ?,
          current_stock_bags = ?,
          current_wac_per_kg = ?,
          current_wac_per_mon = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(newStockKg, newStockBags, newWacPerKg, newWacPerMon, data.commodity_id);

      // 5. Update Party Balance & Party Ledger
      const party = this.getPartyById(partyId);
      if (!party) throw new Error('পার্টির তথ্য পাওয়া যায়নি');

      const netSupplierChange = subMoney(paid_amount, gross_amount);
      const newPartyBalance = addMoney(party.current_balance, netSupplierChange);

      this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(newPartyBalance, partyId);

      const commodityName = commodity.name_bn;
      this.db.prepare(`
        INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_id, reference_no, debit, credit, running_balance, is_test_draft, description)
        VALUES (?, ?, 'PURCHASE', ?, ?, 0, ?, ?, ?, ?)
      `).run(
        data.purchase_date,
        partyId,
        purchaseId,
        invoice_no,
        gross_amount,
        subMoney(party.current_balance, gross_amount),
        isTest,
        `ক্রয়: ${commodityName} (${net_weight_mon.toFixed(2)} মন / ${data.bags_count} বস্তা @ ৳${rateMon}/মন)`
      );

      if (paid_amount > 0) {
        this.db.prepare(`
          INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_id, reference_no, debit, credit, running_balance, is_test_draft, description)
          VALUES (?, ?, 'PAYMENT_GIVEN', ?, ?, ?, 0, ?, ?, ?)
        `).run(
          data.purchase_date,
          partyId,
          purchaseId,
          invoice_no,
          paid_amount,
          newPartyBalance,
          isTest,
          `নগদ পরিশোধ (ক্রয় বিল নং: ${invoice_no})`
        );

        this.db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_id, reference_no, party_id, is_test_draft, description)
          VALUES (?, 'OUTFLOW', 'PURCHASE_CASH', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.purchase_date,
          paid_amount,
          data.payment_method === 'BANK' ? 'BANK' : 'CASH',
          purchaseId,
          invoice_no,
          partyId,
          isTest,
          `শস্য ক্রয়ে পরিশোধ: ${party.name} (${commodityName})`
        );
      }

      if (totalDirectExpenses > 0) {
        this.db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_id, reference_no, party_id, is_test_draft, description)
          VALUES (?, 'OUTFLOW', 'EXPENSE', ?, 'CASH', ?, ?, ?, ?, ?)
        `).run(
          data.purchase_date,
          totalDirectExpenses,
          purchaseId,
          invoice_no,
          partyId,
          isTest,
          `ক্রয় আনুষঙ্গিক খরচ (কুলি: ৳${labor}, গাড়ি: ৳${transport}, বস্তা: ৳${bag}, অন্যান্য: ৳${other}) - চালান: ${invoice_no}`
        );
      }

      return purchaseId;
    });

    const newPurchaseId = purchaseTx();
    return this.getPurchaseById(newPurchaseId)!;
  }

  public getPurchaseById(id: number): Purchase | undefined {
    const stmt = this.db.prepare(`
      SELECT p.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address,
             c.name_bn as commodity_name
      FROM purchases p
      JOIN parties pt ON p.party_id = pt.id
      JOIN commodities c ON p.commodity_id = c.id
      WHERE p.id = ?
    `);
    return stmt.get(id) as Purchase | undefined;
  }

  public getAllPurchases(limit = 100): Purchase[] {
    const stmt = this.db.prepare(`
      SELECT p.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address,
             c.name_bn as commodity_name
      FROM purchases p
      JOIN parties pt ON p.party_id = pt.id
      JOIN commodities c ON p.commodity_id = c.id
      ORDER BY p.id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as Purchase[];
  }

  public deletePurchase(id: number): { success: boolean } {
    const tx = this.db.transaction(() => {
      const p = this.db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as Purchase | undefined;
      if (!p) throw new Error('ক্রয় চালান পাওয়া যায়নি');

      // 1. Revert commodity stock
      this.db.prepare(`
        UPDATE commodities SET
          current_stock_kg = MAX(0, current_stock_kg - ?),
          current_stock_bags = MAX(0, current_stock_bags - ?),
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(p.net_weight_kg, p.bags_count, p.commodity_id);

      // 2. Revert party balance
      const party = this.getPartyById(p.party_id);
      if (party) {
        const netSupplierChange = subMoney(p.paid_amount, p.gross_amount);
        const revertedBalance = subMoney(party.current_balance, netSupplierChange);
        this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
          .run(revertedBalance, p.party_id);
      }

      // 3. Delete party ledger entries
      this.db.prepare("DELETE FROM party_ledger WHERE reference_id = ? AND transaction_type IN ('PURCHASE', 'PAYMENT_GIVEN')")
        .run(id);

      // 4. Delete cashbook entries
      this.db.prepare("DELETE FROM cashbook WHERE reference_id = ? AND (reference_no = ? OR category IN ('PURCHASE_CASH', 'EXPENSE'))")
        .run(id, p.invoice_no);

      // 5. Delete purchase record
      this.db.prepare('DELETE FROM purchases WHERE id = ?').run(id);

      return { success: true };
    });

    return tx();
  }

  // ==================== SALES (বিক্রয় ও চালান / স্টক-আউট) ====================
  public createSale(data: {
    sale_date: string;
    party_id: number;
    commodity_id: number;
    bags_count: number;
    gross_weight_kg: number;
    bag_deduction_kg: number;
    rate_per_mon: number;
    loading_charge: number;
    damaged_bag_deduction: number;
    discount_amount: number;
    payment_method: PaymentMethod;
    paid_amount: number;
    vehicle_no?: string;
    driver_name?: string;
    driver_phone?: string;
    destination?: string;
    notes?: string;
    is_test_draft?: number;
  }): Sale {
    const isTest = data.is_test_draft ? 1 : 0;
    const saleTx = this.db.transaction(() => {
      // 1. Fetch commodity & check stock constraints
      const commodity = this.getCommodityById(data.commodity_id);
      if (!commodity) throw new Error('শস্যের তথ্য পাওয়া যায়নি');

      const grossKg = roundWeight(data.gross_weight_kg);
      const bagDedKg = roundWeight(data.bag_deduction_kg !== undefined ? data.bag_deduction_kg : (data as any).empty_bag_weight_kg || 0);
      const net_weight_kg = roundWeight(Math.max(0, grossKg - bagDedKg));
      const net_weight_mon = roundWeight(net_weight_kg / 40.0);

      // Strict Negative Inventory Prevention
      if (commodity.current_stock_kg < net_weight_kg) {
        const curMon = (commodity.current_stock_kg / 40).toFixed(2);
        const reqMon = net_weight_mon.toFixed(2);
        throw new Error(
          `গুদামে পর্যাপ্ত মজুত নেই! বর্তমান মজুত: ${curMon} মন (${commodity.current_stock_kg} কেজি), কিন্তু বিক্রয়ের অনুরোধ: ${reqMon} মন (${net_weight_kg} কেজি)। নেতিবাচক স্টক অনুমোদিত নয়।`
        );
      }

      const rateMon = roundMoney(data.rate_per_mon);
      const gross_amount = roundMoney((net_weight_kg / 40.0) * rateMon);
      const loading = roundMoney(data.loading_charge !== undefined ? data.loading_charge : (data as any).loading_cost || 0);
      const damage = roundMoney(data.damaged_bag_deduction !== undefined ? data.damaged_bag_deduction : (data as any).deduction_amount || 0);
      const discount = roundMoney(data.discount_amount || 0);
      const net_invoice_amount = roundMoney(Math.max(0, subMoney(addMoney(gross_amount, loading), addMoney(damage, discount))));

      const paid_amount = roundMoney(data.paid_amount || 0);
      const due_amount = roundMoney(Math.max(0, subMoney(net_invoice_amount, paid_amount)));

      // Strict Payment Method Mapping adhering to CHECK(payment_method IN ('CASH', 'BANK', 'DUE', 'PARTIAL'))
      const rawSaleMethod = String(data.payment_method || (data as any).payment_mode || '').trim().toUpperCase();
      let paymentMethod: 'CASH' | 'BANK' | 'DUE' | 'PARTIAL' = 'CASH';
      if (rawSaleMethod === 'CASH' || rawSaleMethod === 'নগদ' || rawSaleMethod === 'নগদ পরিশোধ') {
        paymentMethod = 'CASH';
      } else if (rawSaleMethod === 'BANK' || rawSaleMethod === 'ব্যাংক') {
        paymentMethod = 'BANK';
      } else if (rawSaleMethod === 'DUE' || rawSaleMethod === 'CREDIT' || rawSaleMethod === 'UNPAID' || rawSaleMethod === 'সম্পূর্ণ বাকি' || rawSaleMethod === 'বাকি') {
        paymentMethod = 'DUE';
      } else if (rawSaleMethod === 'PARTIAL' || rawSaleMethod === 'আংশিক বাকি' || rawSaleMethod === 'আংশিক') {
        paymentMethod = 'PARTIAL';
      } else if (due_amount <= 0) {
        paymentMethod = 'CASH';
      } else if (paid_amount <= 0) {
        paymentMethod = 'DUE';
      } else {
        paymentMethod = 'PARTIAL';
      }

      const cogs_amount = roundMoney(net_weight_kg * commodity.current_wac_per_kg);
      const realized_profit = subMoney(net_invoice_amount, cogs_amount);

      const countRes = this.db.prepare('SELECT COUNT(*) as c FROM sales').get() as { c: number };
      const nextNum = (countRes.c + 1).toString().padStart(4, '0');
      const dateStr = data.sale_date.replace(/-/g, '');
      const invoice_no = `SAL-${dateStr}-${nextNum}`;

      // Resolve party if not provided
      let partyId = data.party_id;
      if (!partyId || partyId <= 0) {
        const custName = (data.customer_name || (data as any).buyer_name || (data as any).party_name || 'সাধারণ খুচরা ক্রেতা').trim();
        const custPhone = (data.customer_phone || (data as any).phone || '').trim();
        let existing = this.db.prepare("SELECT id FROM parties WHERE name = ? AND (party_type = 'BUYER' OR party_type = 'BOTH')").get(custName) as { id: number } | undefined;
        if (!existing) {
          existing = this.db.prepare("SELECT id FROM parties WHERE name = ?").get(custName) as { id: number } | undefined;
        }
        if (!existing) {
          const ins = this.db.prepare("INSERT INTO parties (name, phone, address, party_type, opening_balance, current_balance, is_test_draft) VALUES (?, ?, 'চাঁচকৈড় বাজার, গুরুদাসপুর', 'BUYER', 0, 0, ?)").run(custName, custPhone, isTest);
          partyId = Number(ins.lastInsertRowid);
        } else {
          partyId = existing.id;
        }
      }

      // 2. Insert Sale Record
      const insertSale = this.db.prepare(`
        INSERT INTO sales (
          invoice_no, sale_date, party_id, commodity_id, bags_count,
          gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
          rate_per_mon, gross_amount, loading_charge, damaged_bag_deduction, discount_amount,
          net_invoice_amount, payment_method, paid_amount, due_amount,
          vehicle_no, driver_name, driver_phone, destination,
          cogs_amount, realized_profit, is_test_draft, notes
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `);

      const res = insertSale.run(
        invoice_no, data.sale_date, partyId, data.commodity_id, data.bags_count,
        grossKg, bagDedKg, net_weight_kg, net_weight_mon,
        rateMon, gross_amount, loading, damage, discount,
        net_invoice_amount, paymentMethod, paid_amount, due_amount,
        data.vehicle_no || '', data.driver_name || '', data.driver_phone || '', data.destination || '',
        cogs_amount, realized_profit, isTest, data.notes || ''
      );
      const saleId = Number(res.lastInsertRowid);

      // 3. Deduct Stock safely
      const remainingStockKg = roundWeight(subWeight(commodity.current_stock_kg, net_weight_kg));
      const remainingBags = Math.max(0, commodity.current_stock_bags - data.bags_count);

      this.db.prepare(`
        UPDATE commodities SET
          current_stock_kg = ?,
          current_stock_bags = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(remainingStockKg, remainingBags, data.commodity_id);

      // 4. Update Party Balance and Ledger
      const party = this.getPartyById(partyId);
      if (!party) throw new Error('পার্টির তথ্য পাওয়া যায়নি');

      const netCustomerChange = subMoney(net_invoice_amount, paid_amount);
      const newPartyBalance = addMoney(party.current_balance, netCustomerChange);

      this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(newPartyBalance, partyId);

      const commodityName = commodity.name_bn;
      this.db.prepare(`
        INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_id, reference_no, debit, credit, running_balance, is_test_draft, description)
        VALUES (?, ?, 'SALE', ?, ?, ?, 0, ?, ?, ?)
      `).run(
        data.sale_date,
        partyId,
        saleId,
        invoice_no,
        net_invoice_amount,
        addMoney(party.current_balance, net_invoice_amount),
        isTest,
        `বিক্রয়: ${commodityName} (${net_weight_mon.toFixed(2)} মন / ${data.bags_count} বস্তা @ ৳${rateMon}/মন)`
      );

      if (paid_amount > 0) {
        this.db.prepare(`
          INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_id, reference_no, debit, credit, running_balance, is_test_draft, description)
          VALUES (?, ?, 'PAYMENT_RECEIVED', ?, ?, 0, ?, ?, ?, ?)
        `).run(
          data.sale_date,
          partyId,
          saleId,
          invoice_no,
          paid_amount,
          newPartyBalance,
          isTest,
          `নগদ আদায় (বিক্রয় বিল নং: ${invoice_no})`
        );

        this.db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_id, reference_no, party_id, is_test_draft, description)
          VALUES (?, 'INFLOW', 'SALE_CASH', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.sale_date,
          paid_amount,
          paymentMethod === 'BANK' ? 'BANK' : 'CASH',
          saleId,
          invoice_no,
          partyId,
          isTest,
          `বিক্রয় চালান আদায়: ${party.name} (${commodityName})`
        );
      }
          paid_amount,
          data.payment_method === 'BANK' ? 'BANK' : 'CASH',
          saleId,
          invoice_no,
          data.party_id,
          isTest,
          `বিক্রয় নগদ আদায়: ${party.name} (${commodityName})`
        );
      }

      return saleId;
    });

    const newSaleId = saleTx();
    return this.getSaleById(newSaleId)!;
  }

  public getSaleById(id: number): Sale | undefined {
    const stmt = this.db.prepare(`
      SELECT s.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address,
             c.name_bn as commodity_name
      FROM sales s
      JOIN parties pt ON s.party_id = pt.id
      JOIN commodities c ON s.commodity_id = c.id
      WHERE s.id = ?
    `);
    return stmt.get(id) as Sale | undefined;
  }

  public createSaleBatch(data: {
    sale_date: string;
    party_id?: number;
    customer_name?: string;
    customer_phone?: string;
    items: Array<{
      commodity_id: number;
      bags_count: number;
      gross_weight_kg?: number;
      bag_deduction_kg?: number;
      net_weight_mon?: number;
      rate_per_mon: number;
      total_amount?: number;
    }>;
    cash_paid: number;
    payment_method?: PaymentMethod;
    notes?: string;
    is_test_draft?: number;
  }): { success: boolean; invoice_no: string; sales: Sale[] } {
    if (!data.items || data.items.length === 0) {
      throw new Error('কার্টে কমপক্ষে একটি শস্যের আইটেম যোগ করুন');
    }

    const isTest = data.is_test_draft ? 1 : 0;
    const batchTx = this.db.transaction(() => {
      // 1. Resolve or create party
      let partyId = data.party_id;
      if (!partyId || partyId === 0) {
        const custName = (data.customer_name || 'সাধারণ খুচরা ক্রেতা').trim();
        const walkin = this.db.prepare("SELECT * FROM parties WHERE name = ? LIMIT 1").get(custName) as Party | undefined;
        if (walkin) {
          partyId = walkin.id;
        } else {
          const res = this.db.prepare(`
            INSERT INTO parties (name, phone, address, party_type, opening_balance, current_balance, is_test_draft)
            VALUES (?, ?, ?, 'BUYER', 0, 0, ?)
          `).run(custName, (data.customer_phone || '').trim(), 'চাঁচকৈড় বাজার, গুরুদাসপুর', isTest);
          partyId = Number(res.lastInsertRowid);
        }
      }

      const party = this.getPartyById(partyId);
      if (!party) throw new Error('ক্রেতার তথ্য পাওয়া যায়নি');

      // 2. Generate Base Invoice Number
      const countRes = this.db.prepare('SELECT COUNT(*) as c FROM sales').get() as { c: number };
      const nextNum = (countRes.c + 1).toString().padStart(4, '0');
      const dateStr = data.sale_date.replace(/-/g, '');
      const baseInvoiceNo = `SAL-${dateStr}-${nextNum}`;

      // 3. Process each item: Stock checks & calculations
      let grandTotalBill = 0;
      const createdSaleIds: number[] = [];
      const itemSummaries: string[] = [];

      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        const commodity = this.getCommodityById(item.commodity_id);
        if (!commodity) throw new Error(`শস্যের আইডি ${item.commodity_id} পাওয়া যায়নি`);

        // Compute weights
        const bagsCount = Math.max(1, Number(item.bags_count) || 1);
        let netMon = item.net_weight_mon ? Number(item.net_weight_mon) : (bagsCount * (commodity.default_bag_weight_kg || 80)) / 40;
        let netKg = roundWeight(netMon * 40);
        let grossKg = item.gross_weight_kg ? Number(item.gross_weight_kg) : netKg;
        let bagDedKg = item.bag_deduction_kg ? Number(item.bag_deduction_kg) : 0;

        // Check stock
        if (commodity.current_stock_kg < netKg) {
          const curMon = (commodity.current_stock_kg / 40).toFixed(1);
          throw new Error(`পর্যাপ্ত স্টক নেই! ${commodity.name_bn}-এর বর্তমান স্টক ${curMon} মণ (${commodity.current_stock_kg} কেজি)।`);
        }

        const rateMon = roundMoney(item.rate_per_mon);
        const itemTotal = roundMoney(netMon * rateMon);
        grandTotalBill = addMoney(grandTotalBill, itemTotal);

        const cogs = roundMoney(netKg * (commodity.current_wac_per_kg || 0));
        const profit = subMoney(itemTotal, cogs);

        // Sub-invoice string if multiple items
        const itemInvoiceNo = data.items.length > 1 ? `${baseInvoiceNo}-${idx + 1}` : baseInvoiceNo;

        // Insert into sales
        const insertStmt = this.db.prepare(`
          INSERT INTO sales (
            invoice_no, sale_date, party_id, commodity_id, bags_count,
            gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
            rate_per_mon, gross_amount, loading_charge, damaged_bag_deduction, discount_amount,
            net_invoice_amount, payment_method, paid_amount, due_amount,
            vehicle_no, driver_name, driver_phone, destination,
            cogs_amount, realized_profit, is_test_draft, notes
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, 0, 0, 0,
            ?, ?, ?, ?,
            '', '', '', '',
            ?, ?, ?, ?
          )
        `);

        // Attribute paid_amount proportionally or on first item
        const itemPaid = idx === 0 ? Math.min(itemTotal, data.cash_paid || 0) : 0;
        const itemDue = Math.max(0, subMoney(itemTotal, itemPaid));

        const res = insertStmt.run(
          itemInvoiceNo, data.sale_date, partyId, item.commodity_id, bagsCount,
          grossKg, bagDedKg, netKg, netMon,
          rateMon, itemTotal,
          itemTotal, data.payment_method || 'CASH', itemPaid, itemDue,
          cogs, profit, isTest, data.notes || ''
        );
        createdSaleIds.push(Number(res.lastInsertRowid));

        // Deduct inventory
        const newStockKg = roundWeight(subWeight(commodity.current_stock_kg, netKg));
        const newBags = Math.max(0, commodity.current_stock_bags - bagsCount);
        this.db.prepare(`
          UPDATE commodities SET
            current_stock_kg = ?,
            current_stock_bags = ?,
            updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(newStockKg, newBags, item.commodity_id);

        itemSummaries.push(`${commodity.name_bn} (${bagsCount} বস্তা, ${netMon.toFixed(1)} মণ @ ৳${rateMon})`);
      }

      // 4. Update Party Balance and Master Ledger
      const totalPaid = roundMoney(data.cash_paid || 0);
      const netCustomerChange = subMoney(grandTotalBill, totalPaid);
      const newPartyBalance = addMoney(party.current_balance, netCustomerChange);

      this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(newPartyBalance, partyId);

      this.db.prepare(`
        INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
        VALUES (?, ?, 'SALE', ?, ?, 0, ?, ?, ?)
      `).run(
        data.sale_date,
        partyId,
        baseInvoiceNo,
        grandTotalBill,
        addMoney(party.current_balance, grandTotalBill),
        isTest,
        `পাইকারি বিক্রয় চালান: ${itemSummaries.join(', ')}`
      );

      if (totalPaid > 0) {
        this.db.prepare(`
          INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
          VALUES (?, ?, 'PAYMENT_RECEIVED', ?, 0, ?, ?, ?, ?)
        `).run(
          data.sale_date,
          partyId,
          baseInvoiceNo,
          totalPaid,
          newPartyBalance,
          isTest,
          `নগদ আদায় (চালান নং: ${baseInvoiceNo})`
        );

        this.db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
          VALUES (?, 'INFLOW', 'SALE_CASH', ?, ?, ?, ?, ?, ?)
        `).run(
          data.sale_date,
          totalPaid,
          data.payment_method === 'BANK' ? 'BANK' : 'CASH',
          baseInvoiceNo,
          partyId,
          isTest,
          `চালান নগদ আদায়: ${party.name} (${baseInvoiceNo})`
        );
      }

      const createdSales = createdSaleIds.map(id => this.getSaleById(id)!);
      return { success: true, invoice_no: baseInvoiceNo, sales: createdSales };
    });

    return batchTx();
  }

  public getAllSales(limit = 100): Sale[] {
    const stmt = this.db.prepare(`
      SELECT s.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address,
             c.name_bn as commodity_name
      FROM sales s
      JOIN parties pt ON s.party_id = pt.id
      JOIN commodities c ON s.commodity_id = c.id
      ORDER BY s.id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as Sale[];
  }

  // ==================== STOCK ADJUSTMENT / WASTAGE (শুকতি ও ঘাটতি) ====================
  public createStockAdjustment(data: {
    adjustment_date: string;
    commodity_id: number;
    adjustment_type: 'SHRINKAGE' | 'DAMAGE' | 'SPILLAGE' | 'AUDIT_CORRECTION';
    lost_weight_kg: number;
    lost_bags: number;
    reason: string;
    notes?: string;
  }): StockAdjustment {
    const adjTx = this.db.transaction(() => {
      const commodity = this.getCommodityById(data.commodity_id);
      if (!commodity) throw new Error('শস্য পাওয়া যায়নি');

      const lostKg = roundWeight(data.lost_weight_kg);
      if (commodity.current_stock_kg < lostKg) {
        throw new Error('ঘাটতি ওজনের পরিমাণ বর্তমান মজুত স্টকের চেয়ে বেশি হতে পারে না!');
      }

      const lost_weight_mon = roundWeight(lostKg / 40.0);
      const cost_value = roundMoney(lostKg * commodity.current_wac_per_kg);

      const stmt = this.db.prepare(`
        INSERT INTO stock_adjustments (
          adjustment_date, commodity_id, adjustment_type, lost_weight_kg,
          lost_weight_mon, lost_bags, wac_at_time, cost_value, reason, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const res = stmt.run(
        data.adjustment_date,
        data.commodity_id,
        data.adjustment_type,
        lostKg,
        lost_weight_mon,
        data.lost_bags,
        commodity.current_wac_per_kg,
        cost_value,
        data.reason,
        data.notes || ''
      );
      const adjId = Number(res.lastInsertRowid);

      const newStockKg = roundWeight(subWeight(commodity.current_stock_kg, lostKg));
      const newStockBags = Math.max(0, commodity.current_stock_bags - data.lost_bags);

      this.db.prepare(`
        UPDATE commodities SET
          current_stock_kg = ?,
          current_stock_bags = ?,
          updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(newStockKg, newStockBags, data.commodity_id);

      return adjId;
    });

    const newId = adjTx();
    return this.getStockAdjustmentById(newId)!;
  }

  public getStockAdjustmentById(id: number): StockAdjustment | undefined {
    const stmt = this.db.prepare(`
      SELECT sa.*, c.name_bn as commodity_name
      FROM stock_adjustments sa
      JOIN commodities c ON sa.commodity_id = c.id
      WHERE sa.id = ?
    `);
    return stmt.get(id) as StockAdjustment | undefined;
  }

  public getAllStockAdjustments(limit = 100): StockAdjustment[] {
    const stmt = this.db.prepare(`
      SELECT sa.*, c.name_bn as commodity_name
      FROM stock_adjustments sa
      JOIN commodities c ON sa.commodity_id = c.id
      ORDER BY sa.id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as StockAdjustment[];
  }

  // ==================== STOCK INTEGRITY EQUATION VERIFICATION ====================
  /**
   * Mathematically checks stock integrity against historic ledger:
   * Total Net Stock = Purchases - Sales - Wastage/Drying Loss
   */
  public verifyStockIntegrity(commodityId?: number): {
    isAllValid: boolean;
    reports: {
      commodity_id: number;
      commodity_name: string;
      current_stock_kg: number;
      calculated_stock_kg: number;
      difference_kg: number;
      is_matching: boolean;
      purchased_kg: number;
      sold_kg: number;
      lost_kg: number;
    }[];
  } {
    let sql = `
      SELECT
        c.id, c.name_bn, c.current_stock_kg,
        COALESCE((SELECT SUM(net_weight_kg) FROM purchases WHERE commodity_id = c.id), 0) as total_purchased,
        COALESCE((SELECT SUM(net_weight_kg) FROM sales WHERE commodity_id = c.id), 0) as total_sold,
        COALESCE((SELECT SUM(lost_weight_kg) FROM stock_adjustments WHERE commodity_id = c.id), 0) as total_lost
      FROM commodities c
      WHERE c.is_active = 1
    `;
    const params: any[] = [];
    if (commodityId) {
      sql += ' AND c.id = ?';
      params.push(commodityId);
    }
    sql += ' ORDER BY c.id ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];

    let isAllValid = true;
    const reports = rows.map((r) => {
      const calculated = roundWeight(r.total_purchased - r.total_sold - r.total_lost);
      const current = roundWeight(r.current_stock_kg);
      const diff = roundWeight(current - calculated);
      const isMatching = Math.abs(diff) < 0.005;
      if (!isMatching) isAllValid = false;

      return {
        commodity_id: r.id,
        commodity_name: r.name_bn,
        current_stock_kg: current,
        calculated_stock_kg: calculated,
        difference_kg: diff,
        is_matching: isMatching,
        purchased_kg: roundWeight(r.total_purchased),
        sold_kg: roundWeight(r.total_sold),
        lost_kg: roundWeight(r.total_lost),
      };
    });

    return { isAllValid, reports };
  }

  // ==================== PARTY LEDGER & DIRECT VOUCHERS ====================
  public getPartyLedger(partyId: number): LedgerEntry[] {
    const stmt = this.db.prepare(`
      SELECT l.*, p.name as party_name
      FROM party_ledger l
      JOIN parties p ON l.party_id = p.id
      WHERE l.party_id = ?
      ORDER BY l.entry_date ASC, l.id ASC
    `);
    return stmt.all(partyId) as LedgerEntry[];
  }

  public recordPartyPaymentVoucher(data: {
    entry_date: string;
    party_id: number;
    type: 'PAYMENT_RECEIVED' | 'PAYMENT_GIVEN';
    amount: number;
    payment_mode: 'CASH' | 'BANK';
    description: string;
    is_test_draft?: number;
  }): { success: boolean; newBalance: number } {
    const isTest = data.is_test_draft ? 1 : 0;
    const voucherTx = this.db.transaction(() => {
      const party = this.getPartyById(data.party_id);
      if (!party) throw new Error('পার্টি পাওয়া যায়নি');

      const amt = roundMoney(data.amount);
      let debit = 0;
      let credit = 0;
      let newBalance = party.current_balance;

      if (data.type === 'PAYMENT_RECEIVED') {
        credit = amt;
        newBalance = subMoney(party.current_balance, amt);

        this.db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, is_test_draft, description)
          VALUES (?, 'INFLOW', 'DUE_COLLECTION', ?, ?, ?, ?, ?)
        `).run(data.entry_date, amt, data.payment_mode, data.party_id, isTest, `বকেয়া আদায়: ${party.name} (${data.description})`);
      } else {
        debit = amt;
        newBalance = addMoney(party.current_balance, amt);

        this.db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, is_test_draft, description)
          VALUES (?, 'OUTFLOW', 'SUPPLIER_PAYMENT', ?, ?, ?, ?, ?)
        `).run(data.entry_date, amt, data.payment_mode, data.party_id, isTest, `সাপ্লায়ার পাওনা পরিশোধ: ${party.name} (${data.description})`);
      }

      this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
        .run(newBalance, data.party_id);

      this.db.prepare(`
        INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(data.entry_date, data.party_id, data.type, debit, credit, newBalance, isTest, data.description);

      return newBalance;
    });

    const newBalance = voucherTx();
    return { success: true, newBalance };
  }

  public getPartyDetailedStatement(partyId: number) {
    const party = this.getPartyById(partyId);
    if (!party) throw new Error('গ্রাহক পাওয়া যায়নি');

    const ledger = this.getPartyLedger(partyId);

    const sales = this.db.prepare(`
      SELECT s.*, c.name_bn as commodity_name_bn
      FROM sales s
      LEFT JOIN commodities c ON s.commodity_id = c.id
      WHERE s.party_id = ?
      ORDER BY s.sale_date DESC, s.id DESC
    `).all(partyId) as any[];

    // Payments (জমা / পরিশোধ): credit > 0 or transaction_type = PAYMENT_RECEIVED
    const payments = ledger.filter((e) => e.credit > 0 || e.transaction_type === 'PAYMENT_RECEIVED');

    // Invoices / Dues (খরচ বা ক্রয় / চালান): debit > 0 and transaction_type != 'OPENING'
    const invoices = ledger.filter((e) => e.debit > 0 && e.transaction_type !== 'OPENING');

    const totalInflow = payments.reduce((sum, p) => sum + (p.credit || 0), 0);
    const totalInvoices = invoices.reduce((sum, i) => sum + (i.debit || 0), 0);
    const openingDue = party.opening_balance || 0;
    const netDue = party.current_balance;

    return {
      party,
      ledger,
      sales,
      payments,
      invoices,
      totalInflow,
      totalInvoices,
      openingDue,
      netDue,
    };
  }

  public deletePartyPaymentVoucher(ledgerId: number): { success: boolean; message: string } {
    const tx = this.db.transaction(() => {
      const entry = this.db.prepare("SELECT * FROM party_ledger WHERE id = ?").get(ledgerId) as LedgerEntry | undefined;
      if (!entry) throw new Error('লেনদেন রেকর্ডটি পাওয়া যায়নি');

      if (entry.transaction_type === 'SALE' || entry.transaction_type === 'PURCHASE') {
        throw new Error('চালান লেনদেন সরাসরি চালানের তালিকা থেকে বাতিল করতে হবে।');
      }

      const party = this.getPartyById(entry.party_id);
      if (!party) throw new Error('গ্রাহক পাওয়া যায়নি');

      let newBalance = party.current_balance;
      if (entry.credit > 0) {
        newBalance = addMoney(party.current_balance, entry.credit);
      } else if (entry.debit > 0) {
        newBalance = subMoney(party.current_balance, entry.debit);
      }

      this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newBalance, entry.party_id);
      this.db.prepare("DELETE FROM cashbook WHERE party_id = ? AND entry_date = ? AND amount = ?").run(entry.party_id, entry.entry_date, entry.credit || entry.debit);
      this.db.prepare("DELETE FROM party_ledger WHERE id = ?").run(ledgerId);
    });

    tx();
    return { success: true, message: 'লেনদেন সফলভাবে মুছে ফেলা হয়েছে ও ব্যালেন্স সমন্বয় করা হয়েছে।' };
  }

  public updatePartyLedgerNote(ledgerId: number, description: string): { success: boolean } {
    this.db.prepare("UPDATE party_ledger SET description = ? WHERE id = ?").run(description, ledgerId);
    return { success: true };
  }

  // ==================== CASHBOOK (দৈনিক ক্যাশ বই) ====================
  public getDailyCashbook(date: string): {
    opening_balance: number;
    entries: CashbookEntry[];
    total_inflow: number;
    total_outflow: number;
    closing_balance: number;
  } {
    const priorIn = (this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s FROM cashbook WHERE entry_date < ? AND entry_type = 'INFLOW' AND payment_mode = 'CASH'
    `).get(date) as { s: number }).s;

    const priorOut = (this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s FROM cashbook WHERE entry_date < ? AND entry_type = 'OUTFLOW' AND payment_mode = 'CASH'
    `).get(date) as { s: number }).s;

    const opening_balance = roundMoney(priorIn - priorOut);

    const stmt = this.db.prepare(`
      SELECT c.*, p.name as party_name
      FROM cashbook c
      LEFT JOIN parties p ON c.party_id = p.id
      WHERE c.entry_date = ?
      ORDER BY c.id ASC
    `);
    const entries = stmt.all(date) as CashbookEntry[];

    let total_inflow = 0;
    let total_outflow = 0;
    entries.forEach((e) => {
      if (e.payment_mode === 'CASH') {
        if (e.entry_type === 'INFLOW') total_inflow = addMoney(total_inflow, e.amount);
        else total_outflow = addMoney(total_outflow, e.amount);
      }
    });

    const closing_balance = roundMoney(opening_balance + total_inflow - total_outflow);

    return {
      opening_balance,
      entries,
      total_inflow,
      total_outflow,
      closing_balance,
    };
  }

  public addCashbookEntry(data: {
    entry_date: string;
    entry_type: 'INFLOW' | 'OUTFLOW';
    category: any;
    amount: number;
    payment_mode: 'CASH' | 'BANK';
    party_id?: number;
    description: string;
    is_test_draft?: number;
  }): CashbookEntry {
    const isTest = data.is_test_draft ? 1 : 0;
    const amt = roundMoney(data.amount);
    const stmt = this.db.prepare(`
      INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, is_test_draft, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      data.entry_date,
      data.entry_type,
      data.category,
      amt,
      data.payment_mode,
      data.party_id || null,
      isTest,
      data.description
    );
    return this.db.prepare('SELECT * FROM cashbook WHERE id = ?').get(Number(res.lastInsertRowid)) as CashbookEntry;
  }

  // ==================== EXPENSES (দৈনিক পরিচালন খরচ) ====================
  public addExpense(data: {
    expense_date: string;
    category: any;
    amount: number;
    paid_to: string;
    payment_mode: 'CASH' | 'BANK';
    notes?: string;
    is_test_draft?: number;
  }): Expense {
    const isTest = data.is_test_draft ? 1 : 0;
    const expenseTx = this.db.transaction(() => {
      const amt = roundMoney(data.amount);
      const stmt = this.db.prepare(`
        INSERT INTO expenses (expense_date, category, amount, paid_to, payment_mode, is_test_draft, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const res = stmt.run(
        data.expense_date,
        data.category,
        amt,
        data.paid_to,
        data.payment_mode,
        isTest,
        data.notes || ''
      );
      const expId = Number(res.lastInsertRowid);

      const catBnMap: Record<string, string> = {
        RENT: 'গুদাম ভাড়া',
        ELECTRICITY: 'বিদ্যুৎ বিল',
        SALARY: 'কর্মচারীর বেতন',
        LABOR: 'লেবার / কুলি খরচ',
        FOOD_ENTERTAINMENT: 'নাস্তা ও আপ্যায়ন',
        TRANSPORT: 'যাতায়াত খরচ',
        REPAIR: 'মেরামত ও মেইনটেন্যান্স',
        TAX_LEGAL: 'ট্যাক্স / পৌর ফি',
        MISC: 'বিবিধ খরচ',
      };
      const catLabel = catBnMap[data.category] || data.category;

      this.db.prepare(`
        INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, is_test_draft, description)
        VALUES (?, 'OUTFLOW', 'EXPENSE', ?, ?, ?, ?)
      `).run(
        data.expense_date,
        amt,
        data.payment_mode,
        isTest,
        `সাধারণ খরচ (${catLabel}) - প্রাপক: ${data.paid_to} ${data.notes ? '(' + data.notes + ')' : ''}`
      );

      return expId;
    });

    const newId = expenseTx();
    return this.getExpenseById(newId)!;
  }

  public getExpenseById(id: number): Expense | undefined {
    return this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as Expense | undefined;
  }

  public getAllExpenses(limit = 100): Expense[] {
    return this.db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT ?').all(limit) as Expense[];
  }

  // ==================== DASHBOARD & P&L REPORT ====================
  public getDashboardStats(): DashboardStats {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const todayPur = this.db.prepare(`
      SELECT COALESCE(SUM(gross_amount), 0) as amt, COALESCE(SUM(net_weight_mon), 0) as mon
      FROM purchases WHERE purchase_date = ?
    `).get(today) as { amt: number; mon: number };

    const todaySal = this.db.prepare(`
      SELECT
        COALESCE(SUM(net_invoice_amount), 0) as amt,
        COALESCE(SUM(paid_amount), 0) as cash_amt,
        COALESCE(SUM(due_amount), 0) as due_amt,
        COALESCE(SUM(net_weight_mon), 0) as mon
      FROM sales WHERE sale_date = ?
    `).get(today) as { amt: number; cash_amt: number; due_amt: number; mon: number };

    const todayExp = (this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE expense_date = ?
    `).get(today) as { s: number }).s;

    const cbStats = this.getDailyCashbook(today);

    const partyStats = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as rec,
        COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) as pay
      FROM parties WHERE is_active = 1
    `).get() as { rec: number; pay: number };

    const stockStats = this.db.prepare(`
      SELECT
        COALESCE(SUM(current_stock_kg * current_wac_per_kg), 0) as total_val,
        COALESCE(SUM(current_stock_kg / 40.0), 0) as total_mon,
        COALESCE(SUM(current_stock_bags), 0) as total_bags
      FROM commodities WHERE is_active = 1
    `).get() as { total_val: number; total_mon: number; total_bags: number };

    const monthlySales = this.db.prepare(`
      SELECT
        COALESCE(SUM(net_invoice_amount), 0) as revenue,
        COALESCE(SUM(realized_profit), 0) as gross_profit
      FROM sales WHERE sale_date >= ? AND sale_date <= ?
    `).get(monthStart, today) as { revenue: number; gross_profit: number };

    const monthlyExp = (this.db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE expense_date >= ? AND expense_date <= ?
    `).get(monthStart, today) as { s: number }).s;

    const monthlyShrinkage = (this.db.prepare(`
      SELECT COALESCE(SUM(cost_value), 0) as s FROM stock_adjustments WHERE adjustment_date >= ? AND adjustment_date <= ?
    `).get(monthStart, today) as { s: number }).s;

    const netProfit = roundMoney(monthlySales.gross_profit - monthlyExp - monthlyShrinkage);

    const result: any = {
      today_purchases_amount: roundMoney(todayPur.amt),
      today_purchases_mon: roundWeight(todayPur.mon),
      today_sales_amount: roundMoney(todaySal.amt),
      today_sales_cash: roundMoney(todaySal.cash_amt),
      today_sales_due: roundMoney(todaySal.due_amt),
      today_operating_expense: roundMoney(todayExp),
      today_sales_mon: roundWeight(todaySal.mon),
      today_cash_in: cbStats.total_inflow,
      today_cash_out: cbStats.total_outflow,
      closing_cash_balance: cbStats.closing_balance,
      total_receivable: roundMoney(partyStats.rec),
      total_payable: roundMoney(partyStats.pay),
      total_stock_value: roundMoney(stockStats.total_val),
      total_stock_mon: roundWeight(stockStats.total_mon),
      total_stock_bags: stockStats.total_bags,
      monthly_sales_revenue: roundMoney(monthlySales.revenue),
      monthly_gross_profit: roundMoney(monthlySales.gross_profit),
      monthly_net_profit: netProfit,
      todaySales: {
        total_amount: roundMoney(todaySal.amt),
        cash_amount: roundMoney(todaySal.cash_amt),
        due_amount: roundMoney(todaySal.due_amt),
        mon: roundWeight(todaySal.mon),
      },
      todayOperatingExpense: roundMoney(todayExp),
    };

    return result as DashboardStats;
  }

  public getProfitAndLossReport(startDate: string, endDate: string) {
    const salesData = this.db.prepare(`
      SELECT
        COALESCE(SUM(gross_amount), 0) as total_gross_sales,
        COALESCE(SUM(loading_charge), 0) as total_loading,
        COALESCE(SUM(damaged_bag_deduction), 0) as total_deduction,
        COALESCE(SUM(discount_amount), 0) as total_discount,
        COALESCE(SUM(net_invoice_amount), 0) as total_net_revenue,
        COALESCE(SUM(cogs_amount), 0) as total_cogs,
        COALESCE(SUM(realized_profit), 0) as gross_profit
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `).get(startDate, endDate) as any;

    const shrinkageData = this.db.prepare(`
      SELECT
        COALESCE(SUM(lost_weight_kg), 0) as lost_kg,
        COALESCE(SUM(lost_weight_mon), 0) as lost_mon,
        COALESCE(SUM(cost_value), 0) as shrinkage_cost
      FROM stock_adjustments
      WHERE adjustment_date >= ? AND adjustment_date <= ?
    `).get(startDate, endDate) as any;

    const expenseBreakdown = this.db.prepare(`
      SELECT category, SUM(amount) as total_amount
      FROM expenses
      WHERE expense_date >= ? AND expense_date <= ?
      GROUP BY category
    `).all(startDate, endDate) as { category: string; total_amount: number }[];

    const totalOperatingExpenses = roundMoney(expenseBreakdown.reduce((sum, e) => sum + e.total_amount, 0));
    const netProfit = roundMoney(salesData.gross_profit - shrinkageData.shrinkage_cost - totalOperatingExpenses);

    return {
      startDate,
      endDate,
      sales: {
        total_gross_sales: roundMoney(salesData.total_gross_sales),
        total_loading: roundMoney(salesData.total_loading),
        total_deduction: roundMoney(salesData.total_deduction),
        total_discount: roundMoney(salesData.total_discount),
        total_net_revenue: roundMoney(salesData.total_net_revenue),
        total_cogs: roundMoney(salesData.total_cogs),
        gross_profit: roundMoney(salesData.gross_profit),
      },
      shrinkage: {
        lost_kg: roundWeight(shrinkageData.lost_kg),
        lost_mon: roundWeight(shrinkageData.lost_mon),
        shrinkage_cost: roundMoney(shrinkageData.shrinkage_cost),
      },
      expenses: expenseBreakdown.map((e) => ({
        category: e.category,
        total_amount: roundMoney(e.total_amount),
      })),
      totalOperatingExpenses,
      netProfit,
    };
  }

  // ==================== BACKUP & RESTORE ====================
  public createBackup(destinationFolder?: string): { success: boolean; filePath: string; message: string } {
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');

      const targetDir = destinationFolder || this.backupDir;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupFileName = `maha_enterprise_backup_${timestamp}.db`;
      const backupPath = path.join(targetDir, backupFileName);

      fs.copyFileSync(this.dbPath, backupPath);

      if (!destinationFolder) {
        this.cleanOldBackups(targetDir, 30);
      }

      return {
        success: true,
        filePath: backupPath,
        message: `ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে: ${backupFileName}`,
      };
    } catch (err: any) {
      console.error('Backup error:', err);
      return {
        success: false,
        filePath: '',
        message: `ব্যাকআপ ব্যর্থ: ${err.message}`,
      };
    }
  }

  public restoreBackup(sourceFilePath: string): { success: boolean; message: string; safetyBackupPath?: string } {
    try {
      if (!fs.existsSync(sourceFilePath)) {
        return { success: false, message: 'নির্বাচিত ব্যাকআপ ফাইলটি খুঁজে পাওয়া যায়নি।' };
      }

      // 1. Create a safety backup first
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safetyBackupFileName = `maha_enterprise_pre_restore_${timestamp}.db`;
      const safetyBackupPath = path.join(this.backupDir, safetyBackupFileName);
      fs.copyFileSync(this.dbPath, safetyBackupPath);

      // 2. Close active database connection cleanly
      this.db.close();

      // 3. Remove existing WAL and SHM files
      const walFile = this.dbPath + '-wal';
      const shmFile = this.dbPath + '-shm';
      if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
      if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);

      // 4. Overwrite live DB with chosen backup file
      fs.copyFileSync(sourceFilePath, this.dbPath);

      // 5. Re-open database connection and run initialization/migrations
      this.db = new Database(this.dbPath);
      this.initDatabase();

      // 6. Verify integrity of newly restored DB
      const integrity = this.runIntegrityCheck();
      if (!integrity.isOk) {
        throw new Error(`রিস্টোরকৃত ফাইলটি ত্রুটিপূর্ণ: ${integrity.details}`);
      }

      return {
        success: true,
        message: 'ডাটাবেজ সফলভাবে রিস্টোর হয়েছে। পূর্বের ডাটার একটি সেফটি কপি সংরক্ষিত হয়েছে।',
        safetyBackupPath,
      };
    } catch (err: any) {
      console.error('Restore error:', err);
      try {
        if (!this.db || !this.db.open) {
          this.db = new Database(this.dbPath);
          this.initDatabase();
        }
      } catch (reopenErr) {
        console.error('Failed to reopen DB after restore failure:', reopenErr);
      }
      return {
        success: false,
        message: `ডাটাবেজ রিস্টোর ব্যর্থ: ${err.message}`,
      };
    }
  }

  private cleanOldBackups(dir: string, keepCount: number) {
    try {
      const files = fs.readdirSync(dir)
        .filter((f) => f.startsWith('maha_enterprise_backup_') && f.endsWith('.db'))
        .map((f) => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length > keepCount) {
        for (let i = keepCount; i < files.length; i++) {
          fs.unlinkSync(path.join(dir, files[i].name));
        }
      }
    } catch (e) {
      console.error('Failed cleaning old backups:', e);
    }
  }

  public runIntegrityCheck(): { isOk: boolean; details: string; schemaVersion: number } {
    try {
      const rows = this.db.prepare('PRAGMA integrity_check').all() as any[];
      const isOk = rows.length === 1 && rows[0].integrity_check === 'ok';
      const versionRow = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
      return {
        isOk,
        details: isOk ? 'ডাটাবেস সম্পূর্ণ ত্রুটিমুক্ত ও সুস্থ (OK)' : JSON.stringify(rows),
        schemaVersion: versionRow.user_version,
      };
    } catch (err: any) {
      return { isOk: false, details: err.message, schemaVersion: 0 };
    }
  }

  public getSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    rows.forEach((r) => { result[r.key] = r.value; });
    return result;
  }

  public updateSetting(key: string, value: string) {
    this.db.prepare(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  // ==================== DEDICATED NOTEBOOK (নোটবুক ও টোকাবহি) ====================
  public getAllNotes(category?: string, search?: string): Note[] {
    let sql = 'SELECT * FROM notes WHERE 1=1';
    const params: any[] = [];

    if (category && category !== 'ALL' && category !== 'সবগুলো নোট') {
      if (category === 'PINNED' || category === 'পিনকৃত নোট' || category === 'পিনকৃত') {
        sql += ' AND is_pinned = 1';
      } else {
        sql += ' AND category = ?';
        params.push(category);
      }
    }

    if (search && search.trim() !== '') {
      sql += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY is_pinned DESC, datetime(updated_at) DESC, id DESC';
    return this.db.prepare(sql).all(...params) as Note[];
  }

  public getNoteById(id: number): Note | undefined {
    const stmt = this.db.prepare('SELECT * FROM notes WHERE id = ?');
    return stmt.get(id) as Note | undefined;
  }

  public createNote(data: {
    title: string;
    content?: string;
    category?: string;
    is_pinned?: number;
  }): Note {
    const stmt = this.db.prepare(`
      INSERT INTO notes (title, content, category, is_pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `);
    const info = stmt.run(
      (data.title || '').trim(),
      (data.content || '').trim(),
      data.category || 'সাধারণ',
      data.is_pinned ? 1 : 0
    );
    return this.getNoteById(Number(info.lastInsertRowid))!;
  }

  public updateNote(id: number, data: Partial<Note>): Note {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push((data.title || '').trim());
    }
    if (data.content !== undefined) {
      fields.push('content = ?');
      values.push((data.content || '').trim());
    }
    if (data.category !== undefined) {
      fields.push('category = ?');
      values.push(data.category);
    }
    if (data.is_pinned !== undefined) {
      fields.push('is_pinned = ?');
      values.push(data.is_pinned ? 1 : 0);
    }

    fields.push("updated_at = datetime('now', 'localtime')");
    values.push(id);

    this.db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getNoteById(id)!;
  }

  public toggleNotePin(id: number): { success: boolean; is_pinned: number } {
    const note = this.getNoteById(id);
    if (!note) {
      throw new Error('নোট পাওয়া যায়নি');
    }
    const newPinned = note.is_pinned === 1 ? 0 : 1;
    this.db.prepare("UPDATE notes SET is_pinned = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(newPinned, id);
    return { success: true, is_pinned: newPinned };
  }

  public deleteNote(id: number): { success: boolean; message: string } {
    const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?');
    const info = stmt.run(id);
    return {
      success: info.changes > 0,
      message: info.changes > 0 ? 'নোটটি সফলভাবে মুছে ফেলা হয়েছে' : 'নোটটি পাওয়া যায়নি',
    };
  }

  // ==================== TEST DRAFTS SUITE & PURGE ====================
  public hasTestDrafts(): boolean {
    const p = this.db.prepare('SELECT 1 FROM purchases WHERE is_test_draft = 1 LIMIT 1').get() !== undefined;
    if (p) return true;
    const s = this.db.prepare('SELECT 1 FROM sales WHERE is_test_draft = 1 LIMIT 1').get() !== undefined;
    if (s) return true;
    const l = this.db.prepare('SELECT 1 FROM party_ledger WHERE is_test_draft = 1 LIMIT 1').get() !== undefined;
    if (l) return true;
    const c = this.db.prepare('SELECT 1 FROM cashbook WHERE is_test_draft = 1 LIMIT 1').get() !== undefined;
    if (c) return true;
    const e = this.db.prepare('SELECT 1 FROM expenses WHERE is_test_draft = 1 LIMIT 1').get() !== undefined;
    if (e) return true;
    const pt = this.db.prepare('SELECT 1 FROM parties WHERE is_test_draft = 1 LIMIT 1').get() !== undefined;
    return pt;
  }

  public purgeTestDrafts(): {
    success: boolean;
    purged: {
      purchases: number;
      sales: number;
      ledger: number;
      cashbook: number;
      expenses: number;
      parties: number;
    };
    message: string;
  } {
    const purgeTx = this.db.transaction(() => {
      // 1. Revert commodity stocks from test purchases
      const testPurchases = this.db.prepare(`
        SELECT commodity_id, net_weight_kg, bags_count FROM purchases WHERE is_test_draft = 1
      `).all() as { commodity_id: number; net_weight_kg: number; bags_count: number }[];

      for (const p of testPurchases) {
        this.db.prepare(`
          UPDATE commodities SET
            current_stock_kg = MAX(0, current_stock_kg - ?),
            current_stock_bags = MAX(0, current_stock_bags - ?),
            updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(p.net_weight_kg, p.bags_count, p.commodity_id);
      }

      // 2. Revert commodity stocks from test sales
      const testSales = this.db.prepare(`
        SELECT commodity_id, net_weight_kg, bags_count FROM sales WHERE is_test_draft = 1
      `).all() as { commodity_id: number; net_weight_kg: number; bags_count: number }[];

      for (const s of testSales) {
        this.db.prepare(`
          UPDATE commodities SET
            current_stock_kg = current_stock_kg + ?,
            current_stock_bags = current_stock_bags + ?,
            updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(s.net_weight_kg, s.bags_count, s.commodity_id);
      }

      // 3. Recompute or zero-clamp Commodity WACs
      const allCommodities = this.db.prepare('SELECT id, current_stock_kg FROM commodities').all() as { id: number; current_stock_kg: number }[];
      for (const c of allCommodities) {
        if (c.current_stock_kg <= 0.001) {
          this.db.prepare(`
            UPDATE commodities SET
              current_stock_kg = 0,
              current_stock_bags = 0,
              current_wac_per_kg = 0,
              current_wac_per_mon = 0,
              updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(c.id);
        } else {
          const purStats = this.db.prepare(`
            SELECT SUM(total_landed_cost) as total_cost, SUM(net_weight_kg) as total_kg
            FROM purchases WHERE commodity_id = ? AND is_test_draft = 0
          `).get(c.id) as { total_cost: number | null; total_kg: number | null };
          if (purStats && purStats.total_kg && purStats.total_kg > 0) {
            const wacKg = (purStats.total_cost || 0) / purStats.total_kg;
            this.db.prepare(`
              UPDATE commodities SET
                current_wac_per_kg = ?,
                current_wac_per_mon = ?,
                updated_at = datetime('now', 'localtime')
              WHERE id = ?
            `).run(wacKg, roundMoney(wacKg * 40), c.id);
          }
        }
      }

      // 4. Delete records tagged is_test_draft = 1
      const purDel = this.db.prepare('DELETE FROM purchases WHERE is_test_draft = 1').run().changes;
      const salDel = this.db.prepare('DELETE FROM sales WHERE is_test_draft = 1').run().changes;
      const cbDel = this.db.prepare('DELETE FROM cashbook WHERE is_test_draft = 1').run().changes;
      const expDel = this.db.prepare('DELETE FROM expenses WHERE is_test_draft = 1').run().changes;

      // Delete test parties and their ledger entries
      this.db.prepare('DELETE FROM party_ledger WHERE party_id IN (SELECT id FROM parties WHERE is_test_draft = 1)').run();
      const partyDel = this.db.prepare('DELETE FROM parties WHERE is_test_draft = 1').run().changes;

      // Delete any remaining test draft ledger entries
      const ledDel = this.db.prepare('DELETE FROM party_ledger WHERE is_test_draft = 1').run().changes;

      // 5. Recompute current_balance and running_balance for all remaining parties
      const remainingParties = this.db.prepare('SELECT id, opening_balance FROM parties').all() as { id: number; opening_balance: number }[];
      for (const p of remainingParties) {
        const entries = this.db.prepare(`
          SELECT id, transaction_type, debit, credit
          FROM party_ledger
          WHERE party_id = ?
          ORDER BY entry_date ASC, id ASC
        `).all(p.id) as { id: number; transaction_type: string; debit: number; credit: number }[];

        let runBal = 0;
        const hasOpeningEntry = entries.length > 0 && entries[0].transaction_type === 'OPENING';
        if (!hasOpeningEntry) {
          runBal = p.opening_balance;
        }

        for (const entry of entries) {
          runBal = roundMoney(runBal + entry.debit - entry.credit);
          this.db.prepare('UPDATE party_ledger SET running_balance = ? WHERE id = ?').run(runBal, entry.id);
        }

        const finalBal = entries.length > 0 ? runBal : p.opening_balance;
        this.db.prepare("UPDATE parties SET current_balance = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
          .run(finalBal, p.id);
      }

      return {
        success: true,
        purged: {
          purchases: purDel,
          sales: salDel,
          ledger: ledDel,
          cashbook: cbDel,
          expenses: expDel,
          parties: partyDel,
        },
        message: 'সকল টেস্ট ড্রাফট ডাটা সফলভাবে মুছে ফেলা হয়েছে এবং স্টক ও ব্যালেন্স রিস্টোর করা হয়েছে।',
      };
    });

    return purgeTx();
  }

  public close() {
    try {
      this.createBackup();
      this.db.close();
    } catch (e) {
      console.error('Error closing database:', e);
    }
  }
}
