/**
 * Ai Manezar (Gemini 3 Flash) Core Backend Engine
 * Supporting: Gemini 3 Flash Preview, Fallback Cascade, Vision OCR, Multimodal Audio Transcription,
 * Live Shop Context, Full D1 CRUD with User Confirmation, 60-Day RecycleBin Snapshots,
 * Live CSS/UI Dynamic Overrides, and Telegram Audit.
 * 
 * Tailored for Maha Enterprise (মাহা এন্টারপ্রাইজ)
 */

import { toBnDigits, formatTakaBn, getDhakaInfo } from './royalExcelBackup.js';

// ============================================================================
// GEMINI API KEY & MODEL DISPATCH
// ============================================================================
export async function getGeminiApiKey(db, env) {
  if (db) {
    try {
      const s = await db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").first();
      if (s && s.value && s.value.trim().length > 0) return s.value.trim();

      const appS = await db.prepare("SELECT value FROM app_settings WHERE key = 'gemini_api_key'").first();
      if (appS && appS.value && appS.value.trim().length > 0) return appS.value.trim();
    } catch (e) {
      console.warn('[getGeminiApiKey db read error]:', e);
    }
  }
  return env?.GEMINI_API_KEY || '';
}

export async function callGeminiModel(apiKey, payload) {
  const models = [
    'gemini-3-flash-preview',
    'gemini-3-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  let lastErrorText = '';
  let lastStatus = 500;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        return { ok: true, status: res.status, data, modelUsed: model };
      }

      lastStatus = res.status;
      lastErrorText = await res.text();
      console.warn(`[Gemini Model ${model} failed with ${res.status}]:`, lastErrorText.slice(0, 150));
    } catch (err) {
      lastErrorText = err.message;
      console.warn(`[Gemini Model ${model} fetch error]:`, err.message);
    }
  }

  return { ok: false, status: lastStatus, errorText: lastErrorText };
}

