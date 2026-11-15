import * as XLSX from 'xlsx';
import { parseSmartNumber, toEnDigits, toBnDigits, parseNum } from './bengaliNumbers';

// Re-export number utility helpers
export { toBnDigits, toEnDigits, parseSmartNumber, parseNum };

export interface ParsedPartyRow {
  id: string;
  name: string;
  phone: string;
  address: string;
  partyType: 'BUYER' | 'SUPPLIER';
  openingDue: number;
  currentDue: number;
  totalJoma: number;
  totalKhoroch: number;
  notes: string;
  fileName?: string;
  sheetName?: string;
  sourceType: 'DUAL_COLUMN_LEDGER' | 'TABLE_ROW';
  ledgerEntries?: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    weight?: string | number;
    rate?: string | number;
    reference?: string;
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
  const cleanFileName = file.name.replace(/\.[^/.]+$/, '').trim();

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    // Convert sheet to 2D array of raw values
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows || rows.length === 0) continue;

    // A. CHECK FOR DUAL-COLUMN LEDGER (জমা ও খরচ পাশাপাশি কলাম)
    const dualLedger = detectAndParseDualColumnLedger(rows, sheetName, cleanFileName, targetType);
    if (dualLedger) {
      results.push(dualLedger);
      continue;
    }

    // B. CHECK FOR STANDARD TABLE ROWS
    const tableRows = detectAndParseStandardPartyTable(rows, sheetName, cleanFileName, targetType);
    if (tableRows.length > 0) {
      results.push(...tableRows);
    }
  }

  return results;
}

