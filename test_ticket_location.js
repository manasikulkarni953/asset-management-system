// Verification Test for Ticket Location Requirements & Employee-Specific Workstations
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING TICKET LOCATION & EMPLOYEE WORKSTATION TESTS');
  console.log('====================================================\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Step 0: Authenticate
  console.log('--- Step 0: Authenticate as Administrator ---');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin',
      password: 'Admin@123',
    }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }
  const rawCookie = loginRes.headers.get('set-cookie');
  const cookie = rawCookie ? rawCookie.split(';')[0] : '';
  console.log(`✓ Authenticated as ${loginData.user?.fullName}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: cookie,
  };

  // Test 1: Verify employees have distinct workstations
  console.log('\n--- TEST 1: Inspect employee list for unique workstations ---');
  const empRes = await fetch(`${BASE_URL}/api/employees`, { headers: authHeaders });
  assert(empRes.status === 200, 'GET /api/employees returns 200 OK');
  const empData = await empRes.json();
  const empList = empData.employees || [];
  const emp1 = empList.find((e) => e.employee_id === 'EMP-1001');
  const emp2 = empList.find((e) => e.employee_id === 'EMP-1002');
  const emp3 = empList.find((e) => e.employee_id === 'EMP-1003');
  const emp4 = empList.find((e) => e.employee_id === 'tgs-55');

  assert(emp1?.workstation === 'WS-5-001', `EMP-1001 (Alex Johnson) has desk: ${emp1?.workstation}`);
  assert(emp2?.workstation === 'WS-5-015', `EMP-1002 (Sarah Connor) has desk: ${emp2?.workstation}`);
  assert(emp3?.workstation === 'WS-5-042', `EMP-1003 (Michael Scott) has desk: ${emp3?.workstation}`);
  assert(emp4?.workstation === 'WS-5-087', `tgs-55 (Rutika Rathod) has desk: ${emp4?.workstation}`);
  assert(
    new Set([emp1?.workstation, emp2?.workstation, emp3?.workstation, emp4?.workstation]).size === 4,
    'All 4 employees have unique, distinct workstations!'
  );

  // Test 2: Raise ticket for EMP-1001 (Alex Johnson) -> gets WS-5-001 automatically
  console.log('\n--- TEST 2: Ticket for Alex Johnson derives WS-5-001 ---');
  const tkt1Res = await fetch(`${BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      asset_id: 1,
      employee_id: emp1.id,
      issue_category: 'Hardware Failure',
      priority: 'high',
      issue_description: 'Alex desk issue',
      // Workstation not sent; should auto-resolve to Alex\'s desk WS-5-001
    }),
  });
  assert(tkt1Res.status === 201, 'Ticket created for Alex');
  const tkt1 = (await tkt1Res.json()).ticket;
  assert(tkt1.raised_building === 'The Space', 'Building is "The Space"');
  assert(tkt1.raised_floor === '5th Floor', 'Floor is "5th Floor"');
  assert(tkt1.raised_workstation === 'WS-5-001', `Alex\'s ticket workstation is WS-5-001 (got: ${tkt1.raised_workstation})`);

  // Test 3: Raise ticket for EMP-1002 (Sarah Connor) -> gets WS-5-015 automatically
  console.log('\n--- TEST 3: Ticket for Sarah Connor derives WS-5-015 ---');
  const tkt2Res = await fetch(`${BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      asset_id: 2,
      employee_id: emp2.id,
      issue_category: 'Hardware Failure',
      priority: 'medium',
      issue_description: 'Sarah desk issue',
      // Workstation not sent; should auto-resolve to Sarah\'s desk WS-5-015
    }),
  });
  assert(tkt2Res.status === 201, 'Ticket created for Sarah');
  const tkt2 = (await tkt2Res.json()).ticket;
  assert(tkt2.raised_workstation === 'WS-5-015', `Sarah\'s ticket workstation is WS-5-015 (got: ${tkt2.raised_workstation})`);
  assert(tkt1.raised_workstation !== tkt2.raised_workstation, 'Sarah and Alex have different workstations on their tickets!');

  // Test 4: Custom variable workstation override (e.g. WS-5-199)
  console.log('\n--- TEST 4: Explicit workstation override ---');
  const tkt3Res = await fetch(`${BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      asset_id: 3,
      employee_id: emp1.id,
      issue_category: 'Peripheral Issue',
      priority: 'low',
      issue_description: 'Custom workstation test',
      raised_workstation: 'WS-5-199',
    }),
  });
  assert(tkt3Res.status === 201, 'Ticket created with custom workstation');
  const tkt3 = (await tkt3Res.json()).ticket;
  assert(tkt3.raised_workstation === 'WS-5-199', `Ticket has overridden workstation WS-5-199 (got: ${tkt3.raised_workstation})`);

  // Test 5: Validation - rejects empty / spaces-only workstation
  console.log('\n--- TEST 5: Workstation validation check (empty/whitespace rejected) ---');
  const emptyWsRes = await fetch(`${BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      asset_id: 1,
      employee_id: 1,
      issue_category: 'Hardware Failure',
      priority: 'medium',
      issue_description: 'Validation test with whitespace workstation',
      raised_workstation: '   ',
    }),
  });
  assert(emptyWsRes.status === 400, `Empty/spaces workstation returns 400 Bad Request (got: ${emptyWsRes.status})`);

  // Clean up created test tickets safely
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'asset_management' });
  await pool.query('DELETE FROM ticket_history WHERE ticket_id IN (?, ?, ?)', [tkt1.id, tkt2.id, tkt3.id]);
  await pool.query('DELETE FROM tickets WHERE id IN (?, ?, ?)', [tkt1.id, tkt2.id, tkt3.id]);
  await pool.end();
  console.log('\n✓ Cleaned up temporary test tickets.');

  console.log(`\n========================================`);
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
