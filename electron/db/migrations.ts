import Database from 'better-sqlite3';

export const APP_VERSION = '1.5.0';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_core_schema',
    up: (db: Database.Database) => {
      // 1. Commodities
      db.exec(`
        CREATE TABLE IF NOT EXISTS commodities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name_bn TEXT NOT NULL UNIQUE,
          name_en TEXT NOT NULL,
          default_bag_weight_kg REAL NOT NULL DEFAULT 75.0,
          current_stock_kg REAL NOT NULL DEFAULT 0.0 CHECK(current_stock_kg >= 0),
          current_stock_bags INTEGER NOT NULL DEFAULT 0 CHECK(current_stock_bags >= 0),
          current_wac_per_kg REAL NOT NULL DEFAULT 0.0,
          current_wac_per_mon REAL NOT NULL DEFAULT 0.0,
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_commodities_name ON commodities(name_bn);

        -- Parties
        CREATE TABLE IF NOT EXISTS parties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          address TEXT NOT NULL,
          party_type TEXT NOT NULL CHECK(party_type IN ('SUPPLIER', 'BUYER', 'BOTH')),
          opening_balance REAL NOT NULL DEFAULT 0.0,
          current_balance REAL NOT NULL DEFAULT 0.0,
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_parties_name ON parties(name);
        CREATE INDEX IF NOT EXISTS idx_parties_phone ON parties(phone);
        CREATE INDEX IF NOT EXISTS idx_parties_type ON parties(party_type);

        -- Purchases
        CREATE TABLE IF NOT EXISTS purchases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_no TEXT NOT NULL UNIQUE,
          purchase_date TEXT NOT NULL,
          party_id INTEGER NOT NULL REFERENCES parties(id),
          commodity_id INTEGER NOT NULL REFERENCES commodities(id),
          bags_count INTEGER NOT NULL DEFAULT 0 CHECK(bags_count >= 0),
          gross_weight_kg REAL NOT NULL CHECK(gross_weight_kg >= 0),
          bag_deduction_kg REAL NOT NULL DEFAULT 0.0 CHECK(bag_deduction_kg >= 0),
          net_weight_kg REAL NOT NULL CHECK(net_weight_kg >= 0),
          net_weight_mon REAL NOT NULL CHECK(net_weight_mon >= 0),
          rate_per_mon REAL NOT NULL CHECK(rate_per_mon >= 0),
          gross_amount REAL NOT NULL CHECK(gross_amount >= 0),
          labor_cost REAL NOT NULL DEFAULT 0.0,
          transport_cost REAL NOT NULL DEFAULT 0.0,
          bag_cost REAL NOT NULL DEFAULT 0.0,
          other_cost REAL NOT NULL DEFAULT 0.0,
          total_landed_cost REAL NOT NULL CHECK(total_landed_cost >= 0),
          cost_per_mon REAL NOT NULL,
          cost_per_kg REAL NOT NULL,
          payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK', 'DUE', 'PARTIAL')),
          paid_amount REAL NOT NULL DEFAULT 0.0 CHECK(paid_amount >= 0),
          due_amount REAL NOT NULL DEFAULT 0.0 CHECK(due_amount >= 0),
          previous_wac_per_kg REAL NOT NULL DEFAULT 0.0,
          new_wac_per_kg REAL NOT NULL DEFAULT 0.0,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
        CREATE INDEX IF NOT EXISTS idx_purchases_party ON purchases(party_id);
        CREATE INDEX IF NOT EXISTS idx_purchases_commodity ON purchases(commodity_id);

        -- Sales
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_no TEXT NOT NULL UNIQUE,
          sale_date TEXT NOT NULL,
          party_id INTEGER NOT NULL REFERENCES parties(id),
          commodity_id INTEGER NOT NULL REFERENCES commodities(id),
          bags_count INTEGER NOT NULL DEFAULT 0 CHECK(bags_count >= 0),
          gross_weight_kg REAL NOT NULL CHECK(gross_weight_kg >= 0),
          bag_deduction_kg REAL NOT NULL DEFAULT 0.0 CHECK(bag_deduction_kg >= 0),
          net_weight_kg REAL NOT NULL CHECK(net_weight_kg >= 0),
          net_weight_mon REAL NOT NULL CHECK(net_weight_mon >= 0),
          rate_per_mon REAL NOT NULL CHECK(rate_per_mon >= 0),
          gross_amount REAL NOT NULL CHECK(gross_amount >= 0),
          loading_charge REAL NOT NULL DEFAULT 0.0,
          damaged_bag_deduction REAL NOT NULL DEFAULT 0.0,
          discount_amount REAL NOT NULL DEFAULT 0.0,
          net_invoice_amount REAL NOT NULL CHECK(net_invoice_amount >= 0),
          payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK', 'DUE', 'PARTIAL')),
          paid_amount REAL NOT NULL DEFAULT 0.0 CHECK(paid_amount >= 0),
          due_amount REAL NOT NULL DEFAULT 0.0 CHECK(due_amount >= 0),
          vehicle_no TEXT,
          driver_name TEXT,
          driver_phone TEXT,
          destination TEXT,
          cogs_amount REAL NOT NULL DEFAULT 0.0,
          realized_profit REAL NOT NULL DEFAULT 0.0,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
        CREATE INDEX IF NOT EXISTS idx_sales_party ON sales(party_id);
        CREATE INDEX IF NOT EXISTS idx_sales_commodity ON sales(commodity_id);

        -- Stock Adjustments
        CREATE TABLE IF NOT EXISTS stock_adjustments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          adjustment_date TEXT NOT NULL,
          commodity_id INTEGER NOT NULL REFERENCES commodities(id),
          adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('SHRINKAGE', 'DAMAGE', 'SPILLAGE', 'AUDIT_CORRECTION')),
          lost_weight_kg REAL NOT NULL CHECK(lost_weight_kg >= 0),
          lost_weight_mon REAL NOT NULL CHECK(lost_weight_mon >= 0),
          lost_bags INTEGER NOT NULL DEFAULT 0 CHECK(lost_bags >= 0),
          wac_at_time REAL NOT NULL,
          cost_value REAL NOT NULL,
          reason TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_adjustments_date ON stock_adjustments(adjustment_date);

        -- Party Ledger
        CREATE TABLE IF NOT EXISTS party_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_date TEXT NOT NULL,
          party_id INTEGER NOT NULL REFERENCES parties(id),
          transaction_type TEXT NOT NULL CHECK(transaction_type IN ('PURCHASE', 'SALE', 'PAYMENT_RECEIVED', 'PAYMENT_GIVEN', 'ADJUSTMENT', 'OPENING')),
          reference_id INTEGER,
          reference_no TEXT,
          debit REAL NOT NULL DEFAULT 0.0 CHECK(debit >= 0),
          credit REAL NOT NULL DEFAULT 0.0 CHECK(credit >= 0),
          running_balance REAL NOT NULL,
          description TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_ledger_party_date ON party_ledger(party_id, entry_date);

        -- Cashbook
        CREATE TABLE IF NOT EXISTS cashbook (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_date TEXT NOT NULL,
          entry_type TEXT NOT NULL CHECK(entry_type IN ('INFLOW', 'OUTFLOW')),
          category TEXT NOT NULL,
          amount REAL NOT NULL CHECK(amount >= 0),
          payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_mode IN ('CASH', 'BANK')),
          reference_id INTEGER,
          reference_no TEXT,
          party_id INTEGER REFERENCES parties(id),
          description TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook(entry_date);

        -- Expenses
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_date TEXT NOT NULL,
          category TEXT NOT NULL CHECK(category IN ('RENT', 'ELECTRICITY', 'SALARY', 'LABOR', 'FOOD_ENTERTAINMENT', 'TRANSPORT', 'REPAIR', 'TAX_LEGAL', 'MISC')),
          amount REAL NOT NULL CHECK(amount >= 0),
          paid_to TEXT NOT NULL,
          payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_mode IN ('CASH', 'BANK')),
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

        -- App Settings
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        -- Default Commodities Seeds
        INSERT OR IGNORE INTO commodities (id, name_bn, name_en, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon, notes) VALUES
        (1, 'সরিষা (মাঘি/টোরি)', 'Mustard (Maghi/Tori)', 80.0, 0, 0, 0, 0, 'চাঁচকৈড় মোকামের প্রধান রবি শস্য'),
        (2, 'ভুট্টা (হলুদ দানাদার)', 'Corn (Yellow Grain)', 75.0, 0, 0, 0, 0, 'নাটোর-পাবনা অঞ্চলের উচ্চ ফলনশীল ভুট্টা'),
        (3, 'তোষা পাট', 'Toshas Jute', 70.0, 0, 0, 0, 0, 'উচ্চ গ্রেড সোনালী তোষা পাট'),
        (4, 'গম (বারি-২৮/৩৩)', 'Wheat (BARI-28/33)', 85.0, 0, 0, 0, 0, 'চাক্কি ও মিল গ্রেড সাদা গম'),
        (5, 'আমন ধান (ব্রি-৪৯/স্বর্ণা)', 'Aman Paddy (BR-49/Swarna)', 75.0, 0, 0, 0, 0, 'চলনবিল অঞ্চলের আমন ধান'),
        (6, 'বোরো ধান (মিনিকেট/কাটারী)', 'Boro Paddy (Miniket/Katari)', 75.0, 0, 0, 0, 0, 'চলনবিলের সুগন্ধি ও চিকন ধান'),
        (7, 'খেশারী কলাই', 'Grass Pea (Khesari)', 85.0, 0, 0, 0, 0, 'স্থানীয় চাষীদের খেশারী ডাল/কলাই'),
        (8, 'মসুর ডাল (দেশি)', 'Lentil (Deshi)', 85.0, 0, 0, 0, 0, 'নাটোর অঞ্চলের দেশি মসুর');

        -- Default settings
        INSERT OR IGNORE INTO app_settings (key, value) VALUES
        ('org_name', 'মাহা এন্টারপ্রাইজ'),
        ('proprietor', 'মোঃ আব্দুর রশিদ সরকার এন্ড সন্স'),
        ('contacts', 'আলজাবির: 01711054499 | আব্দুর রশিদ: 01711703241'),
        ('location', 'চাঁচকৈড় বাজার, গুরুদাসপুর, নাটোর'),
        ('auto_backup_on_exit', 'true'),
        ('default_backup_dir', ''),
        ('mon_kg_rate', '40'),
        ('app_version', '1.0.0'),
        ('theme_mode', 'light');
      `);
    },
  },
  {
    version: 2,
    name: '002_semantic_versioning_and_theme_persistence',
    up: (db: Database.Database) => {
      db.exec(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app_version', '${APP_VERSION}');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('theme_mode', 'light');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('digit_display', 'BN');
      `);
    },
  },
  {
    version: 3,
    name: '003_stock_and_ledger_integrity_constraints',
    up: (db: Database.Database) => {
      // Ensure triggers or checks exist to prevent negative stock updates
      db.exec(`
        -- Trigger to ensure commodities current_stock_kg cannot become negative
        CREATE TRIGGER IF NOT EXISTS trg_prevent_negative_commodity_stock
        BEFORE UPDATE OF current_stock_kg ON commodities
        FOR EACH ROW
        WHEN NEW.current_stock_kg < 0
        BEGIN
          SELECT RAISE(ABORT, 'গুদামে পর্যাপ্ত মজুত নেই! নেতিবাচক স্টক এন্ট্রি অনুমোদিত নয়।');
        END;
      `);
    },
  },
  {
    version: 4,
    name: '004_security_pin_and_version_update',
    up: (db: Database.Database) => {
      db.exec(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app_version', '${APP_VERSION}');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('app_pin', '5555');
        INSERT OR IGNORE INTO app_settings (key, value) VALUES ('auto_lock_minutes', '30');
      `);
    },
  },
  {
    version: 5,
    name: '005_party_pinning_and_smart_sorting',
    up: (db: Database.Database) => {
      const tableInfo = db.prepare("PRAGMA table_info(parties)").all() as { name: string }[];
      const hasIsPinned = tableInfo.some((col) => col.name === 'is_pinned');
      if (!hasIsPinned) {
        db.exec("ALTER TABLE parties ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;");
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_parties_pinned_updated ON parties(is_pinned, updated_at DESC);");
    },
  },
  {
    version: 6,
    name: '006_dedicated_notebook_table',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT,
          category TEXT DEFAULT 'সাধারণ',
          is_pinned INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes(is_pinned DESC, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);
      `);
    },
  },
  {
    version: 7,
    name: '007_test_drafts_and_reconciliation',
    up: (db: Database.Database) => {
      const addColIfNotExists = (table: string, col: string, def: string) => {
        const info = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
        if (!info.some((c) => c.name === col)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
        }
      };

      addColIfNotExists('purchases', 'is_test_draft', 'INTEGER NOT NULL DEFAULT 0');
      addColIfNotExists('sales', 'is_test_draft', 'INTEGER NOT NULL DEFAULT 0');
      addColIfNotExists('party_ledger', 'is_test_draft', 'INTEGER NOT NULL DEFAULT 0');
      addColIfNotExists('cashbook', 'is_test_draft', 'INTEGER NOT NULL DEFAULT 0');
      addColIfNotExists('expenses', 'is_test_draft', 'INTEGER NOT NULL DEFAULT 0');
      addColIfNotExists('parties', 'is_test_draft', 'INTEGER NOT NULL DEFAULT 0');

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_purchases_test_draft ON purchases(is_test_draft);
        CREATE INDEX IF NOT EXISTS idx_sales_test_draft ON sales(is_test_draft);
        CREATE INDEX IF NOT EXISTS idx_cashbook_test_draft ON cashbook(is_test_draft);
        CREATE INDEX IF NOT EXISTS idx_party_ledger_test_draft ON party_ledger(is_test_draft);
      `);
    },
  },
  {
    version: 8,
    name: '008_v1_4_0_pro_upgrade',
    up: (db: Database.Database) => {
      db.exec(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app_version', '1.4.0');
      `);
    },
  },
  {
    version: 9,
    name: '009_v1_5_0_pro_upgrade',
    up: (db: Database.Database) => {
      db.exec(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app_version', '${APP_VERSION}');
      `);
    },
  },
  {
    version: 10,
    name: '010_pos_due_ledger_notes_and_recycle_bin',
    up: (db: Database.Database) => {
      const addColIfNotExists = (tableName: string, colName: string, colDef: string) => {
        const pragma = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
        const exists = pragma.some(c => c.name === colName);
        if (!exists) {
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
        }
      };

      addColIfNotExists('sales', 'previous_due', 'REAL NOT NULL DEFAULT 0.0');
      addColIfNotExists('sales', 'remaining_due', 'REAL NOT NULL DEFAULT 0.0');
      addColIfNotExists('sales', 'truck_no', 'TEXT');
      addColIfNotExists('sales', 'transport_info', 'TEXT');
      addColIfNotExists('party_ledger', 'notes', 'TEXT');

      db.exec(`
        CREATE TABLE IF NOT EXISTS recycle_bin (
          id TEXT PRIMARY KEY,
          module_type TEXT NOT NULL,
          module_label TEXT NOT NULL,
          original_id TEXT NOT NULL,
          title TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0.0,
          payload_json TEXT NOT NULL,
          deleted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          expires_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_recycle_bin_expires ON recycle_bin(expires_at);
        CREATE INDEX IF NOT EXISTS idx_recycle_bin_module ON recycle_bin(module_type);

        DELETE FROM recycle_bin WHERE expires_at < datetime('now', 'localtime');
      `);
    },
  },
  {
    version: 9,
    name: 'multi_sector_and_purchase_scale_41kg',
    up: (db: Database.Database) => {
      const addColIfNotExists = (tableName: string, colName: string, colDef: string) => {
        const pragma = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
        const exists = pragma.some(c => c.name === colName);
        if (!exists) {
          db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
        }
      };

      addColIfNotExists('commodities', 'sector', "TEXT DEFAULT 'mustard'");
      addColIfNotExists('parties', 'sector', "TEXT DEFAULT 'mustard'");
      addColIfNotExists('purchases', 'sector', "TEXT DEFAULT 'mustard'");
      addColIfNotExists('purchases', 'purchase_scale_kg', 'REAL DEFAULT 41.0');
      addColIfNotExists('purchases', 'billed_maund', 'REAL DEFAULT 0.0');
      addColIfNotExists('purchases', 'actual_weight_kg', 'REAL DEFAULT 0.0');
      addColIfNotExists('purchases', 'extra_weight_kg', 'REAL DEFAULT 0.0');
      addColIfNotExists('sales', 'sector', "TEXT DEFAULT 'mustard'");
      addColIfNotExists('party_ledger', 'sector', "TEXT DEFAULT 'mustard'");
      addColIfNotExists('cashbook', 'sector', "TEXT DEFAULT 'mustard'");
      addColIfNotExists('expenses', 'sector', "TEXT DEFAULT 'general'");

      // Auto-categorize
      db.exec(`
        UPDATE commodities SET sector = 'jute' WHERE (name_bn LIKE '%পাট%' OR name_en LIKE '%jute%') AND (sector IS NULL OR sector = '' OR sector = 'mustard');
        UPDATE commodities SET sector = 'maize' WHERE (name_bn LIKE '%ভুট্টা%' OR name_en LIKE '%maize%' OR name_en LIKE '%corn%') AND (sector IS NULL OR sector = '' OR sector = 'mustard');
        UPDATE commodities SET sector = 'mustard' WHERE sector IS NULL OR sector = '';

        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('তোষা পাট', 'Toshas Jute', 'jute', 0.0);
        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('মেস্তা পাট', 'Mesta Jute', 'jute', 0.0);
        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('দেশি/বগি পাট', 'Deshi/Bogi Jute', 'jute', 0.0);
        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('শুকনা ভুট্টা', 'Dry Maize', 'maize', 75.0);
        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('কাঁচা/ভিজা ভুট্টা', 'Wet Maize', 'maize', 75.0);
        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('মাঘী সরিষা', 'Maghi Mustard', 'mustard', 80.0);
        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('টোরি-৭ সরিষা', 'Tori-7 Mustard', 'mustard', 80.0);
        INSERT OR IGNORE INTO commodities (name_bn, name_en, sector, default_bag_weight_kg) VALUES ('রাই সরিষা', 'Rai Mustard', 'mustard', 80.0);

        UPDATE purchases SET sector = (SELECT sector FROM commodities WHERE commodities.id = purchases.commodity_id) WHERE sector IS NULL OR sector = '' OR sector = 'mustard';
        UPDATE sales SET sector = (SELECT sector FROM commodities WHERE commodities.id = sales.commodity_id) WHERE sector IS NULL OR sector = '' OR sector = 'mustard';
      `);
    },
  },
];

export function runMigrations(db: Database.Database): { appliedCount: number; currentVersion: number } {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
  const appliedSet = new Set(appliedRows.map(r => r.version));

  let appliedCount = 0;
  let latestVersion = 0;

  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.version)) {
      const migrateTx = db.transaction(() => {
        console.log(`Applying migration ${migration.version}: ${migration.name}...`);
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
          migration.version,
          migration.name
        );
      });
      migrateTx();
      appliedCount++;
    }
    latestVersion = Math.max(latestVersion, migration.version);
  }

  // Update PRAGMA user_version to reflect latest schema version
  db.pragma(`user_version = ${latestVersion}`);

  return { appliedCount, currentVersion: latestVersion };
}

