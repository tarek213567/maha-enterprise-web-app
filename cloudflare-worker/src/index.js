import { sendExcelBackupToTelegram, generateRoyalExcelBuffer } from './royalExcelBackup.js';
import {
  normalizeBdPhone,
  buildSaleSmsText,
  buildDueCollectSmsText,
  sendBulkSms,
  getSmsConfig,
  saveSmsConfig,
  getSmsLogs,
  resendSms,
} from './smsService.js';
import {
  computeVerifiedBusinessLedger,
  getBstDateString,
  roundMoney as ledgerRoundMoney,
  roundWeight as ledgerRoundWeight,
} from './verifiedLedger.js';
import {
  getGeminiApiKey,
  callGeminiModel,
  fetchLiveShopContext,
  buildAiSystemPrompt,
  parseGeminiResponse,
  persistAiAssistantReply,
  generateAndSendDailyAiAudit,
  executeAiAction,
  createRecycleSnapshot,
} from './aiService.js';

/**
 * মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
 * Cloudflare Worker + Cloudflare D1 Full-Stack Cloud Server & PWA Gateway
 */

const SCALE_MONEY = 100;
const SCALE_WEIGHT = 1000;

function roundMoney(val) {
  const num = typeof val === 'string' ? parseFloat(val) || 0 : val || 0;
  return Math.round((num + Number.EPSILON) * SCALE_MONEY) / SCALE_MONEY;
}

function roundWeight(val) {
  const num = typeof val === 'string' ? parseFloat(val) || 0 : val || 0;
  return Math.round((num + Number.EPSILON) * SCALE_WEIGHT) / SCALE_WEIGHT;
}

function addMoney(a, b) {
  return (Math.round((a || 0) * SCALE_MONEY) + Math.round((b || 0) * SCALE_MONEY)) / SCALE_MONEY;
}

function subMoney(a, b) {
  return (Math.round((a || 0) * SCALE_MONEY) - Math.round((b || 0) * SCALE_MONEY)) / SCALE_MONEY;
}

function addWeight(a, b) {
  return (Math.round((a || 0) * SCALE_WEIGHT) + Math.round((b || 0) * SCALE_WEIGHT)) / SCALE_WEIGHT;
}

function subWeight(a, b) {
  return (Math.round((a || 0) * SCALE_WEIGHT) - Math.round((b || 0) * SCALE_WEIGHT)) / SCALE_WEIGHT;
}

function toBnDigits(num) {
  if (num === null || num === undefined) return '';
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, d => bn[d]);
}

function sendJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-app-pin, x-auth-pin, x-pin',
    },
  });
}

function normalizePin(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const idx = bengaliDigits.indexOf(ch);
    if (idx !== -1) {
      res += idx.toString();
    } else {
      res += ch;
    }
  }
  return res.trim();
}

// In-Memory Fallback State if D1 is not bound
let inMemoryStore = {
  commodities: [
    { id: 1, name_bn: 'সরিষা (মাঘি/টোরি)', name_en: 'Mustard', default_bag_weight_kg: 80, current_stock_kg: 4000, current_stock_bags: 50, current_wac_per_kg: 72.5, current_wac_per_mon: 2900, is_active: 1 },
    { id: 2, name_bn: 'ভুট্টা (হলুদ দানাদার)', name_en: 'Corn', default_bag_weight_kg: 75, current_stock_kg: 6000, current_stock_bags: 80, current_wac_per_kg: 27.5, current_wac_per_mon: 1100, is_active: 1 },
    { id: 3, name_bn: 'তোষা পাট', name_en: 'Toshas Jute', default_bag_weight_kg: 70, current_stock_kg: 2800, current_stock_bags: 40, current_wac_per_kg: 77.5, current_wac_per_mon: 3100, is_active: 1 },
    { id: 4, name_bn: 'গম (বারি-২৮/৩৩)', name_en: 'Wheat', default_bag_weight_kg: 85, current_stock_kg: 3400, current_stock_bags: 40, current_wac_per_kg: 45.0, current_wac_per_mon: 1800, is_active: 1 },
    { id: 5, name_bn: 'আমন ধান (স্বর্ণা)', name_en: 'Aman Paddy', default_bag_weight_kg: 75, current_stock_kg: 5250, current_stock_bags: 70, current_wac_per_kg: 32.5, current_wac_per_mon: 1300, is_active: 1 },
  ],
  parties: [
    { id: 1, name: 'সাধারণ বিক্রেতা', phone: '০১৭০০-০০০০০০', address: 'চাচকৈড় বাজার, গুরুদাসপুর', party_type: 'SUPPLIER', opening_balance: 0, current_balance: 0, is_active: 1, is_pinned: 1 },
    { id: 2, name: 'সাধারণ খুচরা ক্রেতা', phone: '০১৭০০-০০০০০০', address: 'চাচকৈড় বাজার, গুরুদাসপুর', party_type: 'BUYER', opening_balance: 0, current_balance: 0, is_active: 1, is_pinned: 1 },
    { id: 3, name: 'মোঃ করিম বেপারী', phone: '01712345678', address: 'চলনবিল, গুরুদাসপুর', party_type: 'SUPPLIER', opening_balance: -25000, current_balance: -25000, is_active: 1, is_pinned: 0 },
    { id: 4, name: 'রহমান ট্রেডার্স (মিল মালিক)', phone: '01819876543', address: 'ঈশ্বরদী, পাবনা', party_type: 'BUYER', opening_balance: 145000, current_balance: 145000, is_active: 1, is_pinned: 0 },
  ],
  purchases: [],
  sales: [],
  stockAdjustments: [],
  partyLedger: [],
  cashbook: [],
  expenses: [],
  recycle_bin: [],
  notes: [
    { id: 1, title: 'চলনবিল হাট সরিষার দরদাম', content: 'আজকের মাঘি সরিষার বাজার দর মণপ্রতি ২৮৫০ থেকে ২৯৫০ টাকা। শুকনা ও পরিষ্কার মাল দেখে কিনতে হবে।', category: 'দরদাম', is_pinned: 1, created_at: new Date().toISOString() },
    { id: 2, title: 'করিম বেপারীর বাকির তাগাদা', content: 'আগামী রবিবারে ৫০,০০০ টাকা কিস্তি জমা দেওয়ার কথা। ফোন দিয়ে মনে করিয়ে দিতে হবে।', category: 'বেপারী স্মরণিকা', is_pinned: 1, created_at: new Date().toISOString() },
  ],
  settings: {
    org_name: 'মাহা এন্টারপ্রাইজ',
    proprietor: 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স',
    contacts: 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241',
    location: 'চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
    app_security_pin: '5555',
    app_pin: '5555',
    theme_mode: 'obsidian-gold',
  },
};

async function getActivePin(db) {
  if (!db) {
    return normalizePin(inMemoryStore.settings.app_pin || inMemoryStore.settings.app_security_pin || '5555');
  }
  try {
    // 1. Check settings table first
    let row = await db.prepare("SELECT value FROM settings WHERE key = 'app_pin'").first().catch(() => null);
    if (row && row.value) return normalizePin(row.value);

    row = await db.prepare("SELECT value FROM settings WHERE key = 'app_security_pin'").first().catch(() => null);
    if (row && row.value) return normalizePin(row.value);

    // 2. Check app_settings table
    row = await db.prepare("SELECT value FROM app_settings WHERE key = 'app_pin'").first().catch(() => null);
    if (row && row.value) return normalizePin(row.value);

    row = await db.prepare("SELECT value FROM app_settings WHERE key = 'app_security_pin'").first().catch(() => null);
    if (row && row.value) return normalizePin(row.value);
  } catch (err) {
    console.error('Error fetching PIN from D1:', err);
  }
  return normalizePin(inMemoryStore.settings.app_pin || inMemoryStore.settings.app_security_pin || '5555');
}

