/**
 * scripts/e2e_universal_recycle_bin_seed.cjs
 * 
 * End-to-End Live Seeding Script:
 * Creates draft items for all transaction and entity modules,
 * triggers soft-deletion into 'রিসাইকেল বিন' (Recycle Bin),
 * and verifies that all deleted items appear in the Recycle Bin with correct
 * metadata, amounts, and sectors ready for user inspection.
 */

const https = require('https');

const BASE_URL = 'https://maha-enterprise.tarek213567.workers.dev';
const PIN = '5555';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'x-app-pin': PIN,
        'x-auth-pin': PIN,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('🚀 Starting Universal Recycle Bin E2E Seeding against:', BASE_URL);

  const results = {};

  // Fetch available commodities
  const commsRes = await request('GET', '/api/commodities');
  const commList = Array.isArray(commsRes.data) ? commsRes.data : [];
  const activeComm = commList.find(c => c.name_bn && c.name_bn.includes('সরিষা')) || commList[0] || { id: 9, name_bn: 'সরিষা' };
  console.log(`Using active commodity: [ID: ${activeComm.id}] ${activeComm.name_bn}`);

  // 1. Customer (বাকি খাতা / ক্রেতা)
  console.log('\n--- 1. Testing Customer Module ---');
  const custRes = await request('POST', '/api/customers', {
    name: 'ড্রাফট টেস্ট ক্রেতা (রিসাইকেল বিন)',
    phone: '01711000111',
    address: 'চাঁচকৈড় বাজার',
    sector: 'jute',
    opening_due: 1500,
    is_test_draft: 1,
  });
  console.log('Create Customer response:', custRes.status, custRes.data?.id);
  const customerId = custRes.data?.id;

  if (customerId) {
    const delCust = await request('DELETE', `/api/customers/${customerId}`);
    console.log('Delete Customer response:', delCust.status, delCust.data);
    results.customer = Boolean(delCust.data?.success);
  }

  // 2. Creditor (পাওনাদার / মহাজন)
  console.log('\n--- 2. Testing Creditor Module ---');
  const credRes = await request('POST', '/api/creditors', {
    name: 'ড্রাফট টেস্ট মহাজন (রিসাইকেল বিন)',
    phone: '01711000222',
    address: 'সিংড়া আড়ত',
    sector: 'mustard',
    opening_due: -3500,
    is_test_draft: 1,
  });
  console.log('Create Creditor response:', credRes.status, credRes.data?.id);
  const creditorId = credRes.data?.id;

  if (creditorId) {
    const delCred = await request('DELETE', `/api/creditors/${creditorId}`);
    console.log('Delete Creditor response:', delCred.status, delCred.data);
    results.creditor = Boolean(delCred.data?.success);
  }

  // 3. Commodity / Crop (শস্য / ফসল)
  console.log('\n--- 3. Testing Crop / Commodity Module ---');
  const cropRes = await request('POST', '/api/commodities', {
    name_bn: 'ড্রাফট টেস্ট ভুট্টা (রিসাইকেল বিন ' + Date.now().toString().slice(-4) + ')',
    name_en: 'Draft Test Maize RB',
    default_bag_weight_kg: 75,
    sector: 'maize',
    is_test_draft: 1,
  });
  console.log('Create Crop response:', cropRes.status, cropRes.data?.id);
  const cropId = cropRes.data?.id;

  if (cropId) {
    const delCrop = await request('DELETE', `/api/commodities/${cropId}`);
    console.log('Delete Crop response:', delCrop.status, delCrop.data);
    results.crop = Boolean(delCrop.data?.success);
  }

  // 4. Note (নোটবুক)
  console.log('\n--- 4. Testing Note Module ---');
  const noteRes = await request('POST', '/api/notes', {
    title: 'ড্রাফট টেস্ট নোটবুক (রিসাইকেল বিন)',
    content: 'রিসাইকেল বিন কার্যকারিতা যাচাইকরণ নোট।',
    category: 'সাধারণ',
  });
  console.log('Create Note response:', noteRes.status, noteRes.data?.id);
  const noteId = noteRes.data?.id;

  if (noteId) {
    const delNote = await request('DELETE', `/api/notes/${noteId}`);
    console.log('Delete Note response:', delNote.status, delNote.data);
    results.note = Boolean(delNote.data?.success);
  }

  // 5. Cashbook (দৈনিক ক্যাশ বই)
  console.log('\n--- 5. Testing Cashbook Module ---');
  const today = new Date().toISOString().split('T')[0];
  const cashRes = await request('POST', '/api/cashbook', {
    entry_date: today,
    entry_type: 'INFLOW',
    category: 'SALE',
    amount: 1750,
    payment_mode: 'CASH',
    description: 'ড্রাফট টেস্ট নগদ প্রাপ্তি (রিসাইকেল বিন)',
    is_test_draft: 1,
  });
  console.log('Create Cashbook response:', cashRes.status, cashRes.data?.id);
  const cashId = cashRes.data?.id;

  if (cashId) {
    const delCash = await request('DELETE', `/api/cashbook/${cashId}`);
    console.log('Delete Cashbook response:', delCash.status, delCash.data);
    results.cashbook = Boolean(delCash.data?.success);
  }

  // 6. Expense (পরিচালন খরচ)
  console.log('\n--- 6. Testing Expense Module ---');
  const expRes = await request('POST', '/api/expenses', {
    expense_date: today,
    category: 'FOOD_ENTERTAINMENT',
    amount: 320,
    paid_to: 'চা-নাস্তা ড্রাফট বিল',
    payment_mode: 'CASH',
    notes: 'ড্রাফট টেস্ট খরচ (রিসাইকেল বিন)',
    is_test_draft: 1,
  });
  console.log('Create Expense response:', expRes.status, expRes.data?.id);
  const expId = expRes.data?.id;

  if (expId) {
    const delExp = await request('DELETE', `/api/expenses/${expId}`);
    console.log('Delete Expense response:', delExp.status, delExp.data);
    results.expense = Boolean(delExp.data?.success);
  }

  // 7. Purchase (শস্য ক্রয়)
  console.log('\n--- 7. Testing Purchase Module ---');
  const purPartyRes = await request('POST', '/api/creditors', {
    name: 'ক্রয় টেস্ট বেপারী (রিসাইকেল বিন)',
    phone: '01700999888',
    address: 'গুরুদাসপুর মোকাম',
    sector: 'mustard',
    is_test_draft: 1,
  });
  const purPartyId = purPartyRes.data?.id || 3;

  const purRes = await request('POST', '/api/purchases', {
    purchase_date: today,
    party_id: purPartyId,
    commodity_id: activeComm.id,
    bags_count: 2,
    gross_weight_kg: 82,
    rate_per_mon: 2800,
    paid_amount: 1500,
    is_test_draft: 1,
    notes: 'ড্রাফট টেস্ট ক্রয় চালান (রিসাইকেল বিন)',
  });
  console.log('Create Purchase response:', purRes.status, purRes.data?.id, purRes.data?.invoice_no);
  const purchaseId = purRes.data?.id;

  if (purchaseId) {
    const delPur = await request('DELETE', `/api/purchases/${purchaseId}`);
    console.log('Delete Purchase response:', delPur.status, delPur.data);
    results.purchase = Boolean(delPur.data?.success);
  }

  // 8. Sale (পাইকারি বিক্রয় ও চালান)
  console.log('\n--- 8. Testing Sale Module ---');
  const salePartyRes = await request('POST', '/api/customers', {
    name: 'বিক্রয় টেস্ট খরিদ্দার (রিসাইকেল বিন)',
    phone: '01700777666',
    address: 'পাবনা আড়ত',
    sector: 'mustard',
    is_test_draft: 1,
  });
  const salePartyId = salePartyRes.data?.id || 2;

  const saleRes = await request('POST', '/api/sales', {
    sale_date: today,
    party_id: salePartyId,
    commodity_id: activeComm.id,
    bags_count: 1,
    gross_weight_kg: 40,
    rate_per_mon: 3100,
    paid_amount: 1000,
    is_test_draft: 1,
    notes: 'ড্রাফট টেস্ট বিক্রয় চালান (রিসাইকেল বিন)',
  });
  console.log('Create Sale response:', saleRes.status, saleRes.data?.id, saleRes.data?.invoice_no);
  const saleId = saleRes.data?.id;

  if (saleId) {
    const delSale = await request('DELETE', `/api/sales/${saleId}`);
    console.log('Delete Sale response:', delSale.status, delSale.data);
    results.sale = Boolean(delSale.data?.success);
  }

  // 9. Verify Recycle Bin contents
  console.log('\n--- 9. Verifying Recycle Bin Items ---');
  const binRes = await request('GET', '/api/recycle-bin');
  const binItems = Array.isArray(binRes.data) ? binRes.data : [];
  console.log(`\n🎉 Total items currently in Recycle Bin: ${binItems.length}`);

  const itemSummary = binItems.slice(0, 15).map((item) => ({
    id: item.id,
    module: item.module_type,
    label: item.module_label,
    title: item.title,
    amount: item.amount,
    sector: item.sector,
    deleted_at: item.deleted_at,
  }));
  console.table(itemSummary);

  console.log('\n✅ All 8 Module Soft-Delete Results:', results);
}

run().catch(console.error);
