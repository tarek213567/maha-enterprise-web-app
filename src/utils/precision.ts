/**
 * High-Precision Decimal Utilities for Frontend Calculations
 */

export const SCALE_MONEY = 100;
export const SCALE_WEIGHT = 1000;

export const round2 = (n: number | string | undefined | null): number => {
  if (n === undefined || n === null || n === '') return 0;
  let num: number;
  if (typeof n === 'string') {
    // Normalize Bengali digits (০-৯) to English, replace Bengali danda, and strip currency symbols/commas
    const enStr = n.toString()
      .replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString())
      .replace(/।/g, '.')
      .replace(/[৳$,\s]/g, '');
    num = parseFloat(enStr) || 0;
  } else {
    num = Number(n) || 0;
  }
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export function roundMoney(value: number | string): number {
  return round2(value);
}

export function roundWeight(value: number | string): number {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
  return Math.round((num + Number.EPSILON) * SCALE_WEIGHT) / SCALE_WEIGHT;
}

export function addMoney(a: number, b: number): number {
  const pa = Math.round(a * SCALE_MONEY);
  const pb = Math.round(b * SCALE_MONEY);
  return (pa + pb) / SCALE_MONEY;
}

export function subMoney(a: number, b: number): number {
  const pa = Math.round(a * SCALE_MONEY);
  const pb = Math.round(b * SCALE_MONEY);
  return (pa - pb) / SCALE_MONEY;
}

export function multiplyMoney(mon: number, ratePerMon: number): number {
  return roundMoney(mon * ratePerMon);
}

export function addWeight(a: number, b: number): number {
  const wa = Math.round(a * SCALE_WEIGHT);
  const wb = Math.round(b * SCALE_WEIGHT);
  return (wa + wb) / SCALE_WEIGHT;
}

export function subWeight(a: number, b: number): number {
  const wa = Math.round(a * SCALE_WEIGHT);
  const wb = Math.round(b * SCALE_WEIGHT);
  return (wa - wb) / SCALE_WEIGHT;
}

