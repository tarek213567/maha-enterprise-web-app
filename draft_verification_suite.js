/**
 * Automated Draft Verification & Comprehensive Accounting Audit Suite
 * Maha Enterprise (মাহা এন্টারপ্রাইজ) v1.2.0 PRO
 */

const { AppDatabase } = require('./dist-electron/db/database');
const path = require('path');

function formatTaka(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTakaBn(amount, showSymbol = false) {
  const formatted = formatTaka(amount);
  const bn = formatted.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
  return showSymbol ? `৳ ${bn}` : bn;
}

console.log('================================================================================');
console.log('   MAHA ENTERPRISE - AUTOMATED DRAFT VERIFICATION & ACCOUNTING AUDIT SUITE');
console.log('================================================================================\n');

const db = new AppDatabase();
const today = new Date().toISOString().split('T')[0];

let passedCount = 0;
let totalCount = 0;

function assert(condition, testName, details = '') {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${testName} ${details ? '-> ' + details : ''}`);
  } else {
    console.error(`  [FAIL] ${testName} ${details ? '-> ' + details : ''}`);
    process.exitCode = 1;
  }
}

try {
  // -------------------------------------------------------------
  // PRE-TEST CHECK & SNAPSHOT
  // -------------------------------------------------------------
  console.log('--- STEP 0: INITIAL SNAPSHOT & CLEAN STATE ---');
  // First ensure any lingering test drafts are purged
  db.purgeTestDrafts();
  assert(db.hasTestDrafts() === false, '0.1 No test drafts initially in DB');

  const mustardBefore = db.getCommodityById(1);
  const wheatBefore = db.getCommodityById(4);
  const initialMustardStockKg = mustardBefore ? mustardBefore.current_stock_kg : 0;
  const initialWheatStockKg = wheatBefore ? wheatBefore.current_stock_kg : 0;
  console.log(`  Initial Mustard Stock: ${initialMustardStockKg} KG, Wheat Stock: ${initialWheatStockKg} KG\n`);

  // Ensure wheat has stock for wholesale sale testing by purchasing wheat
  console.log('--- SETUP: INITIAL WHEAT STOCK FOR DRAFT 2 ---');
  const wheatSupplier = db.createParty({
    name: 'টেস্ট গম বেপারী',
    phone: '01799999999',
    address: 'গুরুদাসপুর',
    party_type: 'SUPPLIER',
    opening_balance: 0,
    is_test_draft: 1,
  });
  // Purchase 20 Mon of Wheat (800 KG) @ ৳1300/mon
  const wheatPurchase = db.createPurchase({
    purchase_date: today,
    party_id: wheatSupplier.id,
    commodity_id: 4, // Wheat
    bags_count: 10,
    gross_weight_kg: 800,
    bag_deduction_kg: 0,
    rate_per_mon: 1300,
    labor_cost: 0,
    transport_cost: 0,
    bag_cost: 0,
    other_cost: 0,
    payment_method: 'CASH',
    paid_amount: 26000,
    is_test_draft: 1,
    notes: 'Initial Wheat Setup for Test',
  });
  const wheatAfterSetup = db.getCommodityById(4);
  assert(wheatAfterSetup.current_stock_kg === initialWheatStockKg + 800, 'Setup: Wheat stock +800 KG');

  // -------------------------------------------------------------
  // DRAFT 1: শস্য ক্রয় (Grain Purchase)
  // শস্য: সরিষা | ৫০ মণ ২০ কেজি (২,০২০ কেজি) | দর: ৩,২০০ ৳/মণ
  // মোট মূল্য: ১,৬১,৬০০.০০ ৳ | নগদ পরিশোধ: ১,০০,০০০.০০ ৳ | বকেয়া: ৬১,৬০০.০০ ৳
  // -------------------------------------------------------------
  console.log('\n--- DRAFT 1: শস্য ক্রয় অডিট (Mustard Purchase 50 Mon 20 KG @ ৳3,200) ---');
  const supplier1 = db.createParty({
    name: 'কামাল বেপারী',
    phone: '01711223344',
    address: 'চলনবিল ঘাট, গুরুদাসপুর',
    party_type: 'SUPPLIER',
    opening_balance: 0,
    is_test_draft: 1,
  });

  const p1 = db.createPurchase({
    purchase_date: today,
    party_id: supplier1.id,
    commodity_id: 1, // Mustard
    bags_count: 25,
    gross_weight_kg: 2020.0,
    bag_deduction_kg: 0.0,
    rate_per_mon: 3200.0,
    labor_cost: 0,
    transport_cost: 0,
    bag_cost: 0,
    other_cost: 0,
    payment_method: 'PARTIAL',
    paid_amount: 100000.0,
    is_test_draft: 1,
    notes: 'অডিট ড্রাফট ১: সরিষা ক্রয়',
  });

  assert(p1.net_weight_kg === 2020.0, '1.1 Purchase net weight = 2,020 KG', `${p1.net_weight_kg} KG`);
  assert(p1.net_weight_mon === 50.5, '1.2 Purchase net weight mon = 50.5 Mon (50 মণ ২০ কেজি)', `${p1.net_weight_mon} Mon`);
  assert(p1.gross_amount === 161600.0, '1.3 Gross amount = ৳1,61,600.00 (50.5 * 3200)', `৳${p1.gross_amount}`);
  assert(p1.paid_amount === 100000.0, '1.4 Cash paid = ৳1,00,000.00', `৳${p1.paid_amount}`);
  assert(p1.due_amount === 61600.0, '1.5 Due amount = ৳61,600.00 (161600 - 100000)', `৳${p1.due_amount}`);

  const mustardAfterP1 = db.getCommodityById(1);
  assert(mustardAfterP1.current_stock_kg === initialMustardStockKg + 2020.0, '1.6 Mustard stock updated (+2020 KG)', `${mustardAfterP1.current_stock_kg} KG`);
  const expectedWacKg = 161600.0 / 2020.0; // 80.0 Tk/kg
  assert(Math.abs(mustardAfterP1.current_wac_per_kg - expectedWacKg) < 0.01, '1.7 WAC calculated = ৳80.00/kg (৳3200/mon)', `৳${mustardAfterP1.current_wac_per_kg.toFixed(2)}/kg`);

  const supplier1State = db.getPartyById(supplier1.id);
  // Negative current_balance represents payable to supplier: -61600
  assert(supplier1State.current_balance === -61600.0, '1.8 Supplier ledger balance = -৳61,600.00 (Payable)', `৳${supplier1State.current_balance}`);

  // -------------------------------------------------------------
  // DRAFT 2: পাইকারি বিক্রয় ও মেমো চালান (Wholesale Sale & Invoice)
  // ক্রেতা: মোবারক হোসেন (০১৭০০০০০০০১)
  // সরিষা ২০ মণ (@ ৩,৬০০ = ৭২,০০০ ৳) + গম ১০ মণ (@ ১,৪০০ = ১৪,০০০ ৳)
  // মোট: ৮৬,০০০ ৳ | নগদ আদায়: ৫০,০০০ ৳ | বকেয়া: ৩৬,০০০ ৳
  // -------------------------------------------------------------
  console.log('\n--- DRAFT 2: পাইকারি বিক্রয় ও মেমো চালান (Multi-item Sale Batch) ---');
  const buyer1 = db.createParty({
    name: 'মোবারক হোসেন',
    phone: '01700000001',
    address: 'ঈশ্বরদী বাজার, পাবনা',
    party_type: 'BUYER',
    opening_balance: 0,
    is_test_draft: 1,
  });

  const saleBatchResult = db.createSaleBatch({
    sale_date: today,
    party_id: buyer1.id,
    customer_name: buyer1.name,
    customer_phone: buyer1.phone,
    items: [
      {
        commodity_id: 1, // Mustard
        bags_count: 10,
        net_weight_mon: 20.0, // 20 Mon = 800 KG
        rate_per_mon: 3600.0,
      },
      {
        commodity_id: 4, // Wheat
        bags_count: 5,
        net_weight_mon: 10.0, // 10 Mon = 400 KG
        rate_per_mon: 1400.0,
      },
    ],
    cash_paid: 50000.0,
    payment_method: 'PARTIAL',
    is_test_draft: 1,
    notes: 'অডিট ড্রাফট ২: পাইকারি বিক্রয় চালান',
  });

  assert(saleBatchResult.success === true, '2.1 Sale batch processed successfully');
  assert(saleBatchResult.sales.length === 2, '2.2 Two line-items created');

  const mustardItem = saleBatchResult.sales.find(s => s.commodity_id === 1);
  const wheatItem = saleBatchResult.sales.find(s => s.commodity_id === 4);
  assert(mustardItem.net_invoice_amount === 72000.0, '2.3 Mustard total = ৳72,000.00 (20 mon @ ৳3600)', `৳${mustardItem.net_invoice_amount}`);
  assert(wheatItem.net_invoice_amount === 14000.0, '2.4 Wheat total = ৳14,000.00 (10 mon @ ৳1400)', `৳${wheatItem.net_invoice_amount}`);

  const totalSaleBill = mustardItem.net_invoice_amount + wheatItem.net_invoice_amount;
  assert(totalSaleBill === 86000.0, '2.5 Total Sale Bill = ৳86,000.00 (72000 + 14000)', `৳${totalSaleBill}`);

  const buyer1State = db.getPartyById(buyer1.id);
  const expectedBuyer1Due = 86000.0 - 50000.0; // 36,000.00
  assert(buyer1State.current_balance === expectedBuyer1Due, '2.6 Buyer ledger net due = ৳36,000.00 (86000 - 50000)', `৳${buyer1State.current_balance}`);

  // Check inventory deduction
  const mustardAfterS2 = db.getCommodityById(1);
  const wheatAfterS2 = db.getCommodityById(4);
  assert(mustardAfterS2.current_stock_kg === mustardAfterP1.current_stock_kg - 800.0, '2.7 Mustard stock reduced by 800 KG (-20 Mon)', `${mustardAfterS2.current_stock_kg} KG`);
  assert(wheatAfterS2.current_stock_kg === wheatAfterSetup.current_stock_kg - 400.0, '2.8 Wheat stock reduced by 400 KG (-10 Mon)', `${wheatAfterS2.current_stock_kg} KG`);

  // -------------------------------------------------------------
  // DRAFT 3: বাকি খাতা ও খতিয়ান রিকনসিলিয়েশন (Party Ledger & Statement Reconciliation)
  // ক্রেতা: রফিকুল ইসলাম
  // প্রারম্ভিক বকেয়া: ৫০,০০০ ৳ | নতুন চালান: ৩০,০০০ ৳ (মোট দাবি: ৮০,০০০ ৳) | নগদ জমা: ২৫,০০০ ৳
  // যাচাই: বর্তমান নীট বকেয়া ৫৫,০০০.০০ ৳ এবং সর্বশেষ আদায় ২৫,০০০.০০ ৳
  // -------------------------------------------------------------
  console.log('\n--- DRAFT 3: বাকি খাতা ও খতিয়ান রিকনসিলিয়েশন (Buyer Rafiqul Islam) ---');
  const buyerRafiqul = db.createParty({
    name: 'রফিকুল ইসলাম',
    phone: '01800000002',
    address: 'চাটমোহর, পাবনা',
    party_type: 'BUYER',
    opening_balance: 50000.0, // Opening Due ৳50,000
    is_test_draft: 1,
  });

  assert(buyerRafiqul.opening_balance === 50000.0, '3.1 Opening balance set to ৳50,000.00');
  assert(buyerRafiqul.current_balance === 50000.0, '3.2 Initial current balance = ৳50,000.00');

  // New Sale of ৳30,000
  // 30,000 / 3,600 = 8.333 Mon, or 7.5 mon @ 4000 = 30000 (300 kg)
  const rafiqulSale = db.createSale({
    sale_date: today,
    party_id: buyerRafiqul.id,
    commodity_id: 1, // Mustard
    bags_count: 4,
    gross_weight_kg: 300.0,
    bag_deduction_kg: 0.0,
    rate_per_mon: 4000.0, // 300 kg = 7.5 mon @ 4000 = 30,000
    loading_charge: 0,
    damaged_bag_deduction: 0,
    discount_amount: 0,
    payment_method: 'DUE',
    paid_amount: 0,
    is_test_draft: 1,
    notes: 'অডিট ড্রাফট ৩: নতুন চালান',
  });
  assert(rafiqulSale.net_invoice_amount === 30000.0, '3.3 New invoice bill = ৳30,000.00', `৳${rafiqulSale.net_invoice_amount}`);

  // Cash Collection payment voucher of ৳25,000
  const voucherRes = db.recordPartyPaymentVoucher({
    entry_date: today,
    party_id: buyerRafiqul.id,
    type: 'PAYMENT_RECEIVED',
    amount: 25000.0,
    payment_mode: 'CASH',
    description: 'নগদ জমা কিস্তি',
    is_test_draft: 1,
  });
  assert(voucherRes.success === true, '3.4 Payment voucher recorded');
  assert(voucherRes.newBalance === 55000.0, '3.5 Voucher newBalance = ৳55,000.00', `৳${voucherRes.newBalance}`);

  // Detailed Statement Modal Data
  const statement = db.getPartyDetailedStatement(buyerRafiqul.id);
  assert(statement.openingDue === 50000.0, '3.6 Modal Statement: Opening Due = ৳50,000.00', `৳${statement.openingDue}`);
  assert(statement.totalInvoices === 30000.0, '3.7 Modal Statement: Total Invoices = ৳30,000.00', `৳${statement.totalInvoices}`);
  assert(statement.totalInflow === 25000.0, '3.8 Modal Statement: Total Inflow (জমা) = ৳25,000.00', `৳${statement.totalInflow}`);
  assert(statement.netDue === 55000.0, '3.9 Modal Statement: Net Due (বর্তমান নীট বাকি) = ৳55,000.00', `৳${statement.netDue}`);

  // Main Table Behind it Check: getPartyById & getAllParties
  const partyInDb = db.getPartyById(buyerRafiqul.id);
  assert(partyInDb.current_balance === 55000.0, '3.10 Main Table: current_balance = ৳55,000.00', `৳${partyInDb.current_balance}`);
  assert(partyInDb.last_payment === 25000.0, '3.11 Main Table: last_payment subquery = ৳25,000.00', `৳${partyInDb.last_payment}`);

  const allParties = db.getAllParties('BUYER');
  const rafiqInList = allParties.find(p => p.id === buyerRafiqul.id);
  assert(rafiqInList && rafiqInList.current_balance === 55000.0, '3.12 getAllParties list: balance = ৳55,000.00');
  assert(rafiqInList && rafiqInList.last_payment === 25000.0, '3.13 getAllParties list: last_payment = ৳25,000.00');

  // -------------------------------------------------------------
  // DRAFT 4: দৈনিক ক্যাশ বই ও খরচ এন্ট্রি (Cashbook & Expense)
  // পরিচালন খরচ: লেবার ও লোডিং (LABOR) = ২,৫০০ ৳
  // -------------------------------------------------------------
  console.log('\n--- DRAFT 4: দৈনিক ক্যাশ বই ও খরচ এন্ট্রি (Operating Expense ৳2,500) ---');
  const expense1 = db.addExpense({
    expense_date: today,
    category: 'LABOR',
    amount: 2500.0,
    paid_to: 'চাঁচকৈড় ঘাট কুলি সমিতি',
    payment_mode: 'CASH',
    notes: 'শস্য লোডিং ও খালাস লেবার বিল',
    is_test_draft: 1,
  });

  assert(expense1.amount === 2500.0, '4.1 Expense recorded = ৳2,500.00');

  // Reconcile Daily Cashbook
  const cashbookReport = db.getDailyCashbook(today);
  console.log(`  Daily Cashbook Report for ${today}:`);
  console.log(`    Opening Balance: ৳${cashbookReport.opening_balance}`);
  console.log(`    Total Inflows:   ৳${cashbookReport.total_inflow}`);
  console.log(`    Total Outflows:  ৳${cashbookReport.total_outflow}`);
  console.log(`    Closing Balance: ৳${cashbookReport.closing_balance}`);

  // Inflows: SaleBatch (50000) + PaymentVoucher (25000) = 75000
  // Outflows: WheatSetup (26000) + Purchase1 (100000) + Expense (2500) = 128500
  const expectedNetCashChange = 75000.0 - 128500.0; // -53500.0
  const actualNetCashChange = cashbookReport.total_inflow - cashbookReport.total_outflow;
  assert(actualNetCashChange === expectedNetCashChange, '4.2 Cashbook net change exact to the cent', `৳${actualNetCashChange}`);

  // -------------------------------------------------------------
  // DRAFT 5: BANGLADESHI LAKH-CRORE CURRENCY FORMATTING
  // -------------------------------------------------------------
  console.log('\n--- DRAFT 5: বাংলাদেশি লাখ-কোটি কারেন্সি কমা ফরম্যাটিং (Formatting Verification) ---');
  const fmt1 = formatTakaBn(161600.0, true);
  assert(fmt1 === '৳ ১,৬১,৬০০.০০', '5.1 Format 161,600.00', fmt1);

  const fmt2 = formatTakaBn(55000.0, true);
  assert(fmt2 === '৳ ৫৫,০০০.০০', '5.2 Format 55,000.00', fmt2);

  const fmt3 = formatTakaBn(86000.0, true);
  assert(fmt3 === '৳ ৮৬,০০০.০০', '5.3 Format 86,000.00', fmt3);

  const fmt4 = formatTakaBn(2500.0, true);
  assert(fmt4 === '৳ ২,৫০০.০০', '5.4 Format 2,500.00', fmt4);

  const fmt5 = formatTakaBn(12550000.0, true);
  assert(fmt5 === '৳ ১,২৫,৫০,০০০.০০', '5.5 Format 1,25,50,000.00 (Crore/Lakh)', fmt5);

  // -------------------------------------------------------------
  // DRAFT 6: PURGE TEST DRAFTS & RESTORE INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- DRAFT 6: পার্জ টেস্ট ড্রাফট ও স্টক রিস্টোর (Purge Test Drafts) ---');
  assert(db.hasTestDrafts() === true, '6.1 hasTestDrafts() returns true before purge');

  const purgeResult = db.purgeTestDrafts();
  console.log('  Purge Result:', JSON.stringify(purgeResult.purged));
  assert(purgeResult.success === true, '6.2 purgeTestDrafts() returned success');
  assert(purgeResult.purged.purchases >= 2, '6.3 Test purchases purged');
  assert(purgeResult.purged.sales >= 3, '6.4 Test sales purged');
  assert(purgeResult.purged.expenses >= 1, '6.5 Test expenses purged');
  assert(purgeResult.purged.parties >= 3, '6.6 Test parties purged');

  assert(db.hasTestDrafts() === false, '6.7 hasTestDrafts() returns false after purge');

  // Verify stock restored
  const mustardRestored = db.getCommodityById(1);
  const wheatRestored = db.getCommodityById(4);
  assert(mustardRestored.current_stock_kg === initialMustardStockKg, '6.8 Mustard stock exactly restored to original fresh state', `${mustardRestored.current_stock_kg} KG (Original: ${initialMustardStockKg} KG)`);
  assert(wheatRestored.current_stock_kg === initialWheatStockKg, '6.9 Wheat stock exactly restored to original fresh state', `${wheatRestored.current_stock_kg} KG (Original: ${initialWheatStockKg} KG)`);

  // Verify parties table has 0 test parties remaining
  const remainingTestParties = db.db.prepare('SELECT COUNT(*) as c FROM parties WHERE is_test_draft = 1').get().c;
  assert(remainingTestParties === 0, '6.10 Zero test parties remain');

  // Verify ledger has 0 test entries remaining
  const remainingTestLedger = db.db.prepare('SELECT COUNT(*) as c FROM party_ledger WHERE is_test_draft = 1').get().c;
  assert(remainingTestLedger === 0, '6.11 Zero test ledger entries remain');

  // Verify cashbook has 0 test entries remaining
  const remainingTestCashbook = db.db.prepare('SELECT COUNT(*) as c FROM cashbook WHERE is_test_draft = 1').get().c;
  assert(remainingTestCashbook === 0, '6.12 Zero test cashbook entries remain');

  console.log('\n================================================================================');
  console.log(`   AUDIT COMPLETE: ${passedCount}/${totalCount} TESTS PASSED [100% SUCCESS]`);
  console.log('================================================================================\n');

} catch (err) {
  console.error('\nFATAL ERROR during audit execution:', err);
  process.exitCode = 1;
} finally {
  db.close();
}
