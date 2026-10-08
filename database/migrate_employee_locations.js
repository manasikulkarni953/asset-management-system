// database/migrate_employee_locations.js
// Migration to standardize employee locations to 'The Space, 5th Floor'
// and ensure every employee has a distinct, unique workstation.

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Read .env
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

async function runMigration() {
  const host = cleanHost(env.DB_HOST);
  const port = Number(env.DB_PORT) || 3306;
  const user = env.DB_USER || 'root';
  const password = env.DB_PASSWORD || '';
  const database = env.DB_NAME || 'asset_management';

  console.log(`Connecting to ${database} on ${host}:${port}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    console.log('--- STARTING EMPLOYEE LOCATION STANDARDIZATION ---');

    // 1. Check if workstation column exists in employees
    const [cols] = await conn.query('SHOW COLUMNS FROM employees');
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('workstation')) {
      console.log('Adding workstation column to employees table...');
      await conn.query('ALTER TABLE employees ADD COLUMN workstation VARCHAR(50) NULL AFTER location');
    }

    // 2. Set all employee locations to 'The Space, 5th Floor'
    const [locUpdate] = await conn.execute(
      "UPDATE employees SET location = 'The Space, 5th Floor'"
    );
    console.log(`✓ Updated location to 'The Space, 5th Floor' for ${locUpdate.affectedRows} employee(s).`);

    // 3. Inspect existing employees and their workstations
    const [employees] = await conn.query('SELECT id, employee_id, name, location, workstation FROM employees ORDER BY id ASC');
    console.log('Current employees:', employees);

    // 4. Ensure each employee has a distinct, unique workstation
    const usedWorkstations = new Set();
    employees.forEach(e => {
      if (e.workstation && e.workstation.trim()) {
        usedWorkstations.add(e.workstation.trim());
      }
    });

    let counter = 1;
    for (const emp of employees) {
      if (!emp.workstation || !emp.workstation.trim()) {
        // Derive unique workstation based on employee_id or counter
        let candidateWs = '';
        const numPart = emp.employee_id.replace(/\D/g, '');
        if (numPart && numPart.length > 0) {
          const padded = numPart.padStart(3, '0').slice(-3);
          candidateWs = `WS-5-${padded}`;
        }
        while (!candidateWs || usedWorkstations.has(candidateWs)) {
          candidateWs = `WS-5-${String(counter).padStart(3, '0')}`;
          counter++;
        }
        usedWorkstations.add(candidateWs);
        await conn.execute('UPDATE employees SET workstation = ? WHERE id = ?', [candidateWs, emp.id]);
        console.log(`✓ Assigned distinct workstation ${candidateWs} to ${emp.name} (${emp.employee_id})`);
      }
    }

    // 5. Update tickets missing raised_workstation to match employee's workstation
    const [tktUpdate] = await conn.execute(`
      UPDATE tickets t
      JOIN employees e ON t.employee_id = e.id
      SET t.raised_workstation = e.workstation
      WHERE (t.raised_workstation IS NULL OR t.raised_workstation = '')
        AND e.workstation IS NOT NULL
    `);
    console.log(`✓ Backfilled workstation for ${tktUpdate.affectedRows} existing ticket(s).`);

    // 6. Verify result
    const [updatedEmps] = await conn.query('SELECT id, employee_id, name, location, workstation FROM employees ORDER BY id ASC');
    console.log('\n--- ALL EMPLOYEES AFTER MIGRATION ---');
    updatedEmps.forEach(e => {
      console.log(`  [ID: ${e.id}] ${e.name} (${e.employee_id}) -> Location: '${e.location}' | Workstation: '${e.workstation}'`);
    });

    console.log('\nMigration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runMigration();
