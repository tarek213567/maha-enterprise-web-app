const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const EN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
};

/**
 * Global number conversion function: English digits to Bengali numerals
 * e.g., "123.45" -> "১২৩.৪৫"
 */
export const toBengaliDigits = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return val.toString().replace(/[0-9]/g, (w) => bengaliDigits[+w]);
};

/**
 * Converts English numbers or string numbers to Bengali numerals (alias)
 */
export const toBnDigits = toBengaliDigits;

/**
 * Global number conversion function: Bengali numerals to English digits for calculations and database
 * e.g., "১২৩.৪৫" -> "123.45"
 */
export const toEnglishDigits = (val: string | number | undefined | null): string => {
  if (!val) return '';
  return val.toString().replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
};

/**
 * Converts Bengali numerals into standard English numerals for calculations (alias)
 */
export const toEnDigits = toEnglishDigits;

/**
 * Normalizes Bengali digits (০-৯) to standard English digits (0-9)
 */
export const normalizeBengaliDigits = toEnglishDigits;

/**
 * Smart Number Parsing:
 * Parses numeric inputs entered via English digits (e.g., '125.5') or
 * Bengali digits (e.g., '১২৫.৫' or '১,২৫,০০০.৫০' or with '৳' / '।')
 * cleanly into standard JavaScript number without breaking calculations.
 */
export function parseSmartNumber(input: string | number | undefined | null): number {
  if (input === undefined || input === null || input === '') return 0;
  if (typeof input === 'number') return isNaN(input) ? 0 : input;

  // Convert Bengali digits to English
  let cleaned = toEnDigits(input.trim());

  // Replace Bengali danda / full-stop with decimal point if used as decimal
  cleaned = cleaned.replace(/।/g, '.');

  // Strip currency symbols (৳, $, etc.), commas, spaces
  cleaned = cleaned.replace(/[৳$,\s]/g, '');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Bangladeshi / South Asian Lakh-Crore comma grouping (#,##,##,###.##)
 * e.g., 700000 -> "7,00,000.00"
 */
export const formatTaka = (amount: number | string | undefined | null): string => {
  if (amount === undefined || amount === null || amount === '') return '0.00';
  const num = typeof amount === 'number' ? (isNaN(amount) ? 0 : amount) : parseSmartNumber(amount);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * বাংলা সংখ্যায় রূপান্তরসহ বাংলাদেশি লাখ-কোটি কমা ফরম্যাটিং
 * e.g., 700000 -> "৭,০০,০০০.০০" অথবা showSymbol=true হলে "৳ ৭,০০,০০০.০০"
 */
export const formatTakaBn = (
  amount: number | string | undefined | null,
  showSymbol = false
): string => {
  const formatted = formatTaka(amount);
  const bnFormatted = formatted.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
  return showSymbol ? `৳ ${bnFormatted}` : bnFormatted;
};

/**
 * Formats a number according to the South Asian / Bangladeshi numbering format (Lakh, Crore)
 * e.g. 1234567 -> "12,34,567.00" or "১২,৩৪,৫৬৭.০০"
 * Default: useBnDigits = true (Bangla-First requirement), showSymbol = true
 */
export function formatBanglaCurrency(
  amount: number | string | undefined | null,
  useBnDigits = true,
  showSymbol = true
): string {
  const formattedEn = formatTaka(amount);
  const result = useBnDigits
    ? formattedEn.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[+d])
    : formattedEn;
  return showSymbol ? `৳ ${result}` : result;
}

/**
 * Format standard date YYYY-MM-DD into DD/MM/YYYY in English or Bengali
 * Default: useBn = true (Bangla-First requirement)
 */
export function formatDate(dateStr: string, useBn = true): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    return useBn ? toBnDigits(formatted) : formatted;
  }
  return useBn ? toBnDigits(dateStr) : dateStr;
}
