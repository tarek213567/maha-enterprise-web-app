import ExcelJS from 'exceljs';

// ============================================================================
// BENGALI NUMERIC, DATE & TIME FORMATTERS
// ============================================================================
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(num) {
  if (num === undefined || num === null) return '০';
  return String(num).replace(/[0-9]/g, (d) => BN_DIGITS[parseInt(d, 10)]);
}

export function formatTaka(amount) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTakaBn(amount, showSymbol = false) {
  const en = formatTaka(amount);
  const bn = en.replace(/[0-9]/g, (d) => BN_DIGITS[parseInt(d, 10)]);
  return showSymbol ? `৳ ${bn}` : bn;
}

export function getDhakaInfo(d = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(d).map((p) => [p.type, p.value]));

  const dayNames = {
    Sun: 'রবিবার',
    Mon: 'সোমবার',
    Tue: 'মঙ্গলবার',
    Wed: 'বুধবার',
    Thu: 'বৃহস্পতিবার',
    Fri: 'শুক্রবার',
    Sat: 'শনিবার',
  };
  const monthNames = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
  ];

  const mIndex = parseInt(parts.month, 10) - 1;
  const dayNameBn = dayNames[parts.weekday] || 'রবিবার';
  const monthNameBn = monthNames[mIndex] || 'নভেম্বর';
  const dayBn = toBnDigits(parts.day);
  const yearBn = toBnDigits(parts.year);
  const hourBn = toBnDigits(parts.hour.padStart(2, '0'));
  const minBn = toBnDigits(parts.minute.padStart(2, '0'));

  const clockText = ` ${hourBn} : ${minBn} `;
  const dateText = `${dayBn} ${monthNameBn} ${yearBn}, ${dayNameBn}`;
  const fileTimestamp = `${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}_${parts.hour.padStart(2, '0')}-${parts.minute.padStart(2, '0')}`;

  return { clockText, dateText, fileTimestamp, parts };
}

// ============================================================================
// EXCEL WORKSHEET NAME SANITIZER (Max 31 chars, strip invalid chars & parens)
// ============================================================================
export const sanitizeSheetName = (name) => {
  return String(name || '')
    .replace(/[/\\?*\[\]:]/g, '_')
    .replace(/[()]/g, '')
    .trim()
    .substring(0, 31);
};

// ============================================================================
// ROYAL COLOR PALETTE (ARGB Hex Format for ExcelJS)
// ============================================================================
const COLORS = {
  BANNER_GREEN: 'FF047857',
  BANNER_GOLD_TEXT: 'FFFBBF24',
  GOLD_BORDER: 'FFD97706',
  NAVY_HEADER: 'FF0D2847',
  GOLD_TEXT: 'FFFBBF24',
  MINT_ROW: 'FFDCFCE7',
  PINK_ROW: 'FFFFE4E6',
  GREEN_PILL: 'FF16A34A',
  RED_PILL: 'FFDC2626',
  GOLD_TOTAL_ROW: 'FFD99B00',
  TEXT_DARK: 'FF0F172A',
  WHITE: 'FFFFFFFF',
  BORDER_LIGHT: 'FFE2E8F0',

  // 4 KPI Summary Cards Colors
  KPI_GREEN: 'FF15803D',
  KPI_BLUE: 'FF0284C7',
  KPI_ORANGE: 'FFD97706',
  KPI_PURPLE: 'FF7E22CE',

  // Sheet Tabs Colors
  TAB_GREEN: 'FF16A34A',
  TAB_GOLD: 'FFEAB308',
  TAB_TEAL: 'FF0D9488',
  TAB_EMERALD: 'FF10B981',
  TAB_AMBER: 'FFF59E0B',
  TAB_INDIGO: 'FF6366F1',
  TAB_ORANGE: 'FFEA580C',
  TAB_RED: 'FFDC2626',
  TAB_BLUE: 'FF0284C7',
  TAB_PURPLE: 'FF7E22CE',
};

const thinGoldBorder = { style: 'thin', color: { argb: COLORS.GOLD_BORDER } };
const thinLightBorder = { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } };

const headerBorders = {
  top: thinGoldBorder,
  bottom: thinGoldBorder,
  left: thinGoldBorder,
  right: thinGoldBorder,
};

const cellBorders = {
  top: thinLightBorder,
  bottom: thinLightBorder,
  left: thinLightBorder,
  right: thinLightBorder,
};

const totalBorders = {
  top: { style: 'thin', color: { argb: COLORS.TEXT_DARK } },
  bottom: { style: 'double', color: { argb: COLORS.TEXT_DARK } },
  left: thinLightBorder,
  right: thinLightBorder,
};

function autoFitColumns(ws, minWidth = 12, maxWidth = 45) {
  ws.columns.forEach((column) => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber <= 6) return;
      const valStr = cell.value ? String(cell.value) : '';
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    });
    column.width = Math.min(maxWidth, Math.max(minWidth, maxLen + 4));
  });
}

