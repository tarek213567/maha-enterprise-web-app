/**
 * Bangladeshi Wholesale Grain Weight Conversion Utilities
 * 1 Mon (মন) = 40 KG (কেজি)
 */

import { toBnDigits } from './bengaliNumbers';
import { roundWeight } from './precision';

export const MON_KG = 40.0;

export interface WeightBreakdown {
  mon: number;
  kg: number;
  totalKg: number;
  totalMon: number;
}

/**
 * Converts Mon and KG into total KG with high precision
 */
export function monKgToTotalKg(mon: number | string, kg: number | string): number {
  const m = Number(mon) || 0;
  const k = Number(kg) || 0;
  return roundWeight(m * MON_KG + k);
}

/**
 * Converts total KG into Mon and remainder KG
 */
export function totalKgToMonKg(totalKg: number | string): { mon: number; kg: number; totalMon: number } {
  const t = roundWeight(Number(totalKg) || 0);
  const mon = Math.floor(t / MON_KG);
  const kg = roundWeight(t % MON_KG);
  const totalMon = roundWeight(t / MON_KG);
  return { mon, kg, totalMon };
}

/**
 * Calculates net weight after subtracting empty bag tare weights
 */
export function calculateNetWeight(
  grossKg: number | string,
  bagsCount: number | string,
  deductionPerBagKg: number | string = 0.85
): {
  grossKg: number;
  bagsCount: number;
  bagDeductionKg: number;
  netKg: number;
  netMon: number;
  netMonWhole: number;
  netKgRemainder: number;
} {
  const gross = roundWeight(Number(grossKg) || 0);
  const bags = parseInt(bagsCount?.toString() || '0', 10) || 0;
  const deductionRate = Number(deductionPerBagKg) || 0;
  const bagDeductionKg = roundWeight(bags * deductionRate);
  const netKg = Math.max(0, roundWeight(gross - bagDeductionKg));
  const netMon = roundWeight(netKg / MON_KG);
  const netMonWhole = Math.floor(netKg / MON_KG);
  const netKgRemainder = roundWeight(netKg % MON_KG);

  return {
    grossKg: gross,
    bagsCount: bags,
    bagDeductionKg,
    netKg,
    netMon,
    netMonWhole,
    netKgRemainder,
  };
}

/**
 * Formats weight nicely for receipts and tables in Bengali numerals
 * e.g. "৫০ মন ২০ কেজি" or "৫০.৫০০ মন"
 */
export function formatWeightBn(totalKg: number, useBnDigits = true): string {
  const { mon, kg } = totalKgToMonKg(totalKg);
  const monStr = useBnDigits ? toBnDigits(mon) : mon.toString();
  const kgStr = useBnDigits ? toBnDigits(kg) : kg.toString();

  if (mon === 0 && kg === 0) return useBnDigits ? '০ মন' : '0 মন';
  if (mon === 0) return `${kgStr} কেজি`;
  if (kg === 0) return `${monStr} মন`;
  return `${monStr} মন ${kgStr} কেজি`;
}