// ============================================================================
// LIVE SHOP CONTEXT COLLECTOR
// ============================================================================
export async function fetchLiveShopContext(db) {
  if (!db) {
    return {
      commodities: [],
      totalStockMon: 0,
      totalStockValuation: 0,
      buyers: [],
      totalCustomerDue: 0,
      suppliers: [],
      totalSupplierPayable: 0,
      todaySales: { count: 0, totalAmount: 0, totalCash: 0, totalDue: 0 },
      todayPurchases: { count: 0, totalAmount: 0, totalMon: 0 },
      todayExpenses: { count: 0, totalAmount: 0 },
      cashInHand: 0,
      recentNotes: [],
      memories: [],
      overrides: [],
    };
  }

  const dhaka = getDhakaInfo();
  const p = dhaka?.parts || dhaka;
  const todayStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;

  // 1. Commodities & Stocks
  const { results: comms } = await db.prepare(`
    SELECT id, name_bn, name_en, default_bag_weight_kg, current_stock_kg, current_stock_bags, current_wac_per_kg, current_wac_per_mon
    FROM commodities ORDER BY id ASC
  `).all().catch(() => ({ results: [] }));

  let totalStockKg = 0;
  let totalStockValuation = 0;
  (comms || []).forEach((c) => {
    const kg = Number(c.current_stock_kg) || 0;
    const wacKg = Number(c.current_wac_per_kg) || 0;
    totalStockKg += kg;
    totalStockValuation += kg * wacKg;
  });
  const totalStockMon = Number((totalStockKg / 40.0).toFixed(2));

  // 2. Parties (Buyers & Suppliers)
  const { results: buyers } = await db.prepare(`
    SELECT id, name, phone, address, current_balance FROM parties
    WHERE party_type = 'BUYER' AND current_balance > 0
    ORDER BY current_balance DESC
  `).all().catch(() => ({ results: [] }));

  const totalCustomerDue = (buyers || []).reduce((acc, b) => acc + (Number(b.current_balance) || 0), 0);

  const { results: suppliers } = await db.prepare(`
    SELECT id, name, phone, address, current_balance FROM parties
    WHERE party_type = 'SUPPLIER' AND current_balance < 0
    ORDER BY current_balance ASC
  `).all().catch(() => ({ results: [] }));

  const totalSupplierPayable = Math.abs(
    (suppliers || []).reduce((acc, s) => acc + (Number(s.current_balance) || 0), 0)
  );

  // 3. Today's Sales
  const todaySalesData = await db.prepare(`
    SELECT COUNT(*) as count, SUM(net_invoice_amount) as totalAmount, SUM(paid_amount) as totalCash, SUM(due_amount) as totalDue
    FROM sales WHERE sale_date = ?
  `).bind(todayStr).first().catch(() => null);

  // 4. Today's Purchases
  const todayPurchasesData = await db.prepare(`
    SELECT COUNT(*) as count, SUM(gross_amount) as totalAmount, SUM(net_weight_mon) as totalMon
    FROM purchases WHERE purchase_date = ?
  `).bind(todayStr).first().catch(() => null);

  // 5. Today's Expenses
  const todayExpData = await db.prepare(`
    SELECT COUNT(*) as count, SUM(amount) as totalAmount
    FROM expenses WHERE expense_date = ?
  `).bind(todayStr).first().catch(() => null);

  // 6. Cash In Hand (Cashbook calculation)
  let cashInHand = 0;
  try {
    const cashInflows = await db.prepare("SELECT SUM(amount) as s FROM cashbook WHERE entry_type = 'INFLOW' AND payment_mode = 'CASH'").first();
    const cashOutflows = await db.prepare("SELECT SUM(amount) as s FROM cashbook WHERE entry_type = 'OUTFLOW' AND payment_mode = 'CASH'").first();
    cashInHand = (cashInflows?.s || 0) - (cashOutflows?.s || 0);
  } catch (e) {}

  // 7. Recent Notes
  const { results: notes } = await db.prepare(`
    SELECT id, title, content, category, is_pinned FROM notes ORDER BY is_pinned DESC, updated_at DESC LIMIT 5
  `).all().catch(() => ({ results: [] }));

  // 8. Ai Memories
  const { results: memories } = await db.prepare(`
    SELECT id, fact, category FROM AiMemory ORDER BY createdAt DESC LIMIT 15
  `).all().catch(() => ({ results: [] }));

  // 9. Active Dynamic Overrides
  const { results: overrides } = await db.prepare(`
    SELECT id, overrideType, targetKey, content, isActive FROM AiDynamicOverride WHERE isActive = 1
  `).all().catch(() => ({ results: [] }));

  return {
    todayStr,
    commodities: comms || [],
    totalStockKg,
    totalStockMon,
    totalStockValuation: Math.round(totalStockValuation),
    buyers: buyers || [],
    totalCustomerDue: Math.round(totalCustomerDue),
    suppliers: suppliers || [],
    totalSupplierPayable: Math.round(totalSupplierPayable),
    todaySales: {
      count: todaySalesData?.count || 0,
      totalAmount: Math.round(todaySalesData?.totalAmount || 0),
      totalCash: Math.round(todaySalesData?.totalCash || 0),
      totalDue: Math.round(todaySalesData?.totalDue || 0),
    },
    todayPurchases: {
      count: todayPurchasesData?.count || 0,
      totalAmount: Math.round(todayPurchasesData?.totalAmount || 0),
      totalMon: Number((todayPurchasesData?.totalMon || 0).toFixed(2)),
    },
    todayExpenses: {
      count: todayExpData?.count || 0,
      totalAmount: Math.round(todayExpData?.totalAmount || 0),
    },
    cashInHand: Math.round(cashInHand),
    recentNotes: notes || [],
    memories: (memories || []).map((m) => m.fact),
    overrides: overrides || [],
  };
}

