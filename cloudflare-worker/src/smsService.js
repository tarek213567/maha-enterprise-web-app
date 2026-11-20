/**
 * Universal Bangladeshi Bulk SMS Gateway Service
 * Supporting: BulkSMSBD, Alpha SMS (sms.net.bd), GreenWeb BD, MimSMS, Custom URL Template
 * Tailored for Maha Enterprise (মাহা এন্টারপ্রাইজ) Wholesale POS & Accounts
 */

/**
 * Convert Bengali digits (০-৯) to English (0-9), strip special chars,
 * and validate/normalize to international BD format 8801XXXXXXXXX.
 * Strictly rejects dummy walk-in numbers (e.g. 01700000000, 00000000000).
 */
export function normalizeBdPhone(raw) {
  if (!raw) return null;
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let cleaned = String(raw).trim();
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(bengaliDigits[i], String(i));
  }
  cleaned = cleaned.replace(/[^0-9]/g, '');

  let normalized = null;
  if (/^8801[3-9]\d{8}$/.test(cleaned)) {
    normalized = cleaned;
  } else if (/^01[3-9]\d{8}$/.test(cleaned)) {
    normalized = '88' + cleaned;
  } else if (/^1[3-9]\d{8}$/.test(cleaned)) {
    normalized = '880' + cleaned;
  }

  if (!normalized) return null;

  // Reject dummy/test numbers like 8801700000000, 8801000000000, 8800000000000
  if (/^8801[0-9]0{6,8}$/.test(normalized) || /^8801[0-9](\d)\1{7}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

// Map Bengali crop names to concise Banglish
const CROP_BANGLISH_MAP = {
  'সরিষা': 'Sorisha',
  'মাঘি সরিষা': 'Sorisha',
  'টোরি সরিষা': 'Sorisha',
  'ভুট্টা': 'Bhutta',
  'পাট': 'Pat',
  'তোষা পাট': 'Toshas Pat',
  'গম': 'Gom',
  'ধান': 'Dhan',
  'আমন ধান': 'Aman Dhan',
  'বোরো ধান': 'Boro Dhan',
  'খেসারী': 'Khesari',
  'খেসারী কলাই': 'Khesari',
  'মসুর': 'Mosur',
  'মসুর ডাল': 'Mosur',
};

export function toBanglishCrop(bnName) {
  if (!bnName) return 'Shossho';
  for (const [key, val] of Object.entries(CROP_BANGLISH_MAP)) {
    if (bnName.includes(key)) return val;
  }
  return bnName.replace(/[^\w\s]/gi, '').trim() || 'Shossho';
}

/**
 * Build cost-optimized SMS text
 * Mode A: 'banglish_1sms' (Strictly <= 160 GSM-7 characters)
 * Mode B: 'bengali_unicode'
 */
export function buildSaleSmsText(mode, {
  invoiceNo,
  commodityName,
  bagsCount,
  netWeightMon,
  netWeightKg,
  netAmount,
  paidAmount,
  currentDue,
}) {
  const inv = invoiceNo || 'SAL';
  const total = Math.round(netAmount || 0);
  const paid = Math.round(paidAmount || 0);
  const due = Math.round(currentDue || 0);

  if (mode === 'bengali_unicode') {
    const weightStr = `${(netWeightMon || 0).toFixed(1)} মণ (${bagsCount || 0} বস্তা)`;
    return `মাহা এন্টারপ্রাইজ: চালান #${inv}, ${commodityName || 'শস্য'} (${weightStr}), মোট বিল ৳${total}, জমা ৳${paid}, বর্তমান মোট বকেয়া ৳${due}। ধন্যবাদ।`;
  }

  // Default Mode: 'banglish_1sms' (Strictly <= 160 characters)
  let crop = toBanglishCrop(commodityName);
  const monStr = `${Number(netWeightMon || 0).toFixed(1)}m`;
  const bagStr = bagsCount ? ` (${bagsCount}b)` : '';
  const weightStr = `${monStr}${bagStr}`;

  let text = `Maha Enterprise: Inv #${inv} | ${crop} ${weightStr} | Bill: ${total} Tk | Paid: ${paid} Tk | Total Due: ${due} Tk. Dhonnobad!`;

  if (text.length > 160) {
    const excess = text.length - 160;
    const allowedCropLen = Math.max(3, crop.length - excess);
    crop = crop.slice(0, allowedCropLen);
    text = `Maha Enterprise: Inv #${inv} | ${crop} ${weightStr} | Bill: ${total} Tk | Paid: ${paid} Tk | Total Due: ${due} Tk. Dhonnobad!`;
  }

  if (text.length > 160) {
    text = `Maha Ent: Inv #${inv} | ${crop} | Bill:${total}Tk | Paid:${paid}Tk | Due:${due}Tk. Dhonnobad!`;
  }

  return text;
}

export function buildDueCollectSmsText(mode, { partyName, paidAmount, remainingDue }) {
  const paid = Math.round(paidAmount || 0);
  const due = Math.round(remainingDue || 0);
  const name = (partyName || 'Grahok').slice(0, 24);

  if (mode === 'bengali_unicode') {
    return `মাহা এন্টারপ্রাইজ: ${name}-এর নিকট হতে ৳${paid} জমা পেয়েছি। বর্তমান অবশিষ্ট বকেয়া ৳${due}। ধন্যবাদ।`;
  }

  return `Maha Enterprise: Joma ${paid} Tk received from ${name}. Bortoman Mot Baki: ${due} Tk. Dhonnobad!`;
}

/**
 * Retrieve current SMS settings from D1 or environment
 */
export async function getSmsConfig(db, env) {
  const defaults = {
    sms_enabled: 'true',
    sms_provider: 'bulksmsbd',
    sms_api_key: '',
    sms_sender_id: '',
    sms_custom_url: '',
    sms_format_mode: 'banglish_1sms',
    sms_send_on_due_collect: 'true',
  };

  if (!db) {
    return {
      ...defaults,
      sms_api_key: env?.SMS_API_KEY || '',
      sms_sender_id: env?.SMS_SENDER_ID || '',
    };
  }

  try {
    const { results } = await db.prepare(
      "SELECT key, value FROM settings WHERE key LIKE 'sms_%'"
    ).all();
    if (results && results.length > 0) {
      for (const row of results) {
        defaults[row.key] = row.value;
      }
    }
  } catch (e) {
    // settings query error fallback
  }

  if (env?.SMS_API_KEY && !defaults.sms_api_key) defaults.sms_api_key = env.SMS_API_KEY;
  if (env?.SMS_SENDER_ID && !defaults.sms_sender_id) defaults.sms_sender_id = env.SMS_SENDER_ID;
  if (env?.SMS_PROVIDER && defaults.sms_provider === 'bulksmsbd') defaults.sms_provider = env.SMS_PROVIDER;

  return defaults;
}

/**
 * Save SMS settings to D1 settings table
 */
export async function saveSmsConfig(db, data) {
  if (!db) return false;
  const allowedKeys = [
    'sms_enabled',
    'sms_provider',
    'sms_api_key',
    'sms_sender_id',
    'sms_custom_url',
    'sms_format_mode',
    'sms_send_on_due_collect',
  ];

  const stmts = [];
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      stmts.push(
        db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).bind(key, String(data[key]))
      );
    }
  }
  if (stmts.length > 0) {
    await db.batch(stmts);
  }
  return true;
}