function addRoyalBanner(
  ws,
  titleText = 'মাহা এন্টারপ্রাইজ',
  subtitleText = '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
  clockText = ' ১৩ : ০০ ',
  dateText = '১৫ নভেম্বর ২০২৬, রবিবার',
  colGEnd = 7,
  colH = 8,
  colI = 9
) {
  // Row 1: Title (A1:G1) + Clock (H1:I1)
  ws.mergeCells(1, 1, 1, colGEnd);
  const cellA1 = ws.getCell(1, 1);
  cellA1.value = titleText;
  cellA1.font = { name: 'Hind Siliguri', size: 24, bold: true, color: { argb: COLORS.BANNER_GOLD_TEXT } };
  cellA1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BANNER_GREEN } };
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;

  ws.mergeCells(1, colH, 1, colI);
  const cellH1 = ws.getCell(1, colH);
  cellH1.value = clockText;
  cellH1.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: COLORS.TEXT_DARK } };
  cellH1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  cellH1.alignment = { horizontal: 'center', vertical: 'middle' };
  cellH1.border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // Row 2: Subtitle (A2:G2) + Date (H2:I2)
  ws.mergeCells(2, 1, 2, colGEnd);
  const cellA2 = ws.getCell(2, 1);
  cellA2.value = subtitleText;
  cellA2.font = { name: 'Hind Siliguri', size: 12, bold: true, color: { argb: COLORS.WHITE } };
  cellA2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BANNER_GREEN } };
  cellA2.alignment = { horizontal: 'center', vertical: 'middle' };
  cellA2.border = { bottom: { style: 'medium', color: { argb: COLORS.GOLD_BORDER } } };
  ws.getRow(2).height = 24;

  ws.mergeCells(2, colH, 2, colI);
  const cellH2 = ws.getCell(2, colH);
  cellH2.value = dateText;
  cellH2.font = { name: 'Hind Siliguri', size: 10, bold: true, color: { argb: COLORS.WHITE } };
  cellH2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.BANNER_GREEN } };
  cellH2.alignment = { horizontal: 'center', vertical: 'middle' };
  cellH2.border = { bottom: { style: 'medium', color: { argb: COLORS.GOLD_BORDER } } };

  // Row 3: Spacer
  ws.getRow(3).height = 10;
}

function addKpiCards(
  ws,
  card1Title,
  card1Value,
  card2Title,
  card2Value,
  card3Title,
  card3Value,
  card4Title,
  card4Value
) {
  // Green Card (A4:B5)
  ws.mergeCells('A4:B4');
  ws.mergeCells('A5:B5');
  const c1Top = ws.getCell('A4');
  c1Top.value = card1Title;
  c1Top.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.WHITE } };
  c1Top.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_GREEN } };
  c1Top.alignment = { horizontal: 'center', vertical: 'middle' };

  const c1Bottom = ws.getCell('A5');
  c1Bottom.value = card1Value;
  c1Bottom.font = { name: 'Hind Siliguri', size: 13, bold: true, color: { argb: COLORS.WHITE } };
  c1Bottom.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_GREEN } };
  c1Bottom.alignment = { horizontal: 'center', vertical: 'middle' };

  // Blue Card (C4:D5)
  ws.mergeCells('C4:D4');
  ws.mergeCells('C5:D5');
  const c2Top = ws.getCell('C4');
  c2Top.value = card2Title;
  c2Top.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.WHITE } };
  c2Top.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_BLUE } };
  c2Top.alignment = { horizontal: 'center', vertical: 'middle' };

  const c2Bottom = ws.getCell('C5');
  c2Bottom.value = card2Value;
  c2Bottom.font = { name: 'Hind Siliguri', size: 13, bold: true, color: { argb: COLORS.WHITE } };
  c2Bottom.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_BLUE } };
  c2Bottom.alignment = { horizontal: 'center', vertical: 'middle' };

  // Orange Card (E4:G5)
  ws.mergeCells('E4:G4');
  ws.mergeCells('E5:G5');
  const c3Top = ws.getCell('E4');
  c3Top.value = card3Title;
  c3Top.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.WHITE } };
  c3Top.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_ORANGE } };
  c3Top.alignment = { horizontal: 'center', vertical: 'middle' };

  const c3Bottom = ws.getCell('E5');
  c3Bottom.value = card3Value;
  c3Bottom.font = { name: 'Hind Siliguri', size: 13, bold: true, color: { argb: COLORS.WHITE } };
  c3Bottom.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_ORANGE } };
  c3Bottom.alignment = { horizontal: 'center', vertical: 'middle' };

  // Purple Card (H4:I5)
  ws.mergeCells('H4:I4');
  ws.mergeCells('H5:I5');
  const c4Top = ws.getCell('H4');
  c4Top.value = card4Title;
  c4Top.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.WHITE } };
  c4Top.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_PURPLE } };
  c4Top.alignment = { horizontal: 'center', vertical: 'middle' };

  const c4Bottom = ws.getCell('H5');
  c4Bottom.value = card4Value;
  c4Bottom.font = { name: 'Hind Siliguri', size: 13, bold: true, color: { argb: COLORS.WHITE } };
  c4Bottom.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.KPI_PURPLE } };
  c4Bottom.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getRow(4).height = 20;
  ws.getRow(5).height = 24;

  // Row 6: Spacer
  ws.getRow(6).height = 10;
}