// ============================================================================
// DAILY EVENING TELEGRAM AUDIT SENDER (10:00 PM)
// ============================================================================
export async function generateAndSendDailyAiAudit(db, env) {
  if (!db) return { ok: false, error: 'Database not available' };

  let botToken = env?.TELEGRAM_BOT_TOKEN;
  let chatId = env?.TELEGRAM_CHAT_ID;

  try {
    const dbToken = await db.prepare("SELECT value FROM settings WHERE key = 'telegram_bot_token'").first();
    if (dbToken && dbToken.value) botToken = dbToken.value;

    const dbChat = await db.prepare("SELECT value FROM settings WHERE key = 'telegram_chat_id'").first();
    if (dbChat && dbChat.value) chatId = dbChat.value;
  } catch (e) {}

  if (!botToken || !chatId) {
    return { ok: false, error: 'Telegram Bot Token বা Chat ID সেট করা নেই।' };
  }

  const shopContext = await fetchLiveShopContext(db);
  const dhaka = getDhakaInfo();
  const p = dhaka?.parts || dhaka;
  const dateStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  const timeBangla = `${toBnDigits(p.hour)}:${toBnDigits(p.minute)}`;

  const apiKey = await getGeminiApiKey(db, env);
  let auditReport = '';

  if (apiKey) {
    const prompt = `তুমি "Ai Manezar", মাহা এন্টারপ্রাইজের বুদ্ধিমান ব্যবসায়িক সহকারী।
আজকের তারিখ: ${dateStr} (${dhaka.dayName})।
দোকানের লাইভ তথ্য:
- গুদামে মোট শস্য মজুদ: ${shopContext.totalStockMon} মণ (মূল্য প্রায় ৳ ${shopContext.totalStockValuation.toLocaleString()})
- শস্য বিবরণ: ${JSON.stringify(shopContext.commodities.map((c) => `${c.name_bn}: ${(c.current_stock_kg / 40.0).toFixed(1)} মণ`))}
- আজকের মোট বিক্রয়: ৳ ${shopContext.todaySales.totalAmount.toLocaleString()} (নগদ: ৳ ${shopContext.todaySales.totalCash.toLocaleString()}, বাকি: ৳ ${shopContext.todaySales.totalDue.toLocaleString()})
- আজকের মোট ক্রয়: ৳ ${shopContext.todayPurchases.totalAmount.toLocaleString()} (${shopContext.todayPurchases.totalMon} মণ)
- আজকের গুদাম পরিচালন খরচ: ৳ ${shopContext.todayExpenses.totalAmount.toLocaleString()}
- ক্যাশ ইন হ্যান্ড (হাতে নগদ): ৳ ${shopContext.cashInHand.toLocaleString()}
- মোট বাজার বকেয়া পাওনা: ৳ ${shopContext.totalCustomerDue.toLocaleString()}
- মোট মহাজন/সাপ্লায়ার দেনা: ৳ ${shopContext.totalSupplierPayable.toLocaleString()}

টেলিগ্রামের জন্য একটি অত্যন্ত সুন্দর, ফরম্যাটেড, মার্জিত বাংলা ব্যবসায়িক অডিট রিপোর্ট তৈরি করো। উপযুক্ত ইমোজি, বুলেট পয়েন্ট এবং বোল্ড টেক্সট ব্যবহার করবে। শেষ লাইনে লিখবে: "🤖 Ai Manezar • মাহা এন্টারপ্রাইজ ক্লাউড সিস্টেম"`;

    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      };
      const geminiCall = await callGeminiModel(apiKey, payload);
      if (geminiCall.ok && geminiCall.data) {
        auditReport = geminiCall.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch (e) {
      console.warn('[Gemini Audit generation error]:', e);
    }
  }

  if (!auditReport) {
    auditReport = `🌾 *মাহা এন্টারপ্রাইজ — দৈনিক ব্যবসায়িক অডিট (রাত ১০:০০)*\n\n` +
      `📅 তারিখ: ${dateStr} | সময়: ${timeBangla}\n` +
      `──────────────────────────\n` +
      `🛒 *আজকের বিক্রয়:* ৳ ${shopContext.todaySales.totalAmount.toLocaleString()}\n` +
      `💵 *নগদ আদায়:* ৳ ${shopContext.todaySales.totalCash.toLocaleString()}\n` +
      `📝 *আজকের বাকি:* ৳ ${shopContext.todaySales.totalDue.toLocaleString()}\n\n` +
      `🌾 *আজকের ক্রয়:* ৳ ${shopContext.todayPurchases.totalAmount.toLocaleString()} (${shopContext.todayPurchases.totalMon} মণ)\n` +
      `💸 *আজকের খরচ:* ৳ ${shopContext.todayExpenses.totalAmount.toLocaleString()}\n` +
      `💰 *হাতে নগদ ক্যাশ:* ৳ ${shopContext.cashInHand.toLocaleString()}\n` +
      `──────────────────────────\n` +
      `📦 *গুদামে মোট শস্য মজুদ:* ${shopContext.totalStockMon} মণ (মূল্য: ৳ ${shopContext.totalStockValuation.toLocaleString()})\n` +
      `👥 *মোট ক্রেতা বকেয়া:* ৳ ${shopContext.totalCustomerDue.toLocaleString()}\n` +
      `🏭 *মোট মহাজন দেনা:* ৳ ${shopContext.totalSupplierPayable.toLocaleString()}\n` +
      `──────────────────────────\n` +
      `🤖 *Ai Manezar • মাহা এন্টারপ্রাইজ ক্লাউড সিস্টেম*`;
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: auditReport,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      throw new Error(tgData.description || 'Telegram API Error');
    }

    return { ok: true, report: auditReport, messageId: tgData.result?.message_id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================================
// 60-DAY RECYCLE BIN SNAPSHOT HELPER
// ============================================================================
export async function createRecycleSnapshot(db, { module_type, module_label, original_id, title, amount = 0, payload }) {
  if (!db) return null;
  const snapshotId = `rb_ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    await db.prepare(`
      INSERT INTO recycle_bin (id, module_type, module_label, original_id, title, amount, payload_json, deleted_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+60 days'))
    `).bind(
      snapshotId,
      module_type,
      module_label || 'Ai Manezar পরিবর্তন স্ন্যাপশট',
      String(original_id || snapshotId),
      title || 'Ai Manezar দ্বারা পরিবর্তিত পূর্বাবস্থা',
      Number(amount) || 0,
      JSON.stringify(payload || {})
    ).run();
    return snapshotId;
  } catch (e) {
    console.warn('[RecycleBin Snapshot Error]:', e);
    return null;
  }
}

// ============================================================================
// AI ACTION EXECUTION ENGINE WITH STRICT VALIDATION & SNAPSHOTS
// ============================================================================
export async function executeAiAction(db, env, action) {
  if (!db) return { success: false, error: 'Database not available' };
  if (!action || (!action.type && !action.actionType)) return { success: false, error: 'অবৈধ অ্যাকশন অবজেক্ট' };

  const rawType = String(action.type || action.actionType || '').toUpperCase();
  const rawTable = String(action.table || '');
  const data = action.data || action.payload || {};
  const filter = action.filter || {};
  const description = action.description || 'Ai Manezar অ্যাকশন সম্পাদন';

  try {
    // ------------------------------------------------------------------------
    // ACTION 1: DYNAMIC DESIGN / CSS / UI OVERRIDE
    // ------------------------------------------------------------------------
    if (rawType === 'DYNAMIC_OVERRIDE' || rawType === 'APPLY_OVERRIDE') {
      const overrideType = data.overrideType || 'CSS_THEME';
      const targetKey = data.targetKey || `theme_${Date.now()}`;
      const content = String(data.content || '').trim();

      if (!content) return { success: false, error: 'ডিজাইন বা ওভাররাইড কোড প্রদান করুন' };

      // Snapshot existing override if any
      const existing = await db.prepare('SELECT * FROM AiDynamicOverride WHERE targetKey = ?').bind(targetKey).first().catch(() => null);
      if (existing) {
        await createRecycleSnapshot(db, {
          module_type: 'AI_OVERRIDE',
          module_label: 'লাইভ ডিজাইন ওভাররাইড',
          original_id: existing.id,
          title: `ওভাররাইড পূর্বাবস্থা: ${targetKey}`,
          payload: existing,
        });
      }

      const id = existing ? existing.id : `ovr_${Date.now().toString(36)}`;
      await db.prepare(`
        INSERT INTO AiDynamicOverride (id, overrideType, targetKey, content, isActive, updatedAt)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          overrideType = excluded.overrideType,
          content = excluded.content,
          isActive = 1,
          updatedAt = CURRENT_TIMESTAMP
      `).bind(id, overrideType, targetKey, content).run();

      return {
        success: true,
        message: `লাইভ ডিজাইন ওভাররাইড (${targetKey}) সফলভাবে কার্যকর হয়েছে! 🎨`,
        override: { id, overrideType, targetKey, content, isActive: 1 },
      };
    }

    // ------------------------------------------------------------------------
    // ACTION 2: ADD SALE (বিক্রয় ও চালান)
    // ------------------------------------------------------------------------
    if (rawType === 'ADD_SALE') {
      const commId = data.commodity_id || data.commodityId;
      const comm = await db.prepare('SELECT * FROM commodities WHERE id = ? OR name_bn LIKE ?').bind(commId || 0, `%${data.varietyName || ''}%`).first();
      if (!comm) return { success: false, error: 'শস্যের জাত খুঁজে পাওয়া যায়নি' };

      const bags = Math.max(1, Number(data.bags || data.bags_count) || 1);
      const mon = Number(data.weightMon || data.net_weight_mon) || Number(((bags * comm.default_bag_weight_kg) / 40).toFixed(2));
      const kg = Number((mon * 40).toFixed(2));
      const rate = Number(data.rate || data.rate_per_mon) || 0;
      const total = Number(data.totalAmount) || Math.round(mon * rate);
      const cashPaid = Number(data.cashPaid !== undefined ? data.cashPaid : (data.paymentType === 'CASH' ? total : 0));
      const dueAmount = Math.max(0, total - cashPaid);

      // Customer
      let party = null;
      if (data.customerId || data.party_id) {
        party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(data.customerId || data.party_id).first();
      }
      if (!party && data.customerName) {
        party = await db.prepare('SELECT * FROM parties WHERE name LIKE ? AND party_type = \'BUYER\'').bind(`%${data.customerName}%`).first();
      }
      if (!party) {
        party = await db.prepare('SELECT * FROM parties WHERE id = 2').first(); // Default walk-in retail buyer
      }

      const invoiceNo = `SAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      const prevBal = Number(party.current_balance) || 0;
      const newBal = prevBal + dueAmount;

      // 60-Day Snapshot of affected party & commodity
      await createRecycleSnapshot(db, {
        module_type: 'SALE_CREATE',
        module_label: 'পাইকারি বিক্রয় তৈরি পূর্বাবস্থা',
        original_id: invoiceNo,
        title: `চালান পূর্বাবস্থা: ${invoiceNo} (${comm.name_bn})`,
        amount: total,
        payload: {
          invoiceNo,
          commodityId: comm.id,
          prevStockKg: comm.current_stock_kg,
          prevStockBags: comm.current_stock_bags,
          partyId: party.id,
          prevBalance: prevBal,
        },
      });

      const batch = [
        // 1. Insert Sale
        db.prepare(`
          INSERT INTO sales (invoice_no, sale_date, party_id, commodity_id, bags_count, gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon, rate_per_mon, gross_amount, net_invoice_amount, paid_amount, due_amount, payment_method, previous_due, remaining_due, notes)
          VALUES (?, DATE('now'), ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          invoiceNo,
          party.id,
          comm.id,
          bags,
          kg,
          kg,
          mon,
          rate,
          total,
          total,
          cashPaid,
          dueAmount,
          dueAmount <= 0 ? 'CASH' : (cashPaid > 0 ? 'PARTIAL' : 'DUE'),
          prevBal,
          newBal,
          data.notes || 'Ai Manezar এন্ট্রি'
        ),
        // 2. Deduct Stock
        db.prepare(`
          UPDATE commodities SET
            current_stock_kg = MAX(0, current_stock_kg - ?),
            current_stock_bags = MAX(0, current_stock_bags - ?),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(kg, bags, comm.id),
        // 3. Update Party Balance
        db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, party.id),
        // 4. Ledger entry
        db.prepare(`
          INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, description)
          VALUES (DATE('now'), ?, 'SALE', ?, ?, 0, ?, ?)
        `).bind(party.id, invoiceNo, total, prevBal + total, `${comm.name_bn} (${bags} বস্তা, ${mon} মণ @ ৳${rate})`),
      ];

      if (cashPaid > 0) {
        batch.push(
          db.prepare(`
            INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, description)
            VALUES (DATE('now'), ?, 'PAYMENT_RECEIVED', ?, 0, ?, ?, ?)
          `).bind(party.id, invoiceNo, cashPaid, newBal, `নগদ আদায় (চালান: ${invoiceNo})`),
          db.prepare(`
            INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, description)
            VALUES (DATE('now'), 'INFLOW', 'SALE_CASH', ?, 'CASH', ?, ?, ?)
          `).bind(cashPaid, invoiceNo, party.id, `চালান নগদ আদায়: ${party.name} (${invoiceNo})`)
        );
      }

      await db.batch(batch);
      return { success: true, message: `চালান #${invoiceNo} সফলভাবে সম্পন্ন ও সংরক্ষিত হয়েছে! ✅`, invoiceNo };
    }

    // ------------------------------------------------------------------------
    // ACTION 3: ADD PURCHASE (শস্য ক্রয় ও স্টক-ইন)
    // ------------------------------------------------------------------------
    if (rawType === 'ADD_PURCHASE' || rawType === 'ADD_RICE_PURCHASE') {
      const commId = data.commodity_id || data.commodityId;
      const comm = await db.prepare('SELECT * FROM commodities WHERE id = ? OR name_bn LIKE ?').bind(commId || 0, `%${data.varietyName || ''}%`).first();
      if (!comm) return { success: false, error: 'শস্যের জাত পাওয়া যায়নি' };

      const bags = Math.max(1, Number(data.bags || data.bags_count) || 1);
      const mon = Number(data.weightMon || data.net_weight_mon) || Number(((bags * comm.default_bag_weight_kg) / 40).toFixed(2));
      const kg = Number((mon * 40).toFixed(2));
      const rate = Number(data.rate || data.rate_per_mon) || 0;
      const grossAmount = Number(data.totalAmount) || Math.round(mon * rate);
      const cashPaid = Number(data.cashPaid !== undefined ? data.cashPaid : (data.paymentType === 'CASH' ? grossAmount : 0));
      const dueAmount = Math.max(0, grossAmount - cashPaid);

      // Supplier
      let party = null;
      if (data.supplierId || data.party_id) {
        party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(data.supplierId || data.party_id).first();
      }
      if (!party && data.supplierName) {
        party = await db.prepare('SELECT * FROM parties WHERE name LIKE ? AND party_type = \'SUPPLIER\'').bind(`%${data.supplierName}%`).first();
      }
      if (!party) {
        party = await db.prepare('SELECT * FROM parties WHERE id = 1').first(); // Default walk-in supplier
      }

      const lotNo = `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      const prevBal = Number(party.current_balance) || 0;
      const newBal = prevBal - dueAmount; // Supplier balance is negative for dues

      // New WAC calculation
      const curStockKg = Number(comm.current_stock_kg) || 0;
      const curWacKg = Number(comm.current_wac_per_kg) || 0;
      const newStockKg = curStockKg + kg;
      const newWacKg = newStockKg > 0 ? (curStockKg * curWacKg + grossAmount) / newStockKg : rate / 40.0;
      const newWacMon = newWacKg * 40.0;

      // 60-Day Snapshot
      await createRecycleSnapshot(db, {
        module_type: 'PURCHASE_CREATE',
        module_label: 'শস্য ক্রয় পূর্বাবস্থা',
        original_id: lotNo,
        title: `ক্রয় পূর্বাবস্থা: ${lotNo} (${comm.name_bn})`,
        amount: grossAmount,
        payload: { lotNo, commodityId: comm.id, prevStockKg: curStockKg, prevWacKg: curWacKg, partyId: party.id, prevBalance: prevBal },
      });

      const batch = [
        // 1. Insert Purchase
        db.prepare(`
          INSERT INTO purchases (lot_no, purchase_date, party_id, commodity_id, bags_count, gross_weight_kg, bag_deduction_kg, net_weight_kg, net_weight_mon, rate_per_mon, gross_amount, net_payable_amount, paid_amount, due_amount, payment_mode, notes)
          VALUES (?, DATE('now'), ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          lotNo,
          party.id,
          comm.id,
          bags,
          kg,
          kg,
          mon,
          rate,
          grossAmount,
          grossAmount,
          cashPaid,
          dueAmount,
          dueAmount <= 0 ? 'CASH' : 'DUE',
          data.notes || 'Ai Manezar ক্রয়'
        ),
        // 2. Increase Stock & Update WAC
        db.prepare(`
          UPDATE commodities SET
            current_stock_kg = current_stock_kg + ?,
            current_stock_bags = current_stock_bags + ?,
            current_wac_per_kg = ?,
            current_wac_per_mon = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(kg, bags, newWacKg, newWacMon, comm.id),
        // 3. Update Supplier Balance
        db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, party.id),
        // 4. Ledger entry
        db.prepare(`
          INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, description)
          VALUES (DATE('now'), ?, 'PURCHASE', ?, 0, ?, ?, ?)
        `).bind(party.id, lotNo, grossAmount, prevBal - grossAmount, `${comm.name_bn} ক্রয় (${bags} বস্তা, ${mon} মণ @ ৳${rate})`),
      ];

      if (cashPaid > 0) {
        batch.push(
          db.prepare(`
            INSERT INTO party_ledger (entry_date, party_id, transaction_type, reference_no, debit, credit, running_balance, description)
            VALUES (DATE('now'), ?, 'PAYMENT_GIVEN', ?, ?, 0, ?, ?)
          `).bind(party.id, lotNo, cashPaid, newBal, `সাপ্লায়ার নগদ পরিশোধ (লট: ${lotNo})`),
          db.prepare(`
            INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, reference_no, party_id, description)
            VALUES (DATE('now'), 'OUTFLOW', 'PURCHASE_CASH', ?, 'CASH', ?, ?, ?)
          `).bind(cashPaid, lotNo, party.id, `শস্য ক্রয় নগদ পরিশোধ: ${party.name} (${lotNo})`)
        );
      }

      await db.batch(batch);
      return { success: true, message: `ক্রয় লট #${lotNo} সফলভাবে যুক্ত ও স্টক আপডেট করা হয়েছে! ✅`, lotNo };
    }

    // ------------------------------------------------------------------------
    // ACTION 4: DUE COLLECTION / SUPPLIER PAYMENT (টাকা জমা বা পরিশোধ)
    // ------------------------------------------------------------------------
    if (rawType === 'ADD_CUSTOMER_PAYMENT' || rawType === 'ADD_SUPPLIER_PAYMENT') {
      const isCustomer = rawType === 'ADD_CUSTOMER_PAYMENT';
      const amount = Number(data.amount || data.paidAmount) || 0;
      if (amount <= 0) return { success: false, error: 'বৈধ টাকার পরিমাণ দিন' };

      const partyId = data.partyId || data.party_id || data.customerId || data.supplierId;
      const party = await db.prepare('SELECT * FROM parties WHERE id = ?').bind(partyId).first();
      if (!party) return { success: false, error: 'পার্টি খুঁজে পাওয়া যায়নি' };

      const prevBal = Number(party.current_balance) || 0;
      const newBal = isCustomer ? prevBal - amount : prevBal + amount;

      await createRecycleSnapshot(db, {
        module_type: 'LEDGER_VOUCHER',
        module_label: isCustomer ? 'বকেয়া আদায় ভাউচার' : 'মহাজন পরিশোধ ভাউচার',
        original_id: String(party.id),
        title: `${isCustomer ? 'বকেয়া জমা' : 'মহাজন পরিশোধ'}: ${party.name} (৳${amount})`,
        amount,
        payload: { partyId: party.id, prevBalance: prevBal, amount },
      });

      await db.batch([
        db.prepare('UPDATE parties SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newBal, party.id),
        db.prepare(`
          INSERT INTO party_ledger (entry_date, party_id, transaction_type, debit, credit, running_balance, description)
          VALUES (DATE('now'), ?, ?, ?, ?, ?, ?)
        `).bind(
          party.id,
          isCustomer ? 'PAYMENT_RECEIVED' : 'PAYMENT_GIVEN',
          isCustomer ? 0 : amount,
          isCustomer ? amount : 0,
          newBal,
          data.description || (isCustomer ? 'বকেয়া আদায়' : 'মহাজন পরিশোধ')
        ),
        db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, party_id, description)
          VALUES (DATE('now'), ?, ?, ?, 'CASH', ?, ?)
        `).bind(
          isCustomer ? 'INFLOW' : 'OUTFLOW',
          isCustomer ? 'DUE_COLLECTION' : 'SUPPLIER_PAYMENT',
          amount,
          party.id,
          `${party.name} (${data.description || ''})`
        ),
      ]);

      return { success: true, message: `৳ ${amount.toLocaleString()} সফলভাবে জমা/পরিশোধ করা হয়েছে! বর্তমান জের: ৳ ${newBal.toLocaleString()} ✅` };
    }

    // ------------------------------------------------------------------------
    // ACTION 5: OPERATING EXPENSE (পরিচালন খরচ)
    // ------------------------------------------------------------------------
    if (rawType === 'ADD_EXPENSE') {
      const amount = Number(data.amount) || 0;
      if (amount <= 0) return { success: false, error: 'খরচের সঠিক পরিমাণ দিন' };

      const category = data.category || 'MISC';
      const paidTo = data.paid_to || data.paidTo || 'অন্যান্য খরচ';

      await createRecycleSnapshot(db, {
        module_type: 'EXPENSE_CREATE',
        module_label: 'পরিচালন খরচ',
        original_id: `exp_${Date.now()}`,
        title: `খরচ এন্ট্রি: ${paidTo} (৳${amount})`,
        amount,
        payload: { amount, category, paidTo },
      });

      await db.batch([
        db.prepare(`
          INSERT INTO expenses (expense_date, category, amount, paid_to, payment_mode, notes)
          VALUES (DATE('now'), ?, ?, ?, 'CASH', ?)
        `).bind(category, amount, paidTo, data.notes || 'Ai Manezar খরচ এন্ট্রি'),
        db.prepare(`
          INSERT INTO cashbook (entry_date, entry_type, category, amount, payment_mode, description)
          VALUES (DATE('now'), 'OUTFLOW', 'EXPENSE', ?, 'CASH', ?)
        `).bind(amount, `পরিচালন খরচ: ${paidTo} (${category})`),
      ]);

      return { success: true, message: `৳ ${amount.toLocaleString()} খরচ সফলভাবে রেকর্ড করা হয়েছে! ✅` };
    }

    // ------------------------------------------------------------------------
    // ACTION 6: ADD NOTE (নোটবুক)
    // ------------------------------------------------------------------------
    if (rawType === 'ADD_NOTE') {
      const title = String(data.title || 'ব্যবসায়িক নোট').trim();
      const content = String(data.content || '').trim();
      const category = data.category || 'সাধারণ';

      const res = await db.prepare(`
        INSERT INTO notes (title, content, category, is_pinned)
        VALUES (?, ?, ?, 0)
      `).bind(title, content, category).run();

      return { success: true, message: `নোট "${title}" সফলভাবে নোটবুকে সংরক্ষিত হয়েছে! 📝`, noteId: res.meta.last_row_id };
    }

    // ------------------------------------------------------------------------
    // ACTION 7: SOFT DELETE / DELETE RECORD (৬০ দিনের রিসাইকেল বিনে স্থানান্তর)
    // ------------------------------------------------------------------------
    if (rawType === 'DELETE' || rawType === 'SOFT_DELETE' || rawType === 'DELETE_RECORD') {
      const table = rawTable || 'notes';
      const targetId = filter.id || data.id;
      if (!targetId) return { success: false, error: 'রেকর্ড আইডি প্রদান করুন' };

      // Query existing record
      const existing = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(targetId).first().catch(() => null);
      if (!existing) return { success: false, error: `${table} টেবিলে আইডি ${targetId} পাওয়া যায়নি` };

      // Move to recycle_bin with 60 days expiry
      await createRecycleSnapshot(db, {
        module_type: table.toUpperCase(),
        module_label: `${table} রেকর্ড ডিলিট`,
        original_id: String(targetId),
        title: existing.name || existing.name_bn || existing.title || existing.invoice_no || existing.lot_no || `রেকর্ড #${targetId}`,
        amount: Number(existing.amount || existing.net_invoice_amount || existing.gross_amount || 0),
        payload: existing,
      });

      // Delete from active table
      await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(targetId).run();

      return {
        success: true,
        message: `রেকর্ডটি সফলভাবে মুছে ৬০ দিনের রিসাইকেল বিনে স্থানান্তর করা হয়েছে! (১-ক্লিকে রিস্টোর করা সম্ভব) 🗑️`,
      };
    }

    // ------------------------------------------------------------------------
    // ACTION 8: UNIVERSAL DB MUTATION / EDIT RECORD
    // ------------------------------------------------------------------------
    if (rawType === 'UNIVERSAL_DB_MUTATION' || rawType === 'EDIT_RECORD' || rawType === 'EDIT_STOCK' || rawType === 'EDIT_CUSTOMER') {
      const table = rawTable || 'parties';
      const targetId = filter.id || data.id;
      if (!targetId) return { success: false, error: 'এডিটের জন্য টার্গেট আইডি প্রয়োজন' };

      const existing = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(targetId).first().catch(() => null);
      if (!existing) return { success: false, error: `${table} টেবিলে আইডি ${targetId} খুঁজে পাওয়া যায়নি` };

      // Snapshot before edit
      await createRecycleSnapshot(db, {
        module_type: `${table.toUpperCase()}_EDIT`,
        module_label: `${table} এডিট পূর্বাবস্থা`,
        original_id: String(targetId),
        title: `পরিবর্তন পূর্বাবস্থা: ${existing.name || existing.name_bn || existing.title || targetId}`,
        payload: existing,
      });

      // Build updates
      const allowedCols = Object.keys(data).filter((k) => k !== 'id' && k !== 'created_at');
      if (allowedCols.length === 0) return { success: false, error: 'কোনো পরিবর্তনযোগ্য কলাম নেই' };

      const setClauses = allowedCols.map((c) => `${c} = ?`).join(', ');
      const bindVals = allowedCols.map((c) => data[c]);
      bindVals.push(targetId);

      await db.prepare(`UPDATE ${table} SET ${setClauses} WHERE id = ?`).bind(...bindVals).run();

      return {
        success: true,
        message: `${table} রেকর্ড #${targetId} সফলভাবে আপডেট হয়েছে! (পূর্বের তথ্য রিসাইকেল বিনে সংরক্ষিত) ✏️`,
      };
    }

    return { success: false, error: `অজানা অ্যাকশন টাইপ: ${rawType}` };
  } catch (err) {
    console.error('[executeAiAction Error]:', err);
    return { success: false, error: `অ্যাকশন এক্সিকিউশন ত্রুটি: ${err.message}` };
  }
}