/**
 * Dispatch SMS via selected Bangladeshi gateway and log result into sms_logs
 */
export async function sendBulkSms(db, env, { phone, message, invoiceNo = '', partyName = '' }) {
  const normalizedPhone = normalizeBdPhone(phone);
  if (!normalizedPhone) {
    return { success: false, status: 'SKIPPED', error: 'Invalid or dummy BD phone number' };
  }

  const config = await getSmsConfig(db, env);
  if (!config.sms_enabled || config.sms_enabled === 'false') {
    return { success: false, status: 'SKIPPED', error: 'SMS service is disabled in settings' };
  }

  if (!config.sms_api_key && config.sms_provider !== 'custom') {
    return { success: false, status: 'FAILED', error: 'SMS API Key is not configured' };
  }

  let gatewayResponse = '';
  let status = 'FAILED';
  const provider = config.sms_provider || 'bulksmsbd';

  try {
    if (provider === 'bulksmsbd') {
      const endpoint = 'http://bulksmsbd.net/api/smsapi';
      const bodyParams = new URLSearchParams({
        api_key: config.sms_api_key,
        type: 'text',
        number: normalizedPhone,
        senderid: config.sms_sender_id || '',
        message: message,
      });
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
      });
      gatewayResponse = await res.text();
      try {
        const json = JSON.parse(gatewayResponse);
        if (json.response_code === 202 || json.success_message) {
          status = 'SENT';
        }
      } catch {
        if (gatewayResponse.toLowerCase().includes('success') || res.status === 200) {
          status = 'SENT';
        }
      }
    } else if (provider === 'alphasms') {
      const endpoint = 'https://api.sms.net.bd/sendsms';
      const bodyParams = new URLSearchParams({
        api_key: config.sms_api_key,
        msg: message,
        to: normalizedPhone,
      });
      if (config.sms_sender_id) {
        bodyParams.append('sender_id', config.sms_sender_id);
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
      });
      gatewayResponse = await res.text();
      try {
        const json = JSON.parse(gatewayResponse);
        if (json.error === 0 || json.msg?.toLowerCase().includes('submitted')) {
          status = 'SENT';
        }
      } catch {
        if (res.status === 200) status = 'SENT';
      }
    } else if (provider === 'greenweb') {
      const endpoint = 'http://api.greenweb.com.bd/api.php';
      const bodyParams = new URLSearchParams({
        token: config.sms_api_key,
        to: normalizedPhone,
        message: message,
      });
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
      });
      gatewayResponse = await res.text();
      if (res.status === 200 && !gatewayResponse.toLowerCase().includes('error')) {
        status = 'SENT';
      }
    } else if (provider === 'mimsms') {
      const endpoint = 'https://api.mimsms.com/api/SmsSending/SMS';
      const payload = {
        UserName: config.sms_sender_id || '',
        ApiKey: config.sms_api_key,
        SenderName: config.sms_sender_id || '',
        MobileNumber: normalizedPhone,
        Message: message,
        TransactionType: 'T',
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      gatewayResponse = await res.text();
      if (res.status === 200) status = 'SENT';
    } else if (provider === 'custom') {
      let targetUrl = config.sms_custom_url || '';
      if (!targetUrl) throw new Error('Custom SMS Gateway URL template is not set');

      targetUrl = targetUrl
        .replaceAll('{api_key}', encodeURIComponent(config.sms_api_key || ''))
        .replaceAll('{sender_id}', encodeURIComponent(config.sms_sender_id || ''))
        .replaceAll('{to}', encodeURIComponent(normalizedPhone))
        .replaceAll('{message}', encodeURIComponent(message));

      const res = await fetch(targetUrl);
      gatewayResponse = await res.text();
      if (res.status === 200) status = 'SENT';
    }
  } catch (err) {
    gatewayResponse = `Exception: ${err.message}`;
    status = 'FAILED';
  }

  // Log into sms_logs in D1
  if (db) {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS sms_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_no TEXT,
          party_name TEXT,
          phone TEXT NOT NULL,
          message TEXT NOT NULL,
          provider TEXT,
          status TEXT NOT NULL,
          gateway_response TEXT,
          created_at TEXT DEFAULT (datetime('now', '+6 hours'))
        )
      `).run().catch(() => null);

      await db.prepare(`
        INSERT INTO sms_logs (invoice_no, party_name, phone, message, provider, status, gateway_response)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        invoiceNo || '',
        partyName || '',
        normalizedPhone,
        message,
        provider,
        status,
        gatewayResponse ? gatewayResponse.slice(0, 500) : ''
      ).run();
    } catch (logErr) {
      console.warn('[SMS Log Error]:', logErr);
    }
  }

  return {
    success: status === 'SENT',
    status,
    phone: normalizedPhone,
    gatewayResponse,
  };
}

/**
 * Retrieve recent SMS delivery logs
 */
export async function getSmsLogs(db, limit = 30) {
  if (!db) return [];
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sms_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT,
        party_name TEXT,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        provider TEXT,
        status TEXT NOT NULL,
        gateway_response TEXT,
        created_at TEXT DEFAULT (datetime('now', '+6 hours'))
      )
    `).run().catch(() => null);

    const { results } = await db.prepare(`
      SELECT * FROM sms_logs ORDER BY id DESC LIMIT ?
    `).bind(limit).all();

    return results || [];
  } catch (e) {
    console.warn('[getSmsLogs error]:', e);
    return [];
  }
}

/**
 * Resend a previously failed or existing SMS from logs
 */
export async function resendSms(db, env, logId) {
  if (!db) return { success: false, error: 'Database not available' };
  try {
    const log = await db.prepare('SELECT * FROM sms_logs WHERE id = ?').bind(logId).first();
    if (!log) return { success: false, error: 'SMS log entry not found' };

    const result = await sendBulkSms(db, env, {
      phone: log.phone,
      message: log.message,
      invoiceNo: log.invoice_no,
      partyName: log.party_name,
    });

    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}
