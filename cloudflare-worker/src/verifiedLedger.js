/**
 * মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
 * Single-Source-of-Truth BST Accounting Engine with Multi-Sector Support (পাট, ভুট্টা, সরিষা)
 * Strict Asia/Dhaka (+06:00) normalization, active-record filtering, and 100% full-table sums (Zero LIMIT).
 */

const SCALE_MONEY = 100;
const SCALE_WEIGHT = 1000;

export function roundMoney(val) {
  const num = typeof val === 'string' ? parseFloat(val) || 0 : val || 0;
  return Math.round((num + Number.EPSILON) * SCALE_MONEY) / SCALE_MONEY;
}

export function roundWeight(val) {
  const num = typeof val === 'string' ? parseFloat(val) || 0 : val || 0;
  return Math.round((num + Number.EPSILON) * SCALE_WEIGHT) / SCALE_WEIGHT;
}

/**
 * Strict Bangladesh Standard Time (Asia/Dhaka, UTC+6) Date String: YYYY-MM-DD
 */
export function getBstDateString(date = new Date()) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d); // returns YYYY-MM-DD
}

/**
 * Strict check if any timestamp/date string matches target BST YYYY-MM-DD
 */
export function isSameBstDate(rawValue, targetBstYmd) {
  if (!rawValue || !targetBstYmd) return false;
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed === targetBstYmd;
    }
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      const d = new Date(trimmed.replace(' ', 'T') + 'Z');
      return getBstDateString(d) === targetBstYmd;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return getBstDateString(d) === targetBstYmd;
    }
  } else if (typeof rawValue === 'number') {
    const d = new Date(rawValue);
    if (!isNaN(d.getTime())) {
      return getBstDateString(d) === targetBstYmd;
    }
  }
  return false;
}

/**
 * Deterministic computeVerifiedBusinessLedger(db, inMemoryFallback, sector)
 * Single Source of Truth for Dashboard, Ai Manezar, Parity Audit and Telegram Reports.
 * Supports optional sector scoping ('jute' | 'maize' | 'mustard' | 'general' | 'all').
 */