// Helper: Parse Dual-Column Ledger (Left: জমা, Right: খরচ)
function detectAndParseDualColumnLedger(
  rows: any[][],
  sheetName: string,
  fileName: string,
  targetType: 'BUYER' | 'SUPPLIER'
): ParsedPartyRow | null {
  let headerRowIndex = -1;
  let jomaDateCol = -1;
  let jomaMethodCol = -1;
  let jomaAmountCol = -1;
  let khorochDateCol = -1;
  let khorochMethodCol = -1;
  let khorochWeightCol = -1;
  let khorochRateCol = -1;
  let khorochAmountCol = -1;

  // Search first 15 rows for the dual-column table header
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    let jomaFound = false;
    let khorochFound = false;
    let dateCount = 0;

    for (let c = 0; c < row.length; c++) {
      const val = cellToStr(row[c]);
      if (/জমা|ক্রেডিট|আদায়|ইনফ্লো|Credit|Deposit/i.test(val)) {
        jomaFound = true;
      }
      if (/খরচ|ডেবিট|বাকি|ক্রয়|বিক্রি|আউটফ্লো|Debit|Expense/i.test(val)) {
        khorochFound = true;
      }
      if (/তারিখ|Date/i.test(val)) {
        dateCount++;
      }
    }

    // A header row is confirmed if:
    // 1) Both 'জমা' and 'খরচ' appear, OR
    // 2) Two 'তারিখ' columns appear across the row (Left date & Right date), OR
    // 3) Left has 'তারিখ'/'মাধ্যম' and Right has 'ওজন'/'দর'/'টাকা'
    if (
      (jomaFound && khorochFound) ||
      dateCount >= 2 ||
      (jomaFound && row.some((c: any) => /ওজন|দর|চালান/i.test(cellToStr(c))))
    ) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) return null;

  // Map individual column positions inside or immediately below the header row
  const headerRow = rows[headerRowIndex];
  const subHeaderRow = headerRowIndex + 1 < rows.length ? rows[headerRowIndex + 1] : [];

  for (let c = 0; c < Math.max(headerRow.length, subHeaderRow.length); c++) {
    const val = (cellToStr(headerRow[c]) + ' ' + cellToStr(subHeaderRow[c])).trim();
    if (/তারিখ|Date/i.test(val)) {
      if (c < 3 && jomaDateCol === -1) jomaDateCol = c;
      else if (c >= 3 && khorochDateCol === -1) khorochDateCol = c;
    }
    if (/মাধ্যম|বিবরণ|মারফত|চেক|Particulars|Method/i.test(val)) {
      if (c < 3 && jomaMethodCol === -1) jomaMethodCol = c;
      else if (c >= 3 && khorochMethodCol === -1) khorochMethodCol = c;
    }
    if (/টাকা|পরিমাণ|Amount|Tk/i.test(val)) {
      if (c < 4 && jomaAmountCol === -1) jomaAmountCol = c;
      else if (c >= 4 && khorochAmountCol === -1) khorochAmountCol = c;
    }
    if (/ওজন|বস্তা|কেজি|Weight|Qty/i.test(val) && khorochWeightCol === -1) {
      khorochWeightCol = c;
    }
    if (/দর|রেট|মূল্য|Rate|Price/i.test(val) && khorochRateCol === -1) {
      khorochRateCol = c;
    }
    if (/গাড়ী|ট্রাক|চালান|MDT|BOT|Vehicle|Challan/i.test(val) && khorochMethodCol === -1) {
      khorochMethodCol = c;
    }
  }

  // Fallback defaults if specific columns were not labeled with text
  if (jomaDateCol === -1) jomaDateCol = 0;
  if (jomaMethodCol === -1) jomaMethodCol = 1;
  if (jomaAmountCol === -1) jomaAmountCol = 2;
  if (khorochDateCol === -1) khorochDateCol = 3;
  if (khorochMethodCol === -1) khorochMethodCol = 4;
  if (khorochWeightCol === -1) khorochWeightCol = 5;
  if (khorochRateCol === -1) khorochRateCol = 6;
  if (khorochAmountCol === -1) khorochAmountCol = 7;

  // 1. EXTRACT PARTY NAME & ADDRESS FROM TOP BANNER (Rows 0 to headerRowIndex - 1)
  let extractedName = '';
  let extractedPhone = '';
  const addressLines: string[] = [];

  for (let r = 0; r < headerRowIndex; r++) {
    const row = rows[r];
    const rowCells = row.map(cellToStr).filter((s) => s.length > 0);
    if (rowCells.length === 0) continue;

    const rowFullText = rowCells.join(' ');

    // Check for phone number
    if (!extractedPhone) {
      const ph = cleanPhoneNumber(rowFullText);
      if (ph) extractedPhone = ph;
    }

    // Ignore generic title words
    const isGenericHeader = /^(?:জমা|খরচ|লেজার|খতিয়ান|হিসাব|বাকি|নগদ|তারিখ|টাকা|মহা\s*হিসাব)+$/i.test(rowFullText);
    if (isGenericHeader) continue;

    // First meaningful line is the party/organization name
    if (!extractedName) {
      const cleaned = rowFullText
        .replace(/^(?:নাম|গ্রাহক|পার্টি|মহাজন|ক্রেতা|সাপ্লায়ার|M\/S|MS)\s*[:：\-]?\s*/i, '')
        .replace(/[|,:;\-]/g, ' ')
        .trim();
      if (cleaned.length >= 2) {
        extractedName = cleaned;
      }
    } else {
      // Subsequent lines form the address
      const addrClean = rowFullText
        .replace(/^(?:ঠিকানা|গ্রাম|থানা|উপজেলা|জেলা|মোকাম|স্থান)\s*[:：\-]?\s*/i, '')
        .trim();
      if (addrClean.length >= 2 && !addressLines.includes(addrClean)) {
        addressLines.push(addrClean);
      }
    }
  }

  // Fallback party name resolution
  if (!extractedName || extractedName.length < 2) {
    const cleanSheet = sheetName.replace(/[0-9\._\-\(\)]/g, ' ').trim();
    if (cleanSheet.length >= 2 && !/^(?:Sheet|Page|Table|স্টক|বাকি|লেজার)/i.test(cleanSheet)) {
      extractedName = cleanSheet;
    } else if (fileName && !/^(?:Book|Sheet|Excel|Untitled|New)/i.test(fileName)) {
      extractedName = fileName;
    } else {
      extractedName = targetType === 'BUYER' ? 'খরিদ্দার (বাকি খাতা)' : 'মহাজন / পাওনাদার';
    }
  }

  // Refine Address from banner rows or fallback to filename location hints (e.g. পাবনা, নাটোর)
  let extractedAddress = addressLines.length > 0 ? addressLines.join(', ') : '';
  if (!extractedAddress || extractedAddress === 'চাচকৈড় বাজার, গুরুদাসপুর') {
    const locMatch = (extractedName + ' ' + (fileName || '')).match(/(পাবনা|নাটোর|গুরুদাসপুর|ঈশ্বরদী|ঢাকা|বগুড়া|বগুড়া|কুষ্টিয়া|কুষ্টিয়া|রাজশাহী|সিরাজগঞ্জ|চাটমোহর|বাঘাবাড়ী|বাঘাবাড়ী|সাঁথিয়া|সাঁথিয়া|সিংড়া|সিংড়া|বড়াইগ্রাম|বড়াইগ্রাম|আটঘরিয়া|আটঘরিয়া|ফরিদপুর|যশোর)/);
    if (locMatch) {
      extractedAddress = locMatch[1];
    } else {
      extractedAddress = 'চাচকৈড় বাজার, গুরুদাসপুর';
    }
  }

  // 2. PARSE TRANSACTION ROWS (Starting below the header rows)
  const ledgerEntries: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    weight?: string | number;
    rate?: string | number;
    reference?: string;
  }> = [];

  let totalJoma = 0;
  let totalKhoroch = 0;
  let extractedRemainingDue = 0;

  const startRow = subHeaderRow.some((c: any) => /তারিখ|টাকা|ওজন|দর/i.test(cellToStr(c)))
    ? headerRowIndex + 2
    : headerRowIndex + 1;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowFullStr = row.map(cellToStr).join(' ');

    // Check for footer summary / total rows
    if (/(?:সর্বমোট|মোট|মোট\s*জমা|মোট\s*খরচ|জের|অবঃ|অবশিষ্ট|Total|Balance)/i.test(rowFullStr)) {
      if (/(?:অবঃ|অবশিষ্ট|Balance)/i.test(rowFullStr)) {
        for (const cell of row) {
          const num = parseSmartNumber(cell);
          if (num > 0 && num !== totalJoma && num !== totalKhoroch) {
            extractedRemainingDue = num;
            break;
          }
        }
      }
      continue;
    }

    // LEFT: Joma (Deposit/Payment)
    const jomaAmt = parseSmartNumber(row[jomaAmountCol] || (jomaAmountCol > 0 ? row[jomaAmountCol - 1] : 0));
    const jomaDate = normalizeDate(row[jomaDateCol]);
    const jomaMethod = cellToStr(row[jomaMethodCol]);

    if (jomaAmt > 0) {
      totalJoma += jomaAmt;
      const desc = jomaMethod ? `জমা (${jomaMethod})` : 'নগদ জমা / আদায়';
      ledgerEntries.push({
        date: jomaDate,
        description: desc,
        debit: targetType === 'SUPPLIER' ? jomaAmt : 0, // Outflow to supplier
        credit: targetType === 'BUYER' ? jomaAmt : 0,   // Inflow from customer
        reference: jomaMethod,
      });
    }

    // RIGHT: Khoroch (Debit/Goods Purchase/Invoice)
    const khorochAmt = parseSmartNumber(row[khorochAmountCol] || (khorochAmountCol > 0 ? row[khorochAmountCol - 1] : 0));
    const khorochDate = normalizeDate(row[khorochDateCol]);
    const khorochRef = cellToStr(row[khorochMethodCol]);
    const khorochWeight = cellToStr(row[khorochWeightCol]);
    const khorochRate = cellToStr(row[khorochRateCol]);

    if (khorochAmt > 0) {
      totalKhoroch += khorochAmt;

      const descParts: string[] = [];
      if (khorochRef) descParts.push(khorochRef);
      if (khorochWeight && parseSmartNumber(khorochWeight) > 0) {
        descParts.push(`ওজন: ${toBnDigits(khorochWeight)} কেজি`);
      }
      if (khorochRate && parseSmartNumber(khorochRate) > 0) {
        descParts.push(`দর: ৳${toBnDigits(khorochRate)}`);
      }
      const desc = descParts.length > 0 ? descParts.join(' | ') : 'শস্য বাকি / চালান';

      ledgerEntries.push({
        date: khorochDate,
        description: desc,
        debit: targetType === 'BUYER' ? khorochAmt : 0,   // Goods to customer increases debt
        credit: targetType === 'SUPPLIER' ? khorochAmt : 0, // Goods from supplier increases payable
        weight: khorochWeight,
        rate: khorochRate,
        reference: khorochRef,
      });
    }
  }

  // Calculate net balance
  const calculatedNet = Math.max(0, totalKhoroch - totalJoma);
  const finalDue = extractedRemainingDue > 0 ? extractedRemainingDue : calculatedNet;

  return {
    id: `DUAL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: extractedName,
    phone: extractedPhone,
    address: extractedAddress,
    partyType: targetType,
    openingDue: finalDue,
    currentDue: finalDue,
    totalJoma,
    totalKhoroch,
    notes: `এক্সেল শিট (${sheetName}) হতে সংগৃহীত দ্বৈত-কলাম লেজার`,
    fileName,
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
  fileName: string,
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

    if (!nameVal || (rawDue === 0 && !phoneVal)) continue;

    items.push({
      id: `ROW-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
      name: nameVal,
      phone: phoneVal,
      address: addrVal || 'চাচকৈড় বাজার, গুরুদাসপুর',
      partyType: targetType,
      openingDue: rawOpen,
      currentDue: rawDue,
      totalJoma: 0,
      totalKhoroch: rawDue,
      notes: notesCol !== -1 ? cellToStr(row[notesCol]) : `এক্সেল শিট (${sheetName}) হতে ইমপোর্ট`,
      fileName,
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
