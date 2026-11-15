import * as XLSX from 'xlsx';
import { parseSmartNumber, toEnDigits } from './bengaliNumbers';

export interface ParsedPartyRow {
  id: string;
  name: string;
  phone: string;
  address: string;
  openingDue: number;
  currentDue: number;
  notes: string;
  sheetName?: string;
  sourceType: 'DUAL_COLUMN_LEDGER' | 'TABLE_ROW';
  ledgerEntries?: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
  }>;
  selected: boolean;
}

export interface ParsedStockRow {
  id: string;
  name_bn: string;
  name_en: string;
  default_bag_weight_kg: number;
  bags_count: number;
  weight_kg: number;
  weight_mon: number;
  rate_per_mon: number;
  rate_per_kg: number;
  total_value: number;
  mode: 'ADD' | 'REPLACE';
  matchedCommodityId?: number;
  isNew: boolean;
  selected: boolean;
}

// ----------------------------------------------------------------------------
// HELPER: Extract raw string safely from cell
// ----------------------------------------------------------------------------
function cellToStr(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

// ----------------------------------------------------------------------------
// HELPER: Clean Bangladeshi Phone Numbers
// ----------------------------------------------------------------------------
export function cleanPhoneNumber(raw: any): string {
  if (!raw) return '';
  const digits = toEnDigits(String(raw)).replace(/[^0-9]/g, '');
  // Match standard 11 digits: 01XXXXXXXXX
  const match = digits.match(/01[3-9]\d{8}/);
  if (match) return match[0];
  if (digits.length >= 11) return digits.slice(-11);
  return digits;
}

// ----------------------------------------------------------------------------
// HELPER: Normalize Date string to YYYY-MM-DD
// ----------------------------------------------------------------------------
export function normalizeDate(raw: any): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  if (raw instanceof Date) return raw.toISOString().split('T')[0];

  const str = toEnDigits(String(raw)).trim();
  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const m = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// 1. SMART CUSTOMER & CREDITOR EXCEL PARSER
// ============================================================================
export async function parsePartiesFromExcel(
  file: File,
  targetType: 'BUYER' | 'SUPPLIER'
): Promise<ParsedPartyRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const results: ParsedPartyRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    // Convert sheet to 2D array of raw values
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    // A. CHECK FOR DUAL-COLUMN LEDGER (জমা ও খরচ পাশাপাশি কলাম)
    const dualLedger = detectAndParseDualColumnLedger(rows, sheetName, targetType);
    if (dualLedger) {
      results.push(dualLedger);
      continue;
    }

    // B. CHECK FOR STANDARD TABLE ROWS
    const tableRows = detectAndParseStandardPartyTable(rows, sheetName, targetType);
    if (tableRows.length > 0) {
      results.push(...tableRows);
    }
  }

  return results;
}

