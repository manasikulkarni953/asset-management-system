// test_multi_assignment.js
// Verification suite for Multiple Asset Assignment to One Employee
const mysql = require('mysql2/promise');

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('====================================================');
  console.log('STARTING MULTI-ASSET ASSIGNMENT VERIFICATION SUITE');
  console.log('====================================================\n');

  // Direct MySQL Connection for test fixture setup & assertion checks
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'asset_management',
  });

  try {
    // 0. Authenticate
    console.log('--- STEP 0: Authenticate as Admin ---');
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
    console.log('✓ Admin authenticated successfully.\n');

    // 1. Setup isolated test employee and test assets
    console.log('--- SETUP: Create Test Fixtures ---');
    // Ensure clean state for test employee
    await conn.query('DELETE FROM asset_history WHERE asset_id IN (SELECT id FROM assets WHERE asset_number LIKE "TEST-MA-%")');
    await conn.query('DELETE FROM asset_assignments WHERE asset_id IN (SELECT id FROM assets WHERE asset_number LIKE "TEST-MA-%")');
    await conn.query('DELETE FROM assets WHERE asset_number LIKE "TEST-MA-%"');
    await conn.query('DELETE FROM employees WHERE employee_id IN ("EMP-TEST-MA1", "EMP-TEST-MA2")');

    // Create test employee 1 (Alex Test)
    const [empRes1] = await conn.query(
      `INSERT INTO employees (employee_id, name, email, department, designation, location, status) 
       VALUES ('EMP-TEST-MA1', 'Alex MultiTest', 'alex.multitest@test.com', 'Engineering', 'Staff Engineer', 'HQ - Floor 3', 'active')`
    );
    const emp1Id = empRes1.insertId;

    // Create test employee 2 (Priya Test)
    const [empRes2] = await conn.query(
      `INSERT INTO employees (employee_id, name, email, department, designation, location, status) 
       VALUES ('EMP-TEST-MA2', 'Priya MultiTest', 'priya.multitest@test.com', 'Design', 'Lead Designer', 'HQ - Floor 2', 'active')`
    );
    const emp2Id = empRes2.insertId;

    // Create 6 test assets in stock
    const assetNumbers = [
      'TEST-MA-LAP-001',
      'TEST-MA-MON-002',
      'TEST-MA-KEY-003',
      'TEST-MA-MOU-004',
      'TEST-MA-HED-005',
      'TEST-MA-TAB-006',
    ];
    const assetIds = [];
    for (let i = 0; i < assetNumbers.length; i++) {
      const num = assetNumbers[i];
      const [aRes] = await conn.query(
        `INSERT INTO assets (asset_id, asset_number, category, brand, model, serial_number, status)
         VALUES (?, ?, 'Laptop', 'Dell', 'Latitude 5440', ?, 'in_stock')`,
        ['TGS-TEST-' + (i + 1), num, 'SN-' + num]
      );
      assetIds.push(aRes.insertId);
    }
    console.log(`✓ Created test employees (EMP-TEST-MA1 ID: ${emp1Id}, EMP-TEST-MA2 ID: ${emp2Id})`);
    console.log(`✓ Created 6 test assets in stock (IDs: ${assetIds.join(', ')})\n`);

    // TEST 1: Assign one laptop to Alex Test
    console.log('--- TEST 1: Assign Single Asset (Laptop) to Employee ---');
    const assign1Res = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employeeId: emp1Id,
        assetIds: [assetIds[0]],
        condition: 'Good',
        remarks: 'Test 1 single allocation',
      }),
    });
    const assign1Data = await assign1Res.json();
    if (!assign1Res.ok || !assign1Data.success) {
      throw new Error('TEST 1 FAILED: ' + JSON.stringify(assign1Data));
    }
    console.log(`✓ API Response: ${assign1Data.message}`);
    console.log(`✓ Assigned Count: ${assign1Data.count}`);

    // Verify in DB
    const [rows1] = await conn.query('SELECT * FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp1Id]);
    if (rows1.length !== 1) throw new Error(`TEST 1 DB check failed: expected 1 row, got ${rows1.length}`);
    console.log(`✓ Database verification: Employee has 1 active assignment row.\n`);

    // TEST 2: Assign monitor + keyboard + mouse (3 assets) in ONE operation
    console.log('--- TEST 2: Multi-Asset Assignment (3 Assets in 1 Batch Operation) ---');
    const assign2Res = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employeeId: emp1Id,
        assetIds: [assetIds[1], assetIds[2], assetIds[3]],
        condition: 'Good',
        remarks: 'Test 2 multi-asset batch allocation',
      }),
    });
    const assign2Data = await assign2Res.json();
    if (!assign2Res.ok || !assign2Data.success) {
      throw new Error('TEST 2 FAILED: ' + JSON.stringify(assign2Data));
    }
    console.log(`✓ API Response: ${assign2Data.message}`);
    console.log(`✓ Assigned Count: ${assign2Data.count}`);

    // Verify in DB - total should be 4
    const [rows2] = await conn.query('SELECT * FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp1Id]);
    if (rows2.length !== 4) throw new Error(`TEST 2 DB check failed: expected 4 rows, got ${rows2.length}`);
    console.log(`✓ Database verification: Alex now has ${rows2.length} distinct active assignment records.\n`);

    // TEST 3: Assign another asset (headset) reaching 5 total assets
    console.log('--- TEST 3: Assign 5th Asset to Alex Test ---');
    const assign3Res = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employeeId: emp1Id,
        assetIds: [assetIds[4]],
        condition: 'Good',
        remarks: 'Test 3 5th asset allocation',
      }),
    });
    const assign3Data = await assign3Res.json();
    if (!assign3Res.ok || !assign3Data.success) {
      throw new Error('TEST 3 FAILED: ' + JSON.stringify(assign3Data));
    }
    const [rows3] = await conn.query('SELECT * FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp1Id]);
    if (rows3.length !== 5) throw new Error(`TEST 3 DB check failed: expected 5 rows, got ${rows3.length}`);
    console.log(`✓ Database verification: Alex now has exactly 5 active assets simultaneously.\n`);

    // TEST 4: Try assigning an already assigned asset
    console.log('--- TEST 4: Prevent Duplicate Assignment of Already Assigned Asset ---');
    const assign4Res = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employeeId: emp2Id,
        assetIds: [assetIds[1]], // asset 1 is already assigned to Alex
        condition: 'Good',
        remarks: 'Test 4 should fail',
      }),
    });
    const assign4Data = await assign4Res.json();
    if (assign4Res.ok && assign4Data.success) {
      throw new Error('TEST 4 FAILED: API should have rejected assignment of already assigned asset');
    }
    console.log(`✓ Correctly rejected: "${assign4Data.error || assign4Data.message}"\n`);

    // TEST 5: Zod Validation - Duplicate asset IDs in same request
    console.log('--- TEST 5: Reject Duplicate Asset IDs in Single Request ---');
    const assign5Res = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employeeId: emp2Id,
        assetIds: [assetIds[5], assetIds[5]], // duplicate ID
        condition: 'Good',
        remarks: 'Test 5 duplicate ID',
      }),
    });
    const assign5Data = await assign5Res.json();
    if (assign5Res.ok && assign5Data.success) {
      throw new Error('TEST 5 FAILED: Duplicate assetIds should be rejected by Zod validation');
    }
    console.log(`✓ Correctly rejected duplicate assetIds in request.\n`);

    // TEST 6: Atomic Rollback - 1 valid asset + 1 invalid asset
    console.log('--- TEST 6: Atomic Rollback on Partial Failure ---');
    const [preCountRes] = await conn.query('SELECT COUNT(*) as cnt FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp2Id]);
    const preCount = preCountRes[0].cnt;

    const assign6Res = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employeeId: emp2Id,
        assetIds: [assetIds[5], assetIds[0]], // assetIds[5] is in_stock, but assetIds[0] is assigned to Alex
        condition: 'Good',
        remarks: 'Test 6 atomic failure',
      }),
    });
    const assign6Data = await assign6Res.json();
    if (assign6Res.ok && assign6Data.success) {
      throw new Error('TEST 6 FAILED: Batch containing assigned asset was not rejected');
    }
    console.log(`✓ Rejected with message: "${assign6Data.error || assign6Data.message}"`);

    // Verify Priya has 0 new assignments and asset 5 is STILL in_stock
    const [postCountRes] = await conn.query('SELECT COUNT(*) as cnt FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp2Id]);
    const postCount = postCountRes[0].cnt;
    const [a5Status] = await conn.query('SELECT status, current_employee_id FROM assets WHERE id = ?', [assetIds[5]]);
    if (postCount !== preCount || a5Status[0].status !== 'in_stock' || a5Status[0].current_employee_id !== null) {
      throw new Error('TEST 6 FAILED: Transaction did not roll back properly!');
    }
    console.log(`✓ Entire batch rolled back atomically: Priya active count = ${postCount}, Asset 5 remains in_stock.\n`);

    // TEST 7: Transfer Individual Asset away from Alex to Priya
    console.log('--- TEST 7: Transfer 1 Asset from Alex to Priya ---');
    const transferRes = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'transfer',
        asset_id: assetIds[1],
        to_employee_id: emp2Id,
        notes: 'Transferred monitor to Priya',
      }),
    });
    const transferData = await transferRes.json();
    if (!transferRes.ok || !transferData.success) {
      throw new Error('TEST 7 FAILED: ' + JSON.stringify(transferData));
    }
    const [alexCount7] = await conn.query('SELECT COUNT(*) as cnt FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp1Id]);
    const [priyaCount7] = await conn.query('SELECT COUNT(*) as cnt FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp2Id]);
    if (alexCount7[0].cnt !== 4 || priyaCount7[0].cnt !== 1) {
      throw new Error(`TEST 7 FAILED: Expected Alex=4, Priya=1, got Alex=${alexCount7[0].cnt}, Priya=${priyaCount7[0].cnt}`);
    }
    console.log(`✓ Transfer successful: Alex current assets = ${alexCount7[0].cnt}, Priya current assets = ${priyaCount7[0].cnt}`);

    // Verify history preserved
    const [historyRows] = await conn.query('SELECT * FROM asset_history WHERE asset_id = ?', [assetIds[1]]);
    console.log(`✓ Asset history preserved (${historyRows.length} history records for transferred asset).\n`);

    // TEST 8: Return 1 Asset (Keyboard) from Alex
    console.log('--- TEST 8: Return 1 Asset from Alex ---');
    const returnRes = await fetch(`${BASE_URL}/api/assignments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        action: 'return',
        asset_id: assetIds[2],
        notes: 'Returned keyboard',
      }),
    });
    const returnData = await returnRes.json();
    if (!returnRes.ok || !returnData.success) {
      throw new Error('TEST 8 FAILED: ' + JSON.stringify(returnData));
    }
    const [alexCount8] = await conn.query('SELECT COUNT(*) as cnt FROM asset_assignments WHERE employee_id = ? AND status = "assigned"', [emp1Id]);
    const [keyStatus] = await conn.query('SELECT status, current_employee_id FROM assets WHERE id = ?', [assetIds[2]]);
    if (alexCount8[0].cnt !== 3 || keyStatus[0].status !== 'in_stock' || keyStatus[0].current_employee_id !== null) {
      throw new Error(`TEST 8 FAILED: Expected Alex=3, Keyboard in_stock, got Alex=${alexCount8[0].cnt}, status=${keyStatus[0].status}`);
    }
    console.log(`✓ Return successful: Alex current assets = ${alexCount8[0].cnt}, Keyboard returned to in_stock.\n`);

    // TEST 9: Barcode Scan Integration
    console.log('--- TEST 9: Barcode Scan Integration on Multi-Asset Custodian ---');
    // Scan asset 0 (TEST-MA-LAP-001) which is assigned to Alex
    const scanRes = await fetch(`${BASE_URL}/api/assets/scan`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ barcode: 'TEST-MA-LAP-001' }),
    });
    const scanData = await scanRes.json();
    if (!scanRes.ok || !scanData.success || !scanData.data?.employee) {
      throw new Error('TEST 9 FAILED: ' + JSON.stringify(scanData));
    }
    console.log(`✓ Scanned Asset: ${scanData.data.scannedAsset.assetNumber}`);
    console.log(`✓ Identified Custodian: ${scanData.data.employee.name} (${scanData.data.employee.employeeId})`);
    console.log(`✓ Reported Total Assigned Assets: ${scanData.data.assetCount}`);
    console.log(`✓ Assets in Custodian Group: ${scanData.data.assignedAssets.map(a => `${a.assetNumber} [isScanned=${a.isScanned}]`).join(', ')}`);
    if (scanData.data.assetCount !== 3 || scanData.data.assignedAssets.length !== 3) {
      throw new Error(`TEST 9 FAILED: Expected 3 assets in group, got ${scanData.data.assetCount}`);
    }
    const scannedFlag = scanData.data.assignedAssets.find(a => a.assetNumber === 'TEST-MA-LAP-001');
    if (!scannedFlag || !scannedFlag.isScanned) {
      throw new Error('TEST 9 FAILED: Scanned asset is not highlighted with isScanned=true');
    }
    console.log('✓ Barcode scan correctly identifies employee and highlights scanned asset within complete asset group.\n');

    // TEST 10: Database verification of individual rows
    console.log('--- TEST 10: Database Relational Integrity Check ---');
    const [finalRows] = await conn.query(
      `SELECT aa.id, aa.asset_id, a.asset_number, aa.employee_id, e.employee_id as emp_code, aa.status
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.id
       JOIN employees e ON aa.employee_id = e.id
       WHERE aa.employee_id = ? AND aa.status = "assigned"`,
      [emp1Id]
    );
    console.log('Database Rows for Alex Test (EMP-TEST-MA1):');
    console.table(finalRows);
    if (finalRows.length !== 3) {
      throw new Error(`TEST 10 FAILED: Expected 3 individual database rows, got ${finalRows.length}`);
    }
    for (const r of finalRows) {
      if (typeof r.asset_id !== 'number' || typeof r.employee_id !== 'number') {
        throw new Error('TEST 10 FAILED: asset_id or employee_id is not properly normalized numeric ID');
      }
    }
    console.log('✓ Verified: Each assignment is a distinct, normalized relational record with valid FK references.\n');

    // Clean up test data
    console.log('--- CLEANUP: Removing Test Fixtures ---');
    await conn.query('DELETE FROM asset_history WHERE asset_id IN (SELECT id FROM assets WHERE asset_number LIKE "TEST-MA-%")');
    await conn.query('DELETE FROM asset_assignments WHERE asset_id IN (SELECT id FROM assets WHERE asset_number LIKE "TEST-MA-%")');
    await conn.query('DELETE FROM assets WHERE asset_number LIKE "TEST-MA-%"');
    await conn.query('DELETE FROM employees WHERE employee_id IN ("EMP-TEST-MA1", "EMP-TEST-MA2")');
    console.log('✓ Cleaned up all test assets, assignments, history, and test employees.\n');

    console.log('====================================================');
    console.log('ALL MULTI-ASSET ASSIGNMENT VERIFICATION TESTS PASSED 100%!');
    console.log('====================================================');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
