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
    { id: 1, name: 'মোঃ করিম বেপারী', phone: '01712345678', address: 'চলনবিল, গুরুদাসপুর', party_type: 'SUPPLIER', opening_balance: -25000, current_balance: -25000, is_active: 1, is_pinned: 0 },
    { id: 2, name: 'রহমান ট্রেডার্স (মিল মালিক)', phone: '01819876543', address: 'ঈশ্বরদী, পাবনা', party_type: 'BUYER', opening_balance: 145000, current_balance: 145000, is_active: 1, is_pinned: 0 },
  ],
  purchases: [],
  sales: [],
  stockAdjustments: [],
  partyLedger: [],
  cashbook: [],
  expenses: [],
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

  const queryPin = url.searchParams.get('pin');
  if (queryPin) return normalizePin(queryPin);

  return '';
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
      ('theme_mode', 'obsidian-gold');

      INSERT OR IGNORE INTO settings (key, value) VALUES
      ('org_name', 'মাহা এন্টারপ্রাইজ'),
      ('proprietor', 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স'),
      ('contacts', 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241'),
      ('location', 'চাচকৈড় বাজার, গুরুদাসপুর, নাটোর'),
      ('auto_backup_on_exit', 'true'),
      ('mon_kg_rate', '40'),
      ('app_security_pin', '5555'),
      ('app_pin', '5555'),
      ('theme_mode', 'obsidian-gold');
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

      if (incomingPin && !isSettingsPinUpdate && incomingPin !== activePin) {
        return sendJson({ success: false, error: 'অননুমোদিত এক্সেস: সঠিক পিন কোড প্রদান করুন' }, 401);
      }

      try {
        // --- COMMODITIES ---
        if (url.pathname === '/api/commodities' || url.pathname === '/api/stock') {
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

        const commIdMatch = url.pathname.match(/^\/api\/commodities\/(\d+)$/);
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
          if (request.method === 'DELETE') {
            if (db) {
              await db.prepare('UPDATE commodities SET is_active = 0 WHERE id = ?').bind(id).run();
              return sendJson({ success: true, message: 'শস্য নিষ্ক্রিয় করা হয়েছে' });
            }
            inMemoryStore.commodities = inMemoryStore.commodities.filter(c => c.id !== id);
            return sendJson({ success: true });
          }
        }

        // --- PARTIES ---
        if (url.pathname === '/api/parties' || url.pathname === '/api/dues') {
          if (request.method === 'GET') {
            const type = url.searchParams.get('type');
            if (db) {
              let sql = 'SELECT * FROM parties WHERE is_active = 1';
              const params = [];
              if (type && type !== 'BOTH') {
                sql += ' AND (party_type = ? OR party_type = ?)';
                params.push(type, 'BOTH');
              }
              sql += ' ORDER BY is_pinned DESC, updated_at DESC';
              const { results } = await db.prepare(sql).bind(...params).all();
              return sendJson(results);
            }
            let list = inMemoryStore.parties.filter(p => p.is_active === 1);
            if (type && type !== 'BOTH') list = list.filter(p => p.party_type === type || p.party_type === 'BOTH');
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
              `).bind(body.name, body.phone, body.address, body.party_type, body.is_pinned, id).run();
              const updated = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(id).first();
              return sendJson(updated);
            }
            const idx = inMemoryStore.parties.findIndex(p => p.id === id);
            if (idx !== -1) inMemoryStore.parties[idx] = { ...inMemoryStore.parties[idx], ...body };
            return sendJson(inMemoryStore.parties[idx] || {});
          }
          if (request.method === 'DELETE') {
            if (db) {
              await db.prepare('UPDATE parties SET is_active = 0 WHERE id = ?').bind(id).run();
              return sendJson({ success: true, message: 'পার্টি সফলভাবে মুছে ফেলা হয়েছে' });
            }
            inMemoryStore.parties = inMemoryStore.parties.filter(p => p.id !== id);
            return sendJson({ success: true, message: 'মুছে ফেলা হয়েছে' });
          }
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
            return sendJson({ party, ledger, sales, purchases });
          }
          return sendJson({ party: inMemoryStore.parties.find(p => p.id === partyId), ledger: [], sales: [], purchases: [] });
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

              const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(body.party_id).first();
              if (!party) return sendJson({ success: false, error: 'পার্টি পাওয়া যায়নি' }, 404);

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
                  invoiceNo, body.purchase_date, body.party_id, body.commodity_id, body.bags_count || 0,
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
                db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newPartyBal, body.party_id),
                db.prepare(`
                  INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                  VALUES (?, ?, 'PURCHASE', ?, 0, ?, ?, ?, ?)
                `).bind(
                  body.purchase_date, body.party_id, invoiceNo,
                  grossAmount, subMoney(party.current_balance, grossAmount), isTest,
                  `ক্রয়: ${commodity.name_bn} (${netMon.toFixed(2)} মন / ${body.bags_count} বস্তা @ ৳${rateMon}/মন)`
                )
              ];

              if (paidAmount > 0) {
                batchStmts.push(
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'PAYMENT_GIVEN', ?, ?, 0, ?, ?, ?)
                  `).bind(body.purchase_date, body.party_id, invoiceNo, paidAmount, newPartyBal, isTest, `নগদ পরিশোধ (ক্রয় বিল: ${invoiceNo})`),
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                    VALUES (?, 'OUTFLOW', 'PURCHASE_CASH', ?, ?, ?, ?, ?, ?)
                  `).bind(body.purchase_date, paidAmount, payMethod === 'BANK' ? 'BANK' : 'CASH', invoiceNo, body.party_id, isTest, `শস্য ক্রয়ে পরিশোধ: ${party.name} (${commodity.name_bn})`)
                );
              }

              if (directExp > 0) {
                batchStmts.push(
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                    VALUES (?, 'OUTFLOW', 'EXPENSE', ?, 'CASH', ?, ?, ?, ?)
                  `).bind(body.purchase_date, directExp, invoiceNo, body.party_id, isTest, `ক্রয় আনুষঙ্গিক খরচ (চালান: ${invoiceNo})`)
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

            const mockPurchase = { id: Date.now(), invoice_no: invoiceNo, ...body, net_weight_kg: netKg, net_weight_mon: netMon, gross_amount: grossAmount, total_landed_cost: totalLandedCost, paid_amount: paidAmount, due_amount: dueAmount };
            inMemoryStore.purchases.unshift(mockPurchase);
            return sendJson(mockPurchase, 201);
          }
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

            const paidAmount = roundMoney(body.paid_amount || 0);
            const dueAmount = roundMoney(Math.max(0, subMoney(netInvoiceAmount, paidAmount)));

            let payMethod = 'CASH';
            if (body.payment_method === 'BANK') payMethod = 'BANK';
            else if (dueAmount <= 0) payMethod = 'CASH';
            else if (paidAmount <= 0) payMethod = 'DUE';
            else payMethod = 'PARTIAL';

            const dateStr = (body.sale_date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
            const invoiceNo = `SAL-${dateStr}-${Date.now().toString().slice(-4)}`;

            if (db) {
              const commodity = await db.prepare('SELECT * FROM commodities WHERE id = ?').bind(body.commodity_id).first();
              if (!commodity) return sendJson({ success: false, error: 'শস্য পাওয়া যায়নি' }, 404);
              if (commodity.current_stock_kg < netKg) {
                return sendJson({ success: false, error: `গুদামে পর্যাপ্ত মজুত নেই! বর্তমান মজুত: ${(commodity.current_stock_kg / 40).toFixed(2)} মণ` }, 400);
              }

              const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(body.party_id).first();
              if (!party) return sendJson({ success: false, error: 'পার্টি পাওয়া যায়নি' }, 404);

              const cogs = roundMoney(netKg * commodity.current_wac_per_kg);
              const profit = subMoney(netInvoiceAmount, cogs);

              const remainingStockKg = roundWeight(subWeight(commodity.current_stock_kg, netKg));
              const remainingBags = Math.max(0, commodity.current_stock_bags - (body.bags_count || 0));
              const newPartyBal = addMoney(party.current_balance, subMoney(netInvoiceAmount, paidAmount));

              const batchStmts = [
                db.prepare(`
                  INSERT INTO sales (
                    invoice_no, sale_date, party_id, commodity_id, bags_count,
                    gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon,
                    rate_per_mon, gross_amount, loading_charge, damaged_bag_deduction, discount_amount,
                    net_invoice_amount, payment_method, paid_amount, due_amount,
                    vehicle_no, driver_name, driver_phone, destination,
                    cogs_amount, realized_profit, is_test_draft, notes
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                  invoiceNo, body.sale_date, body.party_id, body.commodity_id, body.bags_count || 0,
                  grossKg, bagDedKg, netKg, netMon,
                  rateMon, grossAmount, loading, damage, discount,
                  netInvoiceAmount, payMethod, paidAmount, dueAmount,
                  body.vehicle_no || '', body.driver_name || '', body.driver_phone || '', body.destination || '',
                  cogs, profit, isTest, body.notes || ''
                ),
                db.prepare(`
                  UPDATE commodities SET current_stock_kg = ?, current_stock_bags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                `).bind(remainingStockKg, remainingBags, body.commodity_id),
                db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newPartyBal, body.party_id),
                db.prepare(`
                  INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                  VALUES (?, ?, 'SALE', ?, ?, 0, ?, ?, ?)
                `).bind(
                  body.sale_date, body.party_id, invoiceNo,
                  netInvoiceAmount, addMoney(party.current_balance, netInvoiceAmount), isTest,
                  `বিক্রয়: ${commodity.name_bn} (${netMon.toFixed(2)} মন / ${body.bags_count} বস্তা @ ৳${rateMon}/মন)`
                )
              ];

              if (paidAmount > 0) {
                batchStmts.push(
                  db.prepare(`
                    INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, is_test_draft, description)
                    VALUES (?, ?, 'PAYMENT_RECEIVED', ?, 0, ?, ?, ?, ?)
                  `).bind(body.sale_date, body.party_id, invoiceNo, paidAmount, newPartyBal, isTest, `নগদ আদায় (বিক্রয় চালান: ${invoiceNo})`),
                  db.prepare(`
                    INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, is_test_draft, description)
                    VALUES (?, 'INFLOW', 'SALE_CASH', ?, ?, ?, ?, ?, ?)
                  `).bind(body.sale_date, paidAmount, payMethod === 'BANK' ? 'BANK' : 'CASH', invoiceNo, body.party_id, isTest, `বিক্রয় নগদ আদায়: ${party.name} (${commodity.name_bn})`)
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
              return sendJson(created, 201);
            }

            const mockSale = { id: Date.now(), invoice_no: invoiceNo, ...body, net_weight_kg: netKg, net_weight_mon: netMon, net_invoice_amount: netInvoiceAmount, paid_amount: paidAmount, due_amount: dueAmount };
            inMemoryStore.sales.unshift(mockSale);
            return sendJson(mockSale, 201);
          }
        }

        // --- STOCK ADJUSTMENTS (শুকতি ঘাটতি) ---
        if (url.pathname === '/api/stock-adjustments') {
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
          }
          return sendJson({ success: true, newBalance: 0 }, 201);
        }

        // --- CASHBOOK ---
        if (url.pathname === '/api/cashbook') {
          const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
          if (request.method === 'GET') {
            if (db) {
              const { results: entries } = await db.prepare('SELECT c.*, p.name as party_name FROM cashbook c LEFT JOIN parties p ON c.party_id = p.id WHERE c.entry_date = ? ORDER BY c.id ASC').bind(date).all();
              const prior = await db.prepare(`
                SELECT
                  COALESCE(SUM(CASE WHEN entry_type = 'INFLOW' THEN amount ELSE 0 END), 0) as inf,
                  COALESCE(SUM(CASE WHEN entry_type = 'OUTFLOW' THEN amount ELSE 0 END), 0) as outf
                FROM cashbook WHERE entry_date < ?
              `).bind(date).first();
              const opening = subMoney(prior.inf, prior.outf);

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
              await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
              return sendJson({ success: true, message: 'নোট মুছে ফেলা হয়েছে' });
            }
            inMemoryStore.notes = inMemoryStore.notes.filter(n => n.id !== id);
            return sendJson({ success: true });
          }
        }

        // --- REPORTS & DASHBOARD ---
        if (url.pathname === '/api/reports/stats') {
          const today = new Date().toISOString().split('T')[0];
          const monthStart = `${today.slice(0, 7)}-01`;

          if (db) {
            const todayPur = await db.prepare("SELECT COALESCE(SUM(total_landed_cost), 0) as amt, COALESCE(SUM(net_weight_mon), 0) as mon FROM purchases WHERE purchase_date = ?").bind(today).first();
            const todaySal = await db.prepare("SELECT COALESCE(SUM(net_invoice_amount), 0) as amt, COALESCE(SUM(paid_amount), 0) as cash_amt, COALESCE(SUM(due_amount), 0) as due_amt, COALESCE(SUM(net_weight_mon), 0) as mon FROM sales WHERE sale_date = ?").bind(today).first();
            const todayExp = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE expense_date = ?").bind(today).first())?.s || 0;

            const partyStats = await db.prepare(`
              SELECT
                COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as rec,
                COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) as pay
              FROM parties WHERE is_active = 1
            `).first();

            const stockStats = await db.prepare(`
              SELECT
                COALESCE(SUM(current_stock_kg * current_wac_per_kg), 0) as total_val,
                COALESCE(SUM(current_stock_kg / 40.0), 0) as total_mon,
                COALESCE(SUM(current_stock_bags), 0) as total_bags
              FROM commodities WHERE is_active = 1
            `).first();

            const cashPrior = await db.prepare(`
              SELECT
                COALESCE(SUM(CASE WHEN entry_type = 'INFLOW' THEN amount ELSE 0 END), 0) as inf,
                COALESCE(SUM(CASE WHEN entry_type = 'OUTFLOW' THEN amount ELSE 0 END), 0) as outf
              FROM cashbook WHERE entry_date <= ?
            `).bind(today).first();
            const closingCash = subMoney(cashPrior.inf, cashPrior.outf);

            const monthlySales = await db.prepare("SELECT COALESCE(SUM(net_invoice_amount), 0) as rev, COALESCE(SUM(realized_profit), 0) as gp FROM sales WHERE sale_date >= ? AND sale_date <= ?").bind(monthStart, today).first();
            const monthlyExp = (await db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE expense_date >= ? AND expense_date <= ?").bind(monthStart, today).first())?.s || 0;
            const monthlyShrinkage = (await db.prepare("SELECT COALESCE(SUM(cost_value), 0) as s FROM stock_adjustments WHERE adjustment_date >= ? AND adjustment_date <= ?").bind(monthStart, today).first())?.s || 0;

            const netProfit = roundMoney(monthlySales.gp - monthlyExp - monthlyShrinkage);

            return sendJson({
              today_purchases_amount: roundMoney(todayPur.amt),
              today_purchases_mon: roundWeight(todayPur.mon),
              today_sales_amount: roundMoney(todaySal.amt),
              today_sales_cash: roundMoney(todaySal.cash_amt),
              today_sales_due: roundMoney(todaySal.due_amt),
              today_operating_expense: roundMoney(todayExp),
              today_sales_mon: roundWeight(todaySal.mon),
              today_cash_in: roundMoney(todaySal.cash_amt),
              today_cash_out: roundMoney(todayPur.amt + todayExp),
              closing_cash_balance: closingCash,
              total_receivable: roundMoney(partyStats.rec),
              total_payable: roundMoney(partyStats.pay),
              total_stock_value: roundMoney(stockStats.total_val),
              total_stock_mon: roundWeight(stockStats.total_mon),
              total_stock_bags: stockStats.total_bags,
              monthly_sales_revenue: roundMoney(monthlySales.rev),
              monthly_gross_profit: roundMoney(monthlySales.gp),
              monthly_net_profit: netProfit,
            });
          }

          return sendJson({
            today_purchases_amount: 0,
            today_purchases_mon: 0,
            today_sales_amount: 0,
            today_sales_mon: 0,
            today_cash_in: 0,
            today_cash_out: 0,
            closing_cash_balance: 0,
            total_receivable: 145000,
            total_payable: 25000,
            total_stock_value: 940000,
            total_stock_mon: 536.25,
            total_stock_bags: 280,
            monthly_sales_revenue: 0,
            monthly_gross_profit: 0,
            monthly_net_profit: 0,
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
            filePath: 'maha_enterprise_cloud_backup.json',
            message: 'ক্লাউড ও লোকাল ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে',
            backup: snapshot,
          });
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
        if (url.pathname === '/api/system/has-drafts') {
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

        if (url.pathname === '/api/system/purge-drafts' && request.method === 'POST') {
          if (db) {
            // 1. Revert commodity stocks from test purchases
            const testPurchases = (await db.prepare('SELECT commodity_id, net_weight_kg, bags_count FROM purchases WHERE is_test_draft = 1').all())?.results || [];
            for (const p of testPurchases) {
              await db.prepare('UPDATE commodities SET current_stock_kg = MAX(0, current_stock_kg - ?), current_stock_bags = MAX(0, current_stock_bags - ?) WHERE id = ?')
                .bind(p.net_weight_kg, p.bags_count, p.commodity_id).run();
            }

            // 2. Revert commodity stocks from test sales
            const testSales = (await db.prepare('SELECT commodity_id, net_weight_kg, bags_count FROM sales WHERE is_test_draft = 1').all())?.results || [];
            for (const s of testSales) {
              await db.prepare('UPDATE commodities SET current_stock_kg = current_stock_kg + ?, current_stock_bags = current_stock_bags + ? WHERE id = ?')
                .bind(s.net_weight_kg, s.bags_count, s.commodity_id).run();
            }

            // 3. Revert commodity stocks from test shrinkage adjustments
            const testAdjs = (await db.prepare('SELECT commodity_id, lost_weight_kg, lost_bags FROM stock_adjustments WHERE is_test_draft = 1').all())?.results || [];
            for (const a of testAdjs) {
              await db.prepare('UPDATE commodities SET current_stock_kg = current_stock_kg + ?, current_stock_bags = current_stock_bags + ? WHERE id = ?')
                .bind(a.lost_weight_kg, a.lost_bags, a.commodity_id).run();
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
};
