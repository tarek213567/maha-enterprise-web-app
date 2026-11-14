import ExcelJS from 'exceljs';
import { dbService, apiFetch } from './api';
import { Commodity, Party, Purchase, Sale, CashbookEntry, Expense, StockAdjustment, Note } from '../types';

// ============================================================================
// BENGALI NUMERIC, DATE & TIME FORMATTERS
// ============================================================================
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBnDigits(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '০';
  return String(num).replace(/[0-9]/g, (d) => BN_DIGITS[parseInt(d, 10)]);
}

const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];
const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export function getBnDateAndDay(d: Date = new Date()): string {
  const dayName = BN_DAYS[d.getDay()];
  const dateBn = toBnDigits(d.getDate());
  const monthBn = BN_MONTHS[d.getMonth()];
  const yearBn = toBnDigits(d.getFullYear());
  return `${dateBn} ${monthBn} ${yearBn}, ${dayName}`;
}

export function getBnTime(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return ` ${toBnDigits(hours)} : ${toBnDigits(mins)} `;
}

// ============================================================================
// ROYAL COLOR PALETTE (ARGB Hex Format for ExcelJS)
// ============================================================================
const COLORS = {
  BANNER_GREEN: 'FF047857',      // Emerald Green #047857
  BANNER_GOLD_TEXT: 'FFFBBF24',  // Bright Gold #FBBF24
  GOLD_BORDER: 'FFD97706',       // Thick Gold #D97706
  NAVY_HEADER: 'FF0D2847',       // Deep Navy Blue #0D2847
  GOLD_TEXT: 'FFFBBF24',         // Table Header Gold #FBBF24
  MINT_ROW: 'FFDCFCE7',          // Soft Mint Green for In-stock #DCFCE7
  PINK_ROW: 'FFFFE4E6',          // Soft Pink for Out-of-stock #FFE4E6
  GREEN_PILL: 'FF16A34A',        // Solid Green #16A34A
  RED_PILL: 'FFDC2626',          // Solid Red #DC2626
  GOLD_TOTAL_ROW: 'FFD99B00',    // Golden Amber Total Row #D99B00
  TEXT_DARK: 'FF0F172A',         // Slate-900 #0F172A
  WHITE: 'FFFFFFFF',             // White #FFFFFF
  BORDER_LIGHT: 'FFE2E8F0',      // Slate-200 #E2E8F0

  // 4 KPI Summary Cards Colors
  KPI_GREEN: 'FF15803D',         // Total Stock Green #15803D
  KPI_BLUE: 'FF0284C7',          // Today Sale Blue #0284C7
  KPI_ORANGE: 'FFD97706',        // Dues/Receivable Orange #D97706
  KPI_PURPLE: 'FF7E22CE',        // Payables/Expenses Purple #7E22CE

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
  TAB_SLATE: 'FF475569',
};

// Reusable borders
const thinGoldBorder: ExcelJS.Border = { style: 'thin', color: { argb: COLORS.GOLD_BORDER } };
const thinLightBorder: ExcelJS.Border = { style: 'thin', color: { argb: COLORS.BORDER_LIGHT } };

const headerBorders: Partial<ExcelJS.Borders> = {
  top: thinGoldBorder,
  bottom: thinGoldBorder,
  left: thinGoldBorder,
  right: thinGoldBorder,
};

const cellBorders: Partial<ExcelJS.Borders> = {
  top: thinLightBorder,
  bottom: thinLightBorder,
  left: thinLightBorder,
  right: thinLightBorder,
};

const totalBorders: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.TEXT_DARK } },
  bottom: { style: 'double', color: { argb: COLORS.TEXT_DARK } },
  left: thinLightBorder,
  right: thinLightBorder,
};

// ============================================================================
// HELPER: Auto-Fit Column Widths
// ============================================================================
function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 12, maxWidth = 45) {
  ws.columns.forEach((column) => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber <= 6) return; // Skip banner & KPI cards
      const valStr = cell.value ? String(cell.value) : '';
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    });
    column.width = Math.min(maxWidth, Math.max(minWidth, maxLen + 4));
  });
}

