// database/migrate_tgs_employees.js
// Safe database migration to:
// 1. Migrate employee IDs to TGS-001, TGS-002, TGS-003, ... format
// 2. Migrate workstations to WS-05-001, WS-05-002, WS-05-003, ... format
// 3. Set location to 'The Space'
// 4. Update referenced tables (e.g. users.employee_id)
// 5. Ensure UNIQUE constraint on employees.employee_id

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const envFile = path.resolve(__dirname, '../.env');
const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

function cleanHost(h) {
  if (!h) return 'localhost';
  return h.replace(/^https?:\/\//i, '').replace(/\/+.*$/, '').split(':')[0].trim();
}

async function migrate() {
  const host = cleanHost(env.DB_HOST);
  const port = Number(env.DB_PORT) || 3306;
  const user = env.DB_USER || 'root';
  const password = env.DB_PASSWORD || '';
  const database = env.DB_NAME || 'asset_management';

  console.log(`Connecting to ${database} on ${host}:${port}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    console.log('=== STARTING TGS EMPLOYEE & WORKSTATION MIGRATION ===\n');

    // 1. Mapping exact 6 employees specified in user prompt:
    // TGS-001: Alex Johnson (id: 1, prev EMP-1001) -> WS-05-001
    // TGS-002: Jhone Doe (id: 6, prev 076) -> WS-05-002
    // TGS-003: Michael Scott (id: 3, prev EMP-1003) -> WS-05-003
    // TGS-004: Nakshatra Sulakhe (id: 5, prev 40) -> WS-05-004
    // TGS-005: Rutika Rathod (id: 4, prev tgs-55) -> WS-05-005
    // TGS-006: Sarah Connor (id: 2, prev EMP-1002) -> WS-05-006

    const mapping = [
      { id: 1, oldId: 'EMP-1001', newId: 'TGS-001', name: 'Alex Johnson', ws: 'WS-05-001' },
      { id: 6, oldId: '076', newId: 'TGS-002', name: 'Jhone Doe', ws: 'WS-05-002' },
      { id: 3, oldId: 'EMP-1003', newId: 'TGS-003', name: 'Michael Scott', ws: 'WS-05-003' },
      { id: 5, oldId: '40', newId: 'TGS-004', name: 'Nakshatra Sulakhe', ws: 'WS-05-004' },
      { id: 4, oldId: 'tgs-55', newId: 'TGS-005', name: 'Rutika Rathod', ws: 'WS-05-005' },
      { id: 2, oldId: 'EMP-1002', newId: 'TGS-006', name: 'Sarah Connor', ws: 'WS-05-006' },
    ];

    // First, set temporary IDs to avoid UNIQUE constraint clashes if any
    for (const m of mapping) {
      await conn.execute('UPDATE employees SET employee_id = ? WHERE id = ?', [`TEMP-${m.id}`, m.id]);
    }

    // Apply new TGS IDs, workstations, and location 'The Space'
    for (const m of mapping) {
      await conn.execute(
        'UPDATE employees SET employee_id = ?, name = ?, location = ?, workstation = ? WHERE id = ?',
        [m.newId, m.name, 'The Space', m.ws, m.id]
      );
      console.log(`✓ Migrated Employee [ID ${m.id}]: ${m.name} -> ID: ${m.newId}, Location: 'The Space', Workstation: ${m.ws}`);
    }

    // 2. Update users table where employee_id was referenced
    const [userUpdate1] = await conn.execute(
      "UPDATE users SET employee_id = 'TGS-001' WHERE employee_id = 'EMP-1001' OR email = 'alex.j@enterprise.com'"
    );
    console.log(`✓ Updated ${userUpdate1.affectedRows} user record(s) referencing EMP-1001 to TGS-001.`);

    // 3. Update tickets table raised_workstation to new WS-05-xxx format
    for (const m of mapping) {
      await conn.execute(
        'UPDATE tickets SET raised_building = ?, raised_workstation = ? WHERE employee_id = ?',
        ['The Space', m.ws, m.id]
      );
    }
    console.log('✓ Synchronized tickets to new workstation format (WS-05-xxx).');

    // 4. Ensure UNIQUE constraint exists on employees.employee_id
    const [indexes] = await conn.query("SHOW INDEX FROM employees WHERE Column_name = 'employee_id'");
    const isUnique = indexes.some(idx => idx.Non_unique === 0);
    if (!isUnique) {
      console.log('Adding UNIQUE constraint on employees.employee_id...');
      await conn.query('ALTER TABLE employees ADD CONSTRAINT uq_employees_employee_id UNIQUE (employee_id)');
    } else {
      console.log('✓ employees.employee_id already has UNIQUE constraint.');
    }

    // 5. Verification
    const [allEmployees] = await conn.query('SELECT id, employee_id, name, department, location, workstation FROM employees ORDER BY employee_id ASC');
    console.log('\n--- VERIFIED EMPLOYEES LIST ---');
    console.table(allEmployees);

    console.log('\nMigration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();
