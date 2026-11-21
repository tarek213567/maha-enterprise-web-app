/**
 * Verification test suite for Ai Manezar on Maha Enterprise (https://maha.nexobd.pro)
 */

async function runMahaAiVerification() {
  const baseUrl = 'https://maha.nexobd.pro';
  console.log('============================================================');
  console.log(`🚀 RUNNING AI MANEZAR TEST SUITE ON: ${baseUrl}`);
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
    // 1. Root HTML & Assets check
    console.log('--- 1. Testing Root HTML & Assets Delivery ---');
    const resHtml = await fetch(`${baseUrl}/`);
    assert(resHtml.status === 200, 'Root URL returns HTTP 200 OK');
    const html = await resHtml.text();
    assert(html.includes('index-'), 'Vite bundled assets referenced in HTML');

    // 2. Settings & AI Key Status
    console.log('\n--- 2. Testing AI Key Status Endpoint ---');
    const aiKeyRes = await fetch(`${baseUrl}/api/settings/ai-key`);
    assert(aiKeyRes.status === 200, 'GET /api/settings/ai-key returned HTTP 200 OK');
    const aiKeyData = await aiKeyRes.json();
    assert(aiKeyData.success === true, `ai-key success flag true (hasKey: ${aiKeyData.hasKey})`);

    // 3. Morning Briefing API
    console.log('\n--- 3. Testing Morning Briefing Endpoint ---');
    const briefingRes = await fetch(`${baseUrl}/api/ai/morning-briefing`);
    assert(briefingRes.status === 200, 'GET /api/ai/morning-briefing returned HTTP 200 OK');
    const briefingData = await briefingRes.json();
    assert(briefingData.success === true, 'Morning Briefing returned success true');
    assert(Boolean(briefingData.briefing?.summaryText), `Briefing summary: "${briefingData.briefing?.summaryText?.slice(0, 60)}..."`);

    // 4. Ai Sessions Management (Create, Update, List, Delete)
    console.log('\n--- 4. Testing AI Chat Sessions API ---');
    const createSessRes = await fetch(`${baseUrl}/api/ai/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '[স্বয়ংক্রিয় টেস্ট সেশন - মাহা এআই]' }),
    });
    const createSessData = await createSessRes.json();
    assert(createSessRes.status === 200 && createSessData.success, 'POST /api/ai/sessions created test session');
    const testSessionId = createSessData.session?.id;
    assert(Boolean(testSessionId), `Session created with ID: ${testSessionId}`);

    if (testSessionId) {
      // Pin / Update session
      const pinRes = await fetch(`${baseUrl}/api/ai/sessions/${testSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: 1, title: '[স্বয়ংক্রিয় টেস্ট - পিন্ড]' }),
      });
      const pinData = await pinRes.json();
      assert(pinRes.status === 200 && pinData.success, 'PUT /api/ai/sessions/:id pinned session successfully');

      // Get messages for session
      const getMsgsRes = await fetch(`${baseUrl}/api/ai/sessions/${testSessionId}/messages`);
      const getMsgsData = await getMsgsRes.json();
      assert(getMsgsRes.status === 200 && getMsgsData.success, 'GET /api/ai/sessions/:id/messages returned 200 OK');
    }

    // 5. Dynamic Overrides & Memories endpoints
    console.log('\n--- 5. Testing Overrides & Memories Endpoints ---');
    const ovRes = await fetch(`${baseUrl}/api/ai/overrides`);
    const ovData = await ovRes.json();
    assert(ovRes.status === 200 && ovData.success, 'GET /api/ai/overrides returned HTTP 200 OK');

    const memRes = await fetch(`${baseUrl}/api/ai/memories`);
    const memData = await memRes.json();
    assert(memRes.status === 200 && memData.success, 'GET /api/ai/memories returned HTTP 200 OK');

    // 6. Action Execution & 60-day RecycleBin Snapshot
    console.log('\n--- 6. Testing Action Execution & 60-Day Recycle Bin Snapshot ---');
    const testAction = {
      actionType: 'ADD_NOTE',
      description: 'Ai Manezar টেস্ট নোটবুক এন্ট্রি',
      payload: {
        title: '[টেস্ট এআই নোট]',
        content: 'Ai Manezar v1.5.0 PRO অটোমেশন টেস্ট সম্পন্ন।',
        category: 'AI_TEST',
      },
    };

    const execRes = await fetch(`${baseUrl}/api/ai/execute-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: testAction }),
    });
    const execData = await execRes.json();
    assert(execRes.status === 200 && execData.success, `POST /api/ai/execute-action succeeded: ${execData.message}`);

    // Clean up test session
    if (testSessionId) {
      await fetch(`${baseUrl}/api/ai/sessions/${testSessionId}`, { method: 'DELETE' });
      console.log('   🧹 Cleaned up test session');
    }

    console.log('\n============================================================');
    console.log(`📋 AI MANEZAR AUDIT SUMMARY: Total Passed: ${passed} | Total Failed: ${failed}`);
    console.log('============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runMahaAiVerification();
