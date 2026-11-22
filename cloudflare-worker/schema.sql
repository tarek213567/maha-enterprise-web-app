-- ========================================================
-- মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
-- Cloudflare D1 Database Schema & Seed Data
-- ========================================================

-- 1. Commodities (শস্যের তালিকা ও বর্তমান মজুদ)
CREATE TABLE IF NOT EXISTS commodities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_bn TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'mustard',
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
CREATE INDEX IF NOT EXISTS idx_commodities_sector ON commodities(sector);

-- 2. Parties (বেপারী, চাষী, মিলার, আড়তদার, পাইকার)
CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  party_type TEXT NOT NULL CHECK(party_type IN ('SUPPLIER', 'BUYER', 'BOTH')),
  sector TEXT NOT NULL DEFAULT 'mustard',
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
CREATE INDEX IF NOT EXISTS idx_parties_sector ON parties(sector);
CREATE INDEX IF NOT EXISTS idx_parties_pinned_updated ON parties(is_pinned, updated_at DESC);

-- 3. Purchases (শস্য ক্রয় ও স্টক-ইন)
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  purchase_date TEXT NOT NULL,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  commodity_id INTEGER NOT NULL REFERENCES commodities(id),
  sector TEXT NOT NULL DEFAULT 'mustard',
  purchase_scale_kg REAL NOT NULL DEFAULT 41.0,
  billed_maund REAL NOT NULL DEFAULT 0.0,
  actual_weight_kg REAL NOT NULL DEFAULT 0.0,
  extra_weight_kg REAL NOT NULL DEFAULT 0.0,
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
CREATE INDEX IF NOT EXISTS idx_purchases_sector ON purchases(sector);

-- 4. Sales (পাইকারি বিক্রয় ও চালান / স্টক-আউট)
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  sale_date TEXT NOT NULL,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  commodity_id INTEGER NOT NULL REFERENCES commodities(id),
  sector TEXT NOT NULL DEFAULT 'mustard',
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
  previous_due REAL NOT NULL DEFAULT 0.0,
  remaining_due REAL NOT NULL DEFAULT 0.0,
  vehicle_no TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  destination TEXT,
  truck_no TEXT,
  transport_info TEXT,
  cogs_amount REAL NOT NULL DEFAULT 0.0,
  realized_profit REAL NOT NULL DEFAULT 0.0,
  is_test_draft INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_party ON sales(party_id);
