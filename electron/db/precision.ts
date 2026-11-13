/**
 * High-Precision Fixed-Point Arithmetic for Maha Enterprise Financials
 * Prevents IEEE-754 floating point rounding bugs (e.g. 0.1 + 0.2 = 0.30000000000000004)
 */

export const SCALE_MONEY = 100; // 2 decimal places (Paisa)
export const SCALE_WEIGHT = 1000; // 3 decimal places (Grams)

/**
 * Rounds monetary values to exact 2 decimal places using half-up Banker's epsilon
 */
export function roundMoney(value: number | string): number {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
  return Math.round((num + Number.EPSILON) * SCALE_MONEY) / SCALE_MONEY;
}

/**
 * Rounds weight in KG to exact 3 decimal places (Gram level precision)
 */
export function roundWeight(value: number | string): number {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
  return Math.round((num + Number.EPSILON) * SCALE_WEIGHT) / SCALE_WEIGHT;
}

/**
 * High-precision money addition
 */
export function addMoney(a: number, b: number): number {
  const pa = Math.round(a * SCALE_MONEY);
  const pb = Math.round(b * SCALE_MONEY);
  return (pa + pb) / SCALE_MONEY;
}

/**
 * High-precision money subtraction
 */
export function subMoney(a: number, b: number): number {
  const pa = Math.round(a * SCALE_MONEY);
  const pb = Math.round(b * SCALE_MONEY);
  return (pa - pb) / SCALE_MONEY;
}

/**
 * High-precision money multiplication (e.g. Mon * Rate)
 */
export function multiplyMoney(mon: number, ratePerMon: number): number {
  const exact = mon * ratePerMon;
  return roundMoney(exact);
}

/**
 * High-precision weight addition
 */
export function addWeight(a: number, b: number): number {
  const wa = Math.round(a * SCALE_WEIGHT);
  const wb = Math.round(b * SCALE_WEIGHT);
  return (wa + wb) / SCALE_WEIGHT;
}

/**
 * High-precision weight subtraction
 */
export function subWeight(a: number, b: number): number {
  const wa = Math.round(a * SCALE_WEIGHT);
  const wb = Math.round(b * SCALE_WEIGHT);
  return (wa - wb) / SCALE_WEIGHT;
}