// ============================================================================
// SERVER-SIDE ROYAL EXCEL GENERATOR (Runs inside Cloudflare Worker)
// ============================================================================
export async function generateRoyalExcelBuffer(db) {
  // Query all essential D1 tables
  const [
    commoditiesRes,
    partiesRes,
    purchasesRes,
    salesRes,
    cashbookRes,
    expensesRes,
    adjustmentsRes,
  ] = await Promise.all([
    db.prepare('SELECT * FROM commodities ORDER BY id ASC').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM parties ORDER BY id ASC').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM purchases ORDER BY id DESC').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM sales ORDER BY id DESC').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM cashbook ORDER BY id DESC').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM expenses ORDER BY id DESC').all().catch(() => ({ results: [] })),
    db.prepare('SELECT * FROM stock_adjustments ORDER BY id DESC').all().catch(() => ({ results: [] })),
  ]);

  const commodities = commoditiesRes.results || [];
  const parties = partiesRes.results || [];
  const purchases = purchasesRes.results || [];
  const sales = salesRes.results || [];
  const cashbook = cashbookRes.results || [];
  const expenses = expensesRes.results || [];
  const stockAdjustments = adjustmentsRes.results || [];

  // Aggregates
  let totalStockKg = 0;
  let totalStockBags = 0;
  let totalStockValue = 0;
  commodities.forEach((c) => {
    const kg = Number(c.current_stock_kg || 0);
    const bags = Number(c.current_stock_bags || 0);
    const wacKg = Number(c.current_wac_per_kg || 0);
    totalStockKg += kg;
    totalStockBags += bags;
    totalStockValue += kg * wacKg;
  });
  const totalStockMon = totalStockKg / 40.0;

  let totalReceivable = 0;
  let totalPayable = 0;
  parties.forEach((p) => {
    const bal = Number(p.current_balance || 0);
    if (bal > 0) totalReceivable += bal;
    else if (bal < 0) totalPayable += Math.abs(bal);
  });

  const now = new Date();
  const dhaka = getDhakaInfo(now);
  const todayStr = `${dhaka.parts.year}-${dhaka.parts.month.padStart(2, '0')}-${dhaka.parts.day.padStart(2, '0')}`;

  let todaySalesAmount = 0;
  let totalSalesAmount = 0;
  sales.forEach((s) => {
    const net = Number(s.net_invoice_amount || s.gross_amount || 0);
    totalSalesAmount += net;
    if (s.sale_date && s.sale_date.startsWith(todayStr)) {
      todaySalesAmount += net;
    }
  });

  let totalPurchasesAmount = 0;
  purchases.forEach((p) => {
    totalPurchasesAmount += Number(p.total_landed_cost || p.gross_amount || 0);
  });

  let totalExpensesAmount = 0;
  expenses.forEach((e) => {
    totalExpensesAmount += Number(e.amount || 0);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'মাহা এন্টারপ্রাইজ (Maha Enterprise)';
  wb.lastModifiedBy = 'আল জাবির সরকার';
  wb.created = now;
  wb.modified = now;

  const usedSheetNames = new Set();
  const getUniqueSheetName = (baseName) => {
    let clean = sanitizeSheetName(baseName);
    if (!clean) clean = 'Sheet';
    if (!usedSheetNames.has(clean)) {
      usedSheetNames.add(clean);
      return clean;
    }
    let counter = 2;
    while (counter < 100) {
      const suffix = `_${counter}`;
      const candidate = clean.substring(0, 31 - suffix.length) + suffix;
      if (!usedSheetNames.has(candidate)) {
        usedSheetNames.add(candidate);
        return candidate;
      }
      counter++;
    }
    return clean.substring(0, 31);
  };

  // ============================================================================
  // TAB 1: ১. সকল শস্যের স্টক (Green Tab: FF16A34A)
  // ============================================================================
  const ws1 = wb.addWorksheet(getUniqueSheetName('১. সকল শস্যের স্টক'), {
    views: [{ showGridLines: true }],
  });
  ws1.properties.tabColor = { argb: COLORS.TAB_GREEN };

  addRoyalBanner(
    ws1,
    'মাহা এন্টারপ্রাইজ — গুদাম স্টক বিবরণী',
    '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
    dhaka.clockText,
    dhaka.dateText,
    6,
    7,
    8
  );

  addKpiCards(
    ws1,
    'মোট মজুত শস্য',
    `${toBnDigits(totalStockBags)} বস্তা (${toBnDigits(totalStockMon.toFixed(1))} মণ)`,
    'আজকের বিক্রি',
    formatTakaBn(todaySalesAmount, true),
    'মোট বকেয়া পাওনা',
    formatTakaBn(totalReceivable, true),
    'মোট আনুমানিক স্টক মূল্য',
    formatTakaBn(totalStockValue, true)
  );

  // Table Headers (Row 7)
  const headers1 = [
    'ক্রম',
    'শস্যের নাম',
    'মোট বস্তা',
    'মোট ওজন (মণ)',
    'মোট ওজন (কেজি)',
    'গড় ক্রয়মূল্য WAC (টাকা/মণ)',
    'আনুমানিক স্টক মূল্য (টাকা)',
    'স্থিতি/অ্যালার্ট',
  ];
  const r7 = ws1.getRow(7);
  r7.values = headers1;
  r7.height = 24;
  r7.eachCell((cell) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  let rowIdx = 8;
  commodities.forEach((c, idx) => {
    const bags = Number(c.current_stock_bags || 0);
    const kg = Number(c.current_stock_kg || 0);
    const mon = kg / 40.0;
    const wacMon = Number(c.current_wac_per_mon || (c.current_wac_per_kg || 0) * 40);
    const estVal = kg * Number(c.current_wac_per_kg || 0);
    const isZero = kg <= 0;

    const row = ws1.getRow(rowIdx);
    row.values = [
      toBnDigits(idx + 1),
      c.name_bn || c.name || '',
      toBnDigits(bags),
      toBnDigits(mon.toFixed(2)),
      toBnDigits(kg.toFixed(0)),
      formatTakaBn(wacMon),
      formatTakaBn(estVal),
      isZero ? 'স্টক নেই' : 'পর্যাপ্ত',
    ];
    row.height = 20;

    const rowBg = isZero ? COLORS.PINK_ROW : COLORS.MINT_ROW;
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Hind Siliguri', size: 10, bold: colNum === 2 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = {
        horizontal: colNum === 1 || colNum === 8 ? 'center' : colNum === 2 ? 'left' : 'right',
        vertical: 'middle',
      };
      cell.border = cellBorders;
      if (colNum === 8) {
        cell.font = {
          name: 'Hind Siliguri',
          size: 10,
          bold: true,
          color: { argb: isZero ? COLORS.RED_PILL : COLORS.GREEN_PILL },
        };
      }
    });

    rowIdx++;
  });

  // Grand Total Row
  const totalRow1 = ws1.getRow(rowIdx);
  totalRow1.values = [
    'সর্বমোট',
    `${toBnDigits(commodities.length)} টি শস্য`,
    toBnDigits(totalStockBags),
    toBnDigits(totalStockMon.toFixed(2)),
    toBnDigits(totalStockKg.toFixed(0)),
    '-',
    formatTakaBn(totalStockValue),
    '-',
  ];
  totalRow1.height = 24;
  totalRow1.eachCell((cell, colNum) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.alignment = {
      horizontal: colNum <= 2 || colNum === 8 ? 'center' : 'right',
      vertical: 'middle',
    };
    cell.border = totalBorders;
  });

  autoFitColumns(ws1);

  // ============================================================================
  // TAB 2..N: DYNAMIC SEPARATE TABS FOR EVERY CROP
  // ============================================================================
  commodities.forEach((crop, cropIndex) => {
    const cropName = crop.name_bn || crop.name || `শস্য_${crop.id}`;
    const tabName = getUniqueSheetName(`${toBnDigits(cropIndex + 2)}. ${cropName} স্টক`);
    const wsCrop = wb.addWorksheet(tabName, { views: [{ showGridLines: true }] });
    wsCrop.properties.tabColor = { argb: COLORS.TAB_GOLD };

    const cropKg = Number(crop.current_stock_kg || 0);
    const cropBags = Number(crop.current_stock_bags || 0);
    const cropMon = cropKg / 40.0;
    const cropWac = Number(crop.current_wac_per_mon || (crop.current_wac_per_kg || 0) * 40);

    addRoyalBanner(
      wsCrop,
      `মাহা এন্টারপ্রাইজ — ${cropName} স্টক ও লেনদেন খতিয়ান`,
      '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
      dhaka.clockText,
      dhaka.dateText,
      8,
      9,
      10
    );

    addKpiCards(
      wsCrop,
      'বর্তমান মজুত ওজন',
      `${toBnDigits(cropMon.toFixed(2))} মণ (${toBnDigits(cropKg.toFixed(0))} কেজি)`,
      'মজুত বস্তা',
      `${toBnDigits(cropBags)} বস্তা`,
      'গড় ক্রয় দর (WAC)',
      `${formatTakaBn(cropWac, true)} /মণ`,
      'মোট আনুমানিক মূল্য',
      formatTakaBn(cropKg * Number(crop.current_wac_per_kg || 0), true)
    );

    const headersCrop = [
      'তারিখ',
      'চালান নং',
      'বিবরণ / পার্টির নাম',
      'লেনদেনের ধরন',
      'বস্তা সংখ্যা',
      'ওজন (মণ)',
      'ওজন (কেজি)',
      'দর (টাকা/মণ)',
      'মোট টাকা',
      'স্থিতি',
    ];
    const r7c = wsCrop.getRow(7);
    r7c.values = headersCrop;
    r7c.height = 24;
    r7c.eachCell((cell) => {
      cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = headerBorders;
    });

    // Populate purchases and sales for this crop
    let cRowIdx = 8;
    const cropPurchases = purchases.filter((p) => p.commodity_id === crop.id);
    const cropSales = sales.filter((s) => s.commodity_id === crop.id);

    cropPurchases.forEach((p) => {
      const pRow = wsCrop.getRow(cRowIdx);
      pRow.values = [
        p.purchase_date || '',
        p.invoice_no || `PUR-${p.id}`,
        p.party_name || p.supplier_name || 'কৃষক/বেপারী',
        'ক্রয় (+) ইন',
        toBnDigits(p.bags_count || 0),
        toBnDigits(Number(p.net_weight_mon || (p.net_weight_kg || 0) / 40).toFixed(2)),
        toBnDigits(Number(p.net_weight_kg || 0).toFixed(0)),
        formatTakaBn(p.rate_per_mon || 0),
        formatTakaBn(p.total_amount || p.total_landed_cost || 0),
        'ইন-স্টক',
      ];
      pRow.height = 20;
      pRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Hind Siliguri', size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.MINT_ROW } };
        cell.alignment = {
          horizontal: colNum <= 2 ? 'center' : colNum === 3 ? 'left' : 'right',
          vertical: 'middle',
        };
        cell.border = cellBorders;
      });
      cRowIdx++;
    });

    cropSales.forEach((s) => {
      const sRow = wsCrop.getRow(cRowIdx);
      sRow.values = [
        s.sale_date || '',
        s.invoice_no || `INV-${s.id}`,
        s.customer_name || s.party_name || 'ক্রেতা পার্টি',
        'বিক্রয় (-) আউট',
        toBnDigits(s.bags_count || 0),
        toBnDigits(Number(s.net_weight_mon || (s.net_weight_kg || 0) / 40).toFixed(2)),
        toBnDigits(Number(s.net_weight_kg || 0).toFixed(0)),
        formatTakaBn(s.rate_per_mon || 0),
        formatTakaBn(s.net_invoice_amount || s.total_amount || 0),
        'বিক্রিত',
      ];
      sRow.height = 20;
      sRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Hind Siliguri', size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
        cell.alignment = {
          horizontal: colNum <= 2 ? 'center' : colNum === 3 ? 'left' : 'right',
          vertical: 'middle',
        };
        cell.border = cellBorders;
      });
      cRowIdx++;
    });

    autoFitColumns(wsCrop);
  });

  // ============================================================================
  // TAB: বাকি খাতা (Orange Tab: FFEA580C)
  // ============================================================================
  const wsDues = wb.addWorksheet(getUniqueSheetName('বাকি খাতা'), { views: [{ showGridLines: true }] });
  wsDues.properties.tabColor = { argb: COLORS.TAB_ORANGE };

  addRoyalBanner(
    wsDues,
    'মাহা এন্টারপ্রাইজ — ক্রেতা পার্টি ও বাকি খাতা',
    '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
    dhaka.clockText,
    dhaka.dateText,
    7,
    8,
    9
  );

  addKpiCards(
    wsDues,
    'মোট বকেয়া পাওনা',
    formatTakaBn(totalReceivable, true),
    'বাকি কাস্টমার সংখ্যা',
    `${toBnDigits(parties.filter((p) => Number(p.current_balance || 0) > 0).length)} জন`,
    'মোট ক্রেতা পার্টি',
    `${toBnDigits(parties.length)} জন`,
    'সর্বশেষ হালনাগাদ',
    dhaka.dateText
  );

  const duesHeaders = [
    'ক্রম',
    'ক্রেতার নাম',
    'মোবাইল নম্বর',
    'ঠিকানা',
    'পূর্বের জের (টাকা)',
    'মোট বিল (+)',
    'মোট আদায় (-)',
    'বর্তমান বাকি (টাকা)',
    'স্ট্যাটাস',
  ];
  const r7d = wsDues.getRow(7);
  r7d.values = duesHeaders;
  r7d.height = 24;
  r7d.eachCell((cell) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  let duesRowIdx = 8;
  let sumDue = 0;
  parties.forEach((p, idx) => {
    const bal = Number(p.current_balance || p.opening_balance || 0);
    if (bal > 0) sumDue += bal;

    const row = wsDues.getRow(duesRowIdx);
    row.values = [
      toBnDigits(idx + 1),
      p.name || '',
      p.phone ? toBnDigits(p.phone) : '-',
      p.address || '-',
      formatTakaBn(p.opening_balance || 0),
      formatTakaBn(p.total_sales || 0),
      formatTakaBn(p.total_paid || 0),
      formatTakaBn(bal),
      bal > 0 ? 'বাকি আছে' : bal < 0 ? 'অগ্রিম জমা' : 'পরিশোধিত',
    ];
    row.height = 20;

    const isDue = bal > 0;
    const rowBg = isDue ? 'FFFFF1F2' : 'FFF0FDF4';
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Hind Siliguri', size: 10, bold: colNum === 2 || colNum === 8 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = {
        horizontal: colNum === 1 || colNum === 9 ? 'center' : colNum === 2 || colNum === 4 ? 'left' : 'right',
        vertical: 'middle',
      };
      cell.border = cellBorders;
      if (colNum === 8 && isDue) {
        cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.RED_PILL } };
      }
    });

    duesRowIdx++;
  });

  // Grand Total for Dues
  const duesTotalRow = wsDues.getRow(duesRowIdx);
  duesTotalRow.values = [
    'সর্বমোট',
    `${toBnDigits(parties.length)} জন`,
    '-',
    '-',
    '-',
    '-',
    '-',
    formatTakaBn(sumDue),
    '-',
  ];
  duesTotalRow.height = 24;
  duesTotalRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.alignment = {
      horizontal: colNum <= 4 || colNum === 9 ? 'center' : 'right',
      vertical: 'middle',
    };
    cell.border = totalBorders;
  });

  autoFitColumns(wsDues);

  // ============================================================================
  // TAB: পাওনাদার হিসাব (Red Tab: FFDC2626)
  // ============================================================================
  const wsSupp = wb.addWorksheet(getUniqueSheetName('পাওনাদার হিসাব'), { views: [{ showGridLines: true }] });
  wsSupp.properties.tabColor = { argb: COLORS.TAB_RED };

  addRoyalBanner(
    wsSupp,
    'মাহা এন্টারপ্রাইজ — সরবরাহকারী ও পাওনাদার হিসাব',
    '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
    dhaka.clockText,
    dhaka.dateText,
    6,
    7,
    8
  );

  addKpiCards(
    wsSupp,
    'মোট প্রদেয় পাওনা',
    formatTakaBn(totalPayable, true),
    'মোট সরবরাহকারী',
    `${toBnDigits(parties.filter((p) => p.party_type === 'SUPPLIER' || p.party_type === 'BOTH').length)} জন`,
    'মোট শস্য ক্রয় মূল্য',
    formatTakaBn(totalPurchasesAmount, true),
    'সর্বশেষ হালনাগাদ',
    dhaka.dateText
  );

  const suppHeaders = [
    'ক্রম',
    'সরবরাহকারীর নাম',
    'মোবাইল নম্বর',
    'ঠিকানা',
    'সরবরাহকৃত শস্য বিল (+)',
    'পরিশোধকৃত টাকা (-)',
    'বর্তমান প্রদেয় পাওনা (টাকা)',
    'স্ট্যাটাস',
  ];
  const r7s = wsSupp.getRow(7);
  r7s.values = suppHeaders;
  r7s.height = 24;
  r7s.eachCell((cell) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  autoFitColumns(wsSupp);

  // ============================================================================
  // TAB: বিক্রয় ইতিহাস (Teal Tab: FF0D9488)
  // ============================================================================
  const wsSalesHist = wb.addWorksheet(getUniqueSheetName('বিক্রয় ইতিহাস'), { views: [{ showGridLines: true }] });
  wsSalesHist.properties.tabColor = { argb: COLORS.TAB_TEAL };

  addRoyalBanner(
    wsSalesHist,
    'মাহা এন্টারপ্রাইজ — পাইকারি বিক্রয় ও চালান খতিয়ান',
    '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
    dhaka.clockText,
    dhaka.dateText,
    10,
    11,
    12
  );

  addKpiCards(
    wsSalesHist,
    'আজকের মোট বিক্রি',
    formatTakaBn(todaySalesAmount, true),
    'সর্বমোট বিক্রি',
    formatTakaBn(totalSalesAmount, true),
    'মোট চালান সংখ্যা',
    `${toBnDigits(sales.length)} টি`,
    'সর্বশেষ চালান তারিখ',
    sales[0]?.sale_date || dhaka.dateText
  );

  const salesHeaders = [
    'ক্রম',
    'চালান নং',
    'তারিখ ও সময়',
    'ক্রেতার নাম',
    'মোবাইল নং',
    'শস্যের নাম',
    'বস্তা',
    'ওজন (মণ)',
    'দর/মণ',
    'মোট বিল',
    'জমা/আদায়',
    'বাকি',
  ];
  const r7sh = wsSalesHist.getRow(7);
  r7sh.values = salesHeaders;
  r7sh.height = 24;
  r7sh.eachCell((cell) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  let sRowIdx = 8;
  sales.slice(0, 150).forEach((s, idx) => {
    const row = wsSalesHist.getRow(sRowIdx);
    row.values = [
      toBnDigits(idx + 1),
      s.invoice_no || `INV-${s.id}`,
      s.sale_date || '',
      s.customer_name || s.party_name || '',
      s.customer_phone ? toBnDigits(s.customer_phone) : '-',
      s.commodity_name || s.crop_name || '',
      toBnDigits(s.bags_count || 0),
      toBnDigits(Number(s.net_weight_mon || (s.net_weight_kg || 0) / 40).toFixed(2)),
      formatTakaBn(s.rate_per_mon || 0),
      formatTakaBn(s.net_invoice_amount || s.total_amount || 0),
      formatTakaBn(s.paid_amount || 0),
      formatTakaBn(s.due_amount || s.remaining_due || 0),
    ];
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Hind Siliguri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC' } };
      cell.alignment = {
        horizontal: colNum <= 3 ? 'center' : colNum === 4 || colNum === 6 ? 'left' : 'right',
        vertical: 'middle',
      };
      cell.border = cellBorders;
    });
    sRowIdx++;
  });

  autoFitColumns(wsSalesHist);

  // ============================================================================
  // TAB: শস্য ক্রয় তালিকা (Amber Tab: FFF59E0B)
  // ============================================================================
  const wsPurList = wb.addWorksheet(getUniqueSheetName('শস্য ক্রয় তালিকা'), { views: [{ showGridLines: true }] });
  wsPurList.properties.tabColor = { argb: COLORS.TAB_AMBER };

  addRoyalBanner(
    wsPurList,
    'মাহা এন্টারপ্রাইজ — শস্য ক্রয় ও স্টক-ইন চালান',
    '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
    dhaka.clockText,
    dhaka.dateText,
    8,
    9,
    10
  );

  addKpiCards(
    wsPurList,
    'সর্বমোট শস্য ক্রয়',
    formatTakaBn(totalPurchasesAmount, true),
    'মোট ক্রয় চালান সংখ্যা',
    `${toBnDigits(purchases.length)} টি`,
    'মোট মজুত শস্য',
    `${toBnDigits(totalStockBags)} বস্তা`,
    'সর্বশেষ ক্রয় চালান',
    purchases[0]?.purchase_date || dhaka.dateText
  );

  const purHeaders = [
    'ক্রম',
    'চালান নং',
    'তারিখ ও সময়',
    'সরবরাহকারীর নাম',
    'শস্যের নাম',
    'বস্তা',
    'ওজন (মণ)',
    'দর/মণ',
    'মোট বিল',
    'পরিশোধ',
  ];
  const r7p = wsPurList.getRow(7);
  r7p.values = purHeaders;
  r7p.height = 24;
  r7p.eachCell((cell) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  let pRowIdx = 8;
  purchases.slice(0, 150).forEach((p, idx) => {
    const row = wsPurList.getRow(pRowIdx);
    row.values = [
      toBnDigits(idx + 1),
      p.invoice_no || `PUR-${p.id}`,
      p.purchase_date || '',
      p.supplier_name || p.party_name || 'কৃষক/বেপারী',
      p.commodity_name || p.crop_name || '',
      toBnDigits(p.bags_count || 0),
      toBnDigits(Number(p.net_weight_mon || (p.net_weight_kg || 0) / 40).toFixed(2)),
      formatTakaBn(p.rate_per_mon || 0),
      formatTakaBn(p.total_amount || p.total_landed_cost || 0),
      formatTakaBn(p.paid_amount || 0),
    ];
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Hind Siliguri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC' } };
      cell.alignment = {
        horizontal: colNum <= 3 ? 'center' : colNum === 4 || colNum === 5 ? 'left' : 'right',
        vertical: 'middle',
      };
      cell.border = cellBorders;
    });
    pRowIdx++;
  });

  autoFitColumns(wsPurList);

  // ============================================================================
  // TAB: দোকানের খরচ ও ক্যাশ (Purple Tab: FF7E22CE)
  // ============================================================================
  const wsCashExp = wb.addWorksheet(getUniqueSheetName('দোকানের খরচ ও ক্যাশ'), { views: [{ showGridLines: true }] });
  wsCashExp.properties.tabColor = { argb: COLORS.TAB_PURPLE };

  addRoyalBanner(
    wsCashExp,
    'মাহা এন্টারপ্রাইজ — পরিচালন খরচ ও ক্যাশবুক বিবরণী',
    '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
    dhaka.clockText,
    dhaka.dateText,
    6,
    7,
    8
  );

  addKpiCards(
    wsCashExp,
    'সর্বমোট পরিচালন খরচ',
    formatTakaBn(totalExpensesAmount, true),
    'খরচ ভাউচার সংখ্যা',
    `${toBnDigits(expenses.length)} টি`,
    'মোট ক্যাশ লেনদেন',
    `${toBnDigits(cashbook.length)} টি`,
    'সর্বশেষ লেনদেন তারিখ',
    dhaka.dateText
  );

  const expHeaders = ['ক্রম', 'তারিখ', 'খরচের খাত', 'বিবরণ', 'টাকা', 'পেমেন্ট মেথড'];
  const r7e = wsCashExp.getRow(7);
  r7e.values = expHeaders;
  r7e.height = 24;
  r7e.eachCell((cell) => {
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  let eRowIdx = 8;
  expenses.slice(0, 100).forEach((e, idx) => {
    const row = wsCashExp.getRow(eRowIdx);
    row.values = [
      toBnDigits(idx + 1),
      e.expense_date || '',
      e.category || 'পরিচালন ব্যয়',
      e.description || '',
      formatTakaBn(e.amount || 0),
      e.payment_method || 'নগদ ক্যাশ',
    ];
    row.height = 20;
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Hind Siliguri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC' } };
      cell.alignment = {
        horizontal: colNum <= 2 ? 'center' : colNum === 3 || colNum === 4 ? 'left' : 'right',
        vertical: 'middle',
      };
      cell.border = cellBorders;
    });
    eRowIdx++;
  });

  autoFitColumns(wsCashExp);

  // Write workbook to buffer
  const buffer = await wb.xlsx.writeBuffer();

  return {
    buffer,
    summary: {
      totalStockBags,
      totalStockMon,
      totalStockValue,
      todaySalesAmount,
      totalSalesAmount,
      totalReceivable,
      totalPayable,
      commoditiesCount: commodities.length,
      partiesCount: parties.length,
      purchasesCount: purchases.length,
      salesCount: sales.length,
      dateFormatted: dhaka.dateText,
      clockFormatted: dhaka.clockText,
      fileTimestamp: dhaka.fileTimestamp,
    },
  };
}

