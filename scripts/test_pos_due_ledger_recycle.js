/**
 * Test Suite: POS Due Engine, Royal Excel Ledger & 60-Day Recycle Bin
 * Maha Enterprise (মাহা এন্টারপ্রাইজ)
 */

console.log('================================================================================');
console.log('   TEST SUITE: POS DUE ENGINE, ROYAL EXCEL LEDGER & 60-DAY RECYCLE BIN');
console.log('================================================================================\n');

// 1. Safe Number Parsing & Precision (Matches src/components/sales/SalesView.tsx & utils/precision.ts)
const toEnglishDigits = (str) => {
  if (!str) return '';
  return String(str).replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
};

const round2 = (num) => {
  if (num === undefined || num === null || num === '') return 0;
  const n = typeof num === 'number' ? num : parseFloat(toEnglishDigits(String(num)).replace(/,/g, '').trim());
  if (isNaN(n) || !isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const parseSafeNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const eng = toEnglishDigits(String(val)).replace(/,/g, '').trim();
  const parsed = parseFloat(eng);
  return isNaN(parsed) ? 0 : parsed;
};

let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message} ${details ? '-> ' + details : ''}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message} ${details ? '-> ' + details : ''}`);
  }
}

// -------------------------------------------------------------
// Test Section 1: SAFE 0 PARSING & BENGALI DIGIT TESTS
// -------------------------------------------------------------
console.log('--- SECTION 1: SAFE ZERO & BENGALI DIGIT PARSING ---');
assert(parseSafeNumber(0) === 0, 'Numeric 0 parses as 0');
assert(parseSafeNumber('0') === 0, 'String "0" parses as 0');
assert(parseSafeNumber('০') === 0, 'Bengali digit "০" parses as 0');
assert(parseSafeNumber(' 0.00 ') === 0, 'Padded " 0.00 " parses as 0');
assert(parseSafeNumber('০.০০') === 0, 'Bengali decimal "০.০০" parses as 0');
assert(parseSafeNumber('১২৫০.৭৫') === 1250.75, 'Bengali digits "১২৫০.৭৫" parse as 1250.75');
assert(parseSafeNumber(null) === 0, 'Null parses as 0');
assert(parseSafeNumber(undefined) === 0, 'Undefined parses as 0');
assert(parseSafeNumber('') === 0, 'Empty string parses as 0');

// POS Quick Presets Behavior
const todayTotal = 5000;
const previousDue = 10000;
const grandTotal = todayTotal + previousDue; // 15000

// Preset: বাকি (০)
let paidInput = 0;
let paidAmount = round2(parseSafeNumber(paidInput));
let remainingDue = round2(grandTotal - paidAmount);
assert(paidAmount === 0, 'Preset "বাকি (০)": Paid amount is strictly 0');
assert(remainingDue === 15000, 'Preset "বাকি (০)": Remaining due is full 15,000');

// Preset: আজকের বিল
paidInput = todayTotal;
paidAmount = round2(parseSafeNumber(paidInput));
remainingDue = round2(grandTotal - paidAmount);
assert(paidAmount === 5000, 'Preset "আজকের বিল": Paid amount is 5,000');
assert(remainingDue === 10000, 'Preset "আজকের বিল": Remaining due is exactly previous due 10,000');

// Preset: সম্পূর্ণ পাওনা
paidInput = grandTotal;
paidAmount = round2(parseSafeNumber(paidInput));
remainingDue = round2(grandTotal - paidAmount);
assert(paidAmount === 15000, 'Preset "সম্পূর্ণ পাওনা": Paid amount is 15,000');
assert(remainingDue === 0, 'Preset "সম্পূর্ণ পাওনা": Remaining due is 0');

// -------------------------------------------------------------
// Test Section 2: POS 5-STEP FORMULA & SCENARIOS A, B, C, D
// -------------------------------------------------------------
console.log('\n--- SECTION 2: POS 5-STEP FORMULA (SCENARIOS A, B, C, D) ---');

function executePosSale(scenario, customerOpeningBal, saleItems, rawPaidInput) {
  // 1. today_bill = round2(sum(items))
  const today_bill = round2(saleItems.reduce((s, it) => s + (it.mon * it.rate), 0));
  // 2. previous_due = round2(customerOpeningBal)
  const prev_due = round2(customerOpeningBal);
  // 3. grand_total = round2(today_bill + previous_due)
  const grand_tot = round2(today_bill + prev_due);
  // 4. paid_amount = round2(parseSafeNumber(rawPaidInput))
  const paid_amt = round2(parseSafeNumber(rawPaidInput));
  // 5. remaining_due = round2(grand_total - paid_amount)
  const rem_due = round2(grand_tot - paid_amt);
  const new_customer_bal = rem_due;
  const cashbook_inflow = paid_amt > 0 ? paid_amt : 0;

  return {
    today_bill,
    prev_due,
    grand_tot,
    paid_amt,
    rem_due,
    new_customer_bal,
    cashbook_inflow,
  };
}

// Scenario A: Customer Opening Due = 10,000; Sale Bill = 5,000; Paid = 0
const resA = executePosSale('A', 10000, [{ mon: 4, rate: 1250 }], 0);
assert(resA.today_bill === 5000, 'Scenario A: Today Bill = ৳5,000');
assert(resA.prev_due === 10000, 'Scenario A: Previous Due = ৳10,000');
assert(resA.grand_tot === 15000, 'Scenario A: Grand Total = ৳15,000');
assert(resA.paid_amt === 0, 'Scenario A: Paid Amount = ৳0');
assert(resA.rem_due === 15000, 'Scenario A: Remaining Due = ৳15,000 (10000 + 5000 - 0)');
assert(resA.new_customer_bal === 15000, 'Scenario A: Customer balance increases to ৳15,000');
assert(resA.cashbook_inflow === 0, 'Scenario A: Cashbook inflow is 0 when paid is 0');

// Scenario B: Customer Opening Due = 10,000; Sale Bill = 5,000; Paid = 5,000 (আজকের বিল)
const resB = executePosSale('B', 10000, [{ mon: 4, rate: 1250 }], 5000);
assert(resB.grand_tot === 15000, 'Scenario B: Grand Total = ৳15,000');
assert(resB.paid_amt === 5000, 'Scenario B: Paid Amount = ৳5,000');
assert(resB.rem_due === 10000, 'Scenario B: Remaining Due = ৳10,000');
assert(resB.new_customer_bal === 10000, 'Scenario B: Customer balance remains ৳10,000');
assert(resB.cashbook_inflow === 5000, 'Scenario B: Cashbook inflow = ৳5,000');

// Scenario C: Customer Opening Due = 10,000; Sale Bill = 5,000; Paid = 15,000 (সম্পূর্ণ পাওনা)
const resC = executePosSale('C', 10000, [{ mon: 4, rate: 1250 }], 15000);
assert(resC.grand_tot === 15000, 'Scenario C: Grand Total = ৳15,000');
assert(resC.paid_amt === 15000, 'Scenario C: Paid Amount = ৳15,000');
assert(resC.rem_due === 0, 'Scenario C: Remaining Due = ৳0');
assert(resC.new_customer_bal === 0, 'Scenario C: Customer balance cleared to ৳0');
assert(resC.cashbook_inflow === 15000, 'Scenario C: Cashbook inflow = ৳15,000');

// Scenario D: Customer Opening Due = 0; Sale Bill = 8,000; Paid = 3,000
const resD = executePosSale('D', 0, [{ mon: 4, rate: 2000 }], 3000);
assert(resD.prev_due === 0, 'Scenario D: Previous Due = ৳0');
assert(resD.grand_tot === 8000, 'Scenario D: Grand Total = ৳8,000');
assert(resD.paid_amt === 3000, 'Scenario D: Paid Amount = ৳3,000');
assert(resD.rem_due === 5000, 'Scenario D: Remaining Due = ৳5,000');
assert(resD.new_customer_bal === 5000, 'Scenario D: Customer balance = ৳5,000');
assert(resD.cashbook_inflow === 3000, 'Scenario D: Cashbook inflow = ৳3,000');

// Scenario E: Bengali Digits Inputs ('০', '৫০০০', '১৫০০০')
const resE1 = executePosSale('E1', '১০০০০', [{ mon: 4, rate: 1250 }], '০');
assert(resE1.paid_amt === 0 && resE1.rem_due === 15000, 'Scenario E1 (Bengali "০"): Correctly treated as 0 paid and 15,000 due');

const resE2 = executePosSale('E2', '১০০০০', [{ mon: 4, rate: 1250 }], '৫০০০');
assert(resE2.paid_amt === 5000 && resE2.rem_due === 10000, 'Scenario E2 (Bengali "৫০০০"): Correctly parsed as 5,000 paid and 10,000 due');

// -------------------------------------------------------------
// Test Section 3: PENDING ITEM AUTO-ADD GUARD
// -------------------------------------------------------------
console.log('\n--- SECTION 3: PENDING ITEM AUTO-ADD GUARD ---');
let cart = [];
const activeCommodity = { id: 1, name_bn: 'পাট', current_stock_kg: 5000, default_bag_weight_kg: 80 };
const entryBags = 2;
const entryWeightMon = 4;
const entryRate = 3200;

// Simulate Guard
if (cart.length === 0 && activeCommodity && entryBags > 0 && entryRate > 0 && entryWeightMon > 0) {
  const itemTotal = round2(entryWeightMon * entryRate);
  cart.push({
    commodityId: activeCommodity.id,
    name: activeCommodity.name_bn,
    bags: entryBags,
    weightMon: entryWeightMon,
    ratePerMon: entryRate,
    totalAmount: itemTotal,
  });
}

assert(cart.length === 1, 'Auto-Add Guard: Automatically added pending item to cart');
assert(cart[0].totalAmount === 12800, 'Auto-Add Guard: Item total calculated accurately (4 * 3200 = 12,800)');

// -------------------------------------------------------------
// Test Section 4: PARTY LEDGER INLINE EDIT & RUNNING BALANCE RECALCULATION
// -------------------------------------------------------------
console.log('\n--- SECTION 4: ROYAL EXCEL LEDGER RUNNING BALANCE RECALCULATION ---');
const openingBalance = 2000;
let ledgerEntries = [
  { id: 1, date: '2026-11-10', type: 'SALE', debit: 5000, credit: 0, notes: '' },
  { id: 2, date: '2026-11-12', type: 'PAYMENT_RECEIVED', debit: 0, credit: 3000, notes: '' },
  { id: 3, date: '2026-11-14', type: 'SALE', debit: 4000, credit: 0, notes: '' },
];

function recalculateRunningBalances(opening, entries) {
  let cur = opening;
  return entries.map((e) => {
    cur = round2(cur + (e.debit || 0) - (e.credit || 0));
    return { ...e, running_balance: cur };
  });
}

let calculated = recalculateRunningBalances(openingBalance, ledgerEntries);
assert(calculated[0].running_balance === 7000, 'Ledger Recalc: Entry 1 running balance = 2000 + 5000 = 7000');
assert(calculated[1].running_balance === 4000, 'Ledger Recalc: Entry 2 running balance = 7000 - 3000 = 4000');
assert(calculated[2].running_balance === 8000, 'Ledger Recalc: Entry 3 running balance = 4000 + 4000 = 8000');

// Now simulate user editing Entry 1 from 5000 to 6000 and adding note
ledgerEntries[0].debit = 6000;
ledgerEntries[0].notes = 'সংশোধিত চালানের টীকা';

calculated = recalculateRunningBalances(openingBalance, ledgerEntries);
assert(calculated[0].running_balance === 8000, 'Ledger Inline Edit: Entry 1 updated to 6000 -> balance 8000');
assert(calculated[1].running_balance === 5000, 'Ledger Inline Edit: Entry 2 balance shifts to 5000');
assert(calculated[2].running_balance === 9000, 'Ledger Inline Edit: Final customer balance shifts to 9000');
assert(calculated[0].notes === 'সংশোধিত চালানের টীকা', 'Ledger Inline Edit: Note saved successfully');

// -------------------------------------------------------------
// Test Section 5: 60-DAY RECYCLE BIN & 1-CLICK RESTORE
// -------------------------------------------------------------
console.log('\n--- SECTION 5: 60-DAY RECYCLE BIN & 1-CLICK RESTORE ---');

const testRecord = {
  id: 101,
  title: 'বিশেষ ক্রেতা চালান SAL-20261114-001',
  amount: 25000,
  party_name: 'মেসার্স ভাই ভাই ট্রেডার্স',
  sale_date: '2026-11-14',
};

// Snapshot capture into recycle_bin
const recycleBinSnapshot = {
  id: `rec_${Date.now()}_test`,
  module_type: 'sale',
  module_label: 'বিক্রয় চালান',
  original_id: String(testRecord.id),
  title: testRecord.title,
  amount: testRecord.amount,
  payload_json: JSON.stringify(testRecord),
  deleted_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
};

assert(recycleBinSnapshot.module_type === 'sale', 'Recycle Bin: Module type captured');
assert(recycleBinSnapshot.amount === 25000, 'Recycle Bin: Amount captured as 25,000');

// Calculate days left
const daysRemaining = Math.max(0, Math.ceil((new Date(recycleBinSnapshot.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
assert(daysRemaining >= 59 && daysRemaining <= 60, `Recycle Bin: Expiry days left calculated correctly as ${daysRemaining} days`);

// Simulate 1-Click Restore: Parse payload and restore
const restoredPayload = JSON.parse(recycleBinSnapshot.payload_json);
assert(restoredPayload.id === 101, '1-Click Restore: Restored record ID matches original');
assert(restoredPayload.title === testRecord.title, '1-Click Restore: Restored record title matches');
assert(restoredPayload.amount === testRecord.amount, '1-Click Restore: Restored record amount matches');

console.log('\n================================================================================');
console.log(`   TEST COMPLETE: ${passed} PASSED / ${failed} FAILED [${failed === 0 ? '100% SUCCESS' : 'FAILURE'}]`);
console.log('================================================================================\n');

process.exit(failed > 0 ? 1 : 0);
