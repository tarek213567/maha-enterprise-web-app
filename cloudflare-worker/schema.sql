-- ========================================================
-- মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
-- Cloudflare D1 Database Schema & Seed Data
-- ========================================================

-- 1. Commodities (শস্যের তালিকা ও বর্তমান মজুদ)
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

CREATE INDEX IF NOT EXISTS idx_commodities_name ON commodities(name_bn);

-- 2. Parties (বেপারী, চাষী, মিলার, আড়তদার, পাইকার)
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

CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
CREATE INDEX IF NOT EXISTS idx_parties_phone ON parties(phone);
CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);
CREATE INDEX IF NOT EXISTS idx_parties_pinned_updated ON parties(is_pinned, updated_at DESC);

-- 3. Purchases (শস্য ক্রয় ও স্টক-ইন)
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

CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_party ON purchases(party_id);
CREATE INDEX IF NOT EXISTS idx_purchases_commodity ON purchases(commodity_id);

-- 4. Sales (পাইকারি বিক্রয় ও চালান / স্টক-আউট)
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

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_party ON sales(party_id);
CREATE INDEX IF NOT EXISTS idx_sales_commodity ON sales(commodity_id);

-- 5. Stock Adjustments (শুকতি ও আর্দ্রতা ঘাটতি / স্টক সমন্বয়)
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
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adjustments_date ON stock_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_adjustments_commodity ON stock_adjustments(commodity_id);

-- 6. Party Ledgers (খাতা - ব্যক্তি অনুযায়ী দেনা/পাওনা লেনদেনের ইতিহাস)
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

CREATE INDEX IF NOT EXISTS idx_ledger_party_date ON party_ledger(party_id, entry_date);

-- 7. Daily Cashbook (দৈনিক ক্যাশ বই)
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

CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook(entry_date);
CREATE INDEX IF NOT EXISTS idx_cashbook_category ON cashbook(category);

-- 8. Operating Expenses (দৈনিক সাধারণ গুদাম ও আড়ত পরিচালন খরচ)
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

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- 9. Dedicated Notebook (নোটবুক ও দৈনন্দিন টোকাবহি)
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT DEFAULT 'সাধারণ',
  is_pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes(is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);

-- 10. System Settings & App Configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default seeds for Commodities
INSERT OR IGNORE INTO commodities (id, name_bn, name_en, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon, notes) VALUES
(1, 'সরিষা (মাঘি/টোরি)', 'Mustard (Maghi/Tori)', 80.0, 0, 0, 0, 0, 'চাচকৈড় মোকামের প্রধান রবি শস্য'),
(2, 'ভুট্টা (হলুদ দানাদার)', 'Corn (Yellow Grain)', 75.0, 0, 0, 0, 0, 'নাটোর-পাবনা অঞ্চলের উচ্চ ফলনশীল ভুট্টা'),
(3, 'তোষা পাট', 'Toshas Jute', 70.0, 0, 0, 0, 0, 'উচ্চ গ্রেড সোনালী তোষা পাট'),
(4, 'গম (বারি-২৮/৩৩)', 'Wheat (BARI-28/33)', 85.0, 0, 0, 0, 0, 'চাক্কি ও মিল গ্রেড সাদা গম'),
(5, 'আমন ধান (ব্রি-৪৯/স্বর্ণা)', 'Aman Paddy (BR-49/Swarna)', 75.0, 0, 0, 0, 0, 'চলনবিল অঞ্চলের আমন ধান'),
(6, 'বোরো ধান (মিনিকেট/কাটারী)', 'Boro Paddy (Miniket/Katari)', 75.0, 0, 0, 0, 0, 'চলনবিলের সুগন্ধি ও চিকন ধান'),
(7, 'খেসারী কলাই', 'Grass Pea (Khesari)', 85.0, 0, 0, 0, 0, 'স্থানীয় চাষীদের খেসারী ডাল/কলাই'),
(8, 'মসুর ডাল (দেশি)', 'Lentil (Deshi)', 85.0, 0, 0, 0, 0, 'নাটোর অঞ্চলের দেশি মসুর');

-- Initial settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES
('org_name', 'মাহা এন্টারপ্রাইজ'),
('proprietor', 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স'),
('contacts', 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241'),
('location', 'চাচকৈড় বাজার, গুরুদাসপুর, নাটোর'),
('auto_backup_on_exit', 'true'),
('mon_kg_rate', '40'),
('app_security_pin', '5555'),
('theme_mode', 'obsidian-gold');
