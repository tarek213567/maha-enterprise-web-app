import ExcelJS from 'exceljs';
import { dbService, apiFetch } from './api';
import { Commodity, Party, Purchase, Sale, CashbookEntry, Expense, StockAdjustment, Note } from '../types';

// ============================================================================
// ROYAL THEME COLOR PALETTE CONSTANTS (ARGB Hex)
// ============================================================================
const PALETTE = {
  NAVY_PRIMARY: 'FF0F172A',      // #0F172A - Deep Slate / Midnight Navy
  SAPPHIRE_HEADER: 'FF1E3A8A',   // #1E3A8A - Royal Sapphire Blue (Table Headers)
  SLATE_SUBHEADER: 'FF334155',   // #334155 - Slate (Subtitles / Info bars)
  GOLD_ACCENT: 'FFF59E0B',       // #F59E0B - Royal Amber Gold
  GOLD_DARK: 'FFD97706',         // #D97706 - Dark Gold
  ZEBRA_EVEN: 'FFFFFFFF',        // #FFFFFF - White
  ZEBRA_ODD: 'FFF8FAFC',         // #F8FAFC - Soft Slate White
  TOTAL_BG: 'FFFEF3C7',          // #FEF3C7 - Warm Soft Amber Summary Row
  TOTAL_TEXT: 'FF78350F',        // #78350F - Deep Amber / Dark Brown Text
  CARD_BG_BLUE: 'FFEFF6FF',      // #EFF6FF - Light Blue
  CARD_BG_GREEN: 'FFF0FDF4',     // #F0FDF4 - Light Green
  CARD_BG_AMBER: 'FFFFFBEB',     // #FFFBEB - Light Amber
  CARD_BG_ROSE: 'FFFFF1F2',      // #FFF1F2 - Light Rose
  BORDER_LIGHT: 'FFE2E8F0',      // #E2E8F0 - Slate-200
  BORDER_MEDIUM: 'FF94A3B8',     // #94A3B8 - Slate-400
  BORDER_DOUBLE: 'FF0F172A',     // #0F172A - Dark Double Underline for Totals
  TEXT_DARK: 'FF0F172A',         // #0F172A - Main Text
  TEXT_MUTED: 'FF64748B',        // #64748B - Muted Text
  WHITE: 'FFFFFFFF',
};

// Common Borders
const thinBorderSide: ExcelJS.Border = { style: 'thin', color: { argb: PALETTE.BORDER_LIGHT } };
const cellBorders: Partial<ExcelJS.Borders> = {
  top: thinBorderSide,
  left: thinBorderSide,
  bottom: thinBorderSide,
  right: thinBorderSide,
};

const totalRowBorders: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: PALETTE.BORDER_MEDIUM } },
  bottom: { style: 'double', color: { argb: PALETTE.BORDER_DOUBLE } },
  left: thinBorderSide,
  right: thinBorderSide,
};

// ============================================================================
// HELPER: Auto-format Title Header Banner
// ============================================================================
function addHeaderBanner(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  metaInfo: string,
  colCount: number
) {
  // Row 1: Main Title
  const r1 = ws.addRow([title]);
  ws.mergeCells(1, 1, 1, colCount);
  r1.height = 32;
  const cell1 = ws.getCell(1, 1);
  cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.NAVY_PRIMARY } };
  cell1.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: PALETTE.GOLD_ACCENT } };
  cell1.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 2: Subtitle
  const r2 = ws.addRow([subtitle]);
  ws.mergeCells(2, 1, 2, colCount);
  r2.height = 22;
  const cell2 = ws.getCell(2, 1);
  cell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.SAPPHIRE_HEADER } };
  cell2.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.WHITE } };
  cell2.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 3: Meta Info (Date, Version, Location)
  const r3 = ws.addRow([metaInfo]);
  ws.mergeCells(3, 1, 3, colCount);
  r3.height = 18;
  const cell3 = ws.getCell(3, 1);
  cell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.SLATE_SUBHEADER } };
  cell3.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FFE2E8F0' } };
  cell3.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: Spacer
  const r4 = ws.addRow([]);
  r4.height = 10;
}

// ============================================================================
// HELPER: Format Table Column Headers
// ============================================================================
function formatHeaders(
  ws: ExcelJS.Worksheet,
  headers: string[],
  rowNumber: number
) {
  const row = ws.getRow(rowNumber);
  row.values = headers;
  row.height = 26;

  headers.forEach((_, colIndex) => {
    const cell = row.getCell(colIndex + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.SAPPHIRE_HEADER } };
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: PALETTE.NAVY_PRIMARY } },
      bottom: { style: 'medium', color: { argb: PALETTE.NAVY_PRIMARY } },
      left: { style: 'thin', color: { argb: 'FF1E293B' } },
      right: { style: 'thin', color: { argb: 'FF1E293B' } },
    };
  });
}

// ============================================================================
// HELPER: Auto Adjust Column Widths
// ============================================================================
function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 12, maxWidth = 45) {
  ws.columns.forEach((column) => {
    let maxLen = minWidth;
    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber <= 3) return; // Skip title banner rows
      const valStr = cell.value ? String(cell.value) : '';
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    });
    column.width = Math.min(maxWidth, Math.max(minWidth, maxLen + 4));
  });
}