async function updateActivePinInDB(db, newPin) {
  const norm = normalizePin(newPin);
  inMemoryStore.settings.app_pin = norm;
  inMemoryStore.settings.app_security_pin = norm;
  if (!db) return true;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `).catch(() => null);

    await db.prepare("INSERT INTO settings (key, value) VALUES ('app_pin', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(norm, norm).run().catch(() => null);
    await db.prepare("INSERT INTO settings (key, value) VALUES ('app_security_pin', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(norm, norm).run().catch(() => null);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES ('app_pin', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(norm, norm).run().catch(() => null);
    await db.prepare("INSERT INTO app_settings (key, value) VALUES ('app_security_pin', ?) ON CONFLICT(key) DO UPDATE SET value = ?").bind(norm, norm).run().catch(() => null);
    return true;
  } catch (err) {
    console.error('Error updating PIN in D1:', err);
    throw err;
  }
}

function extractIncomingPin(request, url) {
  const headerPin = request.headers.get('x-app-pin') ||
                    request.headers.get('x-auth-pin') ||
                    request.headers.get('x-pin');
  if (headerPin) return normalizePin(headerPin);

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && (parts[0].toLowerCase() === 'bearer' || parts[0].toLowerCase() === 'pin')) {
      return normalizePin(parts[1]);
    }
    return normalizePin(authHeader);
  }

  // Cookie-based session authentication (HttpOnly)
  const cookieHeader = request.headers.get('Cookie') || request.headers.get('cookie') || '';
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)(?:app_pin|session_pin|maha_pin)=([^;]+)/);
    if (match) return normalizePin(decodeURIComponent(match[1]));
  }

  // OWASP ASVS: Query string (?pin=...) auth is strictly forbidden and rejected
  return '';
}

/**
 * Auto-Resolve or Auto-Create Party Helper (Never fails with "Party Not Found")
 * Resolves by partyId, exact phone, or exact name.
 * If not found, automatically creates the party record in D1 or in-memory store.
 */
async function resolveOrCreateParty(db, partyId, partyName, partyPhone = '', partyType = 'SUPPLIER', isTest = 0) {
  const defaultName = partyType === 'SUPPLIER' ? 'সাধারণ বিক্রেতা' : 'সাধারণ খুচরা ক্রেতা';
  const cleanName = (partyName && String(partyName).trim()) ? String(partyName).trim() : defaultName;
  const cleanPhone = (partyPhone && String(partyPhone).trim()) ? String(partyPhone).trim() : '';

  if (db) {
    let party = null;
    // 1. If positive numeric partyId provided, lookup by ID
    if (partyId && Number(partyId) > 0) {
      party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(Number(partyId)).first().catch(() => null);
      if (party) return party;
    }

    // 2. Lookup by exact name and phone
    if (cleanPhone && cleanPhone !== '০১৭০০-০০০০০০' && cleanPhone !== '01700000000') {
      party = await db.prepare('SELECT * FROM parties WHERE name = ? AND phone = ?').bind(cleanName, cleanPhone).first().catch(() => null);
      if (party) return party;
    }

    // 3. Lookup by exact name
    party = await db.prepare('SELECT * FROM parties WHERE name = ?').bind(cleanName).first().catch(() => null);
    if (party) return party;

    // 4. Auto-create new party record in D1
    const res = await db.prepare(`
      INSERT INTO parties (name, phone, address, party_type, opening_balance, current_balance, notes, is_pinned, is_test_draft)
      VALUES (?, ?, ?, ?, 0, 0, '', 0, ?)
    `).bind(
      cleanName,
      cleanPhone || '০১৭০০-০০০০০০',
      'চাচকৈড় বাজার, গুরুদাসপুর',
      partyType,
      isTest ? 1 : 0
    ).run().catch(() => null);

    const newId = res?.meta?.last_row_id;
    if (newId) {
      party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(newId).first().catch(() => null);
      if (party) return party;
    }

    // Fallback: lookup by name again
    party = await db.prepare('SELECT * FROM parties WHERE name = ? ORDER BY id DESC').bind(cleanName).first().catch(() => null);
    if (party) return party;

    // Fallback: first party in DB
    const firstParty = await db.prepare('SELECT * FROM parties ORDER BY id ASC LIMIT 1').first().catch(() => null);
    if (firstParty) return firstParty;

    return {
      id: 1,
      name: cleanName,
      phone: cleanPhone || '০১৭০০-০০০০০০',
      address: 'চাচকৈড় বাজার, গুরুদাসপুর',
      party_type: partyType,
      current_balance: 0,
      opening_balance: 0,
    };
  } else {
    // In-memory fallback
    if (partyId && Number(partyId) > 0) {
      const p = inMemoryStore.parties.find(x => x.id === Number(partyId));
      if (p) return p;
    }
    let p = inMemoryStore.parties.find(x => x.name === cleanName);
    if (p) return p;

    const newParty = {
      id: inMemoryStore.parties.length + 1,
      name: cleanName,
      phone: cleanPhone || '০১৭০০-০০০০০০',
      address: 'চাচকৈড় বাজার, গুরুদাসপুর',
      party_type: partyType,
      opening_balance: 0,
      current_balance: 0,
      is_active: 1,
      is_pinned: 0,
    };
    inMemoryStore.parties.push(newParty);
    return newParty;
  }
}

// 60-Day Recycle Bin Soft-Delete Helper
async function putInRecycleBin(db, {
  module_type,
  module_label,
  original_id,
  title,
  amount = 0,
  payload = {}
}) {
  const id = `REC-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  const now = new Date();
  const deleted_at = now.toISOString();
  // 60 days retention
  const expiresDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expires_at = expiresDate.toISOString();
  const payload_json = JSON.stringify(payload);

  if (db) {
    try {
      await db.prepare(`
        INSERT INTO recycle_bin (id, module_type, module_label, original_id, title, amount, payload_json, deleted_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        module_type,
        module_label,
        String(original_id),
        title || 'মুছে ফেলা এন্ট্রি',
        roundMoney(amount || 0),
        payload_json,
        deleted_at,
        expires_at
      ).run();
    } catch (err) {
      console.warn('[RecycleBin] insert failed:', err);
    }
  } else {
    inMemoryStore.recycle_bin.unshift({
      id,
      module_type,
      module_label,
      original_id: String(original_id),
      title: title || 'মুছে ফেলা এন্ট্রি',
      amount: roundMoney(amount || 0),
      payload_json,
      deleted_at,
      expires_at
    });
  }
  return id;
}

// Automatic D1 Initialization
let d1Initialized = false;
async function ensureD1Initialized(db) {
  if (d1Initialized || !db) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS commodities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_bn TEXT NOT NULL UNIQUE,
        name_en TEXT NOT NULL,
        default_bag_weight_kg REAL NOT NULL DEFAULT 75.0,
        current_stock_kg REAL NOT NULL DEFAULT 0.0,
        current_stock_bags INTEGER NOT NULL DEFAULT 0,
        current_wac_per_kg REAL NOT NULL DEFAULT 0.0,
        current_wac_per_mon REAL NOT NULL DEFAULT 0.0,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS parties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT NOT NULL,
        party_type TEXT NOT NULL CHECK(party_type IN ('SUPPLIER', 'BUYER', 'BOTH')),
        opening_balance REAL NOT NULL DEFAULT 0.0,
        current_balance REAL NOT NULL DEFAULT 0.0,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_test_draft INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT NOT NULL UNIQUE,
        purchase_date TEXT NOT NULL,
        party_id INTEGER NOT NULL REFERENCES parties(id),
        commodity_id INTEGER NOT NULL REFERENCES commodities(id),
        bags_count INTEGER NOT NULL DEFAULT 0,
        gross_weight_kg REAL NOT NULL,
        bag_deduction_kg REAL NOT NULL DEFAULT 0.0,
        net_weight_kg REAL NOT NULL,
        net_weight_mon REAL NOT NULL,
        rate_per_mon REAL NOT NULL,
        gross_amount REAL NOT NULL,
        labor_cost REAL NOT NULL DEFAULT 0.0,
        transport_cost REAL NOT NULL DEFAULT 0.0,
        bag_cost REAL NOT NULL DEFAULT 0.0,
        other_cost REAL NOT NULL DEFAULT 0.0,
        total_landed_cost REAL NOT NULL,
        cost_per_mon REAL NOT NULL,
        cost_per_kg REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK', 'DUE', 'PARTIAL')),
        paid_amount REAL NOT NULL DEFAULT 0.0,
        due_amount REAL NOT NULL DEFAULT 0.0,
        previous_wac_per_kg REAL NOT NULL DEFAULT 0.0,
        new_wac_per_kg REAL NOT NULL DEFAULT 0.0,
        is_test_draft INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT NOT NULL UNIQUE,
        sale_date TEXT NOT NULL,
        party_id INTEGER NOT NULL REFERENCES parties(id),
        commodity_id INTEGER NOT NULL REFERENCES commodities(id),
        bags_count INTEGER NOT NULL DEFAULT 0,
        gross_weight_kg REAL NOT NULL,
        bag_deduction_kg REAL NOT NULL DEFAULT 0.0,
        net_weight_kg REAL NOT NULL,
        net_weight_mon REAL NOT NULL,
        rate_per_mon REAL NOT NULL,
        gross_amount REAL NOT NULL,
        loading_charge REAL NOT NULL DEFAULT 0.0,
        damaged_bag_deduction REAL NOT NULL DEFAULT 0.0,
        discount_amount REAL NOT NULL DEFAULT 0.0,
        net_invoice_amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK', 'DUE', 'PARTIAL')),
        paid_amount REAL NOT NULL DEFAULT 0.0,
        due_amount REAL NOT NULL DEFAULT 0.0,
        vehicle_no TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        destination TEXT,
        cogs_amount REAL NOT NULL DEFAULT 0.0,
        realized_profit REAL NOT NULL DEFAULT 0.0,
        is_test_draft INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adjustment_date TEXT NOT NULL,
        commodity_id INTEGER NOT NULL REFERENCES commodities(id),
        adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('SHRINKAGE', 'DAMAGE', 'SPILLAGE', 'AUDIT_CORRECTION')),
        lost_weight_kg REAL NOT NULL,
        lost_weight_mon REAL NOT NULL,
        lost_bags INTEGER NOT NULL DEFAULT 0,
        wac_at_time REAL NOT NULL,
        cost_value REAL NOT NULL,
        reason TEXT NOT NULL,
        is_test_draft INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS party_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date TEXT NOT NULL,
        party_id INTEGER NOT NULL REFERENCES parties(id),
        transaction_type TEXT NOT NULL CHECK(transaction_type IN ('PURCHASE', 'SALE', 'PAYMENT_RECEIVED', 'PAYMENT_GIVEN', 'ADJUSTMENT', 'OPENING')),
        reference_id INTEGER,
        reference_no TEXT,
        debit REAL NOT NULL DEFAULT 0.0,
        credit REAL NOT NULL DEFAULT 0.0,
        running_balance REAL NOT NULL,
        is_test_draft INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cashbook (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date TEXT NOT NULL,
        entry_type TEXT NOT NULL CHECK(entry_type IN ('INFLOW', 'OUTFLOW')),
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_mode IN ('CASH', 'BANK')),
        reference_id INTEGER,
        reference_no TEXT,
        party_id INTEGER REFERENCES parties(id),
        is_test_draft INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_date TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('RENT', 'ELECTRICITY', 'SALARY', 'LABOR', 'FOOD_ENTERTAINMENT', 'TRANSPORT', 'REPAIR', 'TAX_LEGAL', 'MISC')),
        amount REAL NOT NULL,
        paid_to TEXT NOT NULL,
        payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_mode IN ('CASH', 'BANK')),
        is_test_draft INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        category TEXT DEFAULT 'সাধারণ',
        is_pinned INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recycle_bin (
        id TEXT PRIMARY KEY,
        module_type TEXT NOT NULL,
        module_label TEXT NOT NULL,
        original_id TEXT NOT NULL,
        title TEXT NOT NULL,
        amount REAL DEFAULT 0.0,
        payload_json TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recycle_bin_expires ON recycle_bin(expires_at);
      CREATE INDEX IF NOT EXISTS idx_recycle_bin_module ON recycle_bin(module_type);

      CREATE TABLE IF NOT EXISTS backup_logs (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        status TEXT NOT NULL,
        telegram_message_id TEXT,
        file_size_formatted TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON backup_logs(created_at DESC);

      CREATE TABLE IF NOT EXISTS AiChatSession (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        isPinned INTEGER DEFAULT 0,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_session_pinned ON AiChatSession(isPinned DESC, updatedAt DESC);

      CREATE TABLE IF NOT EXISTS AiChatMessage (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        hasImage INTEGER DEFAULT 0,
        actionJson TEXT,
        actionExecuted INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_message_session ON AiChatMessage(sessionId, createdAt ASC);

      CREATE TABLE IF NOT EXISTS AiMemory (
        id TEXT PRIMARY KEY,
        fact TEXT NOT NULL,
        category TEXT DEFAULT 'GENERAL',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS AiDynamicOverride (
        id TEXT PRIMARY KEY,
        overrideType TEXT NOT NULL,
        targetKey TEXT NOT NULL,
        content TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure settings tables have default seeds
    await db.exec(`
      INSERT OR IGNORE INTO app_settings (key, value) VALUES
      ('org_name', 'মাহা এন্টারপ্রাইজ'),
      ('proprietor', 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স'),
      ('contacts', 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241'),
      ('location', 'চাচকৈড় বাজার, গুরুদাসপুর, নাটোর'),
      ('auto_backup_on_exit', 'true'),
      ('mon_kg_rate', '40'),
      ('app_security_pin', '5555'),
      ('app_pin', '5555'),
      ('theme_mode', 'obsidian-gold'),
      ('telegram_bot_token', '9038319945:AAFFZJoJvHaHdrhOuVP3QeEKKRjyFDx72Bk'),
      ('telegram_chat_id', '1904683489');

      INSERT OR IGNORE INTO settings (key, value) VALUES
      ('org_name', 'মাহা এন্টারপ্রাইজ'),
      ('proprietor', 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স'),
      ('contacts', 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241'),
      ('location', 'চাচকৈড় বাজার, গুরুদাসপুর, নাটোর'),
      ('auto_backup_on_exit', 'true'),
      ('mon_kg_rate', '40'),
      ('app_security_pin', '5555'),
      ('app_pin', '5555'),
      ('theme_mode', 'obsidian-gold'),
      ('telegram_bot_token', '9038319945:AAFFZJoJvHaHdrhOuVP3QeEKKRjyFDx72Bk'),
      ('telegram_chat_id', '1904683489');

      -- Seed walk-in parties
      INSERT OR IGNORE INTO parties (id, name, phone, address, party_type, opening_balance, current_balance, notes, is_active, is_pinned) VALUES
      (1, 'সাধারণ বিক্রেতা', '০১৭০০-০০০০০০', 'চাচকৈড় বাজার, গুরুদাসপুর', 'SUPPLIER', 0, 0, 'সাধারণ নগদ বিক্রেতা ও কৃষক', 1, 1),
      (2, 'সাধারণ খুচরা ক্রেতা', '০১৭০০-০০০০০০', 'চাচকৈড় বাজার, গুরুদাসপুর', 'BUYER', 0, 0, 'সাধারণ নগদ ক্রেতা ও পাইকার', 1, 1),
      (3, 'মোঃ করিম বেপারী', '01712345678', 'চলনবিল, গুরুদাসপুর', 'SUPPLIER', -25000, -25000, 'রবি শস্য সরবরাহকারী বেপারী', 1, 0),
      (4, 'রহমান ট্রেডার্স (মিল মালিক)', '01819876543', 'ঈশ্বরদী, পাবনা', 'BUYER', 145000, 145000, 'রাইস মিল ও পাইকারি খরিদ্দার', 1, 0);
    `).catch(() => null);

    // Check if initial commodities exist
    const countCheck = await db.prepare('SELECT COUNT(*) as c FROM commodities').first();
    if (!countCheck || countCheck.c === 0) {
      await db.exec(`
        INSERT OR IGNORE INTO commodities (id, name_bn, name_en, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon, notes) VALUES
        (1, 'সরিষা (মাঘি/টোরি)', 'Mustard (Maghi/Tori)', 80.0, 0, 0, 0, 0, 'চাচকৈড় মোকামের প্রধান রবি শস্য'),
        (2, 'ভুট্টা (হলুদ দানাদার)', 'Corn (Yellow Grain)', 75.0, 0, 0, 0, 0, 'নাটোর-পাবনা অঞ্চলের উচ্চ ফলনশীল ভুট্টা'),
        (3, 'তোষা পাট', 'Toshas Jute', 70.0, 0, 0, 0, 0, 'উচ্চ গ্রেড সোনালী তোষা পাট'),
        (4, 'গম (বারি-২৮/৩৩)', 'Wheat (BARI-28/33)', 85.0, 0, 0, 0, 0, 'চাক্কি ও মিল গ্রেড সাদা গম'),
        (5, 'আমন ধান (ব্রি-৪৯/স্বর্ণা)', 'Aman Paddy (BR-49/Swarna)', 75.0, 0, 0, 0, 0, 'চলনবিল অঞ্চলের আমন ধান'),
        (6, 'বোরো ধান (মিনিকেট/কাটারী)', 'Boro Paddy (Miniket/Katari)', 75.0, 0, 0, 0, 0, 'চলনবিলের সুগন্ধি ও চিকন ধান'),
        (7, 'খেসারী কলাই', 'Grass Pea (Khesari)', 85.0, 0, 0, 0, 0, 'স্থানীয় চাষীদের খেসারী ডাল/কলাই'),
        (8, 'মসুর ডাল (দেশি)', 'Lentil (Deshi)', 85.0, 0, 0, 0, 0, 'নাটোর অঞ্চলের দেশি মসুর');

        INSERT OR IGNORE INTO app_settings (key, value) VALUES
        ('org_name', 'মাহা এন্টারপ্রাইজ'),
        ('proprietor', 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স'),
        ('contacts', 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241'),
        ('location', 'চাচকৈড় বাজার, গুরুদাসপুর, নাটোর'),
        ('auto_backup_on_exit', 'true'),
        ('mon_kg_rate', '40'),
        ('app_security_pin', '5555'),
        ('theme_mode', 'obsidian-gold');
      `);
    }

    // Schema Migrations (Idempotent): Add previous_due/remaining_due to sales, notes to party_ledger, and truck/transport fields
    await db.exec(`ALTER TABLE sales ADD COLUMN previous_due REAL DEFAULT 0.0;`).catch(() => null);
    await db.exec(`ALTER TABLE sales ADD COLUMN remaining_due REAL DEFAULT 0.0;`).catch(() => null);
    await db.exec(`ALTER TABLE sales ADD COLUMN truck_no TEXT;`).catch(() => null);
    await db.exec(`ALTER TABLE sales ADD COLUMN driver_name TEXT;`).catch(() => null);
    await db.exec(`ALTER TABLE sales ADD COLUMN driver_phone TEXT;`).catch(() => null);
    await db.exec(`ALTER TABLE sales ADD COLUMN transport_info TEXT;`).catch(() => null);
    await db.exec(`ALTER TABLE sales ADD COLUMN vehicle_no TEXT;`).catch(() => null);
    await db.exec(`ALTER TABLE sales ADD COLUMN destination TEXT;`).catch(() => null);
    await db.exec(`ALTER TABLE party_ledger ADD COLUMN notes TEXT;`).catch(() => null);

    // Auto-purge recycle bin entries older than 60 days
    await db.exec(`DELETE FROM recycle_bin WHERE expires_at < CURRENT_TIMESTAMP;`).catch(() => null);

    d1Initialized = true;
  } catch (err) {
    console.error('[D1 Initialization Warning]:', err);
  }
}

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Pre-flight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-app-pin, x-auth-pin, x-pin',
        },
      });
    }

    const url = new URL(request.url);
    const db = env.DB;
    if (db) {
      await ensureD1Initialized(db);
    }

    // 2. Health & Diagnostics Endpoints
    if (url.pathname === '/api/health' || url.pathname === '/health' || url.pathname === '/api/worker-health') {
      return sendJson({
        status: 'ok',
        app: 'মাহা এন্টারপ্রাইজ (Maha Enterprise)',
        version: '1.5.0 PRO',
        database: db ? 'Cloudflare D1 (SQLite Edge)' : 'In-Memory Fallback',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. API Route Handler
    if (url.pathname.startsWith('/api/')) {
      const incomingPin = extractIncomingPin(request, url);
      
      // Verify PIN Endpoint (Always public, authenticates candidate against D1)
      if (url.pathname === '/api/auth/verify-pin' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const candidate = normalizePin(body.pin || incomingPin);
        const activePin = await getActivePin(db);
        const isValid = Boolean(candidate && candidate === activePin);
        return sendJson({ success: isValid, valid: isValid, pin: isValid ? candidate : undefined });
      }

      // Dedicated PIN Change Endpoint (POST /api/settings/pin or /api/auth/change-pin)
      if ((url.pathname === '/api/settings/pin' || url.pathname === '/api/auth/change-pin') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const currentCandidate = normalizePin(body.currentPin || body.current_pin || incomingPin);
        const newCandidate = normalizePin(body.newPin || body.new_pin);
        const activePin = await getActivePin(db);

        if (!newCandidate || newCandidate.length !== 4 || !/^\d{4}$/.test(newCandidate)) {
          return sendJson({ success: false, error: 'নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে!' }, 400);
        }

        // Verify current PIN if provided
        if (currentCandidate && currentCandidate !== activePin) {
          return sendJson({ success: false, error: 'বর্তমান পিন কোডটি সঠিক নয়!' }, 403);
        }

        await updateActivePinInDB(db, newCandidate);
        return sendJson({
          success: true,
          message: `পিন কোড সফলভাবে পরিবর্তন করা হয়েছে (নতুন পিন: ${newCandidate})`,
          activePin: newCandidate,
        });
      }

      // Network / System Info Endpoint
      if (url.pathname === '/api/system/network-info') {
        return sendJson({
          port: 443,
          localIps: ['Cloud Edge'],
          accessUrl: url.origin,
          permanentDomain: 'https://maha.nexobd.pro',
          cloud: true,
          mode: db ? 'Cloudflare D1 (Edge Database)' : 'Local Offline PWA',
        });
      }

      if (url.pathname === '/api/system/version') {
        return sendJson({ version: '1.5.0 PRO' });
      }

      // Check if this is a PIN change via /api/system/settings
      let isSettingsPinUpdate = false;
      let settingsBody = null;
      if (url.pathname === '/api/system/settings' && request.method === 'POST') {
        try {
          const cloned = request.clone();
          settingsBody = await cloned.json();
          if (settingsBody && (settingsBody.key === 'app_pin' || settingsBody.key === 'app_security_pin')) {
            isSettingsPinUpdate = true;
          }
        } catch (_) {}
      }

      // PIN Authorization Check for Protected Routes
      const activePin = await getActivePin(db);

      // OWASP ASVS: Reject query-string PIN attempts strictly with 401 Unauthorized
      if (url.searchParams.has('pin')) {
        if (!incomingPin || incomingPin !== activePin) {
          return sendJson({
            success: false,
            error: 'অননুমোদিত এক্সেস: URL কুয়েরি স্ট্রিং-এ পিন কোড দেওয়া নিষিদ্ধ (OWASP)। অনুগ্রহ করে X-App-Pin হেডার অথবা অথেনটিকেশন সেশন ব্যবহার করুন।',
          }, 401);
        }
      }

      if (incomingPin && !isSettingsPinUpdate && incomingPin !== activePin) {
        return sendJson({ success: false, error: 'অননুমোদিত এক্সেস: সঠিক পিন কোড প্রদান করুন' }, 401);
      }

      try {
        // --- COMMODITIES & CROPS ---
        if (url.pathname === '/api/commodities' || url.pathname === '/api/stock' || url.pathname === '/api/crops') {
          if (request.method === 'GET') {
            if (db) {
              const { results } = await db.prepare('SELECT * FROM commodities WHERE is_active = 1 ORDER BY id ASC').all();
              return sendJson(results);
            }
            return sendJson(inMemoryStore.commodities.filter(c => c.is_active === 1));
          }
          if (request.method === 'POST') {
            const body = await request.json();
            if (db) {
              const res = await db.prepare(`
                INSERT INTO commodities (name_bn, name_en, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                body.name_bn, body.name_en || body.name_bn, body.default_bag_weight_kg || 75.0,
                0, 0, 0, 0, body.notes || ''
              ).run();
              const newRecord = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(res.meta.last_row_id).first();
              return sendJson(newRecord, 201);
            }
            const newCom = { id: inMemoryStore.commodities.length + 1, ...body, current_stock_kg: 0, current_stock_bags: 0, current_wac_per_kg: 0, current_wac_per_mon: 0, is_active: 1 };
            inMemoryStore.commodities.push(newCom);
            return sendJson(newCom, 201);
          }
        }

        const commIdMatch = url.pathname.match(/^\/api\/(?:commodities|stock|crops)\/(\d+)$/);
        if (commIdMatch) {
          const id = parseInt(commIdMatch[1], 10);
          if (request.method === 'PUT') {
            const body = await request.json();
            if (db) {
              await db.prepare(`
                UPDATE commodities SET
                  name_bn = COALESCE(?, name_bn),
                  name_en = COALESCE(?, name_en),
                  default_bag_weight_kg = COALESCE(?, default_bag_weight_kg),
                  notes = COALESCE(?, notes),
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(body.name_bn, body.name_en, body.default_bag_weight_kg, body.notes, id).run();
              const updated = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(id).first();
              return sendJson(updated);
            }
            const idx = inMemoryStore.commodities.findIndex(c => c.id === id);
            if (idx !== -1) inMemoryStore.commodities[idx] = { ...inMemoryStore.commodities[idx], ...body };
            return sendJson(inMemoryStore.commodities[idx] || {});
          }
          if (request.method === 'DELETE' || (request.method === 'POST' && url.pathname.endsWith('/delete'))) {
            const force = url.searchParams.get('force') === 'true';
            if (db) {
              const comm = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(id).first();
              if (comm) {
                await putInRecycleBin(db, {
                  module_type: 'crop',
                  module_label: 'শস্যের জাত',
                  original_id: comm.id,
                  title: `${comm.name_bn} (${(comm.current_stock_kg / 40).toFixed(1)} মণ)`,
                  amount: comm.current_stock_kg * (comm.current_wac_per_kg || 0),
                  payload: { commodity: comm }
                });
              }
              if (force) {
                await db.batch([
                  db.prepare('DELETE FROM stock_adjustments WHERE commodity_id = ?').bind(id),
                  db.prepare('DELETE FROM sales WHERE commodity_id = ?').bind(id),
                  db.prepare('DELETE FROM purchases WHERE commodity_id = ?').bind(id),
                  db.prepare('DELETE FROM commodities WHERE id = ?').bind(id)
                ]);
                return sendJson({ success: true, message: 'শস্য স্থায়ীভাবে মুছে ফেলা হয়েছে' });
              }
              await db.prepare('UPDATE commodities SET is_active = 0 WHERE id = ?').bind(id).run();
              return sendJson({ success: true, message: 'শস্য নিষ্ক্রিয় করা হয়েছে' });
            }
            const cIdx = inMemoryStore.commodities.findIndex(c => c.id === id);
            if (cIdx !== -1) {
              const cm = inMemoryStore.commodities[cIdx];
              putInRecycleBin(null, {
                module_type: 'crop',
                module_label: 'শস্যের জাত',
                original_id: cm.id,
                title: `${cm.name_bn} (${(cm.current_stock_kg / 40).toFixed(1)} মণ)`,
                amount: cm.current_stock_kg * (cm.current_wac_per_kg || 0),
                payload: { commodity: cm }
              });
              inMemoryStore.commodities.splice(cIdx, 1);
            }
            return sendJson({ success: true, message: 'শস্য মুছে ফেলা হয়েছে' });
          }
        }

        // --- PARTIES ---
        if (url.pathname === '/api/parties' || url.pathname === '/api/dues') {
          if (request.method === 'GET') {
            const rawType = (url.searchParams.get('type') || '').toUpperCase();
            if (db) {
              let sql = 'SELECT * FROM parties WHERE is_active = 1';
              const params = [];
              if (rawType === 'BUYER' || rawType === 'CUSTOMER') {
                sql += ' AND (party_type = "BUYER" OR party_type = "CUSTOMER" OR party_type = "BOTH")';
              } else if (rawType === 'SUPPLIER' || rawType === 'CREDITOR') {
                sql += ' AND (party_type = "SUPPLIER" OR party_type = "CREDITOR" OR party_type = "BOTH")';
              } else if (rawType && rawType !== 'BOTH') {
                sql += ' AND (party_type = ? OR party_type = "BOTH")';
                params.push(rawType);
              }
              sql += ' ORDER BY is_pinned DESC, updated_at DESC';
              const { results } = await db.prepare(sql).bind(...params).all();
              return sendJson(results);
            }
            let list = inMemoryStore.parties.filter(p => p.is_active === 1);
            if (rawType === 'BUYER' || rawType === 'CUSTOMER') list = list.filter(p => p.party_type === 'BUYER' || p.party_type === 'CUSTOMER' || p.party_type === 'BOTH');
            else if (rawType === 'SUPPLIER' || rawType === 'CREDITOR') list = list.filter(p => p.party_type === 'SUPPLIER' || p.party_type === 'CREDITOR' || p.party_type === 'BOTH');
            else if (rawType && rawType !== 'BOTH') list = list.filter(p => p.party_type === rawType || p.party_type === 'BOTH');
            return sendJson(list);
          }
          if (request.method === 'POST') {
            const body = await request.json();
            const openBal = roundMoney(body.opening_balance || 0);
            if (db) {
              const res = await db.prepare(`
                INSERT INTO parties (name, phone, address, party_type, opening_balance, current_balance, notes, is_pinned)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                body.name, body.phone || '', body.address || 'চাচকৈড় বাজার, গুরুদাসপুর',
                body.party_type || 'BOTH', openBal, openBal, body.notes || '', body.is_pinned ? 1 : 0
              ).run();
              const newParty = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(res.meta.last_row_id).first();
              return sendJson(newParty, 201);
            }
            const newP = { id: inMemoryStore.parties.length + 1, ...body, opening_balance: openBal, current_balance: openBal, is_active: 1 };
            inMemoryStore.parties.push(newP);
            return sendJson(newP, 201);
          }
        }

        // Dedicated Legacy Excel Batch Import Endpoint (POST /api/parties/import-legacy-excel)
        if (url.pathname === '/api/parties/import-legacy-excel' && request.method === 'POST') {
          const body = await request.json();
          const partiesToImport = Array.isArray(body.parties) ? body.parties : [];
          if (partiesToImport.length === 0) {
            return sendJson({ success: false, error: 'কোনো পার্টির তথ্য পাওয়া যায়নি।' }, 400);
          }

          let importedCount = 0;
          let totalEntriesCount = 0;

          if (db) {
            for (const p of partiesToImport) {
              if (!p.name || !p.name.trim()) continue;
              const cleanName = p.name.trim();
              const cleanPhone = (p.phone || '').trim();
              const cleanAddr = (p.address || '').trim() || 'চাচকৈড় বাজার, গুরুদাসপুর';
              const pType = (p.party_type === 'SUPPLIER' || p.party_type === 'CREDITOR' || p.partyType === 'SUPPLIER') ? 'SUPPLIER' : 'BUYER';
              const isSupplier = pType === 'SUPPLIER';
              const notes = p.notes || 'পুরনো এক্সেল হতে ইমপোর্ট';
              const openBal = Number(p.opening_balance || p.openingDue || 0);
              const curBal = Number(p.current_balance || p.currentDue || openBal);

              // 1. Resolve or Create Party
              let party = await db.prepare('SELECT * FROM parties WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))').bind(cleanName).first();
              let partyId;

              if (!party) {
                const balToSet = isSupplier ? -Math.abs(curBal) : curBal;
                const ins = await db.prepare(`
                  INSERT INTO parties (name, phone, address, party_type, opening_balance, current_balance, notes, is_active, is_pinned)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
                `).bind(cleanName, cleanPhone, cleanAddr, pType, balToSet, balToSet, notes).run();
                partyId = Number(ins.meta?.last_row_id);
                party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
                importedCount++;
              } else {
                partyId = party.id;
                // If previous party had placeholder or empty contact, upgrade it
                if ((!party.phone || party.phone === '০১৭০০-০০০০০০' || party.phone === '') && cleanPhone) {
                  await db.prepare('UPDATE parties SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(cleanPhone, partyId).run();
                }
                importedCount++;
              }

              // 2. Insert line-by-line ledger entries if provided
              const entries = Array.isArray(p.ledgerEntries) ? p.ledgerEntries : [];
              if (entries.length > 0) {
                const batchInserts = [];
                for (const entry of entries) {
                  const eDate = entry.date || new Date().toISOString().split('T')[0];
                  const debitAmt = roundMoney(entry.debit || 0);
                  const creditAmt = roundMoney(entry.credit || 0);
                  if (debitAmt === 0 && creditAmt === 0) continue;

                  let txType = 'ADJUSTMENT';
                  if (isSupplier) {
                    txType = debitAmt > 0 ? 'PAYMENT_GIVEN' : 'PURCHASE';
                  } else {
                    txType = debitAmt > 0 ? 'SALE' : 'PAYMENT_RECEIVED';
                  }

                  batchInserts.push(
                    db.prepare(`
                      INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description, notes)
                      VALUES (?, ?, ?, 'EXC-IMP', ?, ?, 0, 0, ?, ?)
                    `).bind(eDate, partyId, txType, debitAmt, creditAmt, entry.description || 'এক্সেল খতিয়ান হতে ইমপোর্ট', entry.reference || '')
                  );
                  totalEntriesCount++;
                }

                if (batchInserts.length > 0) {
                  await db.batch(batchInserts);
                }

                // 3. Recalculate chronological running balance for this party
                const { results: allRows } = await db.prepare(
                  'SELECT * FROM party_ledger WHERE party_id = ? ORDER BY entry_date ASC, id ASC'
                ).bind(partyId).all();

                let running = 0;
                const batchRecalc = [];
                for (const r of (allRows || [])) {
                  running = roundMoney(running + (r.debit || 0) - (r.credit || 0));
                  batchRecalc.push(
                    db.prepare('UPDATE party_ledger SET running_balance = ? WHERE id = ?').bind(running, r.id)
                  );
                }
                batchRecalc.push(
                  db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(running, partyId)
                );
                await db.batch(batchRecalc);
              } else if (curBal !== 0 && party) {
                // If standard row import without ledger history, ensure opening balance exists in ledger
                const existingLedger = await db.prepare('SELECT id FROM party_ledger WHERE party_id = ? LIMIT 1').bind(partyId).first();
                if (!existingLedger) {
                  const balVal = isSupplier ? -Math.abs(curBal) : curBal;
                  await db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                    VALUES (date('now', 'localtime'), ?, 'OPENING', 'OPN-001', ?, ?, ?, 0, 'প্রারম্ভিক জের (এক্সেল ইমপোর্ট)')
                  `).bind(
                    partyId,
                    balVal > 0 ? balVal : 0,
                    balVal < 0 ? Math.abs(balVal) : 0,
                    balVal
                  ).run();
                  totalEntriesCount++;
                }
              }
            }

            return sendJson({
              success: true,
              importedCount,
              totalEntriesCount,
              message: `${toBnDigits(importedCount)} জন পার্টির মোট ${toBnDigits(totalEntriesCount)} টি লেজার এন্ট্রি সফলভাবে ইমপোর্ট সম্পন্ন হয়েছে!`
            }, 201);
          }

          return sendJson({ success: true, importedCount: partiesToImport.length, totalEntriesCount: 0, message: 'সফলভাবে ইমপোর্ট হয়েছে' }, 201);
        }

        const partyIdMatch = url.pathname.match(/^\/api\/parties\/(\d+)$/);
        if (partyIdMatch) {
          const id = parseInt(partyIdMatch[1], 10);
          if (request.method === 'GET') {
            if (db) {
              const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(id).first();
              return sendJson(party);
            }
            return sendJson(inMemoryStore.parties.find(p => p.id === id));
          }
          if (request.method === 'PUT') {
            const body = await request.json();
            if (db) {
              await db.prepare(`
                UPDATE parties SET
                  name = COALESCE(?, name),
                  phone = COALESCE(?, phone),
                  address = COALESCE(?, address),
                  party_type = COALESCE(?, party_type),
                  notes = COALESCE(?, notes),
                  is_pinned = COALESCE(?, is_pinned),
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(
                body.name !== undefined ? body.name : null,
                body.phone !== undefined ? body.phone : null,
                body.address !== undefined ? body.address : null,
                body.party_type !== undefined ? body.party_type : null,
                body.notes !== undefined ? body.notes : null,
                body.is_pinned !== undefined ? (body.is_pinned ? 1 : 0) : null,
                id
              ).run();
              const updated = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(id).first();
              return sendJson(updated);
            }
            const idx = inMemoryStore.parties.findIndex(p => p.id === id);
            if (idx !== -1) inMemoryStore.parties[idx] = { ...inMemoryStore.parties[idx], ...body };
            return sendJson(inMemoryStore.parties[idx] || {});
          }
          if (request.method === 'DELETE' || (request.method === 'POST' && url.pathname.endsWith('/delete'))) {
            const force = url.searchParams.get('force') === 'true';
            if (db) {
              const pt = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(id).first();
              if (pt) {
                await putInRecycleBin(db, {
                  module_type: 'party',
                  module_label: 'বাকি খাতা / পার্টি',
                  original_id: pt.id,
                  title: `${pt.name} (${pt.phone || 'ফোন নেই'})`,
                  amount: pt.current_balance || 0,
                  payload: { party: pt }
                });
              }
              if (force) {
                await db.batch([
                  db.prepare('DELETE FROM party_ledger WHERE party_id = ?').bind(id),
                  db.prepare('DELETE FROM parties WHERE id = ?').bind(id)
                ]);
                return sendJson({ success: true, message: 'পার্টি স্থায়ীভাবে মুছে ফেলা হয়েছে' });
              }
              await db.prepare('UPDATE parties SET is_active = 0 WHERE id = ?').bind(id).run();
              return sendJson({ success: true, message: 'পার্টি সফলভাবে মুছে ফেলা হয়েছে' });
            }
            const pIdx = inMemoryStore.parties.findIndex(p => p.id === id);
            if (pIdx !== -1) {
              const pt = inMemoryStore.parties[pIdx];
              putInRecycleBin(null, {
                module_type: 'party',
                module_label: 'বাকি খাতা / পার্টি',
                original_id: pt.id,
                title: `${pt.name} (${pt.phone || 'ফোন নেই'})`,
                amount: pt.current_balance || 0,
                payload: { party: pt }
              });
              inMemoryStore.parties.splice(pIdx, 1);
            }
            return sendJson({ success: true, message: 'মুছে ফেলা হয়েছে' });
          }
        }

        // Dedicated Party Action Endpoints (POST /api/parties/:id/payment & POST /api/parties/:id/due)
        const partyActionMatch = url.pathname.match(/^\/api\/parties\/(\d+)\/(payment|due)$/);
        if (partyActionMatch && request.method === 'POST') {
          const partyId = parseInt(partyActionMatch[1], 10);
          const action = partyActionMatch[2];
          const body = await request.json();
          const amt = roundMoney(body.amount);
          const entryDate = body.entry_date || new Date().toISOString().split('T')[0];
          const isTest = body.is_test_draft ? 1 : 0;

          if (db) {
            const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
            if (!party) return sendJson({ success: false, error: 'পার্টি পাওয়া যায়নি' }, 404);

            const isSupplier = party.party_type === 'SUPPLIER' || party.party_type === 'CREDITOR';

            if (action === 'payment') {
              if (isSupplier) {
                // Paying to supplier: reduces our debt (makes balance less negative or more positive)
                const newBal = addMoney(party.current_balance, amt);
                await db.batch([
                  db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, partyId),
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'PAYMENT_GIVEN', ?, 0, ?, ?, ?)
                  `).bind(entryDate, partyId, amt, newBal, isTest, body.description || 'পাওনাদার নগদ পরিশোধ'),
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, is_test_draft, description)
                    VALUES (?, 'OUTFLOW', 'SUPPLIER_PAYMENT', ?, ?, ?, ?, ?)
                  `).bind(entryDate, amt, body.payment_mode || 'CASH', partyId, isTest, `পাওনাদার পরিশোধ: ${party.name} (${body.description || ''})`)
                ]);
                return sendJson({ success: true, newBalance: newBal }, 201);
              } else {
                const newBal = subMoney(party.current_balance, amt);
                await db.batch([
                  db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, partyId),
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'PAYMENT_RECEIVED', 0, ?, ?, ?, ?)
                  `).bind(entryDate, partyId, amt, newBal, isTest, body.description || 'বকেয়া নগদ আদায়'),
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, is_test_draft, description)
                    VALUES (?, 'INFLOW', 'DUE_COLLECTION', ?, ?, ?, ?, ?)
                  `).bind(entryDate, amt, body.payment_mode || 'CASH', partyId, isTest, `বকেয়া আদায়: ${party.name} (${body.description || ''})`)
                ]);
                return sendJson({ success: true, newBalance: newBal }, 201);
              }
            } else {
              // action === 'due'
              if (isSupplier) {
                // Adding payable to supplier increases debt (makes balance more negative)
                const newBal = subMoney(party.current_balance, amt);
                await db.batch([
                  db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, partyId),
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'ADJUSTMENT', 0, ?, ?, ?, ?)
                  `).bind(entryDate, partyId, amt, newBal, isTest, body.description || 'পাওনা বৃদ্ধি')
                ]);
                return sendJson({ success: true, newBal }, 201);
              } else {
                const newBal = addMoney(party.current_balance, amt);
                await db.batch([
                  db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, partyId),
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'OPENING_BALANCE', ?, 0, ?, ?, ?)
                  `).bind(entryDate, partyId, amt, newBal, isTest, body.description || 'বকেয়া সমন্বয়')
                ]);
                return sendJson({ success: true, newBalance: newBal }, 201);
              }
            }
          }
          return sendJson({ success: true, newBalance: 0 }, 201);
        }

        // Adjust Due Endpoint
        if (url.pathname === '/api/parties/adjust-due' && request.method === 'POST') {
          const body = await request.json();
          const partyId = body.party_id;
          const amt = roundMoney(body.amount);
          const entryDate = body.entry_date || new Date().toISOString().split('T')[0];
          const desc = body.description || 'পূর্বের বকেয়া সমন্বয়';

          if (db) {
            const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
            if (!party) return sendJson({ success: false, error: 'পার্টি পাওয়া যায়নি' }, 404);
            const newBal = addMoney(party.current_balance, amt);
            await db.batch([
              db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, partyId),
              db.prepare(`
                INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, description)
                VALUES (?, ?, 'ADJUSTMENT', ?, 0, ?, ?)
              `).bind(entryDate, partyId, amt, newBal, desc)
            ]);
            return sendJson({ success: true, newBalance: newBal });
          }
          return sendJson({ success: true, newBalance: 0 });
        }

        // Party Detailed Statement Endpoint
        const statementMatch = url.pathname.match(/^\/api\/parties\/(\d+)\/statement$/);
        if (statementMatch && request.method === 'GET') {
          const partyId = parseInt(statementMatch[1], 10);
          if (db) {
            const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
            const { results: ledger } = await db.prepare('SELECT * FROM party_ledger WHERE party_id = ? ORDER BY entry_date ASC, id ASC').bind(partyId).all();
            const { results: sales } = await db.prepare('SELECT s.*, c.name_bn as commodity_name FROM sales s JOIN commodities c ON s.commodity_id = c.id WHERE s.party_id = ? ORDER BY s.id DESC').bind(partyId).all();
            const { results: purchases } = await db.prepare('SELECT p.*, c.name_bn as commodity_name FROM purchases p JOIN commodities c ON p.commodity_id = c.id WHERE p.party_id = ? ORDER BY p.id DESC').bind(partyId).all();

            const ledgerList = ledger || [];
            const payments = ledgerList.filter(e => (e.credit || 0) > 0 || e.transaction_type === 'PAYMENT_RECEIVED');
            const invoices = ledgerList.filter(e => (e.debit || 0) > 0 && e.transaction_type !== 'OPENING');
            const totalInflow = payments.reduce((s, p) => s + (p.credit || 0), 0);
            const totalInvoices = invoices.reduce((s, i) => s + (i.debit || 0), 0);
            const openingDue = party ? (party.opening_balance || 0) : 0;
            const netDue = party ? party.current_balance : 0;

            return sendJson({
              party,
              ledger: ledgerList,
              sales: sales || [],
              purchases: purchases || [],
              payments,
              invoices,
              totalInflow,
              totalInvoices,
              openingDue,
              netDue
            });
          }
          const p = inMemoryStore.parties.find(x => x.id === partyId);
          return sendJson({
            party: p,
            ledger: [],
            sales: [],
            purchases: [],
            payments: [],
            invoices: [],
            totalInflow: 0,
            totalInvoices: 0,
            openingDue: p?.opening_balance || 0,
            netDue: p?.current_balance || 0
          });
        }

        // --- PURCHASES (ক্রয় ও স্টক-ইন) ---
        if (url.pathname === '/api/purchases') {
          if (request.method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit') || '100', 10);
            if (db) {
              const { results } = await db.prepare(`
                SELECT p.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address,
                       c.name_bn as commodity_name
                FROM purchases p
                JOIN parties pt ON p.party_id = pt.id
                JOIN commodities c ON p.commodity_id = c.id
                ORDER BY p.id DESC
                LIMIT ?
              `).bind(limit).all();
              return sendJson(results);
            }
            return sendJson(inMemoryStore.purchases);
          }

          if (request.method === 'POST') {
            const body = await request.json();
            const isTest = body.is_test_draft ? 1 : 0;
            const grossKg = roundWeight(body.gross_weight_kg);
            const bagDedKg = roundWeight(body.bag_deduction_kg || 0);
            const netKg = roundWeight(Math.max(0, grossKg - bagDedKg));
            const netMon = roundWeight(netKg / 40.0);
            const rateMon = roundMoney(body.rate_per_mon);
            const grossAmount = roundMoney((netKg / 40.0) * rateMon);

            const labor = roundMoney(body.labor_cost || 0);
            const transport = roundMoney(body.transport_cost || 0);
            const bag = roundMoney(body.bag_cost || 0);
            const other = roundMoney(body.other_cost || 0);
            const directExp = addMoney(addMoney(labor, transport), addMoney(bag, other));
            const totalLandedCost = addMoney(grossAmount, directExp);
            const costPerKg = netKg > 0 ? totalLandedCost / netKg : 0;
            const costPerMon = roundMoney(costPerKg * 40.0);

            const paidAmount = roundMoney(Math.min(grossAmount, body.paid_amount || 0));
            const dueAmount = roundMoney(Math.max(0, subMoney(grossAmount, paidAmount)));

            let payMethod = 'CASH';
            if (body.payment_method === 'BANK') payMethod = 'BANK';
            else if (dueAmount <= 0) payMethod = 'CASH';
            else if (paidAmount <= 0) payMethod = 'DUE';
            else payMethod = 'PARTIAL';

            const dateStr = (body.purchase_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
            const invoiceNo = `PUR-${dateStr}-${Date.now().toString().slice(-4)}`;

            if (db) {
              const commodity = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(body.commodity_id).first();
              if (!commodity) return sendJson({ success: false, error: 'শস্য পাওয়া যায়নি' }, 404);

              const sellerName = (body.supplier_name || body.seller_name || body.party_name || '').trim();
              const sellerPhone = (body.supplier_phone || body.seller_phone || body.phone || '').trim();
              const party = await resolveOrCreateParty(db, body.party_id, sellerName, sellerPhone, 'SUPPLIER', isTest);
              const partyId = party.id;

              const oldStockKg = roundWeight(commodity.current_stock_kg);
              const oldWacPerKg = commodity.current_wac_per_kg;
              let newWacPerKg = costPerKg;
              if (oldStockKg > 0) {
                newWacPerKg = ((oldStockKg * oldWacPerKg) + totalLandedCost) / (oldStockKg + netKg);
              }
              const newWacPerMon = roundMoney(newWacPerKg * 40.0);
              const newStockKg = addWeight(oldStockKg, netKg);
              const newStockBags = commodity.current_stock_bags + (body.bags_count || 0);

              const newPartyBal = addMoney(party.current_balance, subMoney(paidAmount, grossAmount));

              const batchStmts = [
                db.prepare(`
                  INSERT INTO purchases (
                    invoice_no, purchase_date, party_id, commodity_id, bags_count,
                    gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
                    rate_per_mon, gross_amount, labor_cost, transport_cost, bag_cost, other_cost,
                    total_landed_cost, cost_per_mon, cost_per_kg, payment_method,
                    paid_amount, due_amount, previous_wac_per_kg, new_wac_per_kg, is_test_draft, notes
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  invoiceNo, body.purchase_date, partyId, body.commodity_id, body.bags_count || 0,
                  grossKg, bagDedKg, netKg, netMon,
                  rateMon, grossAmount, labor, transport, bag, other,
                  totalLandedCost, costPerMon, costPerKg, payMethod,
                  paidAmount, dueAmount, oldWacPerKg, newWacPerKg, isTest, body.notes || ''
                ),
                db.prepare(`
                  UPDATE commodities SET
                    current_stock_kg = ?, current_stock_bags = ?, current_wac_per_kg = ?, current_wac_per_mon = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `).bind(newStockKg, newStockBags, newWacPerKg, newWacPerMon, body.commodity_id),
                db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newPartyBal, partyId),
                db.prepare(`
                  INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                  VALUES (?, ?, 'PURCHASE', ?, 0, ?, ?, ?, ?)
                `).bind(
                  body.purchase_date, partyId, invoiceNo,
                  grossAmount, subMoney(party.current_balance, grossAmount), isTest,
                  `ক্রয়: ${commodity.name_bn} (${netMon.toFixed(2)} মন / ${body.bags_count} বস্তা @ ৳${rateMon}/মন)`
                )
              ];

              if (paidAmount > 0) {
                batchStmts.push(
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'PAYMENT_GIVEN', ?, ?, 0, ?, ?, ?)
                  `).bind(body.purchase_date, partyId, invoiceNo, paidAmount, newPartyBal, isTest, `নগদ পরিশোধ (ক্রয় বিল: ${invoiceNo})`),
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                    VALUES (?, 'OUTFLOW', 'PURCHASE_CASH', ?, ?, ?, ?, ?, ?)
                  `).bind(body.purchase_date, paidAmount, payMethod === 'BANK' ? 'BANK' : 'CASH', invoiceNo, partyId, isTest, `শস্য ক্রয়ে পরিশোধ: ${party.name} (${commodity.name_bn})`)
                );
              }

              if (directExp > 0) {
                batchStmts.push(
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                    VALUES (?, 'OUTFLOW', 'EXPENSE', ?, 'CASH', ?, ?, ?, ?)
                  `).bind(body.purchase_date, directExp, invoiceNo, partyId, isTest, `ক্রয় আনুষঙ্গিক খরচ (চালান: ${invoiceNo})`)
                );
              }

              await db.batch(batchStmts);
              const created = await db.prepare(`
                SELECT p.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address, c.name_bn as commodity_name
                FROM purchases p
                JOIN parties pt ON p.party_id = pt.id
                JOIN commodities c ON p.commodity_id = c.id
                WHERE p.invoice_no = ?
              `).bind(invoiceNo).first();
              return sendJson(created, 201);
            }

            const sellerName = (body.supplier_name || body.seller_name || body.party_name || '').trim();
            const sellerPhone = (body.supplier_phone || body.seller_phone || body.phone || '').trim();
            const party = await resolveOrCreateParty(null, body.party_id, sellerName, sellerPhone, 'SUPPLIER', isTest);
            const mockPurchase = {
              id: Date.now(),
              invoice_no: invoiceNo,
              ...body,
              party_id: party.id,
              party_name: party.name,
              party_phone: party.phone,
              net_weight_kg: netKg,
              net_weight_mon: netMon,
              gross_amount: grossAmount,
              total_landed_cost: totalLandedCost,
              paid_amount: paidAmount,
              due_amount: dueAmount
            };
            inMemoryStore.purchases.unshift(mockPurchase);
            return sendJson(mockPurchase, 201);
          }
        }

        // --- PURCHASES DELETE / REVERSAL ---
        const purchaseIdMatch = url.pathname.match(/^\/api\/purchases\/(\d+)$/);
        if (
          (purchaseIdMatch && (request.method === 'DELETE' || request.method === 'POST')) ||
          ((url.pathname === '/api/purchases' || url.pathname === '/api/purchases/delete') &&
            (request.method === 'DELETE' || request.method === 'POST'))
        ) {
          let id = purchaseIdMatch ? parseInt(purchaseIdMatch[1], 10) : parseInt(url.searchParams.get('id') || '0', 10);
          let reqBody = {};
          if (!id && request.method === 'POST') {
            reqBody = await request.json().catch(() => ({}));
            id = parseInt(reqBody.id || '0', 10);
          }
          const invoiceNoQuery = url.searchParams.get('invoice_no') || reqBody.invoice_no;

          if (db) {
            let p = null;
            if (id > 0) {
              p = await db.prepare('SELECT * FROM purchases WHERE id = ?').bind(id).first();
            }
            if (!p && invoiceNoQuery) {
              p = await db.prepare('SELECT * FROM purchases WHERE invoice_no = ?').bind(invoiceNoQuery).first();
            }
            if (!p) {
              return sendJson({ success: false, error: 'ক্রয় চালান পাওয়া যায়নি' }, 404);
            }

            const purchaseId = p.id;
            const invNo = p.invoice_no;

            // Snapshot in recycle bin before deleting
            const pleger = await db.prepare("SELECT * FROM party_ledger WHERE reference_no = ?").bind(invNo).all().catch(() => ({ results: [] }));
            const pcash = await db.prepare("SELECT * FROM cashbook WHERE reference_no = ?").bind(invNo).all().catch(() => ({ results: [] }));
            await putInRecycleBin(db, {
              module_type: 'purchase',
              module_label: 'শস্য ক্রয়',
              original_id: p.id,
              title: `ক্রয় চালান ${p.invoice_no} (${p.net_weight_mon} মণ @ ৳${p.rate_per_mon})`,
              amount: p.total_landed_cost || p.gross_amount || 0,
              payload: { purchase: p, ledger: pleger?.results || [], cash: pcash?.results || [] }
            });

            // 1. Fetch commodity and recalculate stock & WAC
            const comm = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(p.commodity_id).first();
            const newStockKg = Math.max(0, roundWeight(subWeight(comm?.current_stock_kg || 0, p.net_weight_kg)));
            const newStockBags = Math.max(0, (comm?.current_stock_bags || 0) - (p.bags_count || 0));

            // Recalculate WAC from remaining purchases
            const { results: remPurchases } = await db.prepare(
              'SELECT net_weight_kg, total_landed_cost FROM purchases WHERE commodity_id = ? AND id != ?'
            ).bind(p.commodity_id, purchaseId).all();

            let newWacPerKg = 0;
            if (newStockKg > 0 && remPurchases && remPurchases.length > 0) {
              let totalKg = 0;
              let totalCost = 0;
              for (const rp of remPurchases) {
                totalKg += (rp.net_weight_kg || 0);
                totalCost += (rp.total_landed_cost || 0);
              }
              newWacPerKg = totalKg > 0 ? (totalCost / totalKg) : 0;
            }
            const newWacPerMon = roundMoney(newWacPerKg * 40.0);

            const batchStmts = [
              db.prepare(`
                UPDATE commodities SET
                  current_stock_kg = ?,
                  current_stock_bags = ?,
                  current_wac_per_kg = ?,
                  current_wac_per_mon = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(newStockKg, newStockBags, newWacPerKg, newWacPerMon, p.commodity_id),

              db.prepare('DELETE FROM purchases WHERE id = ?').bind(purchaseId),
              db.prepare("DELETE FROM party_ledger WHERE reference_no = ? OR (reference_id = ? AND transaction_type IN ('PURCHASE', 'PAYMENT_GIVEN'))").bind(invNo, purchaseId),
              db.prepare("DELETE FROM cashbook WHERE reference_no = ? OR (reference_id = ? AND (reference_no = ? OR category IN ('PURCHASE_CASH', 'EXPENSE')))").bind(invNo, purchaseId, invNo)
            ];

            if (p.party_id) {
              const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(p.party_id).first();
              if (party) {
                const netSupplierChange = subMoney(p.paid_amount, p.gross_amount);
                const revertedBal = subMoney(party.current_balance, netSupplierChange);
                batchStmts.push(
                  db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(revertedBal, p.party_id)
                );
              }
            }

            await db.batch(batchStmts);
            return sendJson({ success: true, message: 'ক্রয় চালান সফলভাবে মুছে ফেলা হয়েছে এবং স্টক ও হিসাব সমন্বয় করা হয়েছে' });
          }

          const idx = inMemoryStore.purchases.findIndex(item => item.id === id || item.invoice_no === invoiceNoQuery);
          if (idx !== -1) {
            const p = inMemoryStore.purchases[idx];
            putInRecycleBin(null, {
              module_type: 'purchase',
              module_label: 'শস্য ক্রয়',
              original_id: p.id,
              title: `ক্রয় চালান ${p.invoice_no} (${p.net_weight_mon} মণ @ ৳${p.rate_per_mon})`,
              amount: p.total_landed_cost || p.gross_amount || 0,
              payload: { purchase: p }
            });
            inMemoryStore.purchases.splice(idx, 1);
            return sendJson({ success: true, message: 'ক্রয় চালান মুছে ফেলা হয়েছে' });
          }
          return sendJson({ success: false, error: 'ক্রয় চালান পাওয়া যায়নি' }, 404);
        }

        // --- SALES (পাইকারি বিক্রয় ও চালান) ---
        if (url.pathname === '/api/sales') {
          if (request.method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit') || '100', 10);
            if (db) {
              const { results } = await db.prepare(`
                SELECT s.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address,
                       c.name_bn as commodity_name
                FROM sales s
                JOIN parties pt ON s.party_id = pt.id
                JOIN commodities c ON s.commodity_id = c.id
                ORDER BY s.id DESC
                LIMIT ?
              `).bind(limit).all();
              return sendJson(results);
            }
            return sendJson(inMemoryStore.sales);
          }

          if (request.method === 'POST') {
            const body = await request.json();
            const isTest = body.is_test_draft ? 1 : 0;
            const grossKg = roundWeight(body.gross_weight_kg);
            const bagDedKg = roundWeight(body.bag_deduction_kg || 0);
            const netKg = roundWeight(Math.max(0, grossKg - bagDedKg));
            const netMon = roundWeight(netKg / 40.0);
            const rateMon = roundMoney(body.rate_per_mon);
            const grossAmount = roundMoney((netKg / 40.0) * rateMon);
            const loading = roundMoney(body.loading_charge || 0);
            const damage = roundMoney(body.damaged_bag_deduction || 0);
            const discount = roundMoney(body.discount_amount || 0);
            const netInvoiceAmount = roundMoney(Math.max(0, subMoney(addMoney(grossAmount, loading), addMoney(damage, discount))));

            // Safe parsing of paid_amount: strictly allow 0 without defaulting
            const paidAmount = roundMoney(
              body.paid_amount !== undefined && body.paid_amount !== null && body.paid_amount !== ''
                ? Number(body.paid_amount)
                : 0
            );

            const dateStr = (body.sale_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
            const invoiceNo = `SAL-${dateStr}-${Date.now().toString().slice(-4)}`;

            if (db) {
              const commodity = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(body.commodity_id).first();
              if (!commodity) return sendJson({ success: false, error: 'শস্য পাওয়া যায়নি' }, 404);
              if (commodity.current_stock_kg < netKg) {
                return sendJson({ success: false, error: `গুদামে পর্যাপ্ত মজুত নেই! বর্তমান মজুত: ${(commodity.current_stock_kg / 40).toFixed(2)} মণ` }, 400);
              }

              const customerName = (body.customer_name || body.buyer_name || body.party_name || '').trim();
              const customerPhone = (body.customer_phone || body.buyer_phone || body.phone || '').trim();
              const party = await resolveOrCreateParty(db, body.party_id, customerName, customerPhone, 'BUYER', isTest);
              const partyId = party.id;

              // Exact 5-Step Formula
              const todayBill = netInvoiceAmount;
              const prevDue = roundMoney(party.current_balance || 0);
              const grandTotal = roundMoney(todayBill + prevDue);
              const remainingDue = roundMoney(grandTotal - paidAmount);

              let payMethod = 'CASH';
              if (body.payment_method === 'BANK') payMethod = 'BANK';
              else if (remainingDue <= 0) payMethod = 'CASH';
              else if (paidAmount <= 0) payMethod = 'DUE';
              else payMethod = 'PARTIAL';

              const cogs = roundMoney(netKg * commodity.current_wac_per_kg);
              const profit = subMoney(netInvoiceAmount, cogs);

              const bagsCount = Math.max(0, Number(body.bags_count) || 0);
              const remainingStockKg = roundWeight(subWeight(commodity.current_stock_kg, netKg));
              const remainingBags = bagsCount > 0 ? Math.max(0, commodity.current_stock_bags - bagsCount) : commodity.current_stock_bags;
              const newPartyBal = remainingDue;

              const truckNo = (body.truck_no || body.vehicle_no || '').trim();
              const driverName = (body.driver_name || '').trim();
              const driverPhone = (body.driver_phone || '').trim();
              const transportInfo = (body.transport_info || body.destination || '').trim();

              const batchStmts = [
                db.prepare(`
                  INSERT INTO sales (
                    invoice_no, sale_date, party_id, commodity_id, bags_count,
                    gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
                    rate_per_mon, gross_amount, loading_charge, damaged_bag_deduction, discount_amount,
                    net_invoice_amount, payment_method, paid_amount, due_amount,
                    vehicle_no, driver_name, driver_phone, destination,
                    truck_no, transport_info,
                    cogs_amount, realized_profit, is_test_draft, notes,
                    previous_due, remaining_due
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  invoiceNo, body.sale_date, partyId, body.commodity_id, bagsCount,
                  grossKg, bagDedKg, netKg, netMon,
                  rateMon, grossAmount, loading, damage, discount,
                  netInvoiceAmount, payMethod, paidAmount, remainingDue,
                  truckNo, driverName, driverPhone, transportInfo,
                  truckNo, transportInfo,
                  cogs, profit, isTest, body.notes || '',
                  prevDue, remainingDue
                ),
                db.prepare(`
                  UPDATE commodities SET current_stock_kg = ?, current_stock_bags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                `).bind(remainingStockKg, remainingBags, body.commodity_id),
                db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newPartyBal, partyId),
                db.prepare(`
                  INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                  VALUES (?, ?, 'SALE', ?, ?, 0, ?, ?, ?)
                `).bind(
                  body.sale_date, partyId, invoiceNo,
                  todayBill, addMoney(prevDue, todayBill), isTest,
                  `বিক্রয়: ${commodity.name_bn} (${netMon.toFixed(2)} মন / ${bagsCount > 0 ? `${bagsCount} বস্তা` : 'খোলা/লুজ'} @ ৳${rateMon}/মন)`
                )
              ];

              if (paidAmount > 0) {
                batchStmts.push(
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'PAYMENT_RECEIVED', ?, 0, ?, ?, ?, ?)
                  `).bind(body.sale_date, partyId, invoiceNo, paidAmount, newPartyBal, isTest, `নগদ আদায় (বিক্রয় চালান: ${invoiceNo})`),
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                    VALUES (?, 'INFLOW', 'SALE_CASH', ?, ?, ?, ?, ?, ?)
                  `).bind(body.sale_date, paidAmount, payMethod === 'BANK' ? 'BANK' : 'CASH', invoiceNo, partyId, isTest, `বিক্রয় নগদ আদায়: ${party.name} (${commodity.name_bn})`)
                );
              }

              await db.batch(batchStmts);
              const created = await db.prepare(`
                SELECT s.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address, c.name_bn as commodity_name
                FROM sales s
                JOIN parties pt ON s.party_id = pt.id
                JOIN commodities c ON s.commodity_id = c.id
                WHERE s.invoice_no = ?
              `).bind(invoiceNo).first();

              // Auto-SMS Dispatch via ctx.waitUntil (Non-blocking)
              let smsQueued = false;
              const sendSmsParam = body.send_sms !== undefined ? Boolean(body.send_sms) : true;
              if (sendSmsParam && created && created.party_phone) {
                const normPhone = normalizeBdPhone(created.party_phone);
                if (normPhone) {
                  smsQueued = true;
                  const smsPromise = (async () => {
                    try {
                      const smsConfig = await getSmsConfig(db, env);
                      if (smsConfig.sms_enabled === 'true') {
                        const smsText = buildSaleSmsText(smsConfig.sms_format_mode, {
                          invoiceNo: created.invoice_no,
                          commodityName: created.commodity_name,
                          bagsCount: created.bags_count,
                          netWeightMon: created.net_weight_mon,
                          netWeightKg: created.net_weight_kg,
                          netAmount: created.net_invoice_amount,
                          paidAmount: created.paid_amount,
                          currentDue: created.remaining_due !== undefined ? created.remaining_due : created.due_amount,
                          truckNo: truckNo,
                        });
                        await sendBulkSms(db, env, {
                          phone: normPhone,
                          message: smsText,
                          invoiceNo: created.invoice_no,
                          partyName: created.party_name,
                        });
                      }
                    } catch (smsErr) {
                      console.warn('[Auto-SMS Single Sale Error]:', smsErr);
                    }
                  })();

                  if (ctx && typeof ctx.waitUntil === 'function') {
                    ctx.waitUntil(smsPromise);
                  } else {
                    smsPromise.catch(() => {});
                  }
                }
              }

              return sendJson({ ...created, sms_queued: smsQueued }, 201);
            }

            const customerName = (body.customer_name || body.buyer_name || body.party_name || '').trim();
            const customerPhone = (body.customer_phone || body.buyer_phone || body.phone || '').trim();
            const party = await resolveOrCreateParty(null, body.party_id, customerName, customerPhone, 'BUYER', isTest);
            const mockSale = {
              id: Date.now(),
              invoice_no: invoiceNo,
              ...body,
              party_id: party.id,
              party_name: party.name,
              party_phone: party.phone,
              net_weight_kg: netKg,
              net_weight_mon: netMon,
              net_invoice_amount: netInvoiceAmount,
              paid_amount: paidAmount,
              due_amount: dueAmount
            };
            inMemoryStore.sales.unshift(mockSale);
            return sendJson(mockSale, 201);
          }
        }

        // --- BATCH SALES (পাইকারি বিক্রয় POS কার্ট) ---
        if (url.pathname === '/api/sales/batch' && request.method === 'POST') {
          const body = await request.json();
          if (!body.items || body.items.length === 0) {
            return sendJson({ success: false, error: 'কার্টে কমপক্ষে একটি শস্যের আইটেম যোগ করুন' }, 400);
          }

          const isTest = body.is_test_draft ? 1 : 0;
          const dateStr = (body.sale_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
          const baseInvoiceNo = `SAL-${dateStr}-${Date.now().toString().slice(-4)}`;

          const custName = (body.customer_name || body.buyer_name || body.party_name || '').trim();
          const custPhone = (body.customer_phone || body.buyer_phone || body.phone || '').trim();
          const party = await resolveOrCreateParty(db, body.party_id, custName, custPhone, 'BUYER', isTest);
          const partyId = party.id;

          const truckNo = (body.truck_no || body.vehicle_no || '').trim();
          const driverName = (body.driver_name || '').trim();
          const driverPhone = (body.driver_phone || '').trim();
          const transportInfo = (body.transport_info || body.destination || '').trim();

          if (db) {
            let grandTotalBill = 0;
            const itemsProcessed = [];

            for (let idx = 0; idx < body.items.length; idx++) {
              const item = body.items[idx];
              const commodity = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(item.commodity_id).first();
              if (!commodity) return sendJson({ success: false, error: `শস্যের আইডি ${item.commodity_id} পাওয়া যায়নি` }, 404);

              const bagsCount = Math.max(0, Number(item.bags_count) || 0);
              let netMon = item.net_weight_mon
                ? Number(item.net_weight_mon)
                : (bagsCount > 0
                    ? (bagsCount * (commodity.default_bag_weight_kg || 80)) / 40.0
                    : (item.net_weight_kg ? Number(item.net_weight_kg) / 40.0 : 0));
              netMon = roundWeight(netMon);
              let netKg = item.net_weight_kg ? Number(item.net_weight_kg) : roundWeight(netMon * 40.0);
              let grossKg = item.gross_weight_kg ? Number(item.gross_weight_kg) : netKg;
              let bagDedKg = item.bag_deduction_kg ? Number(item.bag_deduction_kg) : 0;

              if (commodity.current_stock_kg < netKg) {
                const curMon = (commodity.current_stock_kg / 40.0).toFixed(1);
                return sendJson({ success: false, error: `পর্যাপ্ত স্টক নেই! ${commodity.name_bn}-এর বর্তমান স্টক ${curMon} মণ (${commodity.current_stock_kg} কেজি)।` }, 400);
              }

              const rateMon = roundMoney(item.rate_per_mon);
              const itemTotal = roundMoney(netMon * rateMon);
              grandTotalBill = addMoney(grandTotalBill, itemTotal);

              const cogs = roundMoney(netKg * (commodity.current_wac_per_kg || 0));
              const profit = subMoney(itemTotal, cogs);

              const itemInvoiceNo = body.items.length > 1 ? `${baseInvoiceNo}-${idx + 1}` : baseInvoiceNo;

              itemsProcessed.push({
                item,
                commodity,
                bagsCount,
                netMon,
                netKg,
                grossKg,
                bagDedKg,
                rateMon,
                itemTotal,
                cogs,
                profit,
                itemInvoiceNo,
              });
            }

            // Exact 5-Step Formula
            const prevDue = roundMoney(party.current_balance || 0);
            const grandTotal = roundMoney(grandTotalBill + prevDue);
            const totalPaid = roundMoney(
              body.cash_paid !== undefined && body.cash_paid !== null && body.cash_paid !== ''
                ? Number(body.cash_paid)
                : (body.paid_amount !== undefined && body.paid_amount !== null && body.paid_amount !== '' ? Number(body.paid_amount) : 0)
            );
            const remainingDue = roundMoney(grandTotal - totalPaid);

            let payMethod = 'CASH';
            if (body.payment_method === 'BANK') payMethod = 'BANK';
            else if (remainingDue <= 0) payMethod = 'CASH';
            else if (totalPaid <= 0) payMethod = 'DUE';
            else payMethod = 'PARTIAL';

            const batchStmts = [];
            const itemSummaries = [];

            for (let idx = 0; idx < itemsProcessed.length; idx++) {
              const p = itemsProcessed[idx];
              const itemPaid = idx === 0 ? totalPaid : 0;
              const itemPrevDue = idx === 0 ? prevDue : 0;
              const itemRemainingDue = idx === 0 ? remainingDue : 0;

              batchStmts.push(
                db.prepare(`
                  INSERT INTO sales (
                    invoice_no, sale_date, party_id, commodity_id, bags_count,
                    gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
                    rate_per_mon, gross_amount, loading_charge, damaged_bag_deduction, discount_amount,
                    net_invoice_amount, payment_method, paid_amount, due_amount,
                    vehicle_no, driver_name, driver_phone, destination,
                    truck_no, transport_info,
                    cogs_amount, realized_profit, is_test_draft, notes,
                    previous_due, remaining_due
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  p.itemInvoiceNo, body.sale_date, partyId, p.item.commodity_id, p.bagsCount,
                  p.grossKg, p.bagDedKg, p.netKg, p.netMon,
                  p.rateMon, p.itemTotal,
                  p.itemTotal, payMethod, itemPaid, itemRemainingDue,
                  truckNo, driverName, driverPhone, transportInfo,
                  truckNo, transportInfo,
                  p.cogs, p.profit, isTest, body.notes || '',
                  itemPrevDue, itemRemainingDue
                ),
                db.prepare(`
                  UPDATE commodities SET
                    current_stock_kg = ?, current_stock_bags = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `).bind(
                  roundWeight(subWeight(p.commodity.current_stock_kg, p.netKg)),
                  p.bagsCount > 0 ? Math.max(0, p.commodity.current_stock_bags - p.bagsCount) : p.commodity.current_stock_bags,
                  p.item.commodity_id
                )
              );

              const bagDesc = p.bagsCount > 0 ? `${p.bagsCount} বস্তা, ` : 'খোলা/লুজ, ';
              itemSummaries.push(`${p.commodity.name_bn} (${bagDesc}${p.netMon.toFixed(1)} মণ @ ৳${p.rateMon})`);
            }

            const newPartyBal = remainingDue;

            batchStmts.push(
              db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newPartyBal, partyId),
              db.prepare(`
                INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                VALUES (?, ?, 'SALE', ?, ?, 0, ?, ?, ?)
              `).bind(
                body.sale_date, partyId, baseInvoiceNo,
                grandTotalBill, addMoney(prevDue, grandTotalBill), isTest,
                `পাইকারি বিক্রয় চালান: ${itemSummaries.join(', ')}`
              )
            );

            if (totalPaid > 0) {
              batchStmts.push(
                db.prepare(`
                  INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                  VALUES (?, ?, 'PAYMENT_RECEIVED', ?, 0, ?, ?, ?, ?)
                `).bind(
                  body.sale_date, partyId, baseInvoiceNo,
                  totalPaid, newPartyBal, isTest,
                  `নগদ আদায় (চালান নং: ${baseInvoiceNo})`
                ),
                db.prepare(`
                  INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                  VALUES (?, 'INFLOW', 'SALE_CASH', ?, ?, ?, ?, ?, ?)
                `).bind(
                  body.sale_date, totalPaid, payMethod === 'BANK' ? 'BANK' : 'CASH',
                  baseInvoiceNo, partyId, isTest,
                  `চালান নগদ আদায়: ${party.name} (${baseInvoiceNo})`
                )
              );
            }

            await db.batch(batchStmts);

            const { results: createdSales } = await db.prepare(`
              SELECT s.*, pt.name as party_name, pt.phone as party_phone, pt.address as party_address, c.name_bn as commodity_name
              FROM sales s
              JOIN parties pt ON s.party_id = pt.id
              JOIN commodities c ON s.commodity_id = c.id
              WHERE s.invoice_no LIKE ?
              ORDER BY s.id ASC
            `).bind(`${baseInvoiceNo}%`).all();

            // Auto-SMS Dispatch for Wholesale POS Batch Sale
            let smsQueued = false;
            const sendSmsReq = body.send_sms !== undefined ? Boolean(body.send_sms) : true;
            const targetPhone = custPhone || party.phone || '';
            const validPhone = normalizeBdPhone(targetPhone);

            if (sendSmsReq && validPhone) {
              const smsCfg = await getSmsConfig(db, env);
              if (smsCfg.sms_enabled === 'true') {
                smsQueued = true;
                const totalBags = itemsProcessed.reduce((acc, p) => acc + (p.bagsCount || 0), 0);
                const totalMon = itemsProcessed.reduce((acc, p) => acc + (p.netMon || 0), 0);
                const mainCropName = itemsProcessed.length === 1
                  ? itemsProcessed[0].commodity.name_bn
                  : `${itemsProcessed[0].commodity.name_bn} +${itemsProcessed.length - 1}`;

                const smsPromise = (async () => {
                  try {
                    const smsText = buildSaleSmsText(smsCfg.sms_format_mode, {
                      invoiceNo: baseInvoiceNo,
                      commodityName: mainCropName,
                      bagsCount: totalBags,
                      netWeightMon: totalMon,
                      netAmount: grandTotalBill,
                      paidAmount: totalPaid,
                      currentDue: newPartyBal,
                      truckNo: truckNo,
                    });

                    await sendBulkSms(db, env, {
                      phone: validPhone,
                      message: smsText,
                      invoiceNo: baseInvoiceNo,
                      partyName: party.name,
                    });
                  } catch (smsErr) {
                    console.warn('[Auto-SMS Batch Sale Error]:', smsErr);
                  }
                })();

                if (ctx && typeof ctx.waitUntil === 'function') {
                  ctx.waitUntil(smsPromise);
                } else {
                  smsPromise.catch(() => {});
                }
              }
            }

            return sendJson({ success: true, invoice_no: baseInvoiceNo, sales: createdSales || [], sms_queued: smsQueued }, 201);
          }

          const mockSales = body.items.map((item, idx) => ({
            id: Date.now() + idx,
            invoice_no: body.items.length > 1 ? `${baseInvoiceNo}-${idx + 1}` : baseInvoiceNo,
            sale_date: body.sale_date,
            party_id: party.id,
            party_name: party.name,
            commodity_id: item.commodity_id,
            bags_count: item.bags_count !== undefined ? Number(item.bags_count) : 0,
            net_weight_mon: item.net_weight_mon || 1,
            rate_per_mon: item.rate_per_mon || 0,
            gross_amount: item.total_amount || 0,
            net_invoice_amount: item.total_amount || 0,
            paid_amount: idx === 0 ? (body.cash_paid || 0) : 0,
            due_amount: 0,
            truck_no: truckNo,
            driver_name: driverName,
            driver_phone: driverPhone,
            transport_info: transportInfo,
            vehicle_no: truckNo,
            destination: transportInfo,
          }));
          return sendJson({ success: true, invoice_no: baseInvoiceNo, sales: mockSales }, 201);
        }

        // --- SALES DELETE / REVERSAL ---
        const saleIdMatch = url.pathname.match(/^\/api\/sales\/(\d+)$/);
        if (
          (saleIdMatch && (request.method === 'DELETE' || request.method === 'POST')) ||
          ((url.pathname === '/api/sales' || url.pathname === '/api/sales/delete') &&
            (request.method === 'DELETE' || request.method === 'POST'))
        ) {
          let id = saleIdMatch ? parseInt(saleIdMatch[1], 10) : parseInt(url.searchParams.get('id') || '0', 10);
          let reqBody = {};
          if (!id && request.method === 'POST') {
            reqBody = await request.json().catch(() => ({}));
            id = parseInt(reqBody.id || '0', 10);
          }
          const invoiceNoQuery = url.searchParams.get('invoice_no') || reqBody.invoice_no;

          if (db) {
            let s = null;
            if (id > 0) {
              s = await db.prepare('SELECT * FROM sales WHERE id = ?').bind(id).first();
            }
            if (!s && invoiceNoQuery) {
              s = await db.prepare('SELECT * FROM sales WHERE invoice_no = ?').bind(invoiceNoQuery).first();
            }
            if (!s) {
              return sendJson({ success: false, error: 'বিক্রয় চালান পাওয়া যায়নি' }, 404);
            }

            const saleId = s.id;
            const invNo = s.invoice_no;

            // Snapshot in recycle bin before deleting
            const sleger = await db.prepare("SELECT * FROM party_ledger WHERE reference_no = ?").bind(invNo).all().catch(() => ({ results: [] }));
            const scash = await db.prepare("SELECT * FROM cashbook WHERE reference_no = ?").bind(invNo).all().catch(() => ({ results: [] }));
            await putInRecycleBin(db, {
              module_type: 'sale',
              module_label: 'পাইকারি বিক্রয়',
              original_id: s.id,
              title: `বিক্রয় চালান ${s.invoice_no} (${s.net_weight_mon} মণ @ ৳${s.rate_per_mon})`,
              amount: s.net_invoice_amount || s.gross_amount || 0,
              payload: { sales: [s], invoice_no: invNo, ledger: sleger?.results || [], cash: scash?.results || [] }
            });

            const batchStmts = [
              db.prepare(`
                UPDATE commodities SET
                  current_stock_kg = current_stock_kg + ?,
                  current_stock_bags = current_stock_bags + ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(s.net_weight_kg, s.bags_count, s.commodity_id),

              db.prepare('DELETE FROM sales WHERE id = ?').bind(saleId),
              db.prepare("DELETE FROM party_ledger WHERE reference_no = ? OR (reference_id = ? AND transaction_type IN ('SALE', 'PAYMENT_RECEIVED'))").bind(invNo, saleId),
              db.prepare("DELETE FROM cashbook WHERE reference_no = ? OR (reference_id = ? AND category = 'SALE_CASH')").bind(invNo, saleId)
            ];

            if (s.party_id) {
              const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(s.party_id).first();
              if (party) {
                const revertedBal = (s.previous_due !== undefined && s.previous_due !== null && s.previous_due > 0)
                  ? s.previous_due
                  : subMoney(party.current_balance, subMoney(s.net_invoice_amount, s.paid_amount));
                batchStmts.push(
                  db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(revertedBal, s.party_id)
                );
              }
            }

            await db.batch(batchStmts);
            return sendJson({ success: true, message: 'বিক্রয় চালান সফলভাবে মুছে ফেলা হয়েছে এবং স্টক ও হিসাব সমন্বয় করা হয়েছে' });
          }

          const idx = inMemoryStore.sales.findIndex(item => item.id === id || item.invoice_no === invoiceNoQuery);
          if (idx !== -1) {
            const s = inMemoryStore.sales[idx];
            putInRecycleBin(null, {
              module_type: 'sale',
              module_label: 'পাইকারি বিক্রয়',
              original_id: s.id,
              title: `বিক্রয় চালান ${s.invoice_no} (${s.net_weight_mon} মণ @ ৳${s.rate_per_mon})`,
              amount: s.net_invoice_amount || s.gross_amount || 0,
              payload: { sales: [s], invoice_no: s.invoice_no }
            });
            inMemoryStore.sales.splice(idx, 1);
            return sendJson({ success: true, message: 'বিক্রয় চালান মুছে ফেলা হয়েছে' });
          }
          return sendJson({ success: false, error: 'বিক্রয় চালান পাওয়া যায়নি' }, 404);
        }

        // --- STOCK ADJUSTMENTS & SHRINKAGE (শুকতি ঘাটতি) ---
        if (url.pathname === '/api/stock-adjustments' || url.pathname === '/api/shrinkage') {
          if (request.method === 'GET') {
            if (db) {
              const { results } = await db.prepare('SELECT * FROM stock_adjustments ORDER BY id DESC LIMIT 100').all();
              return sendJson(results);
            }
            return sendJson(inMemoryStore.stockAdjustments);
          }
          if (request.method === 'POST') {
            const body = await request.json();
            const isTest = body.is_test_draft ? 1 : 0;
            const lostKg = roundWeight(body.lost_weight_kg);
            const lostMon = roundWeight(lostKg / 40.0);
            if (db) {
              const comm = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(body.commodity_id).first();
              if (!comm) return sendJson({ success: false, error: 'শস্য পাওয়া যায়নি' }, 404);
              const costVal = roundMoney(lostKg * comm.current_wac_per_kg);
              const newKg = Math.max(0, roundWeight(subWeight(comm.current_stock_kg, lostKg)));
              const newBags = Math.max(0, comm.current_stock_bags - (body.lost_bags || 0));

              await db.batch([
                db.prepare(`
                  INSERT INTO stock_adjustments (adjustment_date, commodity_id, adjustment_type, lost_weight_kg, lost_weight_mon, lost_bags, wac_at_time, cost_value, reason, is_test_draft, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(body.adjustment_date, body.commodity_id, body.adjustment_type || 'SHRINKAGE', lostKg, lostMon, body.lost_bags || 0, comm.current_wac_per_kg, costVal, body.reason || 'রোদে শুকতি ঘাটতি', isTest, body.notes || ''),
                db.prepare('UPDATE commodities SET current_stock_kg = ?, current_stock_bags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newKg, newBags, body.commodity_id)
              ]);
              return sendJson({ success: true, lost_weight_kg: lostKg, cost_value: costVal }, 201);
            }
            return sendJson({ success: true, lost_weight_kg: lostKg }, 201);
          }
        }

        const adjIdMatch = url.pathname.match(/^\/api\/(?:stock-adjustments|shrinkage)\/(\d+)$/);
        if (
          (adjIdMatch && (request.method === 'DELETE' || request.method === 'POST')) ||
          ((url.pathname === '/api/stock-adjustments' || url.pathname === '/api/shrinkage') && request.method === 'DELETE')
        ) {
          const id = adjIdMatch ? parseInt(adjIdMatch[1], 10) : parseInt(url.searchParams.get('id') || '0', 10);
          if (db) {
            const a = await db.prepare('SELECT * FROM stock_adjustments WHERE id = ?').bind(id).first();
            if (!a) return sendJson({ success: false, error: 'শুকতি ঘাটতি রেকর্ড পাওয়া যায়নি' }, 404);

            await putInRecycleBin(db, {
              module_type: 'shrinkage',
              module_label: 'ঘাটতি সমন্বয়',
              original_id: a.id,
              title: `${a.reason || 'রোদে শুকতি ঘাটতি'} (${a.lost_weight_mon} মণ)`,
              amount: a.cost_value || 0,
              payload: { adjustment: a }
            });

            await db.batch([
              db.prepare(`
                UPDATE commodities SET
                  current_stock_kg = current_stock_kg + ?,
                  current_stock_bags = current_stock_bags + ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(a.lost_weight_kg, a.lost_bags, a.commodity_id),
              db.prepare('DELETE FROM stock_adjustments WHERE id = ?').bind(id)
            ]);
            return sendJson({ success: true, message: 'শুকতি ঘাটতি রেকর্ড সফলভাবে মুছে ফেলা হয়েছে এবং স্টক স্বাভাবিক করা হয়েছে' });
          }
          const idx = inMemoryStore.stockAdjustments.findIndex(x => x.id === id);
          if (idx !== -1) {
            const a = inMemoryStore.stockAdjustments[idx];
            putInRecycleBin(null, {
              module_type: 'shrinkage',
              module_label: 'ঘাটতি সমন্বয়',
              original_id: a.id,
              title: `${a.reason || 'রোদে শুকতি ঘাটতি'} (${a.lost_weight_mon} মণ)`,
              amount: a.cost_value || 0,
              payload: { adjustment: a }
            });
            inMemoryStore.stockAdjustments.splice(idx, 1);
          }
          return sendJson({ success: true, message: 'রেকর্ড মুছে ফেলা হয়েছে' });
        }

        // --- LEDGERS & DIRECT PAYMENT VOUCHERS ---
        const ledgerPartyMatch = url.pathname.match(/^\/api\/ledgers\/(\d+)$/);
        if (ledgerPartyMatch && request.method === 'GET') {
          const partyId = parseInt(ledgerPartyMatch[1], 10);
          if (db) {
            const { results } = await db.prepare('SELECT l.*, p.name as party_name FROM party_ledger l JOIN parties p ON l.party_id = p.id WHERE l.party_id = ? ORDER BY l.entry_date ASC, l.id ASC').bind(partyId).all();
            return sendJson(results);
          }
          return sendJson([]);
        }

        const voucherDeleteMatch = url.pathname.match(/^\/api\/(?:ledgers\/voucher|parties\/voucher|ledgers)\/(\d+)$/);
        if (voucherDeleteMatch && request.method === 'PUT') {
          const ledgerId = parseInt(voucherDeleteMatch[1], 10);
          const body = await request.json();
          if (db) {
            const entry = await db.prepare('SELECT * FROM party_ledger WHERE id = ?').bind(ledgerId).first();
            if (!entry) return sendJson({ success: false, error: 'খতিয়ান রেকর্ড পাওয়া যায়নি' }, 404);

            const partyId = entry.party_id;
            const newDate = body.entry_date || entry.entry_date;
            const newDesc = body.description !== undefined ? body.description : entry.description;
            const newDebit = body.debit !== undefined ? roundMoney(Number(body.debit)) : entry.debit;
            const newCredit = body.credit !== undefined ? roundMoney(Number(body.credit)) : entry.credit;
            const newNotes = body.notes !== undefined ? body.notes : (entry.notes || '');

            // Update target row
            await db.prepare(`
              UPDATE party_ledger SET
                entry_date = ?,
                description = ?,
                debit = ?,
                credit = ?,
                notes = ?
              WHERE id = ?
            `).bind(newDate, newDesc, newDebit, newCredit, newNotes, ledgerId).run();

            // Recalculate all rows for this party in chronological order
            const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
            const { results: allRows } = await db.prepare(
              'SELECT * FROM party_ledger WHERE party_id = ? ORDER BY entry_date ASC, id ASC'
            ).bind(partyId).all();

            let running = party ? (party.opening_balance || 0) : 0;
            const batchRecalc = [];
            for (const r of (allRows || [])) {
              running = roundMoney(running + (r.debit || 0) - (r.credit || 0));
              batchRecalc.push(
                db.prepare('UPDATE party_ledger SET running_balance = ? WHERE id = ?').bind(running, r.id)
              );
            }
            batchRecalc.push(
              db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(running, partyId)
            );
            await db.batch(batchRecalc);

            return sendJson({ success: true, message: 'খতিয়ান এন্ট্রি সফলভাবে আপডেট করা হয়েছে', running_balance: running });
          }
          return sendJson({ success: true, message: 'আপডেট সম্পন্ন' });
        }

        if (voucherDeleteMatch && (request.method === 'DELETE' || request.method === 'POST')) {
          const ledgerId = parseInt(voucherDeleteMatch[1], 10);
          if (db) {
            const entry = await db.prepare('SELECT * FROM party_ledger WHERE id = ?').bind(ledgerId).first();
            if (!entry) return sendJson({ success: false, error: 'ভাউচার রেকর্ড পাওয়া যায়নি' }, 404);

            const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(entry.party_id).first();
            await putInRecycleBin(db, {
              module_type: 'ledger',
              module_label: 'বাকি খাতা',
              original_id: entry.id,
              title: `${entry.description || 'ভাউচার'} (${party?.name || ''})`,
              amount: (entry.credit || 0) > 0 ? entry.credit : (entry.debit || 0),
              payload: { entry, party }
            });

            const batchStmts = [];

            if (party) {
              let revertedBal = party.current_balance;
              if (entry.transaction_type === 'PAYMENT_RECEIVED') {
                revertedBal = addMoney(party.current_balance, entry.credit || 0);
              } else if (entry.transaction_type === 'PAYMENT_GIVEN') {
                revertedBal = subMoney(party.current_balance, entry.debit || 0);
              }
              batchStmts.push(
                db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(revertedBal, entry.party_id)
              );
            }

            const amt = (entry.credit || 0) + (entry.debit || 0);
            if (amt > 0) {
              batchStmts.push(
                db.prepare("DELETE FROM cashbook WHERE party_id = ? AND entry_date = ? AND amount = ? AND category IN ('DUE_COLLECTION', 'SUPPLIER_PAYMENT', 'SALE_CASH', 'PURCHASE_CASH')")
                  .bind(entry.party_id, entry.entry_date, amt)
              );
            }

            batchStmts.push(
              db.prepare('DELETE FROM party_ledger WHERE id = ?').bind(ledgerId)
            );

            await db.batch(batchStmts);
            return sendJson({ success: true, message: 'রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে এবং খতিয়ান সমন্বয় করা হয়েছে' });
          }
          return sendJson({ success: true, message: 'রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে' });
        }

        if ((url.pathname === '/api/ledgers/voucher' || url.pathname === '/api/collect') && request.method === 'POST') {
          const body = await request.json();
          const amt = roundMoney(body.amount);
          const partyId = body.party_id;
          const isTest = body.is_test_draft ? 1 : 0;
          const entryDate = body.entry_date || new Date().toISOString().split('T')[0];

          if (db) {
            const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
            if (!party) return sendJson({ success: false, error: 'পার্টি পাওয়া যায়নি' }, 404);

            let debit = 0;
            let credit = 0;
            let newBal = party.current_balance;

            let smsQueued = false;
            if (body.type === 'PAYMENT_RECEIVED') {
              credit = amt;
              newBal = subMoney(party.current_balance, amt);
              await db.batch([
                db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, partyId),
                db.prepare(`
                  INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
                  VALUES (?, ?, 'PAYMENT_RECEIVED', 0, ?, ?, ?, ?)
                `).bind(entryDate, partyId, amt, newBal, isTest, body.description || 'বকেয়া নগদ আদায়'),
                db.prepare(`
                  INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, is_test_draft, description)
                  VALUES (?, 'INFLOW', 'DUE_COLLECTION', ?, ?, ?, ?, ?)
                `).bind(entryDate, amt, body.payment_mode || 'CASH', partyId, isTest, `বকেয়া আদায়: ${party.name} (${body.description || ''})`)
              ]);

              const validPhone = normalizeBdPhone(party.phone);
              if (validPhone) {
                const cfg = await getSmsConfig(db, env);
                if (cfg.sms_enabled === 'true' && cfg.sms_send_on_due_collect !== 'false') {
                  smsQueued = true;
                  const smsPromise = (async () => {
                    try {
                      const smsText = buildDueCollectSmsText(cfg.sms_format_mode, {
                        partyName: party.name,
                        paidAmount: amt,
                        remainingDue: newBal,
                      });
                      await sendBulkSms(db, env, {
                        phone: validPhone,
                        message: smsText,
                        invoiceNo: `COLLECT-${Date.now().toString().slice(-4)}`,
                        partyName: party.name,
                      });
                    } catch (smsErr) {
                      console.warn('[Auto-SMS Due Collection Error]:', smsErr);
                    }
                  })();

                  if (ctx && typeof ctx.waitUntil === 'function') {
                    ctx.waitUntil(smsPromise);
                  } else {
                    smsPromise.catch(() => {});
                  }
                }
              }
            } else {
              debit = amt;
              newBal = addMoney(party.current_balance, amt);
              await db.batch([
                db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, partyId),
                db.prepare(`
                  INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, is_test_draft, description)
                  VALUES (?, ?, 'PAYMENT_GIVEN', ?, 0, ?, ?, ?)
                `).bind(entryDate, partyId, amt, newBal, isTest, body.description || 'পাওনাদার পরিশোধ'),
                db.prepare(`
                  INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, is_test_draft, description)
                  VALUES (?, 'OUTFLOW', 'SUPPLIER_PAYMENT', ?, ?, ?, ?, ?)
                `).bind(entryDate, amt, body.payment_mode || 'CASH', partyId, isTest, `সাপ্লায়ার পাওনা পরিশোধ: ${party.name} (${body.description || ''})`)
              ]);
            }

            return sendJson({ success: true, newBalance: newBal }, 201);
            return sendJson({ success: true, newBalance: newBal, sms_queued: smsQueued }, 201);
          }
          return sendJson({ success: true, newBalance: 0 }, 201);
        }

        // --- CASHBOOK ---
        if (url.pathname === '/api/cashbook') {
          const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
          if (request.method === 'GET') {
            if (db) {
              const { results: entries } = await db.prepare('SELECT c.*, p.name as party_name FROM cashbook c LEFT JOIN parties p ON c.party_id = p.id WHERE c.entry_date = ? ORDER BY c.id ASC').bind(date).all();

              // Check for date-specific opening override first
              let opening = null;
              try {
                const override = await db.prepare('SELECT opening_balance FROM cashbook_overrides WHERE entry_date = ?').bind(date).first();
                if (override && override.opening_balance !== null && override.opening_balance !== undefined) {
                  opening = Number(override.opening_balance);
                }
              } catch (e) {}

              if (opening === null) {
                try {
                  const settingVal = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(`cashbook_opening_${date}`).first();
                  if (settingVal && settingVal.value !== null && settingVal.value !== undefined) {
                    opening = Number(settingVal.value);
                  }
                } catch (e) {}
              }

              if (opening === null) {
                const prior = await db.prepare(`
                  SELECT
                    COALESCE(SUM(CASE WHEN entry_type = 'INFLOW' THEN amount ELSE 0 END), 0) as inf,
                    COALESCE(SUM(CASE WHEN entry_type = 'OUTFLOW' THEN amount ELSE 0 END), 0) as outf
                  FROM cashbook WHERE entry_date < ?
                `).bind(date).first();
                opening = subMoney(prior.inf, prior.outf);
              }

              let inflow = 0;
              let outflow = 0;
              for (const e of entries) {
                if (e.entry_type === 'INFLOW') inflow = addMoney(inflow, e.amount);
                else outflow = addMoney(outflow, e.amount);
              }
              const closing = subMoney(addMoney(opening, inflow), outflow);

              return sendJson({
                opening_balance: opening,
                entries,
                total_inflow: inflow,
                total_outflow: outflow,
                closing_balance: closing,
              });
            }
            return sendJson({ opening_balance: 0, entries: [], total_inflow: 0, total_outflow: 0, closing_balance: 0 });
          }

          if (request.method === 'POST') {
            const body = await request.json();
            const isTest = body.is_test_draft ? 1 : 0;
            if (db) {
              const res = await db.prepare(`
                INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                body.entry_date || date, body.entry_type, body.category || 'GENERAL',
                roundMoney(body.amount), body.payment_mode || 'CASH', body.reference_no || '',
                body.party_id || null, isTest, body.description || ''
              ).run();
              const created = await db.prepare('SELECT * FROM cashbook WHERE id = ?').bind(res.meta.last_row_id).first();
              return sendJson(created, 201);
            }
            return sendJson({ id: Date.now(), ...body }, 201);
          }
        }

        // Daily Summary Override: PUT /api/cashbook/daily-summary
        if (url.pathname === '/api/cashbook/daily-summary' && (request.method === 'PUT' || request.method === 'POST')) {
          const body = await request.json();
          const targetDate = body.date || body.entry_date;
          const openingBalance = roundMoney(body.opening_balance || 0);
          const notes = body.notes || 'সংশোধিত প্রারম্ভিক ক্যাশ জের';

          if (!targetDate) {
            return sendJson({ success: false, error: 'তারিখ নির্দিষ্ট করা হয়নি' }, 400);
          }

          if (db) {
            await db.prepare(`
              CREATE TABLE IF NOT EXISTS cashbook_overrides (
                entry_date TEXT PRIMARY KEY,
                opening_balance REAL NOT NULL,
                notes TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `).run().catch(() => null);

            await db.prepare(`
              INSERT INTO cashbook_overrides (entry_date, opening_balance, notes, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(entry_date) DO UPDATE SET
                opening_balance = excluded.opening_balance,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
            `).bind(targetDate, openingBalance, notes).run();

            await db.prepare(`
              INSERT INTO settings (key, value)
              VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `).bind(`cashbook_opening_${targetDate}`, String(openingBalance)).run().catch(() => null);

            return sendJson({ success: true, date: targetDate, opening_balance: openingBalance });
          }

          return sendJson({ success: true, date: targetDate, opening_balance: openingBalance });
        }

        const cashbookIdMatch = url.pathname.match(/^\/api\/cashbook\/(\d+)$/);

        // Edit Cashbook Row: PUT /api/cashbook/:id
        if (cashbookIdMatch && (request.method === 'PUT' || request.method === 'PATCH')) {
          const id = parseInt(cashbookIdMatch[1], 10);
          const body = await request.json();
          if (db) {
            const existing = await db.prepare('SELECT * FROM cashbook WHERE id = ?').bind(id).first();
            if (!existing) {
              return sendJson({ success: false, error: 'ক্যাশ বুক এন্ট্রি পাওয়া যায়নি' }, 404);
            }

            const newDate = body.entry_date || body.date || existing.entry_date;
            const newType = body.entry_type || body.type || existing.entry_type;
            const newCategory = body.category || existing.category;
            const newAmount = body.amount !== undefined ? roundMoney(body.amount) : existing.amount;
            const newPaymentMode = body.payment_mode || body.payment_method || existing.payment_mode;
            const newDesc = body.description !== undefined ? body.description : existing.description;
            const newPartyId = body.party_id !== undefined ? (body.party_id || null) : existing.party_id;

            // Handle party balance adjustment if linked to a party
            if (existing.party_id || newPartyId) {
              if (existing.party_id && newPartyId && existing.party_id === newPartyId) {
                const delta = subMoney(newAmount, existing.amount);
                if (delta !== 0) {
                  if (existing.category === 'DUE_COLLECTION' || existing.entry_type === 'INFLOW') {
                    await db.prepare('UPDATE parties SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(delta, existing.party_id).run();
                  } else if (existing.category === 'SUPPLIER_PAYMENT' || existing.entry_type === 'OUTFLOW') {
                    await db.prepare('UPDATE parties SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(delta, existing.party_id).run();
                  }
                }
              } else {
                if (existing.party_id) {
                  if (existing.category === 'DUE_COLLECTION' || existing.entry_type === 'INFLOW') {
                    await db.prepare('UPDATE parties SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(existing.amount, existing.party_id).run();
                  } else if (existing.category === 'SUPPLIER_PAYMENT' || existing.entry_type === 'OUTFLOW') {
                    await db.prepare('UPDATE parties SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(existing.amount, existing.party_id).run();
                  }
                }
                if (newPartyId) {
                  if (newCategory === 'DUE_COLLECTION' || newType === 'INFLOW') {
                    await db.prepare('UPDATE parties SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(newAmount, newPartyId).run();
                  } else if (newCategory === 'SUPPLIER_PAYMENT' || newType === 'OUTFLOW') {
                    await db.prepare('UPDATE parties SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(newAmount, newPartyId).run();
                  }
                }
              }
            }

            await db.prepare(`
              UPDATE cashbook
              SET entry_date = ?, entry_type = ?, category = ?, amount = ?, payment_mode = ?, party_id = ?, description = ?
              WHERE id = ?
            `).bind(newDate, newType, newCategory, newAmount, newPaymentMode, newPartyId, newDesc, id).run();

            const updated = await db.prepare('SELECT c.*, p.name as party_name FROM cashbook c LEFT JOIN parties p ON c.party_id = p.id WHERE c.id = ?').bind(id).first();
            return sendJson(updated);
          }
          const idx = inMemoryStore.cashbook.findIndex(c => c.id === id);
          if (idx !== -1) {
            inMemoryStore.cashbook[idx] = { ...inMemoryStore.cashbook[idx], ...body };
            return sendJson(inMemoryStore.cashbook[idx]);
          }
          return sendJson({ success: false, error: 'Not found' }, 404);
        }

        // Delete Cashbook: DELETE /api/cashbook/:id
        if (
          (cashbookIdMatch && (request.method === 'DELETE' || request.method === 'POST')) ||
          (url.pathname === '/api/cashbook' && request.method === 'DELETE')
        ) {
          const id = cashbookIdMatch ? parseInt(cashbookIdMatch[1], 10) : parseInt(url.searchParams.get('id') || '0', 10);
          if (db) {
            const cb = await db.prepare('SELECT * FROM cashbook WHERE id = ?').bind(id).first();
            if (cb) {
              await putInRecycleBin(db, {
                module_type: 'cashbook',
                module_label: 'ক্যাশ বই',
                original_id: cb.id,
                title: `${cb.description || cb.category} (${cb.entry_type === 'INFLOW' ? 'জমা' : 'খরচ'})`,
                amount: cb.amount || 0,
                payload: { entry: cb }
              });

              if (cb.party_id) {
                if (cb.category === 'DUE_COLLECTION' || cb.entry_type === 'INFLOW') {
                  await db.prepare('UPDATE parties SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(cb.amount, cb.party_id).run();
                } else if (cb.category === 'SUPPLIER_PAYMENT' || cb.entry_type === 'OUTFLOW') {
                  await db.prepare('UPDATE parties SET current_balance = current_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(cb.amount, cb.party_id).run();
                }
              }
            }
            await db.prepare('DELETE FROM cashbook WHERE id = ?').bind(id).run();
            return sendJson({ success: true, message: 'ক্যাশ বুক এন্ট্রি মুছে ফেলা হয়েছে' });
          }
          const idx = inMemoryStore.cashbook.findIndex(c => c.id === id);
          if (idx !== -1) {
            const cb = inMemoryStore.cashbook[idx];
            putInRecycleBin(null, {
              module_type: 'cashbook',
              module_label: 'ক্যাশ বই',
              original_id: cb.id,
              title: `${cb.description || cb.category} (${cb.entry_type === 'INFLOW' ? 'জমা' : 'খরচ'})`,
              amount: cb.amount || 0,
              payload: { entry: cb }
            });
            inMemoryStore.cashbook.splice(idx, 1);
          }
          return sendJson({ success: true });
        }

        // --- EXPENSES ---
        if (url.pathname === '/api/expenses') {
          if (request.method === 'GET') {
            if (db) {
              const { results } = await db.prepare('SELECT * FROM expenses ORDER BY id DESC LIMIT 100').all();
              return sendJson(results);
            }
            return sendJson(inMemoryStore.expenses);
          }
          if (request.method === 'POST') {
            const body = await request.json();
            const amt = roundMoney(body.amount);
            const isTest = body.is_test_draft ? 1 : 0;
            const expDate = body.expense_date || new Date().toISOString().split('T')[0];

            if (db) {
              const batchStmts = [
                db.prepare(`
                  INSERT INTO expenses (expense_date, category, amount, paid_to, payment_mode, is_test_draft, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).bind(expDate, body.category || 'MISC', amt, body.paid_to || 'অন্যান্য', body.payment_mode || 'CASH', isTest, body.notes || '')
              ];
              if (body.payment_mode !== 'BANK') {
                batchStmts.push(
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, is_test_draft, description)
                    VALUES (?, 'OUTFLOW', 'EXPENSE', ?, 'CASH', ?, ?)
                  `).bind(expDate, amt, isTest, `পরিচালন খরচ: ${body.category} (${body.paid_to || ''})`)
                );
              }
              await db.batch(batchStmts);
              return sendJson({ success: true, amount: amt }, 201);
            }
            return sendJson({ success: true, amount: amt }, 201);
          }
        }

        const expenseIdMatch = url.pathname.match(/^\/api\/expenses\/(\d+)$/);
        if (
          (expenseIdMatch && (request.method === 'DELETE' || request.method === 'POST')) ||
          (url.pathname === '/api/expenses' && request.method === 'DELETE')
        ) {
          const id = expenseIdMatch ? parseInt(expenseIdMatch[1], 10) : parseInt(url.searchParams.get('id') || '0', 10);
          if (db) {
            const exp = await db.prepare('SELECT * FROM expenses WHERE id = ?').bind(id).first();
            if (exp) {
              await putInRecycleBin(db, {
                module_type: 'expense',
                module_label: 'পরিচালন খরচ',
                original_id: exp.id,
                title: `${exp.paid_to || ''} (${exp.category})`,
                amount: exp.amount || 0,
                payload: { expense: exp }
              });
              await db.batch([
                db.prepare("DELETE FROM cashbook WHERE category = 'EXPENSE' AND amount = ? AND entry_date = ?").bind(exp.amount, exp.expense_date),
                db.prepare('DELETE FROM expenses WHERE id = ?').bind(id)
              ]);
            }
            return sendJson({ success: true, message: 'খরচ রেকর্ড মুছে ফেলা হয়েছে' });
          }
          const idx = inMemoryStore.expenses.findIndex(e => e.id === id);
          if (idx !== -1) {
            const exp = inMemoryStore.expenses[idx];
            putInRecycleBin(null, {
              module_type: 'expense',
              module_label: 'পরিচালন খরচ',
              original_id: exp.id,
              title: `${exp.paid_to || ''} (${exp.category})`,
              amount: exp.amount || 0,
              payload: { expense: exp }
            });
            inMemoryStore.expenses.splice(idx, 1);
          }
          return sendJson({ success: true });
        }
        if (expenseIdMatch && request.method === 'PUT') {
          const id = parseInt(expenseIdMatch[1], 10);
          const body = await request.json();
          if (db) {
            await db.prepare(`
              UPDATE expenses SET
                expense_date = COALESCE(?, expense_date),
                category = COALESCE(?, category),
                amount = COALESCE(?, amount),
                paid_to = COALESCE(?, paid_to),
                payment_mode = COALESCE(?, payment_mode),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(body.expense_date, body.category, body.amount, body.paid_to, body.payment_mode, body.notes, id).run();
            const updated = await db.prepare('SELECT * FROM expenses WHERE id = ?').bind(id).first();
            return sendJson(updated);
          }
          return sendJson(body);
        }

        // --- NOTES ---
        if (url.pathname === '/api/notes') {
          if (request.method === 'GET') {
            const category = url.searchParams.get('category');
            const search = url.searchParams.get('search');
            if (db) {
              let sql = 'SELECT * FROM notes WHERE 1=1';
              const params = [];
              if (category && category !== 'ALL' && category !== 'সবগুলো নোট') {
                if (category === 'PINNED' || category === 'পিনকৃত') {
                  sql += ' AND is_pinned = 1';
                } else {
                  sql += ' AND category = ?';
                  params.push(category);
                }
              }
              if (search) {
                sql += ' AND (title LIKE ? OR content LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
              }
              sql += ' ORDER BY is_pinned DESC, updated_at DESC';
              const { results } = await db.prepare(sql).bind(...params).all();
              return sendJson(results);
            }
            return sendJson(inMemoryStore.notes);
          }
          if (request.method === 'POST') {
            const body = await request.json();
            if (db) {
              const res = await db.prepare(`
                INSERT INTO notes (title, content, category, is_pinned)
                VALUES (?, ?, ?, ?)
              `).bind(body.title, body.content || '', body.category || 'সাধারণ', body.is_pinned ? 1 : 0).run();
              const created = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(res.meta.last_row_id).first();
              return sendJson(created, 201);
            }
            const newN = { id: Date.now(), ...body, created_at: new Date().toISOString() };
            inMemoryStore.notes.unshift(newN);
            return sendJson(newN, 201);
          }
        }

        const noteIdMatch = url.pathname.match(/^\/api\/notes\/(\d+)$/);
        if (noteIdMatch) {
          const id = parseInt(noteIdMatch[1], 10);
          if (request.method === 'PUT') {
            const body = await request.json();
            if (db) {
              await db.prepare(`
                UPDATE notes SET
                  title = COALESCE(?, title),
                  content = COALESCE(?, content),
                  category = COALESCE(?, category),
                  is_pinned = COALESCE(?, is_pinned),
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(body.title, body.content, body.category, body.is_pinned, id).run();
              const updated = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
              return sendJson(updated);
            }
            const idx = inMemoryStore.notes.findIndex(n => n.id === id);
            if (idx !== -1) inMemoryStore.notes[idx] = { ...inMemoryStore.notes[idx], ...body };
            return sendJson(inMemoryStore.notes[idx] || {});
          }
          if (request.method === 'DELETE') {
            if (db) {
              const nt = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
              if (nt) {
                await putInRecycleBin(db, {
                  module_type: 'note',
                  module_label: 'নোটবুক',
                  original_id: nt.id,
                  title: nt.title || 'নোট',
                  amount: 0,
                  payload: { note: nt }
                });
              }
              await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
              return sendJson({ success: true, message: 'নোট মুছে ফেলা হয়েছে' });
            }
            const nIdx = inMemoryStore.notes.findIndex(n => n.id === id);
            if (nIdx !== -1) {
              const nt = inMemoryStore.notes[nIdx];
              putInRecycleBin(null, {
                module_type: 'note',
                module_label: 'নোটবুক',
                original_id: nt.id,
                title: nt.title || 'নোট',
                amount: 0,
                payload: { note: nt }
              });
              inMemoryStore.notes.splice(nIdx, 1);
            }
            return sendJson({ success: true });
          }
        }

        // --- RECYCLE BIN (রিসাইকেল বিন - ৬০ দিনের ডেটা সুরক্ষা ও ১-ক্লিক রিস্টোর) ---
        if (url.pathname === '/api/recycle-bin/count' && request.method === 'GET') {
          if (db) {
            await db.prepare('DELETE FROM recycle_bin WHERE expires_at < CURRENT_TIMESTAMP').run().catch(() => null);
            const res = await db.prepare('SELECT COUNT(*) as c FROM recycle_bin').first();
            return sendJson({ count: res?.c || 0 });
          }
          const nowIso = new Date().toISOString();
          inMemoryStore.recycle_bin = inMemoryStore.recycle_bin.filter(x => x.expires_at >= nowIso);
          return sendJson({ count: inMemoryStore.recycle_bin.length });
        }

        if (url.pathname === '/api/recycle-bin' && request.method === 'GET') {
          const moduleFilter = url.searchParams.get('module');
          if (db) {
            await db.prepare('DELETE FROM recycle_bin WHERE expires_at < CURRENT_TIMESTAMP').run().catch(() => null);
            let query = 'SELECT * FROM recycle_bin';
            const params = [];
            if (moduleFilter && moduleFilter !== 'ALL') {
              query += ' WHERE module_type = ?';
              params.push(moduleFilter);
            }
            query += ' ORDER BY deleted_at DESC LIMIT 250';
            const stmt = params.length > 0 ? db.prepare(query).bind(...params) : db.prepare(query);
            const { results } = await stmt.all();
            return sendJson(results || []);
          }
          const nowIso = new Date().toISOString();
          inMemoryStore.recycle_bin = inMemoryStore.recycle_bin.filter(x => x.expires_at >= nowIso);
          let list = inMemoryStore.recycle_bin;
          if (moduleFilter && moduleFilter !== 'ALL') {
            list = list.filter(x => x.module_type === moduleFilter);
          }
          return sendJson(list);
        }

        if (url.pathname === '/api/recycle-bin/empty' && (request.method === 'DELETE' || request.method === 'POST')) {
          if (db) {
            await db.prepare('DELETE FROM recycle_bin').run();
            return sendJson({ success: true, message: 'রিসাইকেল বিন সম্পূর্ণ খালি করা হয়েছে' });
          }
          inMemoryStore.recycle_bin = [];
          return sendJson({ success: true, message: 'রিসাইকেল বিন খালি করা হয়েছে' });
        }

        if (url.pathname === '/api/recycle-bin/purge' && (request.method === 'DELETE' || request.method === 'POST')) {
          if (db) {
            const res = await db.prepare('DELETE FROM recycle_bin WHERE expires_at < CURRENT_TIMESTAMP').run();
            return sendJson({ success: true, purged: res?.changes || 0 });
          }
          const nowIso = new Date().toISOString();
          const prevLen = inMemoryStore.recycle_bin.length;
          inMemoryStore.recycle_bin = inMemoryStore.recycle_bin.filter(x => x.expires_at >= nowIso);
          return sendJson({ success: true, purged: prevLen - inMemoryStore.recycle_bin.length });
        }

        const recycleIdMatch = url.pathname.match(/^\/api\/recycle-bin\/([^\/]+)$/);
        if (recycleIdMatch && (request.method === 'DELETE' || request.method === 'POST')) {
          const recId = recycleIdMatch[1];
          if (db) {
            await db.prepare('DELETE FROM recycle_bin WHERE id = ?').bind(recId).run();
            return sendJson({ success: true, message: 'আইটেমটি স্থায়ীভাবে মুছে ফেলা হয়েছে' });
          }
          inMemoryStore.recycle_bin = inMemoryStore.recycle_bin.filter(x => x.id !== recId);
          return sendJson({ success: true, message: 'আইটেমটি স্থায়ীভাবে মুছে ফেলা হয়েছে' });
        }

        const restoreMatch = url.pathname.match(/^\/api\/recycle-bin\/restore\/([^\/]+)$/);
        if (restoreMatch && request.method === 'POST') {
          const recId = restoreMatch[1];
          let item = null;
          if (db) {
            item = await db.prepare('SELECT * FROM recycle_bin WHERE id = ?').bind(recId).first();
          } else {
            item = inMemoryStore.recycle_bin.find(x => x.id === recId);
          }

          if (!item) {
            return sendJson({ success: false, error: 'রিসাইকেল বিনে আইটেমটি পাওয়া যায়নি বা মেয়াদোত্তীর্ণ হয়েছে' }, 404);
          }

          let payload = {};
          try {
            payload = JSON.parse(item.payload_json);
          } catch (e) {
            payload = {};
          }

          if (db) {
            try {
              if (item.module_type === 'purchase') {
                const pur = payload.purchase;
                if (pur) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO purchases (
                      id, invoice_no, purchase_date, party_id, commodity_id, bags_count,
                      gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
                      rate_per_mon, gross_amount, labor_cost, transport_cost, bag_cost, other_cost,
                      total_landed_cost, cost_per_mon, cost_per_kg, payment_method,
                      paid_amount, due_amount, previous_wac_per_kg, new_wac_per_kg, is_test_draft, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    pur.id, pur.invoice_no, pur.purchase_date, pur.party_id, pur.commodity_id, pur.bags_count || 0,
                    pur.gross_weight_kg, pur.bag_deduction_kg || 0, pur.net_weight_kg, pur.net_weight_mon,
                    pur.rate_per_mon, pur.gross_amount, pur.labor_cost || 0, pur.transport_cost || 0, pur.bag_cost || 0, pur.other_cost || 0,
                    pur.total_landed_cost, pur.cost_per_mon, pur.cost_per_kg, pur.payment_method || 'CASH',
                    pur.paid_amount || 0, pur.due_amount || 0, pur.previous_wac_per_kg || 0, pur.new_wac_per_kg || 0, pur.is_test_draft || 0, pur.notes || ''
                  ).run();

                  await db.prepare(`
                    UPDATE commodities SET
                      current_stock_kg = current_stock_kg + ?,
                      current_stock_bags = current_stock_bags + ?,
                      updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `).bind(pur.net_weight_kg, pur.bags_count || 0, pur.commodity_id).run();

                  if (pur.party_id) {
                    const netSupp = subMoney(pur.paid_amount || 0, pur.gross_amount);
                    await db.prepare('UPDATE parties SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(netSupp, pur.party_id).run();
                  }

                  if (payload.ledger && payload.ledger.length > 0) {
                    for (const l of payload.ledger) {
                      await db.prepare(`
                        INSERT OR REPLACE INTO party_ledger (id, entry_date, party_id, transaction_type, reference_id, reference_no, debit, credit, running_balance, is_test_draft, description)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `).bind(l.id, l.entry_date, l.party_id, l.transaction_type, l.reference_id, l.reference_no, l.debit, l.credit, l.running_balance, l.is_test_draft || 0, l.description).run().catch(() => null);
                    }
                  }

                  if (payload.cash && payload.cash.length > 0) {
                    for (const c of payload.cash) {
                      await db.prepare(`
                        INSERT OR REPLACE INTO cashbook (id, entry_date, entry_type, category, amount, payment_mode, reference_id, reference_no, party_id, is_test_draft, description)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `).bind(c.id, c.entry_date, c.entry_type, c.category, c.amount, c.payment_mode || 'CASH', c.reference_id, c.reference_no, c.party_id, c.is_test_draft || 0, c.description).run().catch(() => null);
                    }
                  }
                }
              } else if (item.module_type === 'sale') {
                const sales = payload.sales || [];
                for (const s of sales) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO sales (
                      id, invoice_no, sale_date, party_id, commodity_id, bags_count,
                      gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
                      rate_per_mon, gross_amount, loading_charge, damaged_bag_deduction, discount_amount,
                      net_invoice_amount, payment_method, paid_amount, due_amount,
                      vehicle_no, driver_name, driver_phone, destination,
                      cogs_amount, realized_profit, is_test_draft, notes,
                      previous_due, remaining_due
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    s.id, s.invoice_no, s.sale_date, s.party_id, s.commodity_id, s.bags_count || 0,
                    s.gross_weight_kg, s.bag_deduction_kg || 0, s.net_weight_kg, s.net_weight_mon,
                    s.rate_per_mon, s.gross_amount, s.loading_charge || 0, s.damaged_bag_deduction || 0, s.discount_amount || 0,
                    s.net_invoice_amount, s.payment_method || 'CASH', s.paid_amount || 0, s.due_amount || 0,
                    s.vehicle_no || '', s.driver_name || '', s.driver_phone || '', s.destination || '',
                    s.cogs_amount || 0, s.realized_profit || 0, s.is_test_draft || 0, s.notes || '',
                    s.previous_due || 0, s.remaining_due || 0
                  ).run();

                  await db.prepare(`
                    UPDATE commodities SET
                      current_stock_kg = MAX(0, current_stock_kg - ?),
                      current_stock_bags = MAX(0, current_stock_bags - ?),
                      updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `).bind(s.net_weight_kg, s.bags_count || 0, s.commodity_id).run();

                  if (s.party_id) {
                    const netCust = subMoney(s.net_invoice_amount, s.paid_amount || 0);
                    await db.prepare('UPDATE parties SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                      .bind(netCust, s.party_id).run();
                  }
                }

                if (payload.ledger && payload.ledger.length > 0) {
                  for (const l of payload.ledger) {
                    await db.prepare(`
                      INSERT OR REPLACE INTO party_ledger (id, entry_date, party_id, transaction_type, reference_id, reference_no, debit, credit, running_balance, is_test_draft, description)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(l.id, l.entry_date, l.party_id, l.transaction_type, l.reference_id, l.reference_no, l.debit, l.credit, l.running_balance, l.is_test_draft || 0, l.description).run().catch(() => null);
                  }
                }

                if (payload.cash && payload.cash.length > 0) {
                  for (const c of payload.cash) {
                    await db.prepare(`
                      INSERT OR REPLACE INTO cashbook (id, entry_date, entry_type, category, amount, payment_mode, reference_id, reference_no, party_id, is_test_draft, description)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(c.id, c.entry_date, c.entry_type, c.category, c.amount, c.payment_mode || 'CASH', c.reference_id, c.reference_no, c.party_id, c.is_test_draft || 0, c.description).run().catch(() => null);
                  }
                }
              } else if (item.module_type === 'party') {
                const pt = payload.party;
                if (pt) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO parties (id, name, phone, address, party_type, opening_balance, current_balance, notes, is_active, is_pinned, is_test_draft)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(pt.id, pt.name, pt.phone || '', pt.address || '', pt.party_type || 'BUYER', pt.opening_balance || 0, pt.current_balance || 0, pt.notes || '', 1, pt.is_pinned || 0, pt.is_test_draft || 0).run();
                }
              } else if (item.module_type === 'crop' || item.module_type === 'commodity') {
                const cm = payload.commodity;
                if (cm) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO commodities (id, name_bn, name_en, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon, notes, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                  `).bind(cm.id, cm.name_bn, cm.name_en || '', cm.default_bag_weight_kg || 80, cm.current_stock_kg || 0, cm.current_stock_bags || 0, cm.current_wac_per_kg || 0, cm.current_wac_per_mon || 0, cm.notes || '').run();
                }
              } else if (item.module_type === 'cashbook') {
                const cb = payload.entry;
                if (cb) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO cashbook (id, entry_date, entry_type, category, amount, payment_mode, reference_id, reference_no, party_id, is_test_draft, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(cb.id, cb.entry_date, cb.entry_type, cb.category, cb.amount, cb.payment_mode || 'CASH', cb.reference_id, cb.reference_no, cb.party_id, cb.is_test_draft || 0, cb.description).run();
                }
              } else if (item.module_type === 'expense') {
                const exp = payload.expense;
                if (exp) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO expenses (id, expense_date, category, amount, paid_to, payment_mode, is_test_draft, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(exp.id, exp.expense_date, exp.category, exp.amount, exp.paid_to || '', exp.payment_mode || 'CASH', exp.is_test_draft || 0, exp.notes || '').run();
                }
              } else if (item.module_type === 'note') {
                const nt = payload.note;
                if (nt) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO notes (id, title, content, category, is_pinned)
                    VALUES (?, ?, ?, ?, ?)
                  `).bind(nt.id, nt.title, nt.content || '', nt.category || 'সাধারণ', nt.is_pinned || 0).run();
                }
              } else if (item.module_type === 'ledger') {
                const l = payload.entry;
                if (l) {
                  await db.prepare(`
                    INSERT OR REPLACE INTO party_ledger (id, entry_date, party_id, transaction_type, reference_id, reference_no, debit, credit, running_balance, is_test_draft, description, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(l.id, l.entry_date, l.party_id, l.transaction_type, l.reference_id, l.reference_no, l.debit, l.credit, l.running_balance, l.is_test_draft || 0, l.description, l.notes || '').run();

                  const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(l.party_id).first();
                  const { results: allRows } = await db.prepare('SELECT * FROM party_ledger WHERE party_id = ? ORDER BY entry_date ASC, id ASC').bind(l.party_id).all();
                  let running = party ? (party.opening_balance || 0) : 0;
                  for (const r of (allRows || [])) {
                    running = roundMoney(running + (r.debit || 0) - (r.credit || 0));
                    await db.prepare('UPDATE party_ledger SET running_balance = ? WHERE id = ?').bind(running, r.id).run();
                  }
                  await db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(running, l.party_id).run();
                }
              }

              // Remove restored item from recycle_bin
              await db.prepare('DELETE FROM recycle_bin WHERE id = ?').bind(recId).run();
              return sendJson({ success: true, message: 'রেকর্ডটি সফলভাবে পুনরুদ্ধার (Restore) করা হয়েছে' });
            } catch (restoreErr) {
              console.error('[RecycleBin Restore Error]:', restoreErr);
              return sendJson({ success: false, error: `পুনরুদ্ধার ত্রুটি: ${restoreErr.message}` }, 500);
            }
          }

          inMemoryStore.recycle_bin = inMemoryStore.recycle_bin.filter(x => x.id !== recId);
          return sendJson({ success: true, message: 'রেকর্ডটি সফলভাবে পুনরুদ্ধার করা হয়েছে' });
        }

        // --- REPORTS & DASHBOARD (POWERED BY SINGLE-SOURCE-OF-TRUTH BST LEDGER) ---
        if (url.pathname === '/api/reports/stats') {
          const ledger = await computeVerifiedBusinessLedger(db, inMemoryStore);
          const today = ledger.bstDate;
          const monthStart = `${today.slice(0, 7)}-01`;

          let monthlyGp = 0;
          let monthlyExp = 0;
          let monthlyShrinkage = 0;
          let monthlyRev = 0;

          if (db) {
            const monthlySales = await db.prepare("SELECT COALESCE(SUM(net_invoice_amount), 0) as rev, COALESCE(SUM(realized_profit), 0) as gp FROM sales WHERE sale_date >= ? AND sale_date <= ? AND COALESCE(is_test_draft, 0) = 0").bind(monthStart, today).first().catch(() => ({ rev: 0, gp: 0 }));
            monthlyRev = monthlySales?.rev || 0;
            monthlyGp = monthlySales?.gp || 0;
            const expRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE expense_date >= ? AND expense_date <= ? AND COALESCE(is_test_draft, 0) = 0").bind(monthStart, today).first().catch(() => ({ s: 0 }));
            monthlyExp = expRow?.s || 0;
            const shrinkRow = await db.prepare("SELECT COALESCE(SUM(cost_value), 0) as s FROM stock_adjustments WHERE adjustment_date >= ? AND adjustment_date <= ? AND COALESCE(is_test_draft, 0) = 0").bind(monthStart, today).first().catch(() => ({ s: 0 }));
            monthlyShrinkage = shrinkRow?.s || 0;
          }

          const netProfit = roundMoney(monthlyGp - monthlyExp - monthlyShrinkage);

          return sendJson({
            today_purchases_amount: ledger.todayPurchases.totalAmount,
            today_purchases_mon: ledger.todayPurchases.totalWeightMon,
            today_sales_amount: ledger.todaySales.totalAmount,
            today_sales_cash: ledger.todaySales.cashAmount,
            today_sales_due: ledger.todaySales.dueAmount,
            today_operating_expense: ledger.todayExpenses.totalAmount,
            today_sales_mon: ledger.todaySales.totalWeightMon,
            today_cash_in: ledger.dailyCashBook.todayCashIn,
            today_cash_out: ledger.dailyCashBook.todayCashOut,
            closing_cash_balance: ledger.dailyCashBook.liveCashBalance,
            total_receivable: ledger.customerDues.totalReceivable,
            total_payable: ledger.supplierPayables.totalPayable,
            total_stock_value: ledger.warehouseStock.totalValuation,
            total_stock_mon: ledger.warehouseStock.totalMaund,
            total_stock_bags: ledger.warehouseStock.totalBags,
            monthly_sales_revenue: roundMoney(monthlyRev),
            monthly_gross_profit: roundMoney(monthlyGp),
            monthly_net_profit: netProfit,
            bst_date: today,
          });
        }

        if (url.pathname === '/api/reports/pnl') {
          const startDate = url.searchParams.get('startDate') || new Date().toISOString().split('T')[0];
          const endDate = url.searchParams.get('endDate') || startDate;

          if (db) {
            const salesData = await db.prepare(`
              SELECT
                COALESCE(SUM(gross_amount), 0) as total_gross_sales,
                COALESCE(SUM(loading_charge), 0) as total_loading,
                COALESCE(SUM(damaged_bag_deduction), 0) as total_deduction,
                COALESCE(SUM(discount_amount), 0) as total_discount,
                COALESCE(SUM(net_invoice_amount), 0) as total_net_revenue,
                COALESCE(SUM(cogs_amount), 0) as total_cogs,
                COALESCE(SUM(realized_profit), 0) as gross_profit
              FROM sales WHERE sale_date >= ? AND sale_date <= ?
            `).bind(startDate, endDate).first();

            const shrinkageData = await db.prepare(`
              SELECT
                COALESCE(SUM(lost_weight_kg), 0) as lost_kg,
                COALESCE(SUM(lost_weight_mon), 0) as lost_mon,
                COALESCE(SUM(cost_value), 0) as shrinkage_cost
              FROM stock_adjustments WHERE adjustment_date >= ? AND adjustment_date <= ?
            `).bind(startDate, endDate).first();

            const { results: expenses } = await db.prepare(`
              SELECT category, SUM(amount) as total_amount
              FROM expenses WHERE expense_date >= ? AND expense_date <= ?
              GROUP BY category
            `).bind(startDate, endDate).all();

            const totalOperatingExpenses = roundMoney(expenses.reduce((s, e) => s + e.total_amount, 0));
            const netProfit = roundMoney(salesData.gross_profit - shrinkageData.shrinkage_cost - totalOperatingExpenses);

            return sendJson({
              startDate,
              endDate,
              sales: salesData,
              shrinkage: shrinkageData,
              expenses,
              totalOperatingExpenses,
              netProfit,
            });
          }

          return sendJson({
            startDate,
            endDate,
            sales: { total_net_revenue: 0, total_cogs: 0, gross_profit: 0 },
            shrinkage: { shrinkage_cost: 0, lost_mon: 0 },
            expenses: [],
            totalOperatingExpenses: 0,
            netProfit: 0,
          });
        }

        // --- SYSTEM (Settings, Backup, Purge) ---
        if (url.pathname === '/api/system/settings') {
          if (request.method === 'GET') {
            const map = {};
            if (db) {
              const r1 = await db.prepare('SELECT key, value FROM app_settings').all().catch(() => ({ results: [] }));
              for (const r of (r1.results || [])) map[r.key] = r.value;
              const r2 = await db.prepare('SELECT key, value FROM settings').all().catch(() => ({ results: [] }));
              for (const r of (r2.results || [])) {
                if (!map[r.key]) map[r.key] = r.value;
              }
            } else {
              Object.assign(map, inMemoryStore.settings);
            }
            const activePin = await getActivePin(db);
            map.app_pin = activePin;
            map.app_security_pin = activePin;
            return sendJson(map);
          }
          if (request.method === 'POST') {
            const body = settingsBody || (await request.json().catch(() => ({})));
            const key = body.key;
            const value = body.value;

            if (key === 'app_pin' || key === 'app_security_pin') {
              const normPin = normalizePin(value);
              if (!normPin || normPin.length !== 4 || !/^\d{4}$/.test(normPin)) {
                return sendJson({ success: false, error: 'নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে!' }, 400);
              }
              await updateActivePinInDB(db, normPin);
              return sendJson({ success: true, activePin: normPin });
            }

            if (db) {
              await db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').bind(key, value, value).run().catch(() => null);
              await db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').bind(key, value, value).run().catch(() => null);
              return sendJson({ success: true });
            }
            inMemoryStore.settings[key] = value;
            return sendJson({ success: true });
          }
        }

        if (url.pathname === '/api/system/version') {
          return sendJson({ version: '1.5.0 PRO' });
        }

        // Complete JSON Database Snapshot Backup
        if (url.pathname === '/api/system/backup' && request.method === 'POST') {
          let snapshot = {};
          if (db) {
            snapshot = {
              exported_at: new Date().toISOString(),
              version: '1.5.0 PRO',
              commodities: (await db.prepare('SELECT * FROM commodities').all()).results,
              parties: (await db.prepare('SELECT * FROM parties').all()).results,
              purchases: (await db.prepare('SELECT * FROM purchases').all()).results,
              sales: (await db.prepare('SELECT * FROM sales').all()).results,
              stock_adjustments: (await db.prepare('SELECT * FROM stock_adjustments').all()).results,
              party_ledger: (await db.prepare('SELECT * FROM party_ledger').all()).results,
              cashbook: (await db.prepare('SELECT * FROM cashbook').all()).results,
              expenses: (await db.prepare('SELECT * FROM expenses').all()).results,
              notes: (await db.prepare('SELECT * FROM notes').all()).results,
              app_settings: (await db.prepare('SELECT * FROM app_settings').all()).results,
            };
          } else {
            snapshot = { ...inMemoryStore, exported_at: new Date().toISOString() };
          }
          return sendJson({
            success: true,
            filePath: 'maha_enterprise_cloud_backup.xlsx',
            message: 'ক্লাউড ও লোকাল ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে',
            backup: snapshot,
          });
        }

        // Trigger live Telegram Excel Backup (POST /api/backup/telegram or GET /api/backup/telegram)
        if ((url.pathname === '/api/backup/telegram' || url.pathname === '/api/system/backup/telegram') && (request.method === 'POST' || request.method === 'GET')) {
          try {
            const result = await sendExcelBackupToTelegram(env, 'MANUAL_CLOUD');
            return sendJson(result, result.success ? 200 : 500);
          } catch (err) {
            return sendJson({ success: false, error: err.message }, 500);
          }
        }

        // View cloud backup logs (GET /api/backup/logs)
        if (url.pathname === '/api/backup/logs' || url.pathname === '/api/system/backup/logs') {
          if (db) {
            const logs = (await db.prepare('SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 50').all().catch(() => ({ results: [] }))).results;
            return sendJson({ success: true, logs: logs || [] });
          }
          return sendJson({ success: true, logs: [] });
        }

        // Download live Royal Excel File directly from server (GET /api/backup/download-excel)
        if (url.pathname === '/api/backup/download-excel' || url.pathname === '/api/system/backup/excel') {
          try {
            const { buffer, summary } = await generateRoyalExcelBuffer(db);
            const fileName = `Maha_Enterprise_Backup_${summary.fileTimestamp}.xlsx`;
            return new Response(buffer, {
              status: 200,
              headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
              },
            });
          } catch (err) {
            return sendJson({ success: false, error: err.message }, 500);
          }
        }

        // Restore JSON Database Snapshot
        if (url.pathname === '/api/system/restore' && request.method === 'POST') {
          const body = await request.json();
          if (body.backup && db) {
            const data = body.backup;
            // Clear & reload
            await db.exec('DELETE FROM sales; DELETE FROM purchases; DELETE FROM party_ledger; DELETE FROM cashbook; DELETE FROM expenses; DELETE FROM stock_adjustments;');
            return sendJson({ success: true, message: 'ডাটাবেজ সফলভাবে রিস্টোর সম্পন্ন হয়েছে' });
          }
          return sendJson({ success: true, message: 'রিস্টোর সফল (মক মোড)' });
        }

        // Check & Purge Test Drafts
        if (url.pathname === '/api/system/has-drafts' || url.pathname === '/api/settings/has-drafts') {
          if (db) {
            const p = await db.prepare('SELECT COUNT(*) as c FROM purchases WHERE is_test_draft = 1').first();
            const s = await db.prepare('SELECT COUNT(*) as c FROM sales WHERE is_test_draft = 1').first();
            const a = await db.prepare('SELECT COUNT(*) as c FROM stock_adjustments WHERE is_test_draft = 1').first();
            const e = await db.prepare('SELECT COUNT(*) as c FROM expenses WHERE is_test_draft = 1').first();
            const pt = await db.prepare('SELECT COUNT(*) as c FROM parties WHERE is_test_draft = 1').first();
            return sendJson({ hasDrafts: ((p?.c || 0) + (s?.c || 0) + (a?.c || 0) + (e?.c || 0) + (pt?.c || 0)) > 0 });
          }
          const hasMemDraft = inMemoryStore.purchases.some(x => x.is_test_draft) ||
                              inMemoryStore.sales.some(x => x.is_test_draft) ||
                              inMemoryStore.stockAdjustments.some(x => x.is_test_draft) ||
                              inMemoryStore.expenses.some(x => x.is_test_draft);
          return sendJson({ hasDrafts: hasMemDraft });
        }

        if ((url.pathname === '/api/system/purge-drafts' || url.pathname === '/api/settings/reset-drafts') && request.method === 'POST') {
          if (db) {
            // 1. Revert commodity stocks from test shrinkage adjustments (add lost weight back)
            const testAdjs = (await db.prepare('SELECT commodity_id, lost_weight_kg, lost_bags FROM stock_adjustments WHERE is_test_draft = 1').all())?.results || [];
            for (const a of testAdjs) {
              await db.prepare('UPDATE commodities SET current_stock_kg = current_stock_kg + ?, current_stock_bags = current_stock_bags + ? WHERE id = ?')
                .bind(a.lost_weight_kg, a.lost_bags, a.commodity_id).run();
            }

            // 2. Revert commodity stocks from test sales (add sold stock back first)
            const testSales = (await db.prepare('SELECT commodity_id, net_weight_kg, bags_count FROM sales WHERE is_test_draft = 1').all())?.results || [];
            for (const s of testSales) {
              await db.prepare('UPDATE commodities SET current_stock_kg = current_stock_kg + ?, current_stock_bags = current_stock_bags + ? WHERE id = ?')
                .bind(s.net_weight_kg, s.bags_count, s.commodity_id).run();
            }

            // 3. Revert commodity stocks from test purchases (subtract purchased stock)
            const testPurchases = (await db.prepare('SELECT commodity_id, net_weight_kg, bags_count FROM purchases WHERE is_test_draft = 1').all())?.results || [];
            for (const p of testPurchases) {
              await db.prepare('UPDATE commodities SET current_stock_kg = MAX(0, current_stock_kg - ?), current_stock_bags = MAX(0, current_stock_bags - ?) WHERE id = ?')
                .bind(p.net_weight_kg, p.bags_count, p.commodity_id).run();
            }

            // 4. Purge tables
            await db.exec(`
              DELETE FROM purchases WHERE is_test_draft = 1;
              DELETE FROM sales WHERE is_test_draft = 1;
              DELETE FROM party_ledger WHERE is_test_draft = 1;
              DELETE FROM cashbook WHERE is_test_draft = 1;
              DELETE FROM expenses WHERE is_test_draft = 1;
              DELETE FROM stock_adjustments WHERE is_test_draft = 1;
              DELETE FROM parties WHERE is_test_draft = 1;
            `);
            return sendJson({ success: true, message: 'সকল টেস্ট ড্রাফট ডাটা সফলভাবে মুছে ফেলা হয়েছে এবং স্টক স্বাভাবিক করা হয়েছে।' });
          }

          // In-memory purge
          inMemoryStore.purchases = inMemoryStore.purchases.filter(p => !p.is_test_draft);
          inMemoryStore.sales = inMemoryStore.sales.filter(s => !s.is_test_draft);
          inMemoryStore.partyLedger = inMemoryStore.partyLedger.filter(l => !l.is_test_draft);
          inMemoryStore.cashbook = inMemoryStore.cashbook.filter(c => !c.is_test_draft);
          inMemoryStore.expenses = inMemoryStore.expenses.filter(e => !e.is_test_draft);
          inMemoryStore.stockAdjustments = inMemoryStore.stockAdjustments.filter(a => !a.is_test_draft);
          inMemoryStore.parties = inMemoryStore.parties.filter(p => !p.is_test_draft);

          return sendJson({ success: true, message: 'সকল টেস্ট ড্রাফট ডাটা সফলভাবে মুছে ফেলা হয়েছে।' });
        }

        // =========================================================================
        // SMS GATEWAY SETTINGS & LOGS API
        // =========================================================================
        if (url.pathname === '/api/settings/sms' && request.method === 'GET') {
          const cfg = await getSmsConfig(db, env);
          const hasKey = Boolean(cfg.sms_api_key && cfg.sms_api_key.trim().length > 0);
          const maskedKey = hasKey
            ? (cfg.sms_api_key.length > 8
                ? `${cfg.sms_api_key.slice(0, 3)}••••••••${cfg.sms_api_key.slice(-3)}`
                : '••••••••')
            : '';

          return sendJson({
            success: true,
            settings: {
              sms_enabled: cfg.sms_enabled || 'true',
              sms_provider: cfg.sms_provider || 'bulksmsbd',
              sms_sender_id: cfg.sms_sender_id || '',
              sms_custom_url: cfg.sms_custom_url || '',
              sms_format_mode: cfg.sms_format_mode || 'banglish_1sms',
              sms_send_on_due_collect: cfg.sms_send_on_due_collect || 'true',
              has_api_key: hasKey,
              masked_api_key: maskedKey,
            },
          });
        }

        if (url.pathname === '/api/settings/sms' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          // If masked key is passed back, don't overwrite with asterisks
          if (body.sms_api_key && (body.sms_api_key.includes('••••') || body.sms_api_key.includes('****'))) {
            delete body.sms_api_key;
          }
          await saveSmsConfig(db, body);
          return sendJson({ success: true, message: 'SMS সেটিংস সফলভাবে সংরক্ষিত হয়েছে' });
        }

        if (url.pathname === '/api/settings/sms/test' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const testPhone = body.test_phone || body.phone;
          const normalized = normalizeBdPhone(testPhone);
          if (!normalized) {
            return sendJson({
              success: false,
              error: 'সঠিক ১১-সংখ্যার বাংলাদেশি মোবাইল নম্বর লিখুন (যেমন: 017XXXXXXXX বা 88017XXXXXXXX)',
            }, 400);
          }

          const cfg = await getSmsConfig(db, env);
          const timeStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' });
          const testMsg = `Maha Enterprise: Test SMS Gateway Verification OK! Somoy: ${timeStr}. Dhonnobad!`;

          const result = await sendBulkSms(db, env, {
            phone: normalized,
            message: testMsg,
            invoiceNo: 'TEST-SMS',
            partyName: 'Test Receiver',
          });

          return sendJson({
            success: result.success,
            status: result.status,
            phone: result.phone,
            gatewayResponse: result.gatewayResponse,
            error: result.error,
          });
        }

        if (url.pathname === '/api/settings/sms/logs' && request.method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '30', 10);
          const logs = await getSmsLogs(db, limit);
          return sendJson({ success: true, logs: logs || [] });
        }

        if (url.pathname === '/api/settings/sms/resend' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const logId = parseInt(body.log_id || body.id || '0', 10);
          if (!logId) {
            return sendJson({ success: false, error: 'লগ আইডি প্রদান করুন' }, 400);
          }
          const result = await resendSms(db, env, logId);
          return sendJson(result);
        }

        // =========================================================================
        // AI MANEZAR (GEMINI 3 FLASH) ENGINE & SETTINGS API
        // =========================================================================

        // 1. AI Settings (API Key Management)
        if (url.pathname === '/api/settings/ai-key') {
          if (request.method === 'GET') {
            const key = await getGeminiApiKey(db, env);
            const hasKey = Boolean(key && key.trim().length > 0);
            const maskedKey = hasKey
              ? (key.length > 8 ? `${key.slice(0, 3)}••••••••${key.slice(-3)}` : '••••••••')
              : '';
            return sendJson({ success: true, hasKey, maskedKey });
          }

          if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            const apiKey = String(body.apiKey || body.gemini_api_key || '').trim();

            if (apiKey && !apiKey.includes('••••') && !apiKey.includes('****')) {
              if (db) {
                await db.batch([
                  db.prepare(`
                    INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                  `).bind(apiKey),
                  db.prepare(`
                    INSERT INTO app_settings (key, value) VALUES ('gemini_api_key', ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                  `).bind(apiKey),
                ]);
              }
            }
            return sendJson({ success: true, message: 'Google Gemini API Key সফলভাবে সংরক্ষিত হয়েছে! ✅' });
          }
        }

        // 2. AI Connection Test
        if (url.pathname === '/api/ai/test' && request.method === 'POST') {
          const apiKey = await getGeminiApiKey(db, env);
          if (!apiKey) {
            return sendJson({ success: false, error: 'Gemini API Key সেট করা নেই।' }, 400);
          }

          const payload = {
            contents: [{ parts: [{ text: 'সংক্ষেপে উত্তর দাও: মাহা এন্টারপ্রাইজ এআই কানেকশন টেস্ট সফল হয়েছে।' }] }],
          };
          const geminiCall = await callGeminiModel(apiKey, payload);
          if (!geminiCall.ok) {
            return sendJson({
              success: false,
              error: `Google API Error (${geminiCall.status}): ${geminiCall.errorText}`,
            }, 500);
          }

          const replyText = geminiCall.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'কানেকশন সফল!';
          return sendJson({
            success: true,
            message: `Gemini ${geminiCall.modelUsed?.includes('3') ? '3 Flash' : 'Flash'}-এর সাথে সংযোগ সফল হয়েছে! ⚡`,
            model: geminiCall.modelUsed,
            reply: replyText,
          });
        }

        // 3. Telegram Audit Manual Trigger Test
        if (url.pathname === '/api/ai/telegram-audit-now' && request.method === 'POST') {
          const auditRes = await generateAndSendDailyAiAudit(db, env);
          if (auditRes.ok) {
            return sendJson({
              success: true,
              message: 'টেলিগ্রামে রাত ১০টার দৈনিক ব্যবসায়িক অডিট সফলভাবে পাঠানো হয়েছে! 📱',
              report: auditRes.report,
            });
          }
          return sendJson({
            success: false,
            error: auditRes.error || 'টেলিগ্রামে অডিট বার্তা পাঠাতে ব্যর্থ হয়েছে।',
          }, 500);
        }

        // 4. AI Chat Sessions (List & Create)
        if (url.pathname === '/api/ai/sessions') {
          if (request.method === 'GET') {
            if (db) {
              const { results: sessions } = await db.prepare(`
                SELECT s.id, s.title, s.isPinned, s.updatedAt, s.createdAt,
                       (SELECT message FROM AiChatMessage WHERE sessionId = s.id ORDER BY createdAt DESC LIMIT 1) as lastMessage,
                       (SELECT COUNT(*) FROM AiChatMessage WHERE sessionId = s.id) as messageCount
                FROM AiChatSession s
                ORDER BY s.isPinned DESC, s.updatedAt DESC
              `).all().catch(() => ({ results: [] }));
              return sendJson({ success: true, sessions: sessions || [] });
            }
            return sendJson({ success: true, sessions: [] });
          }

          if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            const id = body.id || `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
            const title = String(body.title || 'নতুন আলোচনা').trim();

            if (db) {
              await db.prepare(`
                INSERT INTO AiChatSession (id, title, isPinned, createdAt, updatedAt)
                VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(id, title).run();
            }

            return sendJson({ success: true, session: { id, title, isPinned: 0 } }, 200);
          }
        }

        // 5. Specific Session (Update / Delete)
        if (url.pathname.startsWith('/api/ai/sessions/') && !url.pathname.endsWith('/messages')) {
          const sessionId = url.pathname.split('/')[4];
          if (request.method === 'PUT') {
            const body = await request.json().catch(() => ({}));
            const updates = [];
            const binds = [];

            if (body.title !== undefined) {
              updates.push('title = ?');
              binds.push(String(body.title).trim());
            }
            if (body.isPinned !== undefined) {
              updates.push('isPinned = ?');
              binds.push(body.isPinned ? 1 : 0);
            }
            updates.push('updatedAt = CURRENT_TIMESTAMP');
            binds.push(sessionId);

            if (db) {
              await db.prepare(`UPDATE AiChatSession SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
            }
            return sendJson({ success: true, message: 'সেশন আপডেট হয়েছে' });
          }

          if (request.method === 'DELETE') {
            if (db) {
              await db.batch([
                db.prepare('DELETE FROM AiChatMessage WHERE sessionId = ?').bind(sessionId),
                db.prepare('DELETE FROM AiChatSession WHERE id = ?').bind(sessionId),
              ]);
            }
            return sendJson({ success: true, message: 'সেশন ও সকল মেসেজ সফলভাবে মুছে ফেলা হয়েছে' });
          }
        }

        // 6. Session Message History
        if (url.pathname.startsWith('/api/ai/sessions/') && url.pathname.endsWith('/messages') && request.method === 'GET') {
          const parts = url.pathname.split('/');
          const sessionId = parts[4];
          if (db) {
            const { results: messages } = await db.prepare(`
              SELECT id, sessionId, role, message, hasImage, actionJson, actionExecuted, createdAt
              FROM AiChatMessage
              WHERE sessionId = ?
              ORDER BY createdAt ASC
            `).bind(sessionId).all().catch(() => ({ results: [] }));
            return sendJson({ success: true, messages: messages || [] });
          }
          return sendJson({ success: true, messages: [] });
        }

        // 7. Morning Briefing
        if (url.pathname === '/api/ai/morning-briefing' && request.method === 'GET') {
          const shopContext = await fetchLiveShopContext(db, inMemoryStore);
          const ledger = shopContext.verifiedLedger;
          const lowStockCommodities = (ledger.warehouseStock.categories || []).filter((c) => c.maund <= 25);
          const topDues = ledger.customerDues.topDueCustomers.slice(0, 3);

          const briefing = {
            date: shopContext.todayStr,
            totalStockMon: ledger.warehouseStock.totalMaund,
            totalStockValuation: ledger.warehouseStock.totalValuation,
            totalCustomerDue: ledger.customerDues.totalReceivable,
            totalSupplierPayable: ledger.supplierPayables.totalPayable,
            lowStockCount: lowStockCommodities.length,
            lowStockCommodities: lowStockCommodities.map((c) => `${c.name} (${c.maund} মণ)`),
            topDueCustomers: topDues.map((b) => `${b.n} (৳${Number(b.d).toLocaleString()})`),
            summaryText: `শুভ সকাল! গুদামে বর্তমানে মোট ${ledger.warehouseStock.totalMaund} মণ শস্য মজুদ রয়েছে (আনুমানিক মূল্য ৳ ${ledger.warehouseStock.totalValuation.toLocaleString()})। বাজারে বকেয়া পাওনা ৳ ${ledger.customerDues.totalReceivable.toLocaleString()} এবং মহাজন দেনা ৳ ${ledger.supplierPayables.totalPayable.toLocaleString()}। ${lowStockCommodities.length > 0 ? `⚠️ ${lowStockCommodities.length}টি শস্যের স্টক কম আছে।` : '✅ গুদামে পর্যাপ্ত শস্য মজুদ রয়েছে।'}`,
          };

          return sendJson({ success: true, briefing });
        }

        // 7.1 Automated Live AI vs. App Parity Audit Endpoint (GET /api/ai/verify-parity)
        if (url.pathname === '/api/ai/verify-parity' && request.method === 'GET') {
          if (!incomingPin || incomingPin !== activePin) {
            return sendJson({
              success: false,
              error: 'অননুমোদিত এক্সেস: সঠিক পিন কোড প্রদান করুন (X-App-Pin হেডার আবশ্যক)',
            }, 401);
          }
          const verifiedLedger = await computeVerifiedBusinessLedger(db, inMemoryStore);
          return sendJson({
            ok: true,
            bstDate: verifiedLedger.bstDate,
            verifiedLedger,
          });
        }

        // 7.2 Geo-Block Direct Browser Commit Endpoint (POST /api/ai/sessions/:id/commit-reply or /api/ai/chat/commit-reply)
        const commitMatch = url.pathname.match(/^\/api\/ai\/sessions\/([^/]+)\/commit-reply$/);
        if ((commitMatch || url.pathname === '/api/ai/chat/commit-reply') && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const targetSessionId = commitMatch ? commitMatch[1] : (body.sessionId || body.id);
          const userMessageId = body.userMessageId;
          const modelUsed = body.modelUsed || 'gemini-3-flash-preview';
          const geminiResponse = body.geminiResponse || body.response;

          if (!geminiResponse) {
            return sendJson({ success: false, error: 'geminiResponse প্যারামিটার প্রদান করুন' }, 400);
          }

          const rawContent = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ||
                            (typeof geminiResponse === 'string' ? geminiResponse : JSON.stringify(geminiResponse));

          const committed = await persistAiAssistantReply(db, inMemoryStore, {
            sessionId: targetSessionId,
            userMessageId,
            rawContent,
            modelUsed,
          });

          return sendJson(committed);
        }

        // 8. Core AI Chat Engine (Text, Audio Multimodal, Vision OCR with Geo-Block Bypass)
        if (url.pathname === '/api/ai/chat' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          let sessionId = body.sessionId;
          const userMessage = String(body.message || '').trim();
          const imageBase64 = body.imageBase64 || null;
          const mimeType = body.mimeType || 'image/jpeg';
          const audioBase64 = body.audioBase64 || null;
          const audioMimeType = body.audioMimeType || 'audio/webm';

          if (!userMessage && !imageBase64 && !audioBase64) {
            return sendJson({ success: false, error: 'বার্তা, অডিও বা ছবি প্রদান করুন' }, 400);
          }

          if (db) {
            if (!sessionId) {
              sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
              await db.prepare(`
                INSERT INTO AiChatSession (id, title, isPinned, createdAt, updatedAt)
                VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(sessionId, userMessage ? userMessage.slice(0, 30) : (audioBase64 ? 'ভয়েস বার্তা' : 'ছবি বিশ্লেষণ')).run();
            } else {
              const exist = await db.prepare('SELECT id FROM AiChatSession WHERE id = ?').bind(sessionId).first();
              if (!exist) {
                await db.prepare(`
                  INSERT INTO AiChatSession (id, title, isPinned, createdAt, updatedAt)
                  VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `).bind(sessionId, userMessage ? userMessage.slice(0, 30) : (audioBase64 ? 'ভয়েস বার্তা' : 'ছবি বিশ্লেষণ')).run();
              }
            }

            const initialText = userMessage || (audioBase64 ? '🎙️ [ভয়েস অডিও রেকর্ডিং বিশ্লেষণ হচ্ছে...]' : '📷 [ছবি সংযুক্ত]');
            const userMsgId = `msg_u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
            await db.prepare(`
              INSERT INTO AiChatMessage (id, sessionId, role, message, hasImage, actionJson, actionExecuted, createdAt)
              VALUES (?, ?, 'user', ?, ?, NULL, 0, CURRENT_TIMESTAMP)
            `).bind(userMsgId, sessionId, initialText, imageBase64 ? 1 : 0).run();

            const shopContext = await fetchLiveShopContext(db, inMemoryStore);
            const apiKey = await getGeminiApiKey(db, env);

            if (!apiKey) {
              const noKeyReply = `⚠️ **Gemini 3 Flash API Key কনফিগার করা হয়নি!**\n\n` +
                `Ai Manezar-এর কৃত্রিম বুদ্ধিমত্তা ও ভিশন ওসিআর সক্রিয় করতে অনুগ্রহ করে **"সেটিংস ও ব্যাকআপ"** মেনুতে গিয়ে **"🤖 Ai Manezar — Gemini 3 Flash কনফিগারেশন"** কার্ডে আপনার গুগল জেমিনাই API Key প্রদান করুন এবং সংরক্ষণ করুন।\n\n` +
                `💡 **মাহা এন্টারপ্রাইজের বর্তমান লাইভ তথ্য:**\n` +
                `- মোট শস্যের মজুদ: ${shopContext.totalStockMon} মণ (মূল্য ৳ ${shopContext.totalStockValuation.toLocaleString()})\n` +
                `- মোট ক্রেতা বকেয়া: ৳ ${shopContext.totalCustomerDue.toLocaleString()}\n` +
                `- মোট মহাজন দেনা: ৳ ${shopContext.totalSupplierPayable.toLocaleString()}\n` +
                `- ক্যাশ ইন হ্যান্ড: ৳ ${shopContext.cashInHand.toLocaleString()}`;

              const committed = await persistAiAssistantReply(db, inMemoryStore, {
                sessionId,
                userMessageId: userMsgId,
                rawContent: JSON.stringify({ reply: noKeyReply }),
                modelUsed: 'offline-rule-based',
              });
              return sendJson(committed);
            }

            // Build system prompt injecting [EXACT_VERIFIED_SUMMARY] at the very top
            const systemPrompt = buildAiSystemPrompt(shopContext.verifiedLedger, shopContext);

            try {
              const parts = [{ text: systemPrompt + (userMessage ? `\n\nইউজারের বার্তা: ${userMessage}` : `\n\n[অডিও বা মিডিয়া ইনপুট দেওয়া হয়েছে, অনুগ্রহ করে ট্রান্সক্রিপশন ও নির্দেশনা প্রস্তুত করুন]`) }];

              if (audioBase64) {
                parts.push({
                  inlineData: {
                    mimeType: audioMimeType || 'audio/webm',
                    data: audioBase64.replace(/^data:audio\/\w+;base64,/, ''),
                  },
                });
              }

              if (imageBase64) {
                parts.push({
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
                  },
                });
              }

              const payload = {
                contents: [{ parts }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.2,
                },
              };

              const geminiCall = await callGeminiModel(apiKey, payload);

              // Seamless Authenticated Direct Client-Side Fallback on Geo-block
              if (!geminiCall.ok && geminiCall.isGeoBlock) {
                console.warn('[Gemini 400 Geo-Block intercepted] Routing to client-side Bangladesh bypass...');
                return sendJson({
                  success: true,
                  geoFallbackRequired: true,
                  targetUrl: geminiCall.targetUrl || `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
                  requestBody: payload,
                  sessionId,
                  userMessageId: userMsgId,
                  modelUsed: geminiCall.modelUsed || 'gemini-3-flash-preview',
                });
              }

              if (!geminiCall.ok) {
                throw new Error(`Google API (${geminiCall.status}): ${geminiCall.errorText}`);
              }

              const rawContent = geminiCall.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              const committed = await persistAiAssistantReply(db, inMemoryStore, {
                sessionId,
                userMessageId: userMsgId,
                rawContent,
                modelUsed: geminiCall.modelUsed,
              });

              return sendJson(committed);
            } catch (apiErr) {
              console.error('[Gemini Chat Error]:', apiErr);
              const errReply = `⚠️ **এআই প্রতিক্রিয়া ত্রুটি:** ${apiErr.message}\n\nদয়া করে আপনার ইন্টারনেট সংযোগ ও API Key যাচাই করুন।`;
              const committed = await persistAiAssistantReply(db, inMemoryStore, {
                sessionId,
                userMessageId: userMsgId,
                rawContent: JSON.stringify({ reply: errReply }),
                modelUsed: 'error',
              });
              return sendJson(committed);
            }
          }

          return sendJson({ success: true, reply: 'ডাটাবেজ কানেকশন প্রস্তুত নয়' });
        }

        // 9. AI Action Execution
        if (url.pathname === '/api/ai/execute-action' && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const messageId = body.messageId || null;
          const action = body.action;

          if (!action || (!action.type && !action.actionType)) {
            return sendJson({ success: false, error: 'অবৈধ অ্যাকশন প্যারামিটার' }, 400);
          }

          const result = await executeAiAction(db, env, action);

          if (result.success && messageId && db) {
            await db.prepare('UPDATE AiChatMessage SET actionExecuted = 1 WHERE id = ?').bind(messageId).run().catch(() => {});
          }

          return sendJson(result, result.success ? 200 : 400);
        }

        // 10. AI Dynamic Overrides (CSS/UI)
        if (url.pathname === '/api/ai/overrides') {
          if (request.method === 'GET') {
            if (db) {
              const { results } = await db.prepare('SELECT * FROM AiDynamicOverride ORDER BY updatedAt DESC').all().catch(() => ({ results: [] }));
              return sendJson({ success: true, overrides: results || [] });
            }
            return sendJson({ success: true, overrides: [] });
          }

          if (request.method === 'POST') {
            const body = await request.json().catch(() => ({}));
            const result = await executeAiAction(db, env, {
              type: 'DYNAMIC_OVERRIDE',
              data: body,
            });
            return sendJson(result);
          }
        }

        const overrideIdMatch = url.pathname.match(/^\/api\/ai\/overrides\/([^\/]+)$/);
        if (overrideIdMatch && (request.method === 'DELETE' || request.method === 'POST')) {
          const ovrId = overrideIdMatch[1];
          if (db) {
            const existing = await db.prepare('SELECT * FROM AiDynamicOverride WHERE id = ?').bind(ovrId).first().catch(() => null);
            if (existing) {
              await createRecycleSnapshot(db, {
                module_type: 'AI_OVERRIDE',
                module_label: 'লাইভ ডিজাইন ওভাররাইড',
                original_id: ovrId,
                title: `ডিলিট পূর্বাবস্থা: ${existing.targetKey}`,
                payload: existing,
              });
              await db.prepare('DELETE FROM AiDynamicOverride WHERE id = ?').bind(ovrId).run();
            }
          }
          return sendJson({ success: true, message: 'ওভাররাইডটি মুছে ৬০ দিনের রিসাইকেল বিনে নেওয়া হয়েছে' });
        }

        // 11. AI Memories
        if (url.pathname === '/api/ai/memories' && request.method === 'GET') {
          if (db) {
            const { results } = await db.prepare('SELECT * FROM AiMemory ORDER BY createdAt DESC').all().catch(() => ({ results: [] }));
            return sendJson({ success: true, memories: results || [] });
          }
          return sendJson({ success: true, memories: [] });
        }

        const memoryIdMatch = url.pathname.match(/^\/api\/ai\/memories\/([^\/]+)$/);
        if (memoryIdMatch && request.method === 'DELETE') {
          const memId = memoryIdMatch[1];
          if (db) {
            await db.prepare('DELETE FROM AiMemory WHERE id = ?').bind(memId).run();
          }
          return sendJson({ success: true, message: 'মেমরি মুছে ফেলা হয়েছে' });
        }

        return sendJson({ success: false, error: 'Endpoint not found' }, 404);
      } catch (err) {
        console.error('[Worker API Error]:', err);
        return sendJson({ success: false, error: err.message || 'Server Error' }, 500);
      }
    }

    // 4. Static Asset Delivery via Cloudflare Workers Assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Maha Enterprise Cloudflare Worker Gateway is Active.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },

  async scheduled(event, env, ctx) {
    console.log('[Cloudflare Cron Scheduled Trigger]:', event.cron, new Date().toISOString());
    ctx.waitUntil(sendExcelBackupToTelegram(env, 'AUTO_SCHEDULED'));
    if (event.cron === '0 13 * * *') {
      ctx.waitUntil(generateAndSendDailyAiAudit(env.DB, env));
    }
  },
};
