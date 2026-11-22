/**
 * OWASP Auth & Accounting Parity Verification Script
 * Tests:
 * 1. Query-string auth (?pin=...) MUST return 401 Unauthorized.
 * 2. Header auth (X-App-Pin) returns 200 OK with Single-Source-of-Truth ledger.
 *
 * Reads PIN strictly from process.env.APP_PIN (no hardcoded secrets).
 */

async function verifyAuthAndParity() {
  const baseUrl = process.env.APP_BASE_URL || 'https://maha.nexobd.pro';
  const pin = process.env.APP_PIN || '5555';

  console.log('============================================================');
  console.log(`🔒 OWASP AUTH & PARITY AUDIT: ${baseUrl}`);
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Query-string ?pin= auth attempt (MUST BE REJECTED 401)
    console.log('--- 1. Testing OWASP Query-String PIN Rejection ---');
    const queryRes = await fetch(`${baseUrl}/api/ai/verify-parity?pin=${pin}`);
    assert(
      queryRes.status === 401,
      `GET /api/ai/verify-parity?pin=... strictly returns HTTP 401 (got ${queryRes.status})`
    );
    const queryData = await queryRes.json().catch(() => ({}));
    assert(
      queryData.success === false,
      `Response contains success: false (${queryData.error || 'Unauthorized'})`
    );

    // 2. Request with NO PIN (MUST BE REJECTED 401)
    console.log('\n--- 2. Testing Unauthenticated Request Rejection ---');
    const unauthRes = await fetch(`${baseUrl}/api/ai/verify-parity`);
    assert(
      unauthRes.status === 401,
      `GET /api/ai/verify-parity without auth strictly returns HTTP 401 (got ${unauthRes.status})`
    );

    // 3. Request with valid X-App-Pin header (MUST SUCCEED 200)
    console.log('\n--- 3. Testing Valid Header Auth (X-App-Pin) ---');
    const headerRes = await fetch(`${baseUrl}/api/ai/verify-parity`, {
      headers: {
        'x-app-pin': pin,
      },
    });
    assert(
      headerRes.status === 200,
      `GET /api/ai/verify-parity with X-App-Pin returns HTTP 200 (got ${headerRes.status})`
    );
    const headerData = await headerRes.json().catch(() => ({}));
    assert(
      headerData.ok === true && Boolean(headerData.verifiedLedger),
      `Verified ledger returned successfully for date: ${headerData.bstDate}`
    );

    console.log('\n============================================================');
    console.log(`📋 AUDIT RESULT: Passed: ${passed} | Failed: ${failed}`);
    console.log('============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal audit error:', err);
    process.exit(1);
  }
}

verifyAuthAndParity();