// ============================================================================
// TELEGRAM EXCEL BACKUP SENDER
// ============================================================================
export async function sendExcelBackupToTelegram(env, triggerType = 'AUTO_SCHEDULED') {
  const db = env.DB;
  if (!db) {
    throw new Error('D1 Database binding (env.DB) is not available');
  }

  // Ensure backup_logs table exists
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS backup_logs (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        status TEXT NOT NULL,
        telegram_message_id TEXT,
        file_size_formatted TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL
      )`
    )
    .run()
    .catch((err) => console.warn('[backup_logs init]:', err));

  // Retrieve Telegram Bot Token and Chat ID
  let botToken = env.TELEGRAM_BOT_TOKEN;
  let chatId = env.TELEGRAM_CHAT_ID;

  // Check D1 settings table for overrides
  try {
    const tokenRow = await db
      .prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'")
      .first()
      .catch(() => null);
    if (tokenRow && tokenRow.value) botToken = tokenRow.value;

    const chatRow = await db
      .prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'")
      .first()
      .catch(() => null);
    if (chatRow && chatRow.value) chatId = chatRow.value;
  } catch (e) {
    console.warn('[Telegram settings read]:', e);
  }

  // Hardcoded verified fallbacks
  botToken = botToken || '9038319945:AAFFZJoJvHaHdrhOuVP3QeEKKRjyFDx72Bk';
  chatId = chatId || '1904683489';

  const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let fileName = `Maha_Enterprise_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`;
  let fileSizeFormatted = '0 KB';

  try {
    console.log(`[TelegramBackup] Generating Royal Excel Buffer for trigger: ${triggerType}...`);
    const { buffer, summary } = await generateRoyalExcelBuffer(db);

    fileName = `Maha_Enterprise_Backup_${summary.fileTimestamp}.xlsx`;
    const sizeKB = Math.round(buffer.byteLength / 1024);
    fileSizeFormatted = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;

    const triggerLabel =
      triggerType === 'AUTO_SCHEDULED' ? '⏰ স্বয়ংক্রিয় সিডিউল ব্যাকআপ (13:00 / 19:00 BST)' : '⚡ লাইভ ম্যানুয়াল ক্লাউড ব্যাকআপ';

    const caption = [
      `📊 <b>মাহা এন্টারপ্রাইজ — রয়্যাল এক্সেল ক্লাউড ব্যাকআপ</b>`,
      `🏢 চাচকৈড় বাজার, গুরুদাসপুর, নাটোর`,
      `🕒 সময়: <b>${summary.dateFormatted} | ${summary.clockFormatted}</b>`,
      `🏷️ মোড: <b>${triggerLabel}</b>`,
      ``,
      `📦 মোট স্টক: <b>${toBnDigits(summary.totalStockBags)} বস্তা (${toBnDigits(summary.totalStockMon.toFixed(2))} মণ)</b>`,
      `💰 আজকের বিক্রি: <b>${formatTakaBn(summary.todaySalesAmount, true)}</b>`,
      `📒 মোট বকেয়া পাওনা: <b>${formatTakaBn(summary.totalReceivable, true)}</b>`,
      `🏪 মোট শস্য আইটেম: <b>${toBnDigits(summary.commoditiesCount)} টি</b> | পার্টি: <b>${toBnDigits(summary.partiesCount)} জন</b>`,
      ``,
      `📁 ফাইল: <code>${fileName}</code> (${fileSizeFormatted})`,
      `✅ মাল্টি-শীট এক্সেল (.xlsx) ডাটাবেজ ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে।`,
    ].join('\n');

    const formData = new FormData();
    formData.append('chat_id', chatId);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    formData.append('document', blob, fileName);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    console.log(`[TelegramBackup] Uploading ${fileName} (${fileSizeFormatted}) to Telegram chat: ${chatId}...`);
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      throw new Error(`Telegram API Error: ${tgData.description || 'Unknown error'}`);
    }

    const messageId = String(tgData.result?.message_id || '');
    console.log(`[TelegramBackup] ✅ Successfully delivered to Telegram! Message ID: ${messageId}`);

    // Insert success into backup_logs
    await db
      .prepare(
        `INSERT INTO backup_logs (id, file_name, trigger_type, status, telegram_message_id, file_size_formatted, error_message, created_at)
         VALUES (?, ?, ?, 'SUCCESS', ?, ?, NULL, ?)`
      )
      .bind(logId, fileName, triggerType, messageId, fileSizeFormatted, new Date().toISOString())
      .run()
      .catch((err) => console.warn('[backup_logs insert error]:', err));

    return {
      success: true,
      logId,
      fileName,
      fileSizeFormatted,
      messageId,
      triggerType,
      summary,
      telegramResponse: tgData,
    };
  } catch (err) {
    console.error('[TelegramBackup Error]:', err);

    // Insert failure into backup_logs
    await db
      .prepare(
        `INSERT INTO backup_logs (id, file_name, trigger_type, status, telegram_message_id, file_size_formatted, error_message, created_at)
         VALUES (?, ?, ?, 'FAILED', NULL, ?, ?, ?)`
      )
      .bind(logId, fileName, triggerType, fileSizeFormatted, err.message, new Date().toISOString())
      .run()
      .catch(() => null);

    return {
      success: false,
      logId,
      fileName,
      error: err.message,
    };
  }
}