CREATE INDEX IF NOT EXISTS idx_sales_commodity ON sales(commodity_id);
CREATE INDEX IF NOT EXISTS idx_sales_sector ON sales(sector);

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
  is_test_draft INTEGER NOT NULL DEFAULT 0,
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
  sector TEXT NOT NULL DEFAULT 'mustard',
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('PURCHASE', 'SALE', 'PAYMENT_RECEIVED', 'PAYMENT_GIVEN', 'ADJUSTMENT', 'OPENING')),
  reference_id INTEGER,
  reference_no TEXT,
  debit REAL NOT NULL DEFAULT 0.0,
  credit REAL NOT NULL DEFAULT 0.0,
  running_balance REAL NOT NULL,
  is_test_draft INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_party_date ON party_ledger(party_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_sector ON party_ledger(sector);

-- 6.1 Recycle Bin (রিসাইকেল বিন - ৬০ দিনের ডেটা সুরক্ষা ও রিস্টোর)
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

-- 7. Daily Cashbook (দৈনিক ক্যাশ বই)
CREATE TABLE IF NOT EXISTS cashbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'mustard',
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
CREATE INDEX IF NOT EXISTS idx_cashbook_sector ON cashbook(sector);

-- Cashbook Daily Overrides (প্রারম্ভিক ক্যাশ জের সমন্বয় ও তারিখভিত্তিক ওভাররাইড)
CREATE TABLE IF NOT EXISTS cashbook_overrides (
  entry_date TEXT PRIMARY KEY,
  opening_balance REAL NOT NULL,
  notes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 8. Operating Expenses (দৈনিক সাধারণ গুদাম ও আড়ত পরিচালন খরচ)
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'general',
  category TEXT NOT NULL CHECK(category IN ('RENT', 'ELECTRICITY', 'SALARY', 'LABOR', 'FOOD_ENTERTAINMENT', 'TRANSPORT', 'REPAIR', 'TAX_LEGAL', 'MISC')),
  amount REAL NOT NULL,
  paid_to TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_mode IN ('CASH', 'BANK')),
  is_test_draft INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_sector ON expenses(sector);

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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default seeds for Parties (Walk-in & Standard Parties)
INSERT OR IGNORE INTO parties (id, name, phone, address, party_type, sector, opening_balance, current_balance, notes, is_active, is_pinned) VALUES
(1, 'সাধারণ বিক্রেতা', '০১৭০০-০০০০০০', 'চাচকৈড় বাজার, গুরুদাসপুর', 'SUPPLIER', 'mustard', 0, 0, 'সাধারণ নগদ বিক্রেতা ও কৃষক', 1, 1),
(2, 'সাধারণ খুচরা ক্রেতা', '০১৭০০-০০০০০০', 'চাচকৈড় বাজার, গুরুদাসপুর', 'BUYER', 'mustard', 0, 0, 'সাধারণ নগদ ক্রেতা ও পাইকার', 1, 1),
(3, 'মোঃ করিম বেপারী', '01712345678', 'চলনবিল, গুরুদাসপুর', 'SUPPLIER', 'mustard', -25000, -25000, 'রবি শস্য সরবরাহকারী বেপারী', 1, 0),
(4, 'রহমান ট্রেডার্স (মিল মালিক)', '01819876543', 'ঈশ্বরদী, পাবনা', 'BUYER', 'mustard', 145000, 145000, 'রাইস মিল ও পাইকারি খরিদ্দার', 1, 0);

-- Default seeds for Commodities (Multi-Sector Presets: Jute, Maize, Mustard)
INSERT OR IGNORE INTO commodities (id, name_bn, name_en, sector, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon, notes) VALUES
(1, 'মাঘী সরিষা', 'Maghi Mustard', 'mustard', 80.0, 0, 0, 0, 0, 'চাচকৈড় মোকামের প্রধান দেশি মাঘী সরিষা'),
(2, 'টোরি-৭ সরিষা', 'Tori-7 Mustard', 'mustard', 80.0, 0, 0, 0, 0, 'উন্নত জাতের টোরি-৭ সরিষা'),
(3, 'রাই সরিষা', 'Rai Mustard', 'mustard', 80.0, 0, 0, 0, 0, 'মোটা দানার রাই সরিষা'),
(4, 'শুকনা ভুট্টা', 'Dry Maize', 'maize', 75.0, 0, 0, 0, 0, 'চলনবিলের পরিষ্কার শুকনা হলুদ ভুট্টা'),
(5, 'কাঁচা/ভিজা ভুট্টা', 'Wet Maize', 'maize', 75.0, 0, 0, 0, 0, 'মাঠের তাজা আর্দ্র ভুট্টা'),
(6, 'তোষা পাট', 'Toshas Jute', 'jute', 0.0, 0, 0, 0, 0, 'উচ্চ গ্রেড সোনালী তোষা পাট (ওজনভিত্তিক)'),
(7, 'মেস্তা পাট', 'Mesta Jute', 'jute', 0.0, 0, 0, 0, 0, 'মোটা আঁশের মেস্তা পাট (ওজনভিত্তিক)'),
(8, 'দেশি/বগি পাট', 'Deshi/Bogi Jute', 'jute', 0.0, 0, 0, 0, 0, 'স্থানীয় দেশি বগি পাট (ওজনভিত্তিক)');

-- Initial settings
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
-- 11. Cloud Backup Logs (Telegram & Server Backups)
CREATE TABLE IF NOT EXISTS backup_logs (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'AUTO_SCHEDULED' or 'MANUAL_CLOUD'
  status TEXT NOT NULL,       -- 'SUCCESS' or 'FAILED'
  telegram_message_id TEXT,
  file_size_formatted TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON backup_logs(created_at DESC);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
('telegram_bot_token', '9038319945:AAFFZJoJvHaHdrhOuVP3QeEKKRjyFDx72Bk'),
('telegram_chat_id', '1904683489');

INSERT OR IGNORE INTO settings (key, value) VALUES
('telegram_bot_token', '9038319945:AAFFZJoJvHaHdrhOuVP3QeEKKRjyFDx72Bk'),
('telegram_chat_id', '1904683489');

-- 12. Bangladeshi Bulk SMS Gateway Logs & Configuration
CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT,
  party_name TEXT,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL, -- 'SENT' | 'FAILED' | 'SKIPPED'
  gateway_response TEXT,
  created_at TEXT DEFAULT (datetime('now', '+6 hours'))
);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);

INSERT OR IGNORE INTO settings (key, value) VALUES
('sms_enabled', 'true'),
('sms_provider', 'bulksmsbd'),
('sms_api_key', ''),
('sms_sender_id', ''),
('sms_custom_url', ''),
('sms_format_mode', 'banglish_1sms'),
('sms_send_on_due_collect', 'true'),
('gemini_api_key', '');

-- 13. Ai Manezar — Intelligent Business Manager, Memory & Live Design Overrides
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
  role TEXT NOT NULL, -- 'user' | 'model'
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
  overrideType TEXT NOT NULL, -- 'CSS_THEME' | 'UI_CONFIG' | 'CUSTOM_WIDGET'
  targetKey TEXT NOT NULL,
  content TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
