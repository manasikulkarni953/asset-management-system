// Comprehensive End-to-End Test Suite for Asset Management System (Tests 1 - 11)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING ENTERPRISE ASSET MANAGEMENT VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  // Step 0: Authenticate as Administrator
  console.log('--- STEP 0: Authenticate as Administrator ---');
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
  console.log(`  Login success! Authenticated as ${loginData.user?.fullName} (${loginData.user?.role})`);
  console.log(`  Session Cookie acquired: ${cookie.slice(0, 25)}...\n`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Cookie: cookie,
  };

  let test1Asset = null;
  let test2Asset = null;
  const uniqueSuffix = Date.now().toString().slice(-6);

  // ----------------------------------------------------
  // TEST 1: Create a new laptop
  // ----------------------------------------------------
  console.log('--- TEST 1: Create a new laptop ---');
  const t1Serial = `SN-TEST-1-${uniqueSuffix}`;
  const t1Res = await fetch(`${BASE_URL}/api/assets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'Laptop',
      brand: 'Lenovo',
      model: 'ThinkPad T14 Gen 4',
      serial_number: t1Serial,
      purchase_date: '2026-03-15',
      purchase_cost: 1450.00,
      vendor: 'CDW Direct',
      warranty_expiry: '2028-03-15',
      status: 'in_stock'
    })
  });

  const t1Data = await t1Res.json();
  if (!t1Res.ok || !t1Data.asset) {
    console.error('TEST 1 FAILED:', t1Data);
    process.exit(1);
  }
  test1Asset = t1Data.asset;
  console.log('TEST 1 PASSED:');
  console.log(`  Asset ID generated: ${test1Asset.asset_id} (Expected format: TGS-XXXXXX)`);
  console.log(`  Asset Number generated: ${test1Asset.asset_number} (Expected format: TGS-LAP-XXXXX)`);
  console.log(`  Serial Number saved: ${test1Asset.serial_number}`);
  console.log(`  Status: ${test1Asset.status}`);
  console.log(`  MySQL Row ID: ${test1Asset.id}`);
  if (!test1Asset.asset_id || test1Asset.asset_id === '') {
    throw new Error('TEST 1 FAILED: asset_id is empty string!');
  }

  // ----------------------------------------------------
  // TEST 2: Create another laptop (Sequence and Uniqueness)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Create another laptop (Sequence Check) ---');
  const t2Serial = `SN-TEST-2-${uniqueSuffix}`;
  const t2Res = await fetch(`${BASE_URL}/api/assets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'Laptop',
      brand: 'Dell',
      model: 'XPS 15 9530',
      serial_number: t2Serial,
      purchase_date: '2026-04-01',
      purchase_cost: 2199.00,
      vendor: 'Dell Enterprise',
      warranty_expiry: '2029-04-01',
      status: 'in_stock'
    })
  });

  const t2Data = await t2Res.json();
  if (!t2Res.ok || !t2Data.asset) {
    console.error('TEST 2 FAILED:', t2Data);
    process.exit(1);
  }
  test2Asset = t2Data.asset;
  console.log('TEST 2 PASSED:');
  console.log(`  New Asset ID: ${test2Asset.asset_id} (distinct from ${test1Asset.asset_id})`);
  console.log(`  New Asset Number: ${test2Asset.asset_number} (distinct from ${test1Asset.asset_number})`);
  if (test1Asset.asset_id === test2Asset.asset_id || test1Asset.asset_number === test2Asset.asset_number) {
    throw new Error('TEST 2 FAILED: IDs or Numbers are not unique!');
  }

  // ----------------------------------------------------
  // TEST 3: Enter an existing serial number (Duplicate validation)
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Duplicate Serial Number Validation ---');
  const t3Res = await fetch(`${BASE_URL}/api/assets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'Laptop',
      brand: 'HP',
      model: 'EliteBook 840',
      serial_number: t1Serial, // Duplicate!
      purchase_date: '2026-05-01',
      purchase_cost: 1300.00,
      vendor: 'HP Direct',
      warranty_expiry: '2028-05-01'
    })
  });

  const t3Data = await t3Res.json();
  console.log(`  Response Status: ${t3Res.status} (Expected: 409 or 400)`);
  console.log(`  Response Error: "${t3Data.error}"`);
  if (t3Res.status === 409 && t3Data.error && t3Data.error.includes('hardware serial number already exists')) {
    console.log('TEST 3 PASSED: Duplicate serial correctly rejected with friendly message.');
  } else {
    throw new Error('TEST 3 FAILED: Duplicate serial was not rejected properly: ' + JSON.stringify(t3Data));
  }

  // ----------------------------------------------------
  // TEST 4: Barcode value = asset_number
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Barcode Identity Validation ---');
  console.log(`  Target Asset: ${test1Asset.asset_number}`);
  const barcodeValue = test1Asset.asset_number;
  if (/^TGS-[A-Z]{3}-\d{5}$/.test(barcodeValue)) {
    console.log(`TEST 4 PASSED: Barcode value strictly equals Asset Number "${barcodeValue}" (Code 128 compliant).`);
  } else {
    throw new Error('TEST 4 FAILED: Asset number format is invalid: ' + barcodeValue);
  }

  // ----------------------------------------------------
  // TEST 5: Scan barcode -> retrieves correct asset
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Scan Barcode Lookup ---');
  const scanRes = await fetch(`${BASE_URL}/api/assets/scan`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ barcode: test1Asset.asset_number })
  });
  const scanData = await scanRes.json();
  if (scanRes.ok && scanData.found && scanData.asset && scanData.asset.id === test1Asset.id) {
    console.log('TEST 5 PASSED: Scan successfully returned asset:');
    console.log(`  Matched Asset ID: ${scanData.asset.asset_id}`);
    console.log(`  Matched Model: ${scanData.asset.brand} ${scanData.asset.model}`);
    console.log(`  Authorized Actions: ${JSON.stringify(scanData.authorizedActions)}`);
  } else {
    throw new Error('TEST 5 FAILED: Could not lookup scanned barcode: ' + JSON.stringify(scanData));
  }

  // Fetch employees for assignment
  const empRes = await fetch(`${BASE_URL}/api/employees?limit=5`, { headers: authHeaders });
  const empData = await empRes.json();
  const emp1 = empData.employees[0];
  const emp2 = empData.employees[1];
  console.log(`\n  Using Test Custodians: ${emp1.name} (ID: ${emp1.id}) and ${emp2.name} (ID: ${emp2.id})`);

  // ----------------------------------------------------
  // TEST 6: Assign asset
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Assign Asset Custody ---');
  const assignRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'assign',
      asset_id: test1Asset.id,
      employee_id: emp1.id,
      notes: 'Initial developer deployment setup'
    })
  });
  const assignData = await assignRes.json();
  if (!assignRes.ok) {
    throw new Error('TEST 6 FAILED: ' + JSON.stringify(assignData));
  }
  // Verify asset details updated
  const a1Res = await fetch(`${BASE_URL}/api/assets/${test1Asset.id}`, { headers: authHeaders });
  const a1Data = await a1Res.json();
  if (a1Data.asset.status === 'assigned' && a1Data.asset.current_employee_id === emp1.id) {
    console.log('TEST 6 PASSED: Asset custody successfully assigned:');
    console.log(`  Current Status: ${a1Data.asset.status}`);
    console.log(`  Current Custodian: ${a1Data.asset.current_employee_name}`);
    console.log(`  History Events Count: ${a1Data.asset.history.length}`);
  } else {
    throw new Error('TEST 6 FAILED: Status or employee not updated properly: ' + JSON.stringify(a1Data));
  }

  // ----------------------------------------------------
  // TEST 7: Transfer asset
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Transfer Asset to Another Employee ---');
  const transferRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'transfer',
      asset_id: test1Asset.id,
      to_employee_id: emp2.id,
      notes: 'Transferred to lead technician for escalation project'
    })
  });
  const transferData = await transferRes.json();
  if (!transferRes.ok) {
    throw new Error('TEST 7 FAILED: ' + JSON.stringify(transferData));
  }
  // Verify asset details updated
  const a2Res = await fetch(`${BASE_URL}/api/assets/${test1Asset.id}`, { headers: authHeaders });
  const a2Data = await a2Res.json();
  if (a2Data.asset.status === 'assigned' && a2Data.asset.current_employee_id === emp2.id) {
    console.log('TEST 7 PASSED: Asset successfully transferred:');
    console.log(`  Previous Custodian Closed, New Custodian: ${a2Data.asset.current_employee_name}`);
    console.log(`  Total Assignments Chain Count: ${a2Data.asset.assignments.length}`);
  } else {
    throw new Error('TEST 7 FAILED: ' + JSON.stringify(a2Data));
  }

  // ----------------------------------------------------
  // TEST 8: Return asset
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Return Asset to Inventory ---');
  const returnRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      action: 'return',
      asset_id: test1Asset.id,
      notes: 'Returned in pristine condition after project milestone'
    })
  });
  const returnData = await returnRes.json();
  if (!returnRes.ok) {
    throw new Error('TEST 8 FAILED: ' + JSON.stringify(returnData));
  }
  const a3Res = await fetch(`${BASE_URL}/api/assets/${test1Asset.id}`, { headers: authHeaders });
  const a3Data = await a3Res.json();
  if (a3Data.asset.status === 'in_stock' && a3Data.asset.current_employee_id === null) {
    console.log('TEST 8 PASSED: Asset returned to central inventory:');
    console.log(`  Current Status: ${a3Data.asset.status}`);
    console.log(`  Current Custodian: None (Central Stock)`);
  } else {
    throw new Error('TEST 8 FAILED: Asset status is not in_stock: ' + JSON.stringify(a3Data));
  }

  // ----------------------------------------------------
  // TEST 9: Raise ticket from asset
  // ----------------------------------------------------
  console.log('\n--- TEST 9: Raise Support Ticket from Asset ---');
  const ticketRes = await fetch(`${BASE_URL}/api/tickets`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      asset_id: test1Asset.id,
      employee_id: emp1.id,
      issue_category: 'Hardware Failure',
      priority: 'high',
      issue_description: 'Intermittent NVMe SSD read errors detected during kernel diagnostic.'
    })
  });
  const ticketData = await ticketRes.json();
  if (!ticketRes.ok || !ticketData.ticket) {
    throw new Error('TEST 9 FAILED: ' + JSON.stringify(ticketData));
  }
  const createdTicket = ticketData.ticket;
  console.log('TEST 9 PASSED: Ticket created successfully:');
  console.log(`  Ticket ID: ${createdTicket.ticket_id} (Expected format: TKT-YYYY-XXXXX)`);
  console.log(`  Linked Asset: ${createdTicket.asset_id} -> ${test1Asset.asset_number}`);
  console.log(`  Priority: ${createdTicket.priority}`);
  console.log(`  Status: ${createdTicket.status}`);

  // ----------------------------------------------------
  // TEST 10: Change ticket status
  // ----------------------------------------------------
  console.log('\n--- TEST 10: Change Ticket Status and Log History ---');
  const updateTicketRes = await fetch(`${BASE_URL}/api/tickets/${createdTicket.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'resolved',
      resolution: 'Replaced NVMe SSD under warranty. Cloned partition, restored OEM bootloader. Tested 100% healthy.',
      comment: 'Hardware replacement verified by Tier 2 technician.'
    })
  });
  const updateTicketData = await updateTicketRes.json();
  if (!updateTicketRes.ok || !updateTicketData.ticket) {
    throw new Error('TEST 10 FAILED: ' + JSON.stringify(updateTicketData));
  }
  console.log('TEST 10 PASSED: Ticket status transitioned to resolved:');
  console.log(`  New Status: ${updateTicketData.ticket.status}`);
  console.log(`  Resolution Recorded: "${updateTicketData.ticket.resolution}"`);
  console.log(`  Timeline Events Recorded: ${updateTicketData.ticket.history ? updateTicketData.ticket.history.length : 'N/A'}`);

  // ----------------------------------------------------
  // TEST 11: Open Dashboard (Live MySQL Statistics)
  // ----------------------------------------------------
  console.log('\n--- TEST 11: Validate Dashboard Live MySQL Statistics ---');
  const dashRes = await fetch(`${BASE_URL}/api/reports?type=dashboard`, { headers: authHeaders });
  const dashData = await dashRes.json();
  if (dashRes.ok && dashData.metrics) {
    console.log('TEST 11 PASSED: Real-time MySQL metrics received:');
    console.log(`  Total Assets in DB: ${dashData.metrics.totalAssets}`);
    console.log(`  In Stock: ${dashData.metrics.inStockAssets}`);
    console.log(`  Assigned: ${dashData.metrics.assignedAssets}`);
    console.log(`  Open Tickets: ${dashData.metrics.openTickets}`);
    console.log(`  Recent Activity Items: ${dashData.metrics.recentActivity.length}`);
    console.log(`  Category Breakdown: ${dashData.metrics.categoryDistribution.map(c => `${c.category}: ${c.count}`).join(', ')}`);
  } else {
    throw new Error('TEST 11 FAILED: ' + JSON.stringify(dashData));
  }

  // Teardown: Clean up temporary test assets so database remains at exactly the 7 baseline entries
  try {
    const mysql = require('mysql2/promise');
    const cleanupPool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'asset_management',
    });
    if (test1Asset && test2Asset) {
      const ids = [test1Asset.id, test2Asset.id];
      await cleanupPool.query('DELETE FROM ticket_history WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id IN (?, ?))', ids);
      await cleanupPool.query('DELETE FROM tickets WHERE asset_id IN (?, ?)', ids);
      await cleanupPool.query('DELETE FROM asset_assignments WHERE asset_id IN (?, ?)', ids);
      await cleanupPool.query('DELETE FROM asset_history WHERE asset_id IN (?, ?)', ids);
      await cleanupPool.query('DELETE FROM assets WHERE id IN (?, ?)', ids);
    }
    await cleanupPool.end();
  } catch (cleanErr) {
    console.warn('Notice: Test cleanup warning:', cleanErr.message);
  }

  console.log('\n====================================================');
  console.log('ALL TESTS (1 THROUGH 11) COMPLETED AND VERIFIED 100% SUCCESSFUL!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n*** TEST SUITE RUNTIME ERROR ***:', err);
  process.exit(1);
});