// Helper: Parse Dual-Column Ledger
function detectAndParseDualColumnLedger(
  rows: any[][],
  sheetName: string,
  targetType: 'BUYER' | 'SUPPLIER'
): ParsedPartyRow | null {
  // Check if first 8 rows have dual-column hints (e.g. জমা in col A-C and খরচ in col D-H)
  let headerRowIndex = -1;
  let jomaCol = -1;
  let khorochCol = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const val = cellToStr(row[c]);
      if (/জমা|ক্রেডিট|আদায়|ইনফ্লো|Credit|Deposit/i.test(val) && jomaCol === -1) {
        jomaCol = c;
      }
      if (/খরচ|ডেবিট|বাকি|ক্রয়|বিক্রি|আউটফ্লো|Debit|Expense/i.test(val) && khorochCol === -1) {
        khorochCol = c;
      }
    }
    if (jomaCol !== -1 && khorochCol !== -1) {
      headerRowIndex = r;
      break;
    }
  }

  // If no clear dual-column header found, return null
  if (headerRowIndex === -1) return null;

  // Extract Party Name, Address, Phone from top header rows (rows 0 to headerRowIndex)
  let extractedName = '';
  let extractedPhone = '';
  let extractedAddress = '';

  for (let r = 0; r <= headerRowIndex; r++) {
    const rowStr = rows[r].map(cellToStr).join(' ');
    // Phone
    if (!extractedPhone) {
      const ph = cleanPhoneNumber(rowStr);
      if (ph) extractedPhone = ph;
    }
    // Name hints
    if (!extractedName) {
      const nameMatch = rowStr.match(/(?:নাম|গ্রাহক|পার্টি|মহাজন|মেসার্স|শ্রী|মোঃ)\s*[:：\-]?\s*([^\s,;]+(?:\s+[^\s,;]+){1,4})/i);
      if (nameMatch) {
        extractedName = nameMatch[1].replace(/[|,:;\-]/g, '').trim();
      }
    }
    // Address hints
    if (!extractedAddress) {
      const addrMatch = rowStr.match(/(?:ঠিকানা|গ্রাম|স্থান|মোকাম)\s*[:：\-]?\s*([^\n\r,;]+)/i);
      if (addrMatch) {
        extractedAddress = addrMatch[1].trim();
      }
    }
  }

  // Fallback to sheet name if no party name found in banner
  if (!extractedName || extractedName.length < 2) {
    // Sanitize sheet name
    const cleanedSheet = sheetName.replace(/[0-9\._\-\(\)]/g, ' ').trim();
    if (cleanedSheet.length >= 2 && !/Sheet|Page|Table|স্টক|বাকি/i.test(cleanedSheet)) {
      extractedName = cleanedSheet;
    } else {
      extractedName = sheetName.trim();
    }
  }

  // Parse ledger entries line by line
  const ledgerEntries: Array<{ date: string; description: string; debit: number; credit: number }> = [];
  let totalJoma = 0;
  let totalKhoroch = 0;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const leftText = cellToStr(row[jomaCol]);
    const rightText = cellToStr(row[khorochCol]);

    // Skip summary / total rows
    const fullRowStr = row.map(cellToStr).join(' ');
    if (/সর্বমোট|মোট|মোট জমা|মোট খরচ|জের|অবঃ/i.test(fullRowStr)) {
      continue;
    }

    // Left side: Joma (Deposit/Payment)
    const jomaAmount = parseSmartNumber(row[jomaCol + 1] || row[jomaCol + 2] || row[jomaCol]);
    const jomaDate = normalizeDate(row[Math.max(0, jomaCol - 1)] || row[jomaCol]);
    const jomaDesc = cellToStr(row[jomaCol] || 'নগদ জমা / আদায়');

    if (jomaAmount > 0) {
      totalJoma += jomaAmount;
      ledgerEntries.push({
        date: jomaDate,
        description: jomaDesc,
        debit: targetType === 'SUPPLIER' ? jomaAmount : 0, // When paying supplier, debit
        credit: targetType === 'BUYER' ? jomaAmount : 0,   // When customer pays, credit
      });
    }

    // Right side: Khoroch (Debit/Due/Invoice)
    const khorochAmount = parseSmartNumber(row[khorochCol + 1] || row[khorochCol + 2] || row[khorochCol + 3] || row[khorochCol]);
    const khorochDate = normalizeDate(row[Math.max(0, khorochCol - 1)] || row[khorochCol]);
    const khorochDesc = cellToStr(row[khorochCol] || 'শস্য বাকি / চালান');

    if (khorochAmount > 0) {
      totalKhoroch += khorochAmount;
      ledgerEntries.push({
        date: khorochDate,
        description: khorochDesc,
        debit: targetType === 'BUYER' ? khorochAmount : 0,   // When customer buys, debit
        credit: targetType === 'SUPPLIER' ? khorochAmount : 0 // When shop buys from supplier, credit
      });
    }
  }

  // Calculate Net Due
  const calculatedDue = targetType === 'BUYER' ? Math.max(0, totalKhoroch - totalJoma) : Math.max(0, totalKhoroch - totalJoma);

  return {
    id: `DUAL-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: extractedName || (targetType === 'BUYER' ? 'খরিদ্দার' : 'মহাজন/সাপ্লায়ার'),
    phone: extractedPhone,
    address: extractedAddress || 'চাচকৈড় বাজার',
    openingDue: calculatedDue,
    currentDue: calculatedDue,
    notes: `এক্সেল শিট (${sheetName}) হতে সংগৃহীত দ্বৈত-কলাম লেজার`,
    sheetName,
    sourceType: 'DUAL_COLUMN_LEDGER',
    ledgerEntries,
    selected: true,
  };
}

// Helper: Parse Standard Party Table Rows
function detectAndParseStandardPartyTable(
  rows: any[][],
  sheetName: string,
  targetType: 'BUYER' | 'SUPPLIER'
): ParsedPartyRow[] {
  let headerRowIdx = -1;
  let nameCol = -1;
  let phoneCol = -1;
  let addrCol = -1;
  let dueCol = -1;
  let openCol = -1;
  let notesCol = -1;

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const val = cellToStr(row[c]);
      if (/^(?:নাম|গ্রাহকের নাম|ক্রেতার নাম|পার্টির নাম|পাওনাদার|মহাজন|বেপারী|কাস্টমার|সাপ্লায়ার|Name|Party|Customer|Supplier)$/i.test(val) && nameCol === -1) {
        nameCol = c;
      } else if (/মোবাইল|ফোন|মুঠোফোন|Phone|Mobile|Contact/i.test(val) && phoneCol === -1) {
        phoneCol = c;
      } else if (/ঠিকানা|গ্রাম|মোকাম|মার্কেট|Address|Location/i.test(val) && addrCol === -1) {
        addrCol = c;
      } else if (/(?:মোট\s*বাকি|বর্তমান\s*বাকি|বাকি|বকেয়া|পাওনা|দেনা|জের|Due|Balance|Payable|Receivable)/i.test(val) && dueCol === -1) {
        dueCol = c;
      } else if (/(?:প্রারম্ভিক|সাবেক|পূর্বের|Opening)/i.test(val) && openCol === -1) {
        openCol = c;
      } else if (/(?:মন্তব্য|নোট|বিবরণ|Notes|Remarks)/i.test(val) && notesCol === -1) {
        notesCol = c;
      }
    }

    if (nameCol !== -1 && (dueCol !== -1 || phoneCol !== -1)) {
      headerRowIdx = r;
      break;
    }
  }

  // If no header found, search fallback heuristics
  if (headerRowIdx === -1 || nameCol === -1) {
    // Try checking if Col 0 or Col 1 has names and another col has numbers
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const row = rows[r];
      if (row.length >= 2 && cellToStr(row[0]) && parseSmartNumber(row[row.length - 1]) > 0) {
        headerRowIdx = r - 1;
        nameCol = 0;
        dueCol = row.length - 1;
        break;
      }
    }
    if (headerRowIdx === -1 || nameCol === -1) return [];
  }

  const items: ParsedPartyRow[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const nameVal = cellToStr(row[nameCol]);
    if (!nameVal || /সর্বমোট|মোট|Total|Grand/i.test(nameVal)) continue;

    // Clean Phone
    const phoneVal = phoneCol !== -1 ? cleanPhoneNumber(row[phoneCol]) : '';
    // Clean Address
    const addrVal = addrCol !== -1 ? cellToStr(row[addrCol]) : '';
    // Due Amount
    const rawDue = dueCol !== -1 ? parseSmartNumber(row[dueCol]) : 0;
    const rawOpen = openCol !== -1 ? parseSmartNumber(row[openCol]) : rawDue;
    const notesVal = notesCol !== -1 ? cellToStr(row[notesCol]) : '';

    items.push({
      id: `ROW-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 5)}`,
      name: nameVal,
      phone: phoneVal,
      address: addrVal || 'চাচকৈড় বাজার',
      openingDue: rawOpen || rawDue,
      currentDue: rawDue || rawOpen,
      notes: notesVal || `এক্সেল ফাইল থেকে ইমপোর্ট (${sheetName})`,
      sheetName,
      sourceType: 'TABLE_ROW',
      selected: true,
    });
  }

  return items;
}

// ============================================================================
// 2. SMART WAREHOUSE STOCK EXCEL PARSER
// ============================================================================
export async function parseStockFromExcel(
  file: File,
  existingCommodities: Array<{ id: number; name_bn: string; default_bag_weight_kg: number }> = []
): Promise<ParsedStockRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const results: ParsedStockRow[] = [];

  // 1. Try finding our Royal Backup tab: "১. সকল শস্যের স্টক" or "সকল শস্যের স্টক"
  let targetSheetName = workbook.SheetNames.find((s) => /সকল শস্যের স্টক|স্টক|Stock|Inventory/i.test(s)) || workbook.SheetNames[0];
  const ws = workbook.Sheets[targetSheetName];
  if (!ws) return [];

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!rows || rows.length === 0) return [];

  // A. Check if Royal Backup format (Rows 1-6 banner, row 7 header)
  let headerRowIdx = -1;
  let nameCol = -1;
  let bagsCol = -1;
  let kgCol = -1;
  let monCol = -1;
  let rateMonCol = -1;
  let rateKgCol = -1;
  let bagWeightCol = -1;

  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const val = cellToStr(row[c]);
      if (/শস্যের নাম|পণ্যের নাম|শস্য|পণ্য|আইটেম|Commodity|Crop|Item/i.test(val) && nameCol === -1) {
        nameCol = c;
      } else if (/বস্তা সংখ্যা|মোট বস্তা|বস্তা|Bags/i.test(val) && bagsCol === -1) {
        bagsCol = c;
      } else if (/ওজন \(কেজি\)|নেট ওজন \(কেজি\)|কেজি|KG|Weight \(kg\)/i.test(val) && kgCol === -1) {
        kgCol = c;
      } else if (/ওজন \(মণ\)|নেট ওজন \(মণ\)|মণ|Mon|Maund/i.test(val) && monCol === -1) {
        monCol = c;
      } else if (/গড় ক্রয়মূল্য \(৳\/মণ\)|দর \(৳\/মণ\)|দর\/মণ|Rate\/Mon/i.test(val) && rateMonCol === -1) {
        rateMonCol = c;
      } else if (/গড় ক্রয়মূল্য \(৳\/কেজি\)|দর \(৳\/কেজি\)|দর\/কেজি|Rate\/Kg/i.test(val) && rateKgCol === -1) {
        rateKgCol = c;
      } else if (/বস্তার গড় ওজন|ব্যাগ ওজন|Default Bag/i.test(val) && bagWeightCol === -1) {
        bagWeightCol = c;
      }
    }

    if (nameCol !== -1 && (bagsCol !== -1 || kgCol !== -1 || monCol !== -1)) {
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1 || nameCol === -1) {
    return [];
  }

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const nameVal = cellToStr(row[nameCol]);
    if (!nameVal || /সর্বমোট|মোট|Grand Total|Total/i.test(nameVal)) continue;

    const bags = bagsCol !== -1 ? Math.round(parseSmartNumber(row[bagsCol])) : 0;
    let kg = kgCol !== -1 ? parseSmartNumber(row[kgCol]) : 0;
    let mon = monCol !== -1 ? parseSmartNumber(row[monCol]) : 0;

    // Cross-convert Maund and Kg (1 Maund = 40 Kg)
    if (kg > 0 && mon === 0) mon = kg / 40.0;
    else if (mon > 0 && kg === 0) kg = mon * 40.0;

    // Rates
    let rateMon = rateMonCol !== -1 ? parseSmartNumber(row[rateMonCol]) : 0;
    let rateKg = rateKgCol !== -1 ? parseSmartNumber(row[rateKgCol]) : 0;

    if (rateMon > 0 && rateKg === 0) rateKg = rateMon / 40.0;
    else if (rateKg > 0 && rateMon === 0) rateMon = rateKg * 40.0;

    // Bag default weight
    let bagWeight = bagWeightCol !== -1 ? parseSmartNumber(row[bagWeightCol]) : 0;
    if (bagWeight <= 0 && bags > 0 && kg > 0) {
      bagWeight = Math.round((kg / bags) * 10) / 10;
    }
    if (bagWeight <= 0) bagWeight = 75.0;

    const totalVal = kg * rateKg;

    // Check if matches existing commodity
    const matched = existingCommodities.find(
      (c) => c.name_bn.trim() === nameVal.trim() || c.name_bn.includes(nameVal) || nameVal.includes(c.name_bn)
    );

    results.push({
      id: `STOCK-ROW-${r}-${Date.now()}`,
      name_bn: nameVal,
      name_en: matched ? '' : nameVal,
      default_bag_weight_kg: bagWeight,
      bags_count: bags,
      weight_kg: Math.round(kg * 100) / 100,
      weight_mon: Math.round(mon * 100) / 100,
      rate_per_mon: Math.round(rateMon * 100) / 100,
      rate_per_kg: Math.round(rateKg * 100) / 100,
      total_value: Math.round(totalVal),
      mode: 'ADD', // Default to 'ADD', user can toggle to 'REPLACE'
      matchedCommodityId: matched ? matched.id : undefined,
      isNew: !matched,
      selected: true,
    });
  }

  return results;
}
