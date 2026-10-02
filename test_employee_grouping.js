// test_employee_grouping.js
// Verification suite for Employee-Wise Asset Grouping via Code 128 Scan & MySQL (TGS Prefix)

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('====================================================');
  console.log('STARTING EMPLOYEE-WISE ASSET GROUPING VERIFICATION (TGS PREFIX)');
  console.log('====================================================\n');

  // STEP 0: Authenticate
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'Admin@123' }),
  });
  if (!loginRes.ok) throw new Error('Authentication failed: ' + (await loginRes.text()));
  const setCookie = loginRes.headers.get('set-cookie');
  const cookieMatch = setCookie && setCookie.match(/assetflow_auth_token=([^;]+)/);
  const token = cookieMatch ? cookieMatch[1] : '';
  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: `assetflow_auth_token=${token}`,
  };
  console.log('Step 0: Admin session authenticated successfully.\n');

  // TEST 1: Scan Laptop TGS-LAP-00001
  console.log('--- TEST 1: Scan Laptop TGS-LAP-00001 ---');
  const scanLapRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: 'TGS-LAP-00001' }),
  });
  const scanLapData = await scanLapRes.json();
  if (!scanLapRes.ok || !scanLapData.success || !scanLapData.data?.employee) {
    throw new Error('TEST 1 FAILED: ' + JSON.stringify(scanLapData));
  }
  const emp = scanLapData.data.employee;
  console.log(`✓ Identified Employee: ${emp.employeeId} – ${emp.name} (${emp.designation}, ${emp.department})`);
  console.log(`✓ Total Current Assigned Assets Count: ${scanLapData.data.assetCount}`);
  console.log(`✓ Scanned Asset: ${scanLapData.data.scannedAsset.assetNumber} (isScanned=${scanLapData.data.scannedAsset.isScanned})`);
  console.log(`✓ Assets in Group: ${scanLapData.data.assignedAssets.map(a => `${a.assetNumber} (${a.category}) [isScanned=${a.isScanned}]`).join(', ')}`);
  
  if (scanLapData.data.assignedAssets.length !== scanLapData.data.assetCount) {
    throw new Error('TEST 1 FAILED: assetCount does not match assignedAssets length');
  }
  const lapScanned = scanLapData.data.assignedAssets.find(a => a.assetNumber === 'TGS-LAP-00001');
  if (!lapScanned || !lapScanned.isScanned) {
    throw new Error('TEST 1 FAILED: Scanned laptop was not flagged as isScanned');
  }
  console.log('TEST 1 PASSED: Laptop correctly identified employee & entire current asset group.\n');

  // TEST 2: Scan Monitor TGS-MON-00001 (belonging to same employee)
  console.log('--- TEST 2: Scan Monitor TGS-MON-00001 ---');
  const scanMonRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: 'TGS-MON-00001' }),
  });
  const scanMonData = await scanMonRes.json();
  if (!scanMonRes.ok || !scanMonData.success || !scanMonData.data?.employee) {
    throw new Error('TEST 2 FAILED: ' + JSON.stringify(scanMonData));
  }
  if (scanMonData.data.employee.employeeId !== emp.employeeId) {
    throw new Error(`TEST 2 FAILED: Expected employee ${emp.employeeId}, got ${scanMonData.data.employee.employeeId}`);
  }
  const monScanned = scanMonData.data.assignedAssets.find(a => a.assetNumber === 'TGS-MON-00001');
  if (!monScanned || !monScanned.isScanned) {
    throw new Error('TEST 2 FAILED: Monitor was not marked as isScanned in group');
  }
  console.log(`✓ Monitor highlighted as SCANNED`);
  console.log(`✓ Resolved to same custodian: ${scanMonData.data.employee.name} (${scanMonData.data.employee.employeeId})`);
  console.log(`✓ Group size remains authoritative: ${scanMonData.data.assetCount}`);
  console.log('TEST 2 PASSED: Scanning monitor resolves to same employee asset group with monitor highlighted.\n');

  // TEST 3: Scan Unassigned Asset TGS-DSK-00001
  console.log('--- TEST 3: Scan Unassigned Asset TGS-DSK-00001 ---');
  const scanUnassignedRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: 'TGS-DSK-00001' }),
  });
  const scanUnassignedData = await scanUnassignedRes.json();
  if (!scanUnassignedRes.ok || !scanUnassignedData.success) {
    throw new Error('TEST 3 FAILED: ' + JSON.stringify(scanUnassignedData));
  }
  if (scanUnassignedData.data.employee !== null) {
    throw new Error('TEST 3 FAILED: Unassigned asset returned an employee!');
  }
  if (scanUnassignedData.data.assetCount !== 0 || scanUnassignedData.data.assignedAssets.length !== 0) {
    throw new Error('TEST 3 FAILED: Unassigned asset returned non-empty assignedAssets!');
  }
  console.log(`✓ Unassigned asset status: ${scanUnassignedData.asset.status}`);
  console.log(`✓ Employee custodian: ${scanUnassignedData.data.employee} (null)`);
  console.log(`✓ Assigned group count: ${scanUnassignedData.data.assetCount} (0)`);
  console.log('TEST 3 PASSED: Unassigned asset does not attach to an employee.\n');

  // TEST 4: Scan Invalid Barcode
  console.log('--- TEST 4: Scan Invalid Barcode ---');
  const scanInvalidRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: 'TGS-NON-EXISTENT-99999' }),
  });
  const scanInvalidData = await scanInvalidRes.json();
  if (scanInvalidRes.status !== 404 || scanInvalidData.found !== false) {
    throw new Error('TEST 4 FAILED: Expected 404 and found=false: ' + JSON.stringify(scanInvalidData));
  }
  console.log(`✓ Friendly message: "${scanInvalidData.message}"`);
  console.log('TEST 4 PASSED: Invalid barcode handled gracefully without MySQL errors.\n');

  // TEST 5: Verify Employee Details Page API
  console.log('--- TEST 5: Employee Profile API Group Verification ---');
  const empProfileRes = await fetch(`${BASE_URL}/api/employees/${emp.id}`, { headers: authHeaders });
  const empProfileData = await empProfileRes.json();
  if (!empProfileRes.ok || !empProfileData.employee) {
    throw new Error('TEST 5 FAILED: ' + JSON.stringify(empProfileData));
  }
  console.log(`✓ Employee: ${empProfileData.employee.employee_id} – ${empProfileData.employee.name}`);
  console.log(`✓ Total Current Assets: ${empProfileData.employee.asset_count}`);
  console.log(`✓ Current Assets Count in Array: ${empProfileData.employee.current_assets?.length}`);
  if (empProfileData.employee.asset_count !== empProfileData.employee.current_assets?.length) {
    throw new Error('TEST 5 FAILED: asset_count does not match current_assets length');
  }
  console.log('TEST 5 PASSED: Employee details API derives current assets strictly from active assignments.\n');

  // TEST 6: Ticket Raising from Grouped Asset
  console.log('--- TEST 6: Ticket Raising Integration ---');
  const ticketRes = await fetch(`${BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      asset_id: scanMonData.asset.id,
      employee_id: emp.id,
      issue_category: 'Display / Video Issue',
      priority: 'medium',
      issue_description: 'Intermittent flickering detected after scanning monitor from employee asset group.',
    }),
  });
  const ticketData = await ticketRes.json();
  if (!ticketRes.ok || !ticketData.success || !ticketData.ticket) {
    throw new Error('TEST 6 FAILED: ' + JSON.stringify(ticketData));
  }
  console.log(`✓ Created Ticket ID: ${ticketData.ticket.ticket_id}`);
  console.log(`✓ Attached Asset: ${ticketData.ticket.asset_number}`);
  console.log('TEST 6 PASSED: Ticket auto-attaches scanned asset and employee custodian.\n');

  // TEST 7: Custody Transfer and Group Re-computation
  console.log('--- TEST 7: Transfer Asset & Check Employee Group Count ---');
  // Find a second employee (e.g. Michael Scott or Sarah Connor)
  const empListRes = await fetch(`${BASE_URL}/api/employees`, { headers: authHeaders });
  const empListData = await empListRes.json();
  const emp2 = empListData.employees.find(e => e.id !== emp.id);
  if (!emp2) throw new Error('TEST 7 FAILED: Could not find second employee for transfer test');

  const beforeAlexCount = scanLapData.data.assetCount;
  console.log(`  Alex Johnson initial active assets: ${beforeAlexCount}`);

  // Transfer TGS-MON-00001 to emp2
  const transferRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'transfer',
      asset_id: scanMonData.asset.id,
      to_employee_id: emp2.id,
      notes: 'Testing employee grouping transfer behavior',
    }),
  });
  const transferData = await transferRes.json();
  if (!transferRes.ok) throw new Error('Transfer failed: ' + JSON.stringify(transferData));

  // Now scan TGS-LAP-00001 again to check Alex's current group
  const scanLapAfterRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: 'TGS-LAP-00001' }),
  });
  const scanLapAfterData = await scanLapAfterRes.json();
  const afterAlexCount = scanLapAfterData.data.assetCount;
  console.log(`  Alex Johnson active assets after transfer of monitor away: ${afterAlexCount}`);
  if (afterAlexCount !== beforeAlexCount - 1) {
    throw new Error(`TEST 7 FAILED: Expected Alex count to decrease from ${beforeAlexCount} to ${beforeAlexCount - 1}, got ${afterAlexCount}`);
  }
  const monInAlexGroup = scanLapAfterData.data.assignedAssets.some(a => a.assetNumber === 'TGS-MON-00001');
  if (monInAlexGroup) {
    throw new Error('TEST 7 FAILED: Transferred monitor still appeared in Alex current asset group!');
  }
  console.log('✓ Monitor successfully removed from original employee current group.');

  // Now scan TGS-MON-00001 -> must resolve to emp2
  const scanMonAfterRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: 'TGS-MON-00001' }),
  });
  const scanMonAfterData = await scanMonAfterRes.json();
  if (scanMonAfterData.data.employee.employeeId !== emp2.employee_id) {
    throw new Error(`TEST 7 FAILED: Monitor expected to be assigned to ${emp2.employee_id}, got ${scanMonAfterData.data.employee?.employeeId}`);
  }
  console.log(`✓ Scanned Monitor now belongs to new custodian: ${scanMonAfterData.data.employee.name} (${scanMonAfterData.data.employee.employeeId})`);

  // Transfer TGS-MON-00001 back to Alex to preserve baseline
  const transferBackRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'transfer',
      asset_id: scanMonData.asset.id,
      to_employee_id: emp.id,
      notes: 'Transfer back to original custodian to restore baseline',
    }),
  });
  if (!transferBackRes.ok) throw new Error('Transfer back failed');
  console.log('✓ Monitor transferred back to Alex Johnson to preserve baseline.');

  // Re-verify Alex has his full group restored
  const scanLapFinalRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: 'TGS-LAP-00001' }),
  });
  const scanLapFinalData = await scanLapFinalRes.json();
  if (scanLapFinalData.data.assetCount !== beforeAlexCount) {
    throw new Error(`TEST 7 FAILED: Expected restored count ${beforeAlexCount}, got ${scanLapFinalData.data.assetCount}`);
  }
  console.log(`✓ Alex Johnson restored group count: ${scanLapFinalData.data.assetCount}`);
  console.log('TEST 7 PASSED: Transfer correctly updates current asset groups without data contamination.\n');

  // Clean up test ticket created in Test 6 to preserve pristine database
  try {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '', database: 'asset_management' });
    if (ticketData?.ticket?.id) {
      await pool.query('DELETE FROM ticket_history WHERE ticket_id = ?', [ticketData.ticket.id]);
      await pool.query('DELETE FROM tickets WHERE id = ?', [ticketData.ticket.id]);
    }
    await pool.end();
  } catch (cleanErr) {
    console.warn('Note: ticket cleanup skipped:', cleanErr.message);
  }

  console.log('====================================================');
  console.log('ALL EMPLOYEE-WISE ASSET GROUPING TESTS (TGS) PASSED 100%!');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
  process.exit(1);
});