export async function computeVerifiedBusinessLedger(db, inMemoryStore = null, sector = null) {
  const bstDate = getBstDateString();
  const bstTimestamp = new Date().toISOString();
  const isSectorScoped = Boolean(sector && sector !== 'all');

  // 1. D1 Database Mode
  if (db) {
    // 1.1 Warehouse Stock (Full-table scan across active commodities)
    const commSql = isSectorScoped
      ? `SELECT id, name_bn, name_en, sector, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon
         FROM commodities
         WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0 AND sector = ?
         ORDER BY id ASC`
      : `SELECT id, name_bn, name_en, sector, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon
         FROM commodities
         WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0
         ORDER BY id ASC`;
    const commStmt = isSectorScoped ? db.prepare(commSql).bind(sector) : db.prepare(commSql);
    const { results: rawComms } = await commStmt.all().catch(() => ({ results: [] }));

    let totalBags = 0;
    let totalWeightKg = 0;
    let totalValuation = 0;

    const varieties = (rawComms || []).map((c) => {
      const kg = Number(c.current_stock_kg) || 0;
      const isJute = c.sector === 'jute' || (c.name_bn && c.name_bn.includes('পাট'));
      const bags = isJute ? 0 : (Number(c.current_stock_bags) || 0);
      const wacKg = Number(c.current_wac_per_kg) || 0;
      const wacMon = Number(c.current_wac_per_mon) || (wacKg * 40.0);
      const maund = roundWeight(kg / 40.0);
      const valuation = roundMoney(kg * wacKg);

      totalBags += bags;
      totalWeightKg += kg;
      totalValuation += valuation;

      let status = 'পর্যাপ্ত';
      if (maund <= 0) {
        status = 'স্টক নেই';
      } else if (maund < 25) {
        status = 'স্বল্প স্টক';
      }

      return {
        id: c.id,
        name: c.name_bn,
        name_en: c.name_en,
        sector: c.sector || (isJute ? 'jute' : 'mustard'),
        isJute,
        bags,
        bagsDisplay: isJute ? '— (ওজনভিত্তিক)' : `${bags} বস্তা`,
        weightKg: roundWeight(kg),
        maund,
        avgRatePerMon: roundMoney(wacMon),
        avgRatePerKg: roundMoney(wacKg),
        valuation,
        status,
      };
    });

    const warehouseStock = {
      totalBags,
      totalWeightKg: roundWeight(totalWeightKg),
      totalMaund: roundWeight(totalWeightKg / 40.0),
      totalValuation: roundMoney(totalValuation),
      categories: varieties,
    };

    // 1.2 Customer Dues (বাকি খাতা) & Supplier Payables (মহাজন দেনা)
    // 100% full-table query without LIMIT before summing
    const partySql = isSectorScoped
      ? `SELECT id, name, phone, address, party_type, sector, opening_balance, current_balance, is_pinned
         FROM parties
         WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_test_draft, 0) = 0 AND sector = ?
         ORDER BY is_pinned DESC, ABS(current_balance) DESC, id ASC`
      : `SELECT id, name, phone, address, party_type, sector, opening_balance, current_balance, is_pinned
         FROM parties
         WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0 AND COALESCE(is_test_draft, 0) = 0
         ORDER BY is_pinned DESC, ABS(current_balance) DESC, id ASC`;
    const partyStmt = isSectorScoped ? db.prepare(partySql).bind(sector) : db.prepare(partySql);
    const { results: allParties } = await partyStmt.all().catch(() => ({ results: [] }));

    let totalReceivable = 0;
    let activeCustomerCount = 0;
    let customersWithDueCount = 0;
    const allActiveCustomerDues = [];

    let totalPayable = 0;
    let activeSupplierCount = 0;
    let suppliersWithPayableCount = 0;
    const allActiveSupplierPayables = [];

    (allParties || []).forEach((p) => {
      const isBuyer = p.party_type === 'BUYER' || p.party_type === 'BOTH';
      const isSupplier = p.party_type === 'SUPPLIER' || p.party_type === 'BOTH';
      const bal = Number(p.current_balance || 0);

      if (isBuyer) {
        activeCustomerCount++;
        if (bal > 0) {
          customersWithDueCount++;
          totalReceivable += bal;
          allActiveCustomerDues.push({
            id: p.id,
            n: p.name,
            d: roundMoney(bal),
            p: p.phone || '',
            a: p.address || '',
            sector: p.sector || 'mustard',
          });
        }
      }

      if (isSupplier) {
        activeSupplierCount++;
        const payable = bal < 0 ? Math.abs(bal) : (p.party_type === 'SUPPLIER' && bal === 0 && Number(p.opening_balance || 0) < 0 ? Math.abs(Number(p.opening_balance)) : 0);
        if (payable > 0) {
          suppliersWithPayableCount++;
          totalPayable += payable;
          allActiveSupplierPayables.push({
            id: p.id,
            n: p.name,
            d: roundMoney(payable),
            p: p.phone || '',
            a: p.address || '',
            sector: p.sector || 'mustard',
          });
        }
      }
    });

    const customerDues = {
      totalReceivable: roundMoney(totalReceivable),
      activeCustomerCount,
      customersWithDueCount,
      topDueCustomers: allActiveCustomerDues.slice(0, 20),
      allActiveCustomerDues,
    };

    const supplierPayables = {
      totalPayable: roundMoney(totalPayable),
      activeSupplierCount,
      suppliersWithPayableCount,
      topSuppliers: allActiveSupplierPayables.slice(0, 20),
      allActiveSupplierPayables,
    };

    // 1.3 Today's Sales (F3)
    const salesSql = isSectorScoped
      ? `SELECT s.*, p.name as party_name, c.name_bn as commodity_name, c.sector as comm_sector
         FROM sales s
         LEFT JOIN parties p ON s.party_id = p.id
         LEFT JOIN commodities c ON s.commodity_id = c.id
         WHERE COALESCE(s.is_test_draft, 0) = 0
           AND COALESCE(s.is_deleted, 0) = 0
           AND (s.sale_date = ? OR s.sale_date LIKE ?)
           AND (s.sector = ? OR (s.sector IS NULL AND c.sector = ?))
         ORDER BY s.id DESC`
      : `SELECT s.*, p.name as party_name, c.name_bn as commodity_name, c.sector as comm_sector
         FROM sales s
         LEFT JOIN parties p ON s.party_id = p.id
         LEFT JOIN commodities c ON s.commodity_id = c.id
         WHERE COALESCE(s.is_test_draft, 0) = 0
           AND COALESCE(s.is_deleted, 0) = 0
           AND (s.sale_date = ? OR s.sale_date LIKE ?)
         ORDER BY s.id DESC`;
    const salesStmt = isSectorScoped
      ? db.prepare(salesSql).bind(bstDate, `${bstDate}%`, sector, sector)
      : db.prepare(salesSql).bind(bstDate, `${bstDate}%`);
    const { results: rawSales } = await salesStmt.all().catch(() => ({ results: [] }));

    let saleTotal = 0;
    let saleCash = 0;
    let saleDue = 0;
    let saleBags = 0;
    let saleWeightKg = 0;

    const formattedSales = (rawSales || []).map((s) => {
      const netAmt = Number(s.net_invoice_amount || s.gross_amount || 0);
      const paid = Number(s.paid_amount || 0);
      const due = Number(s.due_amount || 0);
      const isJute = s.sector === 'jute' || (s.commodity_name && s.commodity_name.includes('পাট'));
      const bags = isJute ? 0 : Number(s.bags_count || 0);
      const kg = Number(s.net_weight_kg || 0);

      saleTotal += netAmt;
      saleCash += paid;
      saleDue += due;
      saleBags += bags;
      saleWeightKg += kg;

      return {
        id: s.id,
        invoiceNo: s.invoice_no,
        partyName: s.party_name || 'সাধারণ খুচরা ক্রেতা',
        commodityName: s.commodity_name || '',
        sector: s.sector || (isJute ? 'jute' : 'mustard'),
        isJute,
        bags,
        bagsDisplay: isJute ? '— (ওজনভিত্তিক)' : `${bags} বস্তা`,
        weightMon: roundWeight(s.net_weight_mon || (kg / 40.0)),
        weightKg: roundWeight(kg),
        ratePerMon: roundMoney(s.rate_per_mon || 0),
        netAmount: roundMoney(netAmt),
        paidAmount: roundMoney(paid),
        dueAmount: roundMoney(due),
        paymentMethod: s.payment_method || 'CASH',
        truckNo: s.truck_no || s.vehicle_no || '',
        driverName: s.driver_name || '',
        driverPhone: s.driver_phone || '',
        transportInfo: s.transport_info || s.destination || '',
      };
    });

    const todaySales = {
      totalAmount: roundMoney(saleTotal),
      cashAmount: roundMoney(saleCash),
      dueAmount: roundMoney(saleDue),
      totalBags: saleBags,
      totalWeightKg: roundWeight(saleWeightKg),
      totalWeightMon: roundWeight(saleWeightKg / 40.0),
      invoiceCount: formattedSales.length,
      invoices: formattedSales,
    };

    // 1.4 Today's Purchases (F2)
    const purSql = isSectorScoped
      ? `SELECT pr.*, p.name as party_name, c.name_bn as commodity_name, c.sector as comm_sector
         FROM purchases pr
         LEFT JOIN parties p ON pr.party_id = p.id
         LEFT JOIN commodities c ON pr.commodity_id = c.id
         WHERE COALESCE(pr.is_test_draft, 0) = 0
           AND COALESCE(pr.is_deleted, 0) = 0
           AND (pr.purchase_date = ? OR pr.purchase_date LIKE ?)
           AND (pr.sector = ? OR (pr.sector IS NULL AND c.sector = ?))
         ORDER BY pr.id DESC`
      : `SELECT pr.*, p.name as party_name, c.name_bn as commodity_name, c.sector as comm_sector
         FROM purchases pr
         LEFT JOIN parties p ON pr.party_id = p.id
         LEFT JOIN commodities c ON pr.commodity_id = c.id
         WHERE COALESCE(pr.is_test_draft, 0) = 0
           AND COALESCE(pr.is_deleted, 0) = 0
           AND (pr.purchase_date = ? OR pr.purchase_date LIKE ?)
         ORDER BY pr.id DESC`;
    const purStmt = isSectorScoped
      ? db.prepare(purSql).bind(bstDate, `${bstDate}%`, sector, sector)
      : db.prepare(purSql).bind(bstDate, `${bstDate}%`);
    const { results: rawPurchases } = await purStmt.all().catch(() => ({ results: [] }));

    let purTotal = 0;
    let purPaid = 0;
    let purDue = 0;
    let purBags = 0;
    let purWeightKg = 0;

    const formattedPurchases = (rawPurchases || []).map((pr) => {
      const landed = Number(pr.total_landed_cost || pr.gross_amount || 0);
      const paid = Number(pr.paid_amount || 0);
      const due = Number(pr.due_amount || 0);
      const isJute = pr.sector === 'jute' || (pr.commodity_name && pr.commodity_name.includes('পাট'));
      const bags = isJute ? 0 : Number(pr.bags_count || 0);
      const kg = Number(pr.net_weight_kg || pr.actual_weight_kg || 0);

      purTotal += landed;
      purPaid += paid;
      purDue += due;
      purBags += bags;
      purWeightKg += kg;

      return {
        id: pr.id,
        invoiceNo: pr.invoice_no,
        partyName: pr.party_name || 'সাধারণ বিক্রেতা',
        commodityName: pr.commodity_name || '',
        sector: pr.sector || (isJute ? 'jute' : 'mustard'),
        isJute,
        bags,
        bagsDisplay: isJute ? '— (ওজনভিত্তিক)' : `${bags} বস্তা`,
        purchaseScaleKg: Number(pr.purchase_scale_kg || 41.0),
        billedMaund: roundWeight(Number(pr.billed_maund || 0)),
        actualWeightKg: roundWeight(kg),
        extraWeightKg: roundWeight(Number(pr.extra_weight_kg || 0)),
        weightMon: roundWeight(pr.net_weight_mon || (kg / 40.0)),
        weightKg: roundWeight(kg),
        ratePerMon: roundMoney(pr.rate_per_mon || 0),
        totalAmount: roundMoney(landed),
        paidAmount: roundMoney(paid),
        dueAmount: roundMoney(due),
        paymentMethod: pr.payment_method || 'CASH',
      };
    });

    const todayPurchases = {
      totalAmount: roundMoney(purTotal),
      paidAmount: roundMoney(purPaid),
      dueAmount: roundMoney(purDue),
      totalBags: purBags,
      totalWeightKg: roundWeight(purWeightKg),
      totalWeightMon: roundWeight(purWeightKg / 40.0),
      purchaseCount: formattedPurchases.length,
      purchases: formattedPurchases,
    };

    // 1.5 Today's Expenses (পরিচালন খরচ)
    const expSql = isSectorScoped
      ? `SELECT * FROM expenses
         WHERE COALESCE(is_test_draft, 0) = 0
           AND COALESCE(is_deleted, 0) = 0
           AND (expense_date = ? OR expense_date LIKE ?)
           AND (sector = ? OR sector = 'general' OR sector IS NULL)
         ORDER BY id DESC`
      : `SELECT * FROM expenses
         WHERE COALESCE(is_test_draft, 0) = 0
           AND COALESCE(is_deleted, 0) = 0
           AND (expense_date = ? OR expense_date LIKE ?)
         ORDER BY id DESC`;
    const expStmt = isSectorScoped
      ? db.prepare(expSql).bind(bstDate, `${bstDate}%`, sector)
      : db.prepare(expSql).bind(bstDate, `${bstDate}%`);
    const { results: rawExpenses } = await expStmt.all().catch(() => ({ results: [] }));

    let expTotal = 0;
    const formattedExpenses = (rawExpenses || []).map((e) => {
      const amt = Number(e.amount || 0);
      expTotal += amt;
      return {
        id: e.id,
        category: e.category,
        amount: roundMoney(amt),
        paidTo: e.paid_to || '',
        paymentMode: e.payment_mode || 'CASH',
        sector: e.sector || 'general',
        notes: e.notes || '',
      };
    });

    const todayExpenses = {
      totalAmount: roundMoney(expTotal),
      count: formattedExpenses.length,
      items: formattedExpenses,
    };

    // 1.6 Daily Cash Book (F4)
    let openingBalance = null;

    if (!isSectorScoped) {
      // Check cashbook_overrides
      try {
        const override = await db.prepare('SELECT opening_balance FROM cashbook_overrides WHERE entry_date = ?').bind(bstDate).first();
        if (override && override.opening_balance !== null && override.opening_balance !== undefined) {
          openingBalance = Number(override.opening_balance);
        }
      } catch (_) {}

      // Check settings fallback
      if (openingBalance === null) {
        try {
          const s = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(`cashbook_opening_${bstDate}`).first();
          if (s && s.value !== null && s.value !== undefined) {
            openingBalance = Number(s.value);
          }
        } catch (_) {}
      }
    }

    // Compute from prior entries if no manual override
    if (openingBalance === null) {
      const priorSql = isSectorScoped
        ? `SELECT
             COALESCE(SUM(CASE WHEN entry_type = 'INFLOW' THEN amount ELSE 0 END), 0) as inf,
             COALESCE(SUM(CASE WHEN entry_type = 'OUTFLOW' THEN amount ELSE 0 END), 0) as outf
           FROM cashbook
           WHERE entry_date < ? AND COALESCE(is_test_draft, 0) = 0 AND COALESCE(is_deleted, 0) = 0
             AND (sector = ? OR sector = 'general' OR sector IS NULL)`
        : `SELECT
             COALESCE(SUM(CASE WHEN entry_type = 'INFLOW' THEN amount ELSE 0 END), 0) as inf,
             COALESCE(SUM(CASE WHEN entry_type = 'OUTFLOW' THEN amount ELSE 0 END), 0) as outf
           FROM cashbook
           WHERE entry_date < ? AND COALESCE(is_test_draft, 0) = 0 AND COALESCE(is_deleted, 0) = 0`;
      const priorStmt = isSectorScoped ? db.prepare(priorSql).bind(bstDate, sector) : db.prepare(priorSql).bind(bstDate);
      const prior = await priorStmt.first().catch(() => ({ inf: 0, outf: 0 }));
      openingBalance = roundMoney((prior?.inf || 0) - (prior?.outf || 0));
    }

    const todayCashSql = isSectorScoped
      ? `SELECT
           COALESCE(SUM(CASE WHEN entry_type = 'INFLOW' THEN amount ELSE 0 END), 0) as today_in,
           COALESCE(SUM(CASE WHEN entry_type = 'OUTFLOW' THEN amount ELSE 0 END), 0) as today_out
         FROM cashbook
         WHERE entry_date = ? AND COALESCE(is_test_draft, 0) = 0 AND COALESCE(is_deleted, 0) = 0
           AND (sector = ? OR sector = 'general' OR sector IS NULL)`
      : `SELECT
           COALESCE(SUM(CASE WHEN entry_type = 'INFLOW' THEN amount ELSE 0 END), 0) as today_in,
           COALESCE(SUM(CASE WHEN entry_type = 'OUTFLOW' THEN amount ELSE 0 END), 0) as today_out
         FROM cashbook
         WHERE entry_date = ? AND COALESCE(is_test_draft, 0) = 0 AND COALESCE(is_deleted, 0) = 0`;
    const todayCashStmt = isSectorScoped ? db.prepare(todayCashSql).bind(bstDate, sector) : db.prepare(todayCashSql).bind(bstDate);
    const todayCashbook = await todayCashStmt.first().catch(() => ({ today_in: 0, today_out: 0 }));

    const todayCashIn = roundMoney(todayCashbook?.today_in || 0);
    const todayCashOut = roundMoney(todayCashbook?.today_out || 0);
    const netCashToday = roundMoney(todayCashIn - todayCashOut);
    const liveCashBalance = roundMoney(openingBalance + netCashToday);

    const dailyCashBook = {
      openingBalance: roundMoney(openingBalance),
      todayCashIn,
      todayCashOut,
      netCashToday,
      liveCashBalance,
    };

    return {
      bstDate,
      bstTimestamp,
      sector: sector || 'all',
      warehouseStock,
      customerDues,
      supplierPayables,
      todaySales,
      todayPurchases,
      todayExpenses,
      dailyCashBook,
    };
  }

  // 2. In-Memory Store Fallback
  const mem = inMemoryStore || {};
  let comms = mem.commodities || [];
  if (isSectorScoped) {
    comms = comms.filter(c => c.sector === sector);
  }

  let totalBags = 0;
  let totalWeightKg = 0;
  let totalValuation = 0;

  const varieties = comms.filter((c) => c.is_active !== 0 && !c.is_deleted).map((c) => {
    const kg = Number(c.current_stock_kg) || 0;
    const isJute = c.sector === 'jute' || (c.name_bn && c.name_bn.includes('পাট'));
    const bags = isJute ? 0 : (Number(c.current_stock_bags) || 0);
    const wacKg = Number(c.current_wac_per_kg) || 0;
    const wacMon = Number(c.current_wac_per_mon) || (wacKg * 40.0);
    const maund = roundWeight(kg / 40.0);
    const valuation = roundMoney(kg * wacKg);

    totalBags += bags;
    totalWeightKg += kg;
    totalValuation += valuation;

    return {
      id: c.id,
      name: c.name_bn,
      name_en: c.name_en,
      sector: c.sector || (isJute ? 'jute' : 'mustard'),
      isJute,
      bags,
      bagsDisplay: isJute ? '— (ওজনভিত্তিক)' : `${bags} বস্তা`,
      weightKg: roundWeight(kg),
      maund,
      avgRatePerMon: roundMoney(wacMon),
      avgRatePerKg: roundMoney(wacKg),
      valuation,
      status: maund <= 0 ? 'স্টক নেই' : (maund < 25 ? 'স্বল্প স্টক' : 'পর্যাপ্ত'),
    };
  });

  const warehouseStock = {
    totalBags,
    totalWeightKg: roundWeight(totalWeightKg),
    totalMaund: roundWeight(totalWeightKg / 40.0),
    totalValuation: roundMoney(totalValuation),
    categories: varieties,
  };

  let parties = mem.parties || [];
  if (isSectorScoped) {
    parties = parties.filter(p => p.sector === sector);
  }

  let totalReceivable = 0;
  let activeCustomerCount = 0;
  let customersWithDueCount = 0;
  const allActiveCustomerDues = [];

  let totalPayable = 0;
  let activeSupplierCount = 0;
  let suppliersWithPayableCount = 0;
  const allActiveSupplierPayables = [];

  parties.filter((p) => p.is_active !== 0 && !p.is_deleted && !p.is_test_draft).forEach((p) => {
    const isBuyer = p.party_type === 'BUYER' || p.party_type === 'BOTH';
    const isSupplier = p.party_type === 'SUPPLIER' || p.party_type === 'BOTH';
    const bal = Number(p.current_balance || 0);

    if (isBuyer) {
      activeCustomerCount++;
      if (bal > 0) {
        customersWithDueCount++;
        totalReceivable += bal;
        allActiveCustomerDues.push({
          id: p.id,
          n: p.name,
          d: roundMoney(bal),
          p: p.phone || '',
          a: p.address || '',
          sector: p.sector || 'mustard',
        });
      }
    }

    if (isSupplier) {
      activeSupplierCount++;
      const payable = bal < 0 ? Math.abs(bal) : (p.party_type === 'SUPPLIER' && bal === 0 && Number(p.opening_balance || 0) < 0 ? Math.abs(Number(p.opening_balance)) : 0);
      if (payable > 0) {
        suppliersWithPayableCount++;
        totalPayable += payable;
        allActiveSupplierPayables.push({
          id: p.id,
          n: p.name,
          d: roundMoney(payable),
          p: p.phone || '',
          a: p.address || '',
          sector: p.sector || 'mustard',
        });
      }
    }
  });

  const customerDues = {
    totalReceivable: roundMoney(totalReceivable),
    activeCustomerCount,
    customersWithDueCount,
    topDueCustomers: allActiveCustomerDues.slice(0, 20),
    allActiveCustomerDues,
  };

  const supplierPayables = {
    totalPayable: roundMoney(totalPayable),
    activeSupplierCount,
    suppliersWithPayableCount,
    topSuppliers: allActiveSupplierPayables.slice(0, 20),
    allActiveSupplierPayables,
  };

  let sales = (mem.sales || []).filter((s) => !s.is_test_draft && !s.is_deleted && isSameBstDate(s.sale_date, bstDate));
  if (isSectorScoped) {
    sales = sales.filter((s) => s.sector === sector);
  }
  let saleTotal = 0;
  let saleCash = 0;
  let saleDue = 0;
  let saleBags = 0;
  let saleWeightKg = 0;

  const formattedSales = sales.map((s) => {
    const netAmt = Number(s.net_invoice_amount || s.gross_amount || 0);
    const paid = Number(s.paid_amount || 0);
    const due = Number(s.due_amount || 0);
    const isJute = s.sector === 'jute' || (s.commodity_name && s.commodity_name.includes('পাট'));
    const bags = isJute ? 0 : Number(s.bags_count || 0);
    const kg = Number(s.net_weight_kg || 0);

    saleTotal += netAmt;
    saleCash += paid;
    saleDue += due;
    saleBags += bags;
    saleWeightKg += kg;

    return {
      id: s.id,
      invoiceNo: s.invoice_no,
      partyName: s.party_name || 'সাধারণ খুচরা ক্রেতা',
      commodityName: s.commodity_name || '',
      sector: s.sector || (isJute ? 'jute' : 'mustard'),
      isJute,
      bags,
      bagsDisplay: isJute ? '— (ওজনভিত্তিক)' : `${bags} বস্তা`,
      weightMon: roundWeight(s.net_weight_mon || (kg / 40.0)),
      weightKg: roundWeight(kg),
      ratePerMon: roundMoney(s.rate_per_mon || 0),
      netAmount: roundMoney(netAmt),
      paidAmount: roundMoney(paid),
      dueAmount: roundMoney(due),
      paymentMethod: s.payment_method || 'CASH',
      truckNo: s.truck_no || s.vehicle_no || '',
      driverName: s.driver_name || '',
      driverPhone: s.driver_phone || '',
      transportInfo: s.transport_info || s.destination || '',
    };
  });

  const todaySales = {
    totalAmount: roundMoney(saleTotal),
    cashAmount: roundMoney(saleCash),
    dueAmount: roundMoney(saleDue),
    totalBags: saleBags,
    totalWeightKg: roundWeight(saleWeightKg),
    totalWeightMon: roundWeight(saleWeightKg / 40.0),
    invoiceCount: formattedSales.length,
    invoices: formattedSales,
  };

  let purchases = (mem.purchases || []).filter((p) => !p.is_test_draft && !p.is_deleted && isSameBstDate(p.purchase_date, bstDate));
  if (isSectorScoped) {
    purchases = purchases.filter((p) => p.sector === sector);
  }
  let purTotal = 0;
  let purPaid = 0;
  let purDue = 0;
  let purBags = 0;
  let purWeightKg = 0;

  const formattedPurchases = purchases.map((pr) => {
    const landed = Number(pr.total_landed_cost || pr.gross_amount || 0);
    const paid = Number(pr.paid_amount || 0);
    const due = Number(pr.due_amount || 0);
    const isJute = pr.sector === 'jute' || (pr.commodity_name && pr.commodity_name.includes('পাট'));
    const bags = isJute ? 0 : Number(pr.bags_count || 0);
    const kg = Number(pr.net_weight_kg || pr.actual_weight_kg || 0);

    purTotal += landed;
    purPaid += paid;
    purDue += due;
    purBags += bags;
    purWeightKg += kg;

    return {
      id: pr.id,
      invoiceNo: pr.invoice_no,
      partyName: pr.party_name || 'সাধারণ বিক্রেতা',
      commodityName: pr.commodity_name || '',
      sector: pr.sector || (isJute ? 'jute' : 'mustard'),
      isJute,
      bags,
      bagsDisplay: isJute ? '— (ওজনভিত্তিক)' : `${bags} বস্তা`,
      purchaseScaleKg: Number(pr.purchase_scale_kg || 41.0),
      billedMaund: roundWeight(Number(pr.billed_maund || 0)),
      actualWeightKg: roundWeight(kg),
      extraWeightKg: roundWeight(Number(pr.extra_weight_kg || 0)),
      weightMon: roundWeight(pr.net_weight_mon || (kg / 40.0)),
      weightKg: roundWeight(kg),
      ratePerMon: roundMoney(pr.rate_per_mon || 0),
      totalAmount: roundMoney(landed),
      paidAmount: roundMoney(paid),
      dueAmount: roundMoney(due),
      paymentMethod: pr.payment_method || 'CASH',
    };
  });

  const todayPurchases = {
    totalAmount: roundMoney(purTotal),
    paidAmount: roundMoney(purPaid),
    dueAmount: roundMoney(purDue),
    totalBags: purBags,
    totalWeightKg: roundWeight(purWeightKg),
    totalWeightMon: roundWeight(purWeightKg / 40.0),
    purchaseCount: formattedPurchases.length,
    purchases: formattedPurchases,
  };

  let expenses = (mem.expenses || []).filter((e) => !e.is_test_draft && !e.is_deleted && isSameBstDate(e.expense_date, bstDate));
  if (isSectorScoped) {
    expenses = expenses.filter((e) => e.sector === sector || e.sector === 'general');
  }
  let expTotal = 0;
  const formattedExpenses = expenses.map((e) => {
    const amt = Number(e.amount || 0);
    expTotal += amt;
    return {
      id: e.id,
      category: e.category,
      amount: roundMoney(amt),
      paidTo: e.paid_to || '',
      paymentMode: e.payment_mode || 'CASH',
      sector: e.sector || 'general',
      notes: e.notes || '',
    };
  });

  const todayExpenses = {
    totalAmount: roundMoney(expTotal),
    count: formattedExpenses.length,
    items: formattedExpenses,
  };

  let openingBalance = 0;
  (mem.cashbook || []).filter((c) => !c.is_test_draft && !c.is_deleted && (!isSectorScoped || c.sector === sector || c.sector === 'general')).forEach((c) => {
    if (c.entry_date < bstDate) {
      if (c.entry_type === 'INFLOW') openingBalance += Number(c.amount || 0);
      else if (c.entry_type === 'OUTFLOW') openingBalance -= Number(c.amount || 0);
    }
  });

  let todayCashIn = 0;
  let todayCashOut = 0;
  (mem.cashbook || []).filter((c) => !c.is_test_draft && isSameBstDate(c.entry_date, bstDate) && (!isSectorScoped || !c.sector || c.sector === sector || c.sector === 'general')).forEach((c) => {
    if (c.entry_type === 'INFLOW') todayCashIn += Number(c.amount || 0);
    else if (c.entry_type === 'OUTFLOW') todayCashOut += Number(c.amount || 0);
  });

  const dailyCashBook = {
    openingBalance: roundMoney(openingBalance),
    todayCashIn: roundMoney(todayCashIn),
    todayCashOut: roundMoney(todayCashOut),
    netCashToday: roundMoney(todayCashIn - todayCashOut),
    liveCashBalance: roundMoney(openingBalance + todayCashIn - todayCashOut),
  };

  return {
    bstDate,
    bstTimestamp,
    sector: sector || 'all',
    warehouseStock,
    customerDues,
    supplierPayables,
    todaySales,
    todayPurchases,
    todayExpenses,
    dailyCashBook,
  };
}
