import { toBnDigits } from './bengaliNumbers';

const BENGALI_WEEKDAYS = [
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
  'শনিবার',
];

const GREGORIAN_BENGALI_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const BANGLA_MONTHS = [
  'বৈশাখ',
  'জ্যৈষ্ঠ',
  'আষাঢ়',
  'শ্রাবণ',
  'ভাদ্র',
  'আশ্বিন',
  'কার্তিক',
  'অগ্রহায়ণ',
  'পৌষ',
  'মাঘ',
  'ফাল্গুন',
  'চৈত্র',
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns formatted Gregorian date in Bengali (e.g. "শনিবার, ১৪ নভেম্বর ২০২৬")
 */
export function getGregorianDateInBengali(date: Date = new Date()): {
  weekday: string;
  day: string;
  month: string;
  year: string;
  fullText: string;
} {
  const weekday = BENGALI_WEEKDAYS[date.getDay()];
  const day = toBnDigits(date.getDate());
  const month = GREGORIAN_BENGALI_MONTHS[date.getMonth()];
  const year = toBnDigits(date.getFullYear());
  const fullText = `${weekday}, ${day} ${month} ${year}`;

  return { weekday, day, month, year, fullText };
}

/**
 * Calculates the accurate Bengali Calendar Date (বঙ্গাব্দ)
 * based on the revised Bangladesh Bangla Academy calendar rules.
 * e.g., November 14, 2026 -> "২৯ কার্তিক ১৪৩৩ বঙ্গাব্দ"
 */
export function getBanglaBongabdoDate(date: Date = new Date()): {
  dayBn: string;
  monthBn: string;
  yearBn: string;
  fullText: string;
} {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth(); // 0-indexed (0 = Jan, 10 = Nov)
  const gDate = date.getDate();

  // Reference midday UTC to avoid any daylight saving or local timezone shift
  const targetUtc = Date.UTC(gYear, gMonth, gDate, 12, 0, 0);
  const startOfYearUtc = Date.UTC(gYear, 3, 14, 12, 0, 0); // April 14 (১ বৈশাখ)

  let bYear: number;
  let dayOffset: number;

  if (targetUtc >= startOfYearUtc) {
    bYear = gYear - 593;
    dayOffset = Math.round((targetUtc - startOfYearUtc) / 86400000);
  } else {
    bYear = gYear - 594;
    const prevStartUtc = Date.UTC(gYear - 1, 3, 14, 12, 0, 0);
    dayOffset = Math.round((targetUtc - prevStartUtc) / 86400000);
  }

  // Falgun is month index 10.
  // If current date is Jan-Apr, Falgun belongs to Gregorian gYear.
  // If current date is May-Dec, Falgun of this Bongabdo year belongs to Gregorian gYear + 1.
  const falgunYear = gMonth <= 3 ? gYear : gYear + 1;
  const falgunDays = isLeapYear(falgunYear) ? 30 : 29;

  // Revised Bangla Academy month lengths:
  // Boishakh to Ashwin (6 months) = 31 days each
  // Kartik to Magh (4 months) = 30 days each
  // Falgun = 29 days (30 in leap year)
  // Chaitra = 30 days
  const monthLengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, falgunDays, 30];

  let bMonthIndex = 0;
  let bDay = dayOffset + 1;

  for (let i = 0; i < 12; i++) {
    if (bDay <= monthLengths[i]) {
      bMonthIndex = i;
      break;
    }
    bDay -= monthLengths[i];
  }

  const dayBn = toBnDigits(bDay);
  const monthBn = BANGLA_MONTHS[bMonthIndex];
  const yearBn = toBnDigits(bYear);
  const fullText = `${dayBn} ${monthBn} ${yearBn} বঙ্গাব্দ`;

  return { dayBn, monthBn, yearBn, fullText };
}