// ============================================================================
// HELPER: Add Exact Royal Top Banner (Rows 1–2)
// ============================================================================
function addRoyalBanner(
  ws: ExcelJS.Worksheet,
  titleText: string = 'মাহা এন্টারপ্রাইজ',
  subtitleText: string = '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর',
  clockText: string = getBnTime(),
  dateText: string = getBnDateAndDay(),
  colGEnd: number = 7, // Column G is 7
  colH: number = 8,    // Column H is 8
  colI: number = 9     // Column I is 9
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

// ============================================================================
// HELPER: Add 4 Colored KPI Summary Cards (Rows 4–5)
// ============================================================================
function addKpiCards(
  ws: ExcelJS.Worksheet,
  card1Title: string,
  card1Value: string,
  card2Title: string,
  card2Value: string,
  card3Title: string,
  card3Value: string,
  card4Title: string,
  card4Value: string
) {
  // Green Card (A4:B5, Fill FF15803D)
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

  // Blue Card (C4:D5, Fill FF0284C7)
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

  // Orange Card (E4:G5, Fill FFD97706)
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

  // Purple Card (H4:I5, Fill FF7E22CE)
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
// MAIN FUNCTION: downloadStyledExcelBackup (Replaces ALL legacy .json logic)
// ============================================================================
export async function downloadStyledExcelBackup(snapshotData?: any): Promise<{
  success: boolean;
  fileName: string;
  message: string;
}> {
  // 1. Fetch Complete Dataset if not provided
  let data = snapshotData;
  if (!data || !data.commodities) {
    try {
      const res = await apiFetch<any>('/api/system/backup', { method: 'POST' });
      if (res && res.backup && res.backup.commodities) {
        data = res.backup;
      }
    } catch {
      data = null;
    }
  }

  // Fallback to client-side dbService calls if needed
  if (!data || !data.commodities) {
    const today = new Date().toISOString().split('T')[0];
    const [commodities, parties, purchases, sales, cashbookData, expenses, adjustments, notes] = await Promise.all([
      dbService.commodities.getAll().catch(() => []),
      dbService.parties.getAll().catch(() => []),
      dbService.purchases.getAll().catch(() => []),
      dbService.sales.getAll().catch(() => []),
      dbService.cashbook.getDaily(today).catch(() => ({ entries: [] })),
      dbService.expenses.getAll().catch(() => []),
      dbService.stockAdjustments.getAll().catch(() => []),
      dbService.notes.getAll().catch(() => []),
    ]);

    data = {
      exported_at: new Date().toISOString(),
      version: '1.5.0 PRO',
      commodities: commodities || [],
      parties: parties || [],
      purchases: purchases || [],
      sales: sales || [],
      party_ledger: [],
      cashbook: cashbookData?.entries || [],
      expenses: expenses || [],
      stock_adjustments: adjustments || [],
      notes: notes || [],
    };
  }

  const commodities: Commodity[] = data.commodities || [];
  const parties: Party[] = data.parties || [];
  const purchases: Purchase[] = data.purchases || [];
  const sales: Sale[] = data.sales || [];
  const cashbook: CashbookEntry[] = data.cashbook || [];
  const expenses: Expense[] = data.expenses || [];
  const stockAdjustments: StockAdjustment[] = data.stock_adjustments || [];
  const notes: Note[] = data.notes || [];

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

  const todayStr = new Date().toISOString().split('T')[0];
  let todaySalesAmount = 0;
  let totalSalesAmount = 0;
  let totalRealizedProfit = 0;
  sales.forEach((s) => {
    const net = Number(s.net_invoice_amount || s.gross_amount || 0);
    totalSalesAmount += net;
    totalRealizedProfit += Number(s.realized_profit || 0);
    if (s.sale_date && s.sale_date.startsWith(todayStr)) {
      todaySalesAmount += net;
    }
  });
  if (todaySalesAmount === 0 && sales.length > 0) {
    todaySalesAmount = Number(sales[sales.length - 1].net_invoice_amount || 0);
  }

  let totalExpensesAmount = 0;
  expenses.forEach((e) => {
    totalExpensesAmount += Number(e.amount || 0);
  });

  let totalPurchasesAmount = 0;
  purchases.forEach((p) => {
    totalPurchasesAmount += Number(p.total_landed_cost || p.gross_amount || 0);
  });

  let totalCashInflow = 0;
  let totalCashOutflow = 0;
  cashbook.forEach((c) => {
    const amt = Number(c.amount || 0);
    if (c.entry_type === 'INFLOW') totalCashInflow += amt;
    else if (c.entry_type === 'OUTFLOW') totalCashOutflow += amt;
  });
  const netCashFlow = totalCashInflow - totalCashOutflow;

  const now = new Date();
  const clockFormatted = getBnTime(now);
  const dateFormatted = getBnDateAndDay(now);

  // Initialize ExcelJS Workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'মাহা এন্টারপ্রাইজ (Maha Enterprise)';
  wb.lastModifiedBy = 'আল জাবির সরকার';
  wb.created = now;
  wb.modified = now;

  // ============================================================================
  // TAB 1: ১. সকল শস্যের স্টক (Green Tab: FF16A34A)
  // ============================================================================
  const ws1 = wb.addWorksheet('১. সকল শস্যের স্টক', {
    views: [{ showGridLines: true }],
  });
  ws1.properties.tabColor = { argb: COLORS.TAB_GREEN };

  // 1. Banner (Rows 1-2)
  addRoyalBanner(ws1, 'মাহা এন্টারপ্রাইজ', '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর', clockFormatted, dateFormatted, 7, 8, 9);

  // 2. 4 Colored KPI Cards (Rows 4-5)
  addKpiCards(
    ws1,
    'মোট শস্যের স্টক',
    `${toBnDigits(totalStockBags)} বস্তা | ${toBnDigits(totalStockMon.toFixed(2))} মণ`,
    'আজকের বিক্রি',
    `৳ ${toBnDigits(todaySalesAmount.toLocaleString())}`,
    'বাকি/বকেয়া পাওনা',
    `৳ ${toBnDigits(totalReceivable.toLocaleString())}`,
    'মোট পাওনাদার / খরচ',
    `৳ ${toBnDigits((totalPayable + totalExpensesAmount).toLocaleString())}`
  );

  // 3. Table Header (Row 7)
  const tab1Headers = [
    'ক্রমিক',
    'শস্যের নাম',
    'বস্তা সংখ্যা',
    'মোট ওজন (কেজি)',
    'মোট ওজন (মণ)',
    'গড় ক্রয়দর (কেজি)',
    'গড় ক্রয়দর (মণ)',
    'বর্তমান স্টক মূল্য (টাকা)',
    'স্টক অবস্থা',
  ];
  const r7 = ws1.getRow(7);
  r7.values = tab1Headers;
  r7.height = 26;
  tab1Headers.forEach((_, colIdx) => {
    const cell = r7.getCell(colIdx + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  // 4. Data Rows (Row 8+)
  const startRow1 = 8;
  commodities.forEach((c, idx) => {
    const rowNum = startRow1 + idx;
    const kg = Number(c.current_stock_kg || 0);
    const bags = Number(c.current_stock_bags || 0);
    const wacKg = Number(c.current_wac_per_kg || 0);
    const isAvailable = kg > 0;

    const row = ws1.addRow([
      toBnDigits(idx + 1),
      c.name_bn || c.name_en || 'নামহীন শস্য',
      bags,
      kg,
      { formula: `D${rowNum}/40`, result: kg / 40.0 },
      wacKg,
      { formula: `F${rowNum}*40`, result: wacKg * 40.0 },
      { formula: `D${rowNum}*F${rowNum}`, result: kg * wacKg },
      isAvailable ? 'পর্যাপ্ত' : 'স্টক নেই',
    ]);
    row.height = 22;

    const rowFill = isAvailable ? COLORS.MINT_ROW : COLORS.PINK_ROW;

    for (let cCol = 1; cCol <= 9; cCol++) {
      const cell = row.getCell(cCol);
      cell.border = cellBorders;
      cell.font = { name: 'Hind Siliguri', size: 10.5, color: { argb: COLORS.TEXT_DARK } };

      if (cCol === 9) {
        // Status pill
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isAvailable ? COLORS.GREEN_PILL : COLORS.RED_PILL },
        };
        cell.font = { name: 'Hind Siliguri', size: 10.5, bold: true, color: { argb: COLORS.WHITE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
        if (cCol === 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        else if (cCol === 2) cell.alignment = { horizontal: 'left', vertical: 'middle' };
        else {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (cCol === 3) cell.numFmt = '#,##0';
          else cell.numFmt = '#,##0.00';
        }
      }
    }
  });

  // 5. Golden Total Row (সর্বমোট)
  const endRow1 = startRow1 + commodities.length - 1;
  const totalRow1 = ws1.addRow([
    'সর্বমোট',
    '',
    commodities.length > 0 ? { formula: `SUM(C${startRow1}:C${endRow1})`, result: totalStockBags } : 0,
    commodities.length > 0 ? { formula: `SUM(D${startRow1}:D${endRow1})`, result: totalStockKg } : 0,
    commodities.length > 0 ? { formula: `SUM(E${startRow1}:E${endRow1})`, result: totalStockMon } : 0,
    '-',
    '-',
    commodities.length > 0 ? { formula: `SUM(H${startRow1}:H${endRow1})`, result: totalStockValue } : 0,
    'সকল শস্য',
  ]);
  ws1.mergeCells(totalRow1.number, 1, totalRow1.number, 2);
  totalRow1.height = 26;

  for (let cCol = 1; cCol <= 9; cCol++) {
    const cell = totalRow1.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.border = totalBorders;

    if (cCol <= 2 || cCol === 6 || cCol === 7 || cCol === 9) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (cCol === 3) cell.numFmt = '#,##0';
      else cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(ws1, 13, 35);

  // ============================================================================
  // DYNAMIC CROP TABS (Separate Tab for EACH Commodity: e.g. ২. পাট স্টক, ৩. সরিষা স্টক)
  // ============================================================================
  const cropTabColors = [
    COLORS.TAB_GOLD,
    COLORS.TAB_TEAL,
    COLORS.TAB_EMERALD,
    COLORS.TAB_AMBER,
    COLORS.TAB_INDIGO,
    'FFEC4899', // Pink
    'FF8B5CF6', // Purple
    'FF06B6D4', // Cyan
  ];

  commodities.forEach((c, cIdx) => {
    const cropName = c.name_bn || c.name_en || `শস্য-${c.id}`;
    const tabName = `${toBnDigits(cIdx + 2)}. ${cropName} স্টক`;
    const wsCrop = wb.addWorksheet(tabName, { views: [{ showGridLines: true }] });
    wsCrop.properties.tabColor = { argb: cropTabColors[cIdx % cropTabColors.length] };

    // Banner
    addRoyalBanner(
      wsCrop,
      `মাহা এন্টারপ্রাইজ — ${cropName} স্টক ও লেনদেন খতিয়ান`,
      `‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর`,
      clockFormatted,
      dateFormatted,
      7, 8, 9
    );

    // Crop Stats
    const cKg = Number(c.current_stock_kg || 0);
    const cBags = Number(c.current_stock_bags || 0);
    const cMon = cKg / 40.0;
    const cWacKg = Number(c.current_wac_per_kg || 0);
    const cWacMon = cWacKg * 40.0;
    const cVal = cKg * cWacKg;

    // Filter purchases & sales for this commodity
    const cropPurchases = purchases.filter((p) => p.commodity_id === c.id);
    const cropSales = sales.filter((s) => s.commodity_id === c.id);

    let cropPurKg = 0;
    cropPurchases.forEach((p) => { cropPurKg += Number(p.net_weight_kg || 0); });
    let cropSaleKg = 0;
    cropSales.forEach((s) => { cropSaleKg += Number(s.net_weight_kg || 0); });

    addKpiCards(
      wsCrop,
      `${cropName} বর্তমান স্টক`,
      `${toBnDigits(cBags)} বস্তা | ${toBnDigits(cMon.toFixed(2))} মণ`,
      'গড় ক্রয়দর (WAC / মণ)',
      `৳ ${toBnDigits(cWacMon.toFixed(2))}`,
      'মোট ক্রয়কৃত পরিমাণ',
      `${toBnDigits((cropPurKg / 40).toFixed(2))} মণ (${toBnDigits(cropPurchases.length)} চালান)`,
      'মোট বিক্রয়কৃত পরিমাণ',
      `${toBnDigits((cropSaleKg / 40).toFixed(2))} মণ (${toBnDigits(cropSales.length)} মেমো)`
    );

    // Table Header
    const cropHeaders = [
      'ক্রমিক',
      'তারিখ',
      'চালান / মেমো নং',
      'লেনদেনের ধরন',
      'পার্টি / ক্রেতা / বেপারি',
      'বস্তা সংখ্যা',
      'ওজন (কেজি)',
      'ওজন (মণ)',
      'দর / মণ (৳)',
      'মোট টাকা (৳)',
    ];
    const cr7 = wsCrop.getRow(7);
    cr7.values = cropHeaders;
    cr7.height = 26;
    cropHeaders.forEach((_, colIdx) => {
      const cell = cr7.getCell(colIdx + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
      cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = headerBorders;
    });

    // Combine transactions
    interface CropTx {
      date: string;
      ref: string;
      type: string;
      party: string;
      bags: number;
      kg: number;
      rate: number;
      amt: number;
    }
    const txList: CropTx[] = [];
    cropPurchases.forEach((p) => {
      txList.push({
        date: p.purchase_date || '',
        ref: p.invoice_no || `PUR-${p.id}`,
        type: 'শস্য ক্রয় (+)',
        party: p.party_name || 'বেপারি',
        bags: Number(p.bags_count || 0),
        kg: Number(p.net_weight_kg || 0),
        rate: Number(p.rate_per_mon || 0),
        amt: Number(p.total_landed_cost || p.gross_amount || 0),
      });
    });
    cropSales.forEach((s) => {
      txList.push({
        date: s.sale_date || '',
        ref: s.invoice_no || `SAL-${s.id}`,
        type: 'পাইকারি বিক্রয় (-)',
        party: s.party_name || 'খরিদ্দার',
        bags: Number(s.bags_count || 0),
        kg: Number(s.net_weight_kg || 0),
        rate: Number(s.rate_per_mon || 0),
        amt: Number(s.net_invoice_amount || s.gross_amount || 0),
      });
    });

    txList.sort((a, b) => (b.date > a.date ? 1 : -1));

    const cropStartRow = 8;
    txList.forEach((tx, tIdx) => {
      const rowNum = cropStartRow + tIdx;
      const isPur = tx.type.includes('ক্রয়');
      const r = wsCrop.addRow([
        toBnDigits(tIdx + 1),
        tx.date,
        tx.ref,
        tx.type,
        tx.party,
        tx.bags,
        tx.kg,
        { formula: `G${rowNum}/40`, result: tx.kg / 40.0 },
        tx.rate,
        tx.amt,
      ]);
      r.height = 20;
      const rFill = isPur ? COLORS.MINT_ROW : 'FFFFF7ED'; // Mint or soft amber

      for (let cCol = 1; cCol <= 10; cCol++) {
        const cell = r.getCell(cCol);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rFill } };
        cell.font = { name: 'Hind Siliguri', size: 10, color: { argb: COLORS.TEXT_DARK } };
        cell.border = cellBorders;

        if ([1, 2, 3, 4].includes(cCol)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (cCol === 5) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (cCol === 6) cell.numFmt = '#,##0';
          else cell.numFmt = '#,##0.00';
        }
      }
    });

    const cropEndRow = cropStartRow + txList.length - 1;
    const cropTotal = wsCrop.addRow([
      'সর্বমোট বর্তমান স্টক',
      '',
      '',
      '',
      `${cropName} গোডাউন স্টক:`,
      cBags,
      cKg,
      cMon,
      cWacMon,
      cVal,
    ]);
    wsCrop.mergeCells(cropTotal.number, 1, cropTotal.number, 4);
    cropTotal.height = 26;

    for (let cCol = 1; cCol <= 10; cCol++) {
      const cell = cropTotal.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
      cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
      cell.border = totalBorders;

      if (cCol <= 5) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (cCol === 6) cell.numFmt = '#,##0';
        else cell.numFmt = '#,##0.00';
      }
    }

    autoFitColumns(wsCrop, 13, 35);
  });

  // ============================================================================
  // TAB: বাকি খাতা (Orange Tab: FFEA580C)
  // ============================================================================
  const wsDues = wb.addWorksheet('বাকি খাতা', { views: [{ showGridLines: true }] });
  wsDues.properties.tabColor = { argb: COLORS.TAB_ORANGE };

  addRoyalBanner(wsDues, 'মাহা এন্টারপ্রাইজ — খরিদ্দার বাকি খাতা (কাস্টমার বকেয়া)', '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর', clockFormatted, dateFormatted, 6, 7, 8);

  const buyers = parties.filter((p) => p.party_type === 'BUYER' || p.party_type === 'BOTH');
  addKpiCards(
    wsDues,
    'মোট বাকি খরিদ্দার',
    `${toBnDigits(buyers.length)} জন`,
    'মোট বকেয়া পাওনা',
    `৳ ${toBnDigits(totalReceivable.toLocaleString())}`,
    'গড় বকেয়া প্রতি খরিদ্দার',
    `৳ ${toBnDigits(buyers.length > 0 ? (totalReceivable / buyers.length).toFixed(2) : '০')}`,
    'পরিশোধযোগ্য দেনা',
    `৳ ${toBnDigits(totalPayable.toLocaleString())}`
  );

  const dueHeaders = [
    'ক্রমিক',
    'খরিদ্দারের নাম',
    'মোবাইল নম্বর',
    'ঠিকানা',
    'প্রারম্ভিক বাকি (৳)',
    'বর্তমান বাকি (৳)',
    'হিসাবের প্রকৃতি',
    'স্ট্যাটাস',
  ];
  const dr7 = wsDues.getRow(7);
  dr7.values = dueHeaders;
  dr7.height = 26;
  dueHeaders.forEach((_, colIdx) => {
    const cell = dr7.getCell(colIdx + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  const dueStartRow = 8;
  buyers.forEach((b, idx) => {
    const bal = Number(b.current_balance || 0);
    const op = Number(b.opening_balance || 0);

    const r = wsDues.addRow([
      toBnDigits(idx + 1),
      b.name || 'নামহীন খরিদ্দার',
      b.phone || '',
      b.address || '',
      op,
      bal,
      bal > 0 ? 'পাওনাদার' : bal < 0 ? 'দেনা' : 'পরিশোধিত',
      b.is_active === 0 ? 'নিষ্ক্রিয়' : 'সচল',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC';

    for (let cCol = 1; cCol <= 8; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Hind Siliguri', size: 10, color: { argb: COLORS.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 3, 7, 8].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([2, 4].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      }
    }
  });

  const dueEndRow = dueStartRow + buyers.length - 1;
  const dueTotalRow = wsDues.addRow([
    'সর্বমোট বাকি পাওনা',
    '',
    '',
    '',
    buyers.length > 0 ? { formula: `SUM(E${dueStartRow}:E${dueEndRow})` } : 0,
    buyers.length > 0 ? { formula: `SUM(F${dueStartRow}:F${dueEndRow})` } : 0,
    `মোট পাওনা: ৳${totalReceivable.toFixed(2)}`,
    'সকল কাস্টমার',
  ]);
  wsDues.mergeCells(dueTotalRow.number, 1, dueTotalRow.number, 4);
  dueTotalRow.height = 26;

  for (let cCol = 1; cCol <= 8; cCol++) {
    const cell = dueTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.border = totalBorders;

    if (cCol <= 4 || cCol >= 7) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsDues, 14, 40);

  // ============================================================================
  // TAB: পাওনাদার হিসাব (Red Tab: FFDC2626)
  // ============================================================================
  const wsSupp = wb.addWorksheet('পাওনাদার হিসাব', { views: [{ showGridLines: true }] });
  wsSupp.properties.tabColor = { argb: COLORS.TAB_RED };

  addRoyalBanner(wsSupp, 'মাহা এন্টারপ্রাইজ — মহাজন ও বেপারি পাওনাদার খাতা', '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর', clockFormatted, dateFormatted, 6, 7, 8);

  const suppliers = parties.filter((p) => p.party_type === 'SUPPLIER' || p.party_type === 'BOTH');
  addKpiCards(
    wsSupp,
    'মোট মহাজন / বেপারি',
    `${toBnDigits(suppliers.length)} জন`,
    'পরিশোধযোগ্য মোট দেনা',
    `৳ ${toBnDigits(totalPayable.toLocaleString())}`,
    'মোট শস্য ক্রয় খরচ',
    `৳ ${toBnDigits(totalPurchasesAmount.toLocaleString())}`,
    'ক্যাশ স্থিতি',
    `৳ ${toBnDigits(netCashFlow.toLocaleString())}`
  );

  const suppHeaders = [
    'ক্রমিক',
    'মহাজন / বেপারির নাম',
    'মোবাইল নম্বর',
    'ঠিকানা',
    'প্রারম্ভিক দেনা (৳)',
    'বর্তমান দেনা (৳)',
    'স্ট্যাটাস',
    'মন্তব্য',
  ];
  const sr7 = wsSupp.getRow(7);
  sr7.values = suppHeaders;
  sr7.height = 26;
  suppHeaders.forEach((_, colIdx) => {
    const cell = sr7.getCell(colIdx + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  const suppStartRow = 8;
  suppliers.forEach((s, idx) => {
    const bal = Math.abs(Number(s.current_balance || 0));
    const op = Math.abs(Number(s.opening_balance || 0));

    const r = wsSupp.addRow([
      toBnDigits(idx + 1),
      s.name || 'মহাজন',
      s.phone || '',
      s.address || '',
      op,
      bal,
      s.is_active === 0 ? 'নিষ্ক্রিয়' : 'সচল',
      'নিয়মিত সরবরাহকারী',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC';

    for (let cCol = 1; cCol <= 8; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Hind Siliguri', size: 10, color: { argb: COLORS.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 3, 7, 8].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([2, 4].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      }
    }
  });

  const suppEndRow = suppStartRow + suppliers.length - 1;
  const suppTotalRow = wsSupp.addRow([
    'সর্বমোট দেনা',
    '',
    '',
    '',
    suppliers.length > 0 ? { formula: `SUM(E${suppStartRow}:E${suppEndRow})` } : 0,
    suppliers.length > 0 ? { formula: `SUM(F${suppStartRow}:F${suppEndRow})` } : 0,
    'সকল মহাজন',
    'পরিশোধযোগ্য',
  ]);
  wsSupp.mergeCells(suppTotalRow.number, 1, suppTotalRow.number, 4);
  suppTotalRow.height = 26;

  for (let cCol = 1; cCol <= 8; cCol++) {
    const cell = suppTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.border = totalBorders;

    if (cCol <= 4 || cCol >= 7) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsSupp, 14, 40);

  // ============================================================================
  // TAB: বিক্রয় ইতিহাস (Blue Tab: FF0284C7)
  // ============================================================================
  const wsSalesHist = wb.addWorksheet('বিক্রয় ইতিহাস', { views: [{ showGridLines: true }] });
  wsSalesHist.properties.tabColor = { argb: COLORS.TAB_BLUE };

  addRoyalBanner(wsSalesHist, 'মাহা এন্টারপ্রাইজ — পাইকারি বিক্রয় ইতিহাস ও লাভ-লোকসান', '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর', clockFormatted, dateFormatted, 11, 12, 13);

  addKpiCards(
    wsSalesHist,
    'মোট বিক্রয় চালান',
    `${toBnDigits(sales.length)} টি মেমো`,
    'সর্বমোট বিক্রয় বিল',
    `৳ ${toBnDigits(totalSalesAmount.toLocaleString())}`,
    'সর্বমোট নগদ আদায়',
    `৳ ${toBnDigits(sales.reduce((acc, s) => acc + Number(s.paid_amount || 0), 0).toLocaleString())}`,
    'মোট অর্জিত নিট লাভ',
    `৳ ${toBnDigits(totalRealizedProfit.toLocaleString())}`
  );

  const saleHistHeaders = [
    'ক্রমিক',
    'চালান নং',
    'তারিখ',
    'ক্রেতার নাম',
    'মোবাইল',
    'শস্যের জাত',
    'নিট ওজন (কেজি)',
    'নিট মণ',
    'বস্তা সংখ্যা',
    'বিক্রয় দর / মণ',
    'সর্বমোট বিল (৳)',
    'নগদ আদায় (৳)',
    'বকেয়া (৳)',
    'অর্জিত লাভ (৳)',
  ];
  const slr7 = wsSalesHist.getRow(7);
  slr7.values = saleHistHeaders;
  slr7.height = 26;
  saleHistHeaders.forEach((_, colIdx) => {
    const cell = slr7.getCell(colIdx + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  const saleStartRow = 8;
  sales.forEach((s, idx) => {
    const rowNum = saleStartRow + idx;
    const netKg = Number(s.net_weight_kg || 0);
    const bags = Number(s.bags_count || 0);
    const rateMon = Number(s.rate_per_mon || 0);
    const netInvoice = Number(s.net_invoice_amount || s.gross_amount || 0);
    const paid = Number(s.paid_amount || 0);
    const due = Number(s.due_amount || (netInvoice - paid));
    const profit = Number(s.realized_profit || 0);

    const r = wsSalesHist.addRow([
      toBnDigits(idx + 1),
      s.invoice_no || `SAL-${s.id}`,
      s.sale_date || '',
      s.party_name || 'খুচরা ক্রেতা',
      s.party_phone || '',
      s.commodity_name || '',
      netKg,
      { formula: `G${rowNum}/40`, result: netKg / 40.0 },
      bags,
      rateMon,
      netInvoice,
      paid,
      due,
      profit,
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC';

    for (let cCol = 1; cCol <= 14; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Hind Siliguri', size: 10, color: { argb: COLORS.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 3, 5].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([4, 6].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (cCol === 9) cell.numFmt = '#,##0';
        else cell.numFmt = '#,##0.00';
      }
    }
  });

  const saleEndRow = saleStartRow + sales.length - 1;
  const saleTotal = wsSalesHist.addRow([
    'সর্বমোট বিক্রয় হিসাব',
    '',
    '',
    '',
    '',
    '',
    sales.length > 0 ? { formula: `SUM(G${saleStartRow}:G${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(H${saleStartRow}:H${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(I${saleStartRow}:I${saleEndRow})` } : 0,
    '-',
    sales.length > 0 ? { formula: `SUM(K${saleStartRow}:K${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(L${saleStartRow}:L${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(M${saleStartRow}:M${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(N${saleStartRow}:N${saleEndRow})` } : 0,
  ]);
  wsSalesHist.mergeCells(saleTotal.number, 1, saleTotal.number, 6);
  saleTotal.height = 26;

  for (let cCol = 1; cCol <= 14; cCol++) {
    const cell = saleTotal.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.border = totalBorders;

    if (cCol <= 6 || cCol === 10) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (cCol === 9) cell.numFmt = '#,##0';
      else cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsSalesHist, 13, 35);

  // ============================================================================
  // TAB: শস্য ক্রয় তালিকা (Purple Tab: FF7E22CE)
  // ============================================================================
  const wsPurList = wb.addWorksheet('শস্য ক্রয় তালিকা', { views: [{ showGridLines: true }] });
  wsPurList.properties.tabColor = { argb: COLORS.TAB_PURPLE };

  addRoyalBanner(wsPurList, 'মাহা এন্টারপ্রাইজ — শস্য ক্রয় চালান ও সরবরাহ তালিকা', '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর', clockFormatted, dateFormatted, 10, 11, 12);

  addKpiCards(
    wsPurList,
    'মোট ক্রয় চালান',
    `${toBnDigits(purchases.length)} টি`,
    'মোট ক্রয় খরচ (টাকা)',
    `৳ ${toBnDigits(totalPurchasesAmount.toLocaleString())}`,
    'মোট পরিশোধিত টাকা',
    `৳ ${toBnDigits(purchases.reduce((acc, p) => acc + Number(p.paid_amount || 0), 0).toLocaleString())}`,
    'মোট ক্রয় বকেয়া দেনা',
    `৳ ${toBnDigits(purchases.reduce((acc, p) => acc + Number(p.due_amount || 0), 0).toLocaleString())}`
  );

  const purListHeaders = [
    'ক্রমিক',
    'চালান নং',
    'তারিখ',
    'সরবরাহকারী',
    'মোবাইল',
    'শস্যের জাত',
    'নিট ওজন (কেজি)',
    'নিট মণ',
    'বস্তা সংখ্যা',
    'ক্রয় দর / মণ',
    'মোট ক্রয় খরচ (৳)',
    'পরিশোধিত (৳)',
    'বকেয়া (৳)',
  ];
  const plr7 = wsPurList.getRow(7);
  plr7.values = purListHeaders;
  plr7.height = 26;
  purListHeaders.forEach((_, colIdx) => {
    const cell = plr7.getCell(colIdx + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  const purStartRow = 8;
  purchases.forEach((p, idx) => {
    const rowNum = purStartRow + idx;
    const netKg = Number(p.net_weight_kg || 0);
    const bags = Number(p.bags_count || 0);
    const rateMon = Number(p.rate_per_mon || 0);
    const totalCost = Number(p.total_landed_cost || p.gross_amount || 0);
    const paid = Number(p.paid_amount || 0);
    const due = Number(p.due_amount || (totalCost - paid));

    const r = wsPurList.addRow([
      toBnDigits(idx + 1),
      p.invoice_no || `PUR-${p.id}`,
      p.purchase_date || '',
      p.party_name || 'বেপারি',
      p.party_phone || '',
      p.commodity_name || '',
      netKg,
      { formula: `G${rowNum}/40`, result: netKg / 40.0 },
      bags,
      rateMon,
      totalCost,
      paid,
      due,
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC';

    for (let cCol = 1; cCol <= 13; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Hind Siliguri', size: 10, color: { argb: COLORS.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 3, 5].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([4, 6].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (cCol === 9) cell.numFmt = '#,##0';
        else cell.numFmt = '#,##0.00';
      }
    }
  });

  const purEndRow = purStartRow + purchases.length - 1;
  const purTotal = wsPurList.addRow([
    'সর্বমোট ক্রয় হিসাব',
    '',
    '',
    '',
    '',
    '',
    purchases.length > 0 ? { formula: `SUM(G${purStartRow}:G${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(H${purStartRow}:H${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(I${purStartRow}:I${purEndRow})` } : 0,
    '-',
    purchases.length > 0 ? { formula: `SUM(K${purStartRow}:K${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(L${purStartRow}:L${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(M${purStartRow}:M${purEndRow})` } : 0,
  ]);
  wsPurList.mergeCells(purTotal.number, 1, purTotal.number, 6);
  purTotal.height = 26;

  for (let cCol = 1; cCol <= 13; cCol++) {
    const cell = purTotal.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.border = totalBorders;

    if (cCol <= 6 || cCol === 10) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (cCol === 9) cell.numFmt = '#,##0';
      else cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsPurList, 13, 35);

  // ============================================================================
  // TAB: দোকানের খরচ ও ক্যাশ (Slate Tab: FF475569)
  // ============================================================================
  const wsCashExp = wb.addWorksheet('দোকানের খরচ ও ক্যাশ', { views: [{ showGridLines: true }] });
  wsCashExp.properties.tabColor = { argb: COLORS.TAB_SLATE };

  addRoyalBanner(wsCashExp, 'মাহা এন্টারপ্রাইজ — দৈনিক ক্যাশ বই ও পরিচালন খরচ', '‘সততাই ব্যবসার মূলধন’ — চাচকৈড় বাজার, গুরুদাসপুর, নাটোর', clockFormatted, dateFormatted, 7, 8, 9);

  addKpiCards(
    wsCashExp,
    'মোট নগদ ক্যাশ জমা',
    `৳ ${toBnDigits(totalCashInflow.toLocaleString())}`,
    'মোট নগদ ক্যাশ খরচ',
    `৳ ${toBnDigits(totalCashOutflow.toLocaleString())}`,
    'বর্তমান ক্যাশ স্থিতি',
    `৳ ${toBnDigits(netCashFlow.toLocaleString())}`,
    'মোট পরিচালন খরচ',
    `৳ ${toBnDigits(totalExpensesAmount.toLocaleString())}`
  );

  const cashExpHeaders = [
    'ক্রমিক',
    'তারিখ',
    'ভাউচার নং',
    'লেনদেনের ধরন',
    'খাত / বিষয়',
    'সংশ্লিষ্ট পার্টি / মাধ্যম',
    'জমা (টাকা)',
    'খরচ (টাকা)',
    'বিবরণ / নোট',
  ];
  const cer7 = wsCashExp.getRow(7);
  cer7.values = cashExpHeaders;
  cer7.height = 26;
  cashExpHeaders.forEach((_, colIdx) => {
    const cell = cer7.getCell(colIdx + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.NAVY_HEADER } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.GOLD_TEXT } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = headerBorders;
  });

  const cashStartRow = 8;
  cashbook.forEach((cb, idx) => {
    const amt = Number(cb.amount || 0);
    const isInflow = cb.entry_type === 'INFLOW';
    const inflow = isInflow ? amt : 0;
    const outflow = !isInflow ? amt : 0;

    let catBn: string = String(cb.category || '');
    if (catBn === 'SALE_CASH') catBn = 'বিক্রয় নগদ আদায়';
    else if (catBn === 'PURCHASE_CASH') catBn = 'ক্রয় নগদ পরিশোধ';
    else if (catBn.includes('COLLECTION')) catBn = 'বকেয়া আদায়';
    else if (catBn.includes('PAYMENT')) catBn = 'মহাজন পরিশোধ';
    else if (catBn === 'EXPENSE') catBn = 'পরিচালন খরচ';

    const r = wsCashExp.addRow([
      toBnDigits(idx + 1),
      cb.entry_date || '',
      cb.reference_no || `CB-${cb.id}`,
      isInflow ? 'নগদ জমা (+)' : 'নগদ খরচ (-)',
      catBn,
      cb.party_name || cb.payment_mode || 'CASH',
      inflow,
      outflow,
      cb.description || '',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? COLORS.WHITE : 'FFF8FAFC';

    for (let cCol = 1; cCol <= 9; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Hind Siliguri', size: 10, color: { argb: COLORS.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 3, 4].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([5, 6, 9].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      }
    }
  });

  const cashEndRow = cashStartRow + cashbook.length - 1;
  const cashTotal = wsCashExp.addRow([
    'সর্বমোট ক্যাশ স্থিতি',
    '',
    '',
    '',
    '',
    'নিট ক্যাশ:',
    cashbook.length > 0 ? { formula: `SUM(G${cashStartRow}:G${cashEndRow})` } : 0,
    cashbook.length > 0 ? { formula: `SUM(H${cashStartRow}:H${cashEndRow})` } : 0,
    cashbook.length > 0 ? { formula: `G${cashEndRow + 1}-H${cashEndRow + 1}` } : 0,
  ]);
  wsCashExp.mergeCells(cashTotal.number, 1, cashTotal.number, 5);
  cashTotal.height = 26;

  for (let cCol = 1; cCol <= 9; cCol++) {
    const cell = cashTotal.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GOLD_TOTAL_ROW } };
    cell.font = { name: 'Hind Siliguri', size: 11, bold: true, color: { argb: COLORS.TEXT_DARK } };
    cell.border = totalBorders;

    if (cCol <= 6) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsCashExp, 13, 35);

  // ============================================================================
  // AUTO-DOWNLOAD EXECUTION: Maha_Enterprise_Backup_YYYY-MM-DD.xlsx
  // ============================================================================
  const buffer = await wb.xlsx.writeBuffer();
  const dateStr = now.toISOString().split('T')[0];
  const fileName = `Maha_Enterprise_Backup_${dateStr}.xlsx`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return {
    success: true,
    fileName,
    message: `রয়্যাল এক্সেল ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে: ${fileName}`,
  };
}

// Backward compatibility alias
export const generateAndDownloadExcelBackup = downloadStyledExcelBackup;