// ============================================================================
// MAIN GENERATOR & DOWNLOAD ENGINE
// ============================================================================
export async function generateAndDownloadExcelBackup(snapshotData?: any): Promise<{
  success: boolean;
  fileName: string;
  message: string;
}> {
  // 1. Fetch Complete Dataset if not provided
  let data = snapshotData;
  if (!data || !data.commodities) {
    try {
      // In web app, /api/system/backup gives full snapshot from D1
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

  // 2. Compute Aggregates for Dashboard
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

  let totalReceivable = 0; // Parties with positive balance (Buyer owes us)
  let totalPayable = 0;    // Parties with negative balance (We owe Supplier)
  parties.forEach((p) => {
    const bal = Number(p.current_balance || 0);
    if (bal > 0) totalReceivable += bal;
    else if (bal < 0) totalPayable += Math.abs(bal);
  });

  let totalPurchasesAmount = 0;
  purchases.forEach((p) => {
    totalPurchasesAmount += Number(p.total_landed_cost || p.gross_amount || 0);
  });

  let totalSalesAmount = 0;
  let totalRealizedProfit = 0;
  sales.forEach((s) => {
    totalSalesAmount += Number(s.net_invoice_amount || s.gross_amount || 0);
    totalRealizedProfit += Number(s.realized_profit || 0);
  });

  let totalExpensesAmount = 0;
  expenses.forEach((e) => {
    totalExpensesAmount += Number(e.amount || 0);
  });

  let totalCashInflow = 0;
  let totalCashOutflow = 0;
  cashbook.forEach((c) => {
    const amt = Number(c.amount || 0);
    if (c.entry_type === 'INFLOW') totalCashInflow += amt;
    else if (c.entry_type === 'OUTFLOW') totalCashOutflow += amt;
  });
  const netCashFlow = totalCashInflow - totalCashOutflow;

  let totalShrinkageKg = 0;
  let totalShrinkageLoss = 0;
  stockAdjustments.forEach((adj) => {
    const kg = Math.abs(Number(adj.lost_weight_kg || (adj as any).weight_change_kg || 0));
    const loss = Math.abs(Number(adj.cost_value || (adj as any).financial_impact || 0));
    totalShrinkageKg += kg;
    totalShrinkageLoss += loss;
  });

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
  const metaString = `ব্যাকআপ তৈরির সময়: ${dateFormatted}, ${timeFormatted} | সংস্করণ: ১.৫.০ প্রো (রয়্যাল এডিশন) | মোকাম: চাঁচকৈড় বাজার, গুরুদাসপুর, নাটোর`;

  // 3. Initialize ExcelJS Workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'মাহা এন্টারপ্রাইজ (Maha Enterprise ERP)';
  wb.lastModifiedBy = 'আল জাবির সরকার';
  wb.created = now;
  wb.modified = now;

  // ============================================================================
  // SHEET 1: ড্যাশবোর্ড ও সারসংক্ষেপ (Executive Summary & KPIs)
  // ============================================================================
  const wsDash = wb.addWorksheet('ড্যাশবোর্ড ও সারসংক্ষেপ', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsDash,
    'মাহা এন্টারপ্রাইজ — শস্য আড়ত ও পাইকারি ব্যবসা ব্যবস্থাপনা',
    'এক্সিকিউটিভ ড্যাশবোর্ড ও ক্লাউড ডাটাবেজ ব্যাকআপ সারসংক্ষেপ',
    metaString,
    8
  );

  // Section 1: KPI Cards Heading
  const kpiHeadingRow = wsDash.addRow(['📊 ব্যবসায়িক মূল সূচকসমূহ (Key Performance Indicators)']);
  wsDash.mergeCells(kpiHeadingRow.number, 1, kpiHeadingRow.number, 8);
  kpiHeadingRow.height = 24;
  const kpiHeadingCell = wsDash.getCell(kpiHeadingRow.number, 1);
  kpiHeadingCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: PALETTE.NAVY_PRIMARY } };
  kpiHeadingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  kpiHeadingCell.alignment = { vertical: 'middle', indent: 1 };

  // Helper for KPI Cards
  const addKpiBlock = (
    rStart: number,
    cStart: number,
    cEnd: number,
    iconTitle: string,
    valText: string,
    subText: string,
    bgArgb: string
  ) => {
    wsDash.mergeCells(rStart, cStart, rStart, cEnd);
    wsDash.mergeCells(rStart + 1, cStart, rStart + 1, cEnd);
    wsDash.mergeCells(rStart + 2, cStart, rStart + 2, cEnd);

    const c1 = wsDash.getCell(rStart, cStart);
    const c2 = wsDash.getCell(rStart + 1, cStart);
    const c3 = wsDash.getCell(rStart + 2, cStart);

    c1.value = iconTitle;
    c1.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: PALETTE.TEXT_MUTED } };
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    c1.alignment = { horizontal: 'center', vertical: 'middle' };

    c2.value = valText;
    c2.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: PALETTE.NAVY_PRIMARY } };
    c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    c2.alignment = { horizontal: 'center', vertical: 'middle' };

    c3.value = subText;
    c3.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: PALETTE.TEXT_MUTED } };
    c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
    c3.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let r = rStart; r <= rStart + 2; r++) {
      for (let c = cStart; c <= cEnd; c++) {
        wsDash.getCell(r, c).border = cellBorders;
      }
    }
  };

  // KPI Row 1 (Rows 6-8)
  addKpiBlock(
    6, 1, 2,
    '📦 মোট গুদাম স্টক',
    `${totalStockMon.toFixed(2)} মণ (${totalStockKg.toLocaleString()} কেজি)`,
    `মোট বস্তা: ${totalStockBags.toLocaleString()} টি | মূল্য: ৳ ${totalStockValue.toLocaleString()}`,
    PALETTE.CARD_BG_BLUE
  );

  addKpiBlock(
    6, 3, 4,
    '💰 মোট বাকি পাওনা (ক্রেতা)',
    `৳ ${totalReceivable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `খরিদ্দারদের নিকট মোট বকেয়া পাওনা`,
    PALETTE.CARD_BG_GREEN
  );

  addKpiBlock(
    6, 5, 6,
    '🤝 মোট বাকি দেনা (মহাজন)',
    `৳ ${totalPayable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `বেপারি ও মহাজনদের পরিশোধযোগ্য দেনা`,
    PALETTE.CARD_BG_ROSE
  );

  addKpiBlock(
    6, 7, 8,
    '💵 ক্যাশ বই মোট স্থিতি',
    `৳ ${netCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `জমা: ৳ ${totalCashInflow.toLocaleString()} | খরচ: ৳ ${totalCashOutflow.toLocaleString()}`,
    PALETTE.CARD_BG_AMBER
  );

  // KPI Row 2 (Rows 10-12)
  wsDash.addRow([]); // Spacer
  addKpiBlock(
    10, 1, 2,
    '🛒 মোট শস্য ক্রয় খতিয়ান',
    `৳ ${totalPurchasesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `মোট ক্রয় চালান: ${purchases.length} টি`,
    PALETTE.CARD_BG_BLUE
  );

  addKpiBlock(
    10, 3, 4,
    '📈 মোট পাইকারি বিক্রয়',
    `৳ ${totalSalesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `মোট বিক্রয় চালান: ${sales.length} টি | অর্জিত লাভ: ৳ ${totalRealizedProfit.toLocaleString()}`,
    PALETTE.CARD_BG_GREEN
  );

  addKpiBlock(
    10, 5, 6,
    '🏷️ মোট পরিচালন খরচ',
    `৳ ${totalExpensesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `মোট খরচের এন্ট্রি: ${expenses.length} টি`,
    PALETTE.CARD_BG_ROSE
  );

  addKpiBlock(
    10, 7, 8,
    '⚖️ শুকতি ও আর্দ্রতা ক্ষতি',
    `৳ ${totalShrinkageLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `মোট ঘাটতি ওজন: ${totalShrinkageKg.toFixed(2)} কেজি`,
    PALETTE.CARD_BG_AMBER
  );

  // Section 2: Table of Modules & Record Count
  wsDash.addRow([]); // Spacer
  const modHeadingRow = wsDash.addRow(['📑 ব্যাকআপে অন্তর্ভুক্ত খতিয়ান ও মডিউলসমূহের বিবরণ']);
  wsDash.mergeCells(modHeadingRow.number, 1, modHeadingRow.number, 8);
  modHeadingRow.height = 24;
  const modHeadingCell = wsDash.getCell(modHeadingRow.number, 1);
  modHeadingCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: PALETTE.NAVY_PRIMARY } };
  modHeadingCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  modHeadingCell.alignment = { vertical: 'middle', indent: 1 };

  const dashTableHeaders = [
    'ক্রমিক',
    'মডিউলের নাম',
    'এক্সেল শিটের নাম',
    'মোট রেকর্ড',
    'মূল্যায়ন / মোট পরিমাণ (টাকা)',
    'মূল একক / পরিমাপ',
    'সর্বশেষ অবস্থা',
    'ডাটাবেজ স্ট্যাটাস',
  ];
  formatHeaders(wsDash, dashTableHeaders, modHeadingRow.number + 1);

  const dashModulesData = [
    [1, 'গুদাম স্টক ইনভেন্টরি', 'গুদাম স্টক (Inventory)', commodities.length, totalStockValue, `${totalStockMon.toFixed(2)} মণ (${totalStockBags} বস্তা)`, 'সচল ও নিয়মিত', 'সংরক্ষিত'],
    [2, 'শস্য ক্রয় খতিয়ান', 'শস্য ক্রয় খতিয়ান (Purchases)', purchases.length, totalPurchasesAmount, `${purchases.length} টি ক্রয় চালান`, 'নিরীক্ষিত', 'সংরক্ষিত'],
    [3, 'পাইকারি বিক্রয় খতিয়ান', 'পাইকারি বিক্রয় খতিয়ান (Sales)', sales.length, totalSalesAmount, `${sales.length} টি বিক্রয় মেমো`, 'লাভ সমন্বিত', 'সংরক্ষিত'],
    [4, 'বাকি খাতা ও পার্টি খতিয়ান', 'বাকি খাতা (Parties & Dues)', parties.length, totalReceivable - totalPayable, `${parties.length} জন পার্টি`, 'ব্যালেন্সড', 'সংরক্ষিত'],
    [5, 'দৈনিক ক্যাশ বই রেজিস্টার', 'দৈনিক ক্যাশ বই (Cashbook)', cashbook.length, netCashFlow, `${cashbook.length} টি নগদ লেনদেন`, 'মিল সম্পন্ন', 'সংরক্ষিত'],
    [6, 'পরিচালন ও বিবিধ খরচ', 'পরিচালন খরচ (Expenses)', expenses.length, totalExpensesAmount, `${expenses.length} টি ভাউচার`, 'ভাউচারযুক্ত', 'সংরক্ষিত'],
    [7, 'শুকতি ও ওজন ঘাটতি ক্ষতি', 'শুকতি ও ঘাটতি (Shrinkage)', stockAdjustments.length, totalShrinkageLoss, `${totalShrinkageKg.toFixed(2)} কেজি হ্রাস`, 'স্টকে সমন্বয়কৃত', 'সংরক্ষিত'],
    [8, 'ডিজিটাল নোটবুক ও মেমো', 'নোটবুক (Notes)', notes.length, '-', `${notes.length} টি নোট`, 'সচল', 'সংরক্ষিত'],
  ];

  dashModulesData.forEach((rowVals, idx) => {
    const r = wsDash.addRow(rowVals);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    rowVals.forEach((val, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if (cIdx === 0 || cIdx === 6 || cIdx === 7) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cIdx === 3 || cIdx === 4) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof val === 'number') {
          cell.numFmt = cIdx === 4 ? '#,##0.00' : '#,##0';
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  autoFitColumns(wsDash, 14, 45);

  // ============================================================================
  // SHEET 2: গুদাম স্টক (Inventory)
  // ============================================================================
  const wsInv = wb.addWorksheet('গুদাম স্টক (Inventory)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsInv,
    'মাহা এন্টারপ্রাইজ — গুদাম স্টক ও শস্য মূল্যায়ন প্রতিবেদন',
    'সকল শস্যের বর্তমান মজুদ ওজন, বস্তা সংখ্যা, গড় ক্রয়দর (WAC) ও আনুমানিক স্টক মূল্য',
    metaString,
    9
  );

  const invHeaders = [
    'ক্রমিক',
    'শস্যের জাত ও নাম',
    'বর্তমান স্টক (কেজি)',
    'বর্তমান স্টক (মণ)',
    'বর্তমান বস্তা (টি)',
    'গড় ক্রয়দর / কেজি (৳)',
    'গড় ক্রয়দর / মণ (৳)',
    'মোট আনুমানিক মূল্য (৳)',
    'স্টক অবস্থা',
  ];
  const invHeaderRowIdx = 5;
  formatHeaders(wsInv, invHeaders, invHeaderRowIdx);

  const invStartRow = 6;
  commodities.forEach((c, idx) => {
    const rowNum = invStartRow + idx;
    const kg = Number(c.current_stock_kg || 0);
    const bags = Number(c.current_stock_bags || 0);
    const wacKg = Number(c.current_wac_per_kg || 0);

    let statusText = 'পর্যাপ্ত মজুত';
    if (kg <= 0) statusText = 'স্টক শেষ';
    else if (kg < 200) statusText = 'স্বল্প মজুত';

    const r = wsInv.addRow([
      idx + 1,
      c.name_bn || c.name_en || 'নামহীন শস্য',
      kg,
      { formula: `C${rowNum}/40`, result: kg / 40.0 },
      bags,
      wacKg,
      { formula: `F${rowNum}*40`, result: wacKg * 40.0 },
      { formula: `C${rowNum}*F${rowNum}`, result: kg * wacKg },
      statusText,
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 9; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if (cCol === 1 || cCol === 9) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cCol === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (cCol === 5) cell.numFmt = '#,##0';
        else cell.numFmt = '#,##0.00';
      }
    }
  });

  const invEndRow = invStartRow + commodities.length - 1;
  const invTotalRow = wsInv.addRow([
    'সর্বমোট',
    `${commodities.length} টি শস্যের মোট`,
    commodities.length > 0 ? { formula: `SUM(C${invStartRow}:C${invEndRow})`, result: totalStockKg } : 0,
    commodities.length > 0 ? { formula: `SUM(D${invStartRow}:D${invEndRow})`, result: totalStockMon } : 0,
    commodities.length > 0 ? { formula: `SUM(E${invStartRow}:E${invEndRow})`, result: totalStockBags } : 0,
    '-',
    '-',
    commodities.length > 0 ? { formula: `SUM(H${invStartRow}:H${invEndRow})`, result: totalStockValue } : 0,
    'সম্পূর্ণ গোডাউন',
  ]);
  invTotalRow.height = 24;
  for (let cCol = 1; cCol <= 9; cCol++) {
    const cell = invTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.TOTAL_BG } };
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: PALETTE.TOTAL_TEXT } };
    cell.border = totalRowBorders;
    if (cCol <= 2 || cCol === 9) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (cCol === 5) cell.numFmt = '#,##0';
      else if (cCol === 3 || cCol === 4 || cCol === 8) cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsInv, 13, 40);

  // ============================================================================
  // SHEET 3: শস্য ক্রয় খতিয়ান (Purchases)
  // ============================================================================
  const wsPur = wb.addWorksheet('শস্য ক্রয় খতিয়ান (Purchases)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsPur,
    'মাহা এন্টারপ্রাইজ — শস্য ক্রয় চালান ও সরবরাহকারী খতিয়ান',
    'সকল শস্য ক্রয়ের চালান, নিট ওজন, বস্তা, ক্রয় দর, পরিবহন ও লেবার খরচসহ ল্যান্ডেড কস্ট হিসাব',
    metaString,
    20
  );

  const purHeaders = [
    'ক্রমিক',
    'চালান নং',
    'তারিখ',
    'সরবরাহকারী / বেপারি',
    'মোবাইল',
    'শস্যের নাম',
    'মোট ওজন (কেজি)',
    'বস্তা কর্তন (কেজি)',
    'নিট ওজন (কেজি)',
    'নিট মণ',
    'বস্তা সংখ্যা',
    'ক্রয় দর / মণ (৳)',
    'শস্যের মূল্য (৳)',
    'কুলি খরচ (৳)',
    'গাড়ি ভাড়া (৳)',
    'মোট ক্রয় খরচ (৳)',
    'পরিশোধিত (৳)',
    'বকেয়া টাকা (৳)',
    'মাধ্যম',
    'মন্তব্য / নোট',
  ];
  const purHeaderRowIdx = 5;
  formatHeaders(wsPur, purHeaders, purHeaderRowIdx);

  const purStartRow = 6;
  purchases.forEach((p, idx) => {
    const rowNum = purStartRow + idx;
    const grossKg = Number(p.gross_weight_kg || 0);
    const bagDedKg = Number(p.bag_deduction_kg || 0);
    const netKg = Number(p.net_weight_kg || grossKg - bagDedKg);
    const bags = Number(p.bags_count || 0);
    const rateMon = Number(p.rate_per_mon || 0);
    const grossAmt = Number(p.gross_amount || 0);
    const labor = Number(p.labor_cost || 0);
    const transport = Number(p.transport_cost || 0);
    const totalCost = Number(p.total_landed_cost || grossAmt + labor + transport);
    const paid = Number(p.paid_amount || 0);
    const due = Number(p.due_amount || (totalCost - paid));

    const r = wsPur.addRow([
      idx + 1,
      p.invoice_no || `PUR-${p.id}`,
      p.purchase_date || '',
      p.party_name || 'সাধারণ বেপারি',
      p.party_phone || '',
      p.commodity_name || '',
      grossKg,
      bagDedKg,
      netKg,
      { formula: `I${rowNum}/40`, result: netKg / 40.0 },
      bags,
      rateMon,
      grossAmt,
      labor,
      transport,
      totalCost,
      paid,
      due,
      p.payment_method === 'BANK' ? 'ব্যাংক' : 'নগদ ক্যাশ',
      p.notes || (p as any).remarks || '',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 20; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 3, 5, 19].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([4, 6, 20].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (cCol === 11) cell.numFmt = '#,##0';
        else cell.numFmt = '#,##0.00';
      }
    }
  });

  const purEndRow = purStartRow + purchases.length - 1;
  const purTotalRow = wsPur.addRow([
    'সর্বমোট',
    `${purchases.length} টি চালান`,
    '-',
    '-',
    '-',
    '-',
    purchases.length > 0 ? { formula: `SUM(G${purStartRow}:G${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(H${purStartRow}:H${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(I${purStartRow}:I${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(J${purStartRow}:J${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(K${purStartRow}:K${purEndRow})` } : 0,
    '-',
    purchases.length > 0 ? { formula: `SUM(M${purStartRow}:M${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(N${purStartRow}:N${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(O${purStartRow}:O${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(P${purStartRow}:P${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(Q${purStartRow}:Q${purEndRow})` } : 0,
    purchases.length > 0 ? { formula: `SUM(R${purStartRow}:R${purEndRow})` } : 0,
    '-',
    'সর্বমোট হিসাব',
  ]);
  purTotalRow.height = 24;

  for (let cCol = 1; cCol <= 20; cCol++) {
    const cell = purTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.TOTAL_BG } };
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.TOTAL_TEXT } };
    cell.border = totalRowBorders;

    if ([1, 2, 3, 4, 5, 6, 12, 19, 20].includes(cCol)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (cCol === 11) cell.numFmt = '#,##0';
      else cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsPur, 13, 35);

  // ============================================================================
  // SHEET 4: পাইকারি বিক্রয় খতিয়ান (Sales)
  // ============================================================================
  const wsSale = wb.addWorksheet('পাইকারি বিক্রয় খতিয়ান (Sales)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsSale,
    'মাহা এন্টারপ্রাইজ — পাইকারি বিক্রয় মেমো ও লাভ-লোকসান খতিয়ান',
    'সকল পাইকারি বিক্রয়ের চালান, ক্রেতা বিবরণ, আদায়, বকেয়া, মালের ক্রয়মূল্য (COGS) ও অর্জিত লাভ',
    metaString,
    20
  );

  const saleHeaders = [
    'ক্রমিক',
    'চালান নং',
    'তারিখ',
    'ক্রেতার নাম',
    'মোবাইল',
    'শস্যের জাত',
    'নিট ওজন (কেজি)',
    'নিট মণ',
    'বস্তা সংখ্যা',
    'বিক্রয় দর / মণ (৳)',
    'বিক্রয় বিল (৳)',
    'লেবার চার্জ (৳)',
    'বস্তা কর্তন (৳)',
    'ছাড় (৳)',
    'সর্বমোট বিল (৳)',
    'নগদ আদায় (৳)',
    'বর্তমান বকেয়া (৳)',
    'মালের ক্রয়মূল্য (৳)',
    'অর্জিত নিট লাভ (৳)',
    'পেমেন্ট মাধ্যম',
  ];
  const saleHeaderRowIdx = 5;
  formatHeaders(wsSale, saleHeaders, saleHeaderRowIdx);

  const saleStartRow = 6;
  sales.forEach((s, idx) => {
    const rowNum = saleStartRow + idx;
    const netKg = Number(s.net_weight_kg || 0);
    const bags = Number(s.bags_count || 0);
    const rateMon = Number(s.rate_per_mon || 0);
    const grossAmt = Number(s.gross_amount || 0);
    const loading = Number(s.loading_charge || 0);
    const bagDed = Number(s.damaged_bag_deduction || 0);
    const disc = Number(s.discount_amount || 0);
    const netInvoice = Number(s.net_invoice_amount || (grossAmt + loading - bagDed - disc));
    const paid = Number(s.paid_amount || 0);
    const due = Number(s.due_amount || (netInvoice - paid));
    const cogs = Number(s.cogs_amount || 0);
    const profit = Number(s.realized_profit || (netInvoice - cogs));

    const r = wsSale.addRow([
      idx + 1,
      s.invoice_no || `SAL-${s.id}`,
      s.sale_date || '',
      s.party_name || 'সাধারণ খুচরা ক্রেতা',
      s.party_phone || '',
      s.commodity_name || '',
      netKg,
      { formula: `G${rowNum}/40`, result: netKg / 40.0 },
      bags,
      rateMon,
      grossAmt,
      loading,
      bagDed,
      disc,
      netInvoice,
      paid,
      due,
      cogs,
      profit,
      s.payment_method === 'BANK' ? 'ব্যাংক' : 'নগদ ক্যাশ',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 20; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 3, 5, 20].includes(cCol)) {
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
  const saleTotalRow = wsSale.addRow([
    'সর্বমোট',
    `${sales.length} টি মেমো`,
    '-',
    '-',
    '-',
    '-',
    sales.length > 0 ? { formula: `SUM(G${saleStartRow}:G${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(H${saleStartRow}:H${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(I${saleStartRow}:I${saleEndRow})` } : 0,
    '-',
    sales.length > 0 ? { formula: `SUM(K${saleStartRow}:K${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(L${saleStartRow}:L${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(M${saleStartRow}:M${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(N${saleStartRow}:N${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(O${saleStartRow}:O${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(P${saleStartRow}:P${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(Q${saleStartRow}:Q${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(R${saleStartRow}:R${saleEndRow})` } : 0,
    sales.length > 0 ? { formula: `SUM(S${saleStartRow}:S${saleEndRow})` } : 0,
    'সর্বমোট বিক্রয়',
  ]);
  saleTotalRow.height = 24;

  for (let cCol = 1; cCol <= 20; cCol++) {
    const cell = saleTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.TOTAL_BG } };
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.TOTAL_TEXT } };
    cell.border = totalRowBorders;

    if ([1, 2, 3, 4, 5, 6, 10, 20].includes(cCol)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (cCol === 9) cell.numFmt = '#,##0';
      else cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsSale, 13, 35);

  // ============================================================================
  // SHEET 5: বাকি খাতা (Parties & Dues)
  // ============================================================================
  const wsParty = wb.addWorksheet('বাকি খাতা (Parties & Dues)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsParty,
    'মাহা এন্টারপ্রাইজ — পার্টি তালিকা ও বর্তমান বকেয়া খাতা',
    'সকল খরিদ্দার, মহাজন ও বেপারিদের যোগাযোগের ঠিকানা, প্রারম্ভিক ব্যালেন্স ও বর্তমান জের স্থিতি',
    metaString,
    9
  );

  const partyHeaders = [
    'ক্রমিক',
    'পার্টির নাম',
    'পার্টির ধরন',
    'মোবাইল নম্বর',
    'ঠিকানা',
    'প্রারম্ভিক জের (৳)',
    'বর্তমান ব্যালেন্স (৳)',
    'হিসাবের প্রকৃতি',
    'স্ট্যাটাস',
  ];
  const partyHeaderRowIdx = 5;
  formatHeaders(wsParty, partyHeaders, partyHeaderRowIdx);

  const partyStartRow = 6;
  parties.forEach((p, idx) => {
    const bal = Number(p.current_balance || 0);
    const opBal = Number(p.opening_balance || 0);

    let natureText = 'পরিশোধিত (০)';
    if (bal > 0) natureText = 'পাওনা (আমাদের প্রাপ্য)';
    else if (bal < 0) natureText = 'দেনা (মহাজন পাবে)';

    let typeBangla = 'উভয় (খরিদ্দার/মহাজন)';
    if (p.party_type === 'BUYER') typeBangla = 'খরিদ্দার / ক্রেতা';
    else if (p.party_type === 'SUPPLIER') typeBangla = 'সরবরাহকারী / বেপারি';

    const r = wsParty.addRow([
      idx + 1,
      p.name || 'নামহীন পার্টি',
      typeBangla,
      p.phone || '',
      p.address || '',
      opBal,
      bal,
      natureText,
      p.is_active === 0 ? 'নিষ্ক্রিয়' : 'সচল',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 9; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 3, 4, 8, 9].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([2, 5].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      }
    }
  });

  const partyEndRow = partyStartRow + parties.length - 1;
  const partyTotalRow = wsParty.addRow([
    'সর্বমোট',
    `${parties.length} জন পার্টির হিসাব`,
    '-',
    '-',
    '-',
    parties.length > 0 ? { formula: `SUM(F${partyStartRow}:F${partyEndRow})` } : 0,
    parties.length > 0 ? { formula: `SUM(G${partyStartRow}:G${partyEndRow})` } : 0,
    `পাওনা: ৳${totalReceivable.toFixed(2)} | দেনা: ৳${totalPayable.toFixed(2)}`,
    'সকল পার্টি',
  ]);
  partyTotalRow.height = 24;

  for (let cCol = 1; cCol <= 9; cCol++) {
    const cell = partyTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.TOTAL_BG } };
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.TOTAL_TEXT } };
    cell.border = totalRowBorders;

    if ([1, 2, 3, 4, 5, 8, 9].includes(cCol)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsParty, 14, 45);

  // ============================================================================
  // SHEET 6: দৈনিক ক্যাশ বই (Cashbook)
  // ============================================================================
  const wsCash = wb.addWorksheet('দৈনিক ক্যাশ বই (Cashbook)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsCash,
    'মাহা এন্টারপ্রাইজ — দৈনিক ক্যাশ বই ও নগদ প্রবাহ খতিয়ান',
    'প্রতিদিনের নগদ জমা (Inflow) ও খরচ (Outflow) সম্বলিত ব্যালেন্সড ক্যাশ বই রেজিস্টার',
    metaString,
    10
  );

  const cashHeaders = [
    'ক্রমিক',
    'তারিখ',
    'ভাউচার / রেফারেন্স নং',
    'লেনদেনের ধরন',
    'খাত / ক্যাটাগরি',
    'সংশ্লিষ্ট পার্টি',
    'পেমেন্ট মাধ্যম',
    'জমার পরিমাণ (৳)',
    'খরচের পরিমাণ (৳)',
    'বিবরণ / নোট',
  ];
  const cashHeaderRowIdx = 5;
  formatHeaders(wsCash, cashHeaders, cashHeaderRowIdx);

  const cashStartRow = 6;
  cashbook.forEach((c, idx) => {
    const amt = Number(c.amount || 0);
    const isInflow = c.entry_type === 'INFLOW';
    const inflow = isInflow ? amt : 0;
    const outflow = !isInflow ? amt : 0;

    let catBn: string = String(c.category || '');
    if (catBn === 'SALE_CASH') catBn = 'বিক্রয় নগদ আদায়';
    else if (catBn === 'PURCHASE_CASH') catBn = 'ক্রয় বাবদ নগদ পরিশোধ';
    else if (catBn === 'DUE_COLLECTION' || catBn === 'COLLECTION') catBn = 'পার্টি বকেয়া আদায়';
    else if (catBn === 'SUPPLIER_PAYMENT' || catBn === 'PAYMENT') catBn = 'মহাজন বকেয়া পরিশোধ';
    else if (catBn === 'EXPENSE') catBn = 'পরিচালন খরচ';

    const r = wsCash.addRow([
      idx + 1,
      c.entry_date || '',
      c.reference_no || `CB-${c.id}`,
      isInflow ? 'নগদ জমা (+)' : 'নগদ খরচ (-)',
      catBn,
      c.party_name || '-',
      c.payment_mode || 'CASH',
      inflow,
      outflow,
      c.description || '',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 10; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 3, 4, 7].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([5, 6, 10].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      }
    }
  });

  const cashEndRow = cashStartRow + cashbook.length - 1;
  const cashTotalRow = wsCash.addRow([
    'সর্বমোট',
    `${cashbook.length} টি ভাউচার`,
    '-',
    '-',
    '-',
    '-',
    'নিট স্থিতি:',
    cashbook.length > 0 ? { formula: `SUM(H${cashStartRow}:H${cashEndRow})` } : 0,
    cashbook.length > 0 ? { formula: `SUM(I${cashStartRow}:I${cashEndRow})` } : 0,
    cashbook.length > 0 ? { formula: `H${cashEndRow + 1}-I${cashEndRow + 1}` } : 0,
  ]);
  cashTotalRow.height = 24;

  for (let cCol = 1; cCol <= 10; cCol++) {
    const cell = cashTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.TOTAL_BG } };
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.TOTAL_TEXT } };
    cell.border = totalRowBorders;

    if ([1, 2, 3, 4, 5, 6, 7].includes(cCol)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsCash, 13, 35);

  // ============================================================================
  // SHEET 7: পরিচালন খরচ (Expenses)
  // ============================================================================
  const wsExp = wb.addWorksheet('পরিচালন খরচ (Expenses)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsExp,
    'মাহা এন্টারপ্রাইজ — পরিচালন ও বিবিধ খরচ খতিয়ান',
    'দোকান ভাড়া, বিদ্যুৎ, কর্মচারীর বেতন, নাস্তা-আপ্যায়ন, পরিবহনসহ সার্বিক পরিচালন ব্যয় রেজিস্টার',
    metaString,
    7
  );

  const expHeaders = [
    'ক্রমিক',
    'তারিখ',
    'খরচের খাত ও বিষয়',
    'টাকার পরিমাণ (৳)',
    'পেমেন্ট মাধ্যম',
    'পরিশোধকারী / দায়িত্বপ্রাপ্ত',
    'বিস্তারিত নোট ও বিবরণ',
  ];
  const expHeaderRowIdx = 5;
  formatHeaders(wsExp, expHeaders, expHeaderRowIdx);

  const expStartRow = 6;
  expenses.forEach((e, idx) => {
    const amt = Number(e.amount || 0);

    const r = wsExp.addRow([
      idx + 1,
      e.expense_date || '',
      e.category_name_bn || e.category || 'সাধারণ খরচ',
      amt,
      e.payment_mode || (e as any).payment_method || 'CASH',
      e.paid_to || (e as any).paid_by || 'ম্যানেজার',
      e.notes || (e as any).description || '',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 7; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 5].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([3, 6, 7].includes(cCol)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      }
    }
  });

  const expEndRow = expStartRow + expenses.length - 1;
  const expTotalRow = wsExp.addRow([
    'সর্বমোট',
    `${expenses.length} টি ভাউচার`,
    'মোট পরিচালন ব্যয়:',
    expenses.length > 0 ? { formula: `SUM(D${expStartRow}:D${expEndRow})` } : 0,
    '-',
    '-',
    'সর্বমোট খরচ',
  ]);
  expTotalRow.height = 24;

  for (let cCol = 1; cCol <= 7; cCol++) {
    const cell = expTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.TOTAL_BG } };
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.TOTAL_TEXT } };
    cell.border = totalRowBorders;

    if ([1, 2, 3, 5, 6, 7].includes(cCol)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsExp, 14, 45);

  // ============================================================================
  // SHEET 8: শুকতি ও ঘাটতি (Shrinkage)
  // ============================================================================
  const wsShrink = wb.addWorksheet('শুকতি ও ঘাটতি (Shrinkage)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsShrink,
    'মাহা এন্টারপ্রাইজ — শস্য শুকতি, আর্দ্রতা হ্রাস ও ঘাটতি রেজিস্টার',
    'গুদামে শস্য সংরক্ষণকালীন প্রাকৃতিক শুকতি, ওজন হ্রাস ও আর্থিক ক্ষতির পরিমাপ রেজিস্টার',
    metaString,
    10
  );

  const shrinkHeaders = [
    'ক্রমিক',
    'তারিখ',
    'শস্যের জাত ও নাম',
    'ঘাটতি / শুকতির কারণ',
    'ঘাটতি ওজন (কেজি)',
    'ঘাটতি মণ',
    'বস্তা হ্রাস',
    'তৎকালীন ক্রয়দর / মণ (৳)',
    'আর্থিক ক্ষতি (৳)',
    'নোট ও অনুমোদন',
  ];
  const shrinkHeaderRowIdx = 5;
  formatHeaders(wsShrink, shrinkHeaders, shrinkHeaderRowIdx);

  const shrinkStartRow = 6;
  stockAdjustments.forEach((adj, idx) => {
    const rowNum = shrinkStartRow + idx;
    const kg = Math.abs(Number(adj.lost_weight_kg || (adj as any).weight_change_kg || 0));
    const bags = Math.abs(Number(adj.lost_bags || (adj as any).bags_change || 0));
    const rateMon = Number(adj.wac_at_time || (adj as any).cost_per_mon || 0);
    const lossAmt = Math.abs(Number(adj.cost_value || (adj as any).financial_impact || 0));

    const r = wsShrink.addRow([
      idx + 1,
      adj.adjustment_date || '',
      adj.commodity_name || 'সাধারণ শস্য',
      adj.reason || 'প্রাকৃতিক শুকতি ও আর্দ্রতা হ্রাস',
      kg,
      { formula: `E${rowNum}/40`, result: kg / 40.0 },
      bags,
      rateMon,
      lossAmt,
      adj.notes || 'অনুমোদিত',
    ]);
    r.height = 20;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 10; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 2, 4, 10].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cCol === 3) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (cCol === 7) cell.numFmt = '#,##0';
        else cell.numFmt = '#,##0.00';
      }
    }
  });

  const shrinkEndRow = shrinkStartRow + stockAdjustments.length - 1;
  const shrinkTotalRow = wsShrink.addRow([
    'সর্বমোট',
    `${stockAdjustments.length} টি রেকর্ড`,
    '-',
    'সর্বমোট ক্ষতি:',
    stockAdjustments.length > 0 ? { formula: `SUM(E${shrinkStartRow}:E${shrinkEndRow})` } : 0,
    stockAdjustments.length > 0 ? { formula: `SUM(F${shrinkStartRow}:F${shrinkEndRow})` } : 0,
    stockAdjustments.length > 0 ? { formula: `SUM(G${shrinkStartRow}:G${shrinkEndRow})` } : 0,
    '-',
    stockAdjustments.length > 0 ? { formula: `SUM(I${shrinkStartRow}:I${shrinkEndRow})` } : 0,
    'স্টকে সমন্বিত',
  ]);
  shrinkTotalRow.height = 24;

  for (let cCol = 1; cCol <= 10; cCol++) {
    const cell = shrinkTotalRow.getCell(cCol);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.TOTAL_BG } };
    cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: PALETTE.TOTAL_TEXT } };
    cell.border = totalRowBorders;

    if ([1, 2, 3, 4, 8, 10].includes(cCol)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (cCol === 7) cell.numFmt = '#,##0';
      else cell.numFmt = '#,##0.00';
    }
  }

  autoFitColumns(wsShrink, 13, 35);

  // ============================================================================
  // SHEET 9: নোটবুক (Notes)
  // ============================================================================
  const wsNotes = wb.addWorksheet('নোটবুক (Notes)', {
    views: [{ showGridLines: true }],
  });

  addHeaderBanner(
    wsNotes,
    'মাহা এন্টারপ্রাইজ — ডিজিটাল নোটবুক ও ব্যবসায়িক মেমো',
    'ব্যবসায়িক গুরুত্বপূর্ণ সিদ্ধান্ত, হিসাবের চিরকুট ও জরুরি তথ্যাবলি',
    metaString,
    7
  );

  const noteHeaders = [
    'ক্রমিক',
    'শিরোনাম',
    'ক্যাটাগরি',
    'পিনকৃত অবস্থা',
    'বিস্তারিত নোটের বিষয়বস্তু',
    'তৈরির তারিখ',
    'সর্বশেষ আপডেট',
  ];
  const noteHeaderRowIdx = 5;
  formatHeaders(wsNotes, noteHeaders, noteHeaderRowIdx);

  notes.forEach((n, idx) => {
    const r = wsNotes.addRow([
      idx + 1,
      n.title || 'শিরোনামহীন নোট',
      n.category || 'সাধারণ',
      n.is_pinned === 1 ? '📌 পিনকৃত' : 'সাধারণ',
      n.content || '',
      n.created_at ? n.created_at.split('T')[0] : '',
      n.updated_at ? n.updated_at.split('T')[0] : '',
    ]);
    r.height = 22;
    const bg = idx % 2 === 0 ? PALETTE.ZEBRA_EVEN : PALETTE.ZEBRA_ODD;

    for (let cCol = 1; cCol <= 7; cCol++) {
      const cell = r.getCell(cCol);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { name: 'Segoe UI', size: 10, color: { argb: PALETTE.TEXT_DARK } };
      cell.border = cellBorders;

      if ([1, 3, 4, 6, 7].includes(cCol)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    }
  });

  autoFitColumns(wsNotes, 14, 50);

  // ============================================================================
  // 4. WRITE BUFFER & TRIGGER AUTO-DOWNLOAD
  // ============================================================================
  const buffer = await wb.xlsx.writeBuffer();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const fileName = `Maha_Enterprise_Backup_${dateStr}_${timeStr}.xlsx`;

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
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  return {
    success: true,
    fileName,
    message: `রয়্যাল এক্সেল ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে: ${fileName}`,
  };
}
