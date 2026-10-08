const fs = require('fs');
const mysql = require('mysql2/promise');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

(async () => {
  const host = env.DB_HOST.replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
  const conn = await mysql.createConnection({
    host,
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME
  });

  console.log('Connected to MySQL. Migrating to `employee` table...');

  // 1. Convert employee table collation to utf8mb4_unicode_ci to match other tables
  await conn.query('ALTER TABLE employee CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  console.log('1. Converted `employee` table collation to utf8mb4_unicode_ci.');

  // 2. Add columns: name, designation, location, workstation, status if not present
  const [cols] = await conn.query('SHOW COLUMNS FROM employee');
  const colNames = new Set(cols.map(c => c.Field.toLowerCase()));

  if (!colNames.has('name')) {
    await conn.query('ALTER TABLE employee ADD COLUMN name VARCHAR(100) DEFAULT NULL');
    console.log('Added `name` column to `employee`.');
  }
  if (!colNames.has('designation')) {
    await conn.query('ALTER TABLE employee ADD COLUMN designation VARCHAR(100) DEFAULT NULL');
    console.log('Added `designation` column to `employee`.');
  }
  if (!colNames.has('location')) {
    await conn.query("ALTER TABLE employee ADD COLUMN location VARCHAR(100) DEFAULT 'The Space'");
    console.log('Added `location` column to `employee`.');
  }
  if (!colNames.has('workstation')) {
    await conn.query('ALTER TABLE employee ADD COLUMN workstation VARCHAR(50) DEFAULT NULL');
    console.log('Added `workstation` column to `employee`.');
  }
  if (!colNames.has('status')) {
    await conn.query("ALTER TABLE employee ADD COLUMN status ENUM('active', 'on_leave', 'terminated') DEFAULT 'active'");
    console.log('Added `status` column to `employee`.');
  }

  // 3. Sync columns
  await conn.query("UPDATE employee SET name = full_name WHERE name IS NULL OR name = ''");
  await conn.query("UPDATE employee SET designation = COALESCE(NULLIF(job_title, ''), 'Staff') WHERE designation IS NULL OR designation = ''");
  await conn.query("UPDATE employee SET location = 'The Space' WHERE location IS NULL OR location = ''");
  await conn.query("UPDATE employee SET status = IF(is_active = 1, 'active', 'terminated') WHERE status IS NULL");
  await conn.query("UPDATE employee SET employee_id = CONCAT('TGS-', LPAD(id, 3, '0')) WHERE employee_id IS NULL OR employee_id = ''");
  console.log('2. Synced name, designation, location, status, and employee_id.');

  // 4. Ensure any records from `employees` (e.g. IDs 1 to 6) are present in `employee` so existing tickets/assets are preserved
  const [oldEmployees] = await conn.query('SELECT * FROM employees ORDER BY id ASC');
  for (const emp of oldEmployees) {
    const [existing] = await conn.query('SELECT id FROM employee WHERE id = ?', [emp.id]);
    if (existing.length === 0) {
      await conn.query(
        `INSERT INTO employee (id, username, full_name, name, email, job_title, designation, department, location, workstation, status, is_active, employee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          emp.id,
          emp.email.split('@')[0],
          emp.name,
          emp.name,
          emp.email,
          emp.designation,
          emp.designation,
          emp.department,
          emp.location || 'The Space',
          emp.workstation || `WS-05-${String(emp.id).padStart(3, '0')}`,
          emp.status || 'active',
          emp.employee_id || `TGS-${String(emp.id).padStart(3, '0')}`
        ]
      );
      console.log(`Preserved existing employee ID ${emp.id} (${emp.name}) into \`employee\`.`);
    } else {
      // update workstation and location if missing
      await conn.query(
        'UPDATE employee SET workstation = COALESCE(workstation, ?), location = COALESCE(location, ?) WHERE id = ?',
        [emp.workstation, emp.location, emp.id]
      );
    }
  }

  // 5. Assign distinct sequential workstations to active employees who do not have one yet
  const [activeEmps] = await conn.query("SELECT id, workstation FROM employee WHERE status = 'active' ORDER BY id ASC");
  const usedSeats = new Set();
  for (const e of activeEmps) {
    if (e.workstation) {
      const match = e.workstation.match(/^WS-05-(\d+)$/i);
      if (match) usedSeats.add(parseInt(match[1], 10));
    }
  }

  let seatCursor = 1;
  for (const e of activeEmps) {
    if (!e.workstation) {
      while (usedSeats.has(seatCursor)) {
        seatCursor++;
      }
      const ws = `WS-05-${String(seatCursor).padStart(3, '0')}`;
      usedSeats.add(seatCursor);
      await conn.query('UPDATE employee SET workstation = ? WHERE id = ?', [ws, e.id]);
      console.log(`Assigned workstation ${ws} to employee ID ${e.id}`);
    }
  }

  // 6. Update foreign keys on assets, asset_assignments, and tickets to point to `employee(id)`
  try {
    await conn.query('ALTER TABLE assets DROP FOREIGN KEY fk_assets_employee');
  } catch (e) { /* ignore if not exists */ }
  try {
    await conn.query('ALTER TABLE asset_assignments DROP FOREIGN KEY fk_assignments_employee');
  } catch (e) { /* ignore if not exists */ }
  try {
    await conn.query('ALTER TABLE tickets DROP FOREIGN KEY fk_tickets_employee');
  } catch (e) { /* ignore if not exists */ }

  await conn.query('ALTER TABLE assets ADD CONSTRAINT fk_assets_employee FOREIGN KEY (current_employee_id) REFERENCES employee(id) ON DELETE SET NULL');
  await conn.query('ALTER TABLE asset_assignments ADD CONSTRAINT fk_assignments_employee FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE CASCADE');
  await conn.query('ALTER TABLE tickets ADD CONSTRAINT fk_tickets_employee FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE RESTRICT');
  console.log('3. Successfully updated foreign key constraints to reference `employee(id)`.');

  const [totalCount] = await conn.query('SELECT COUNT(*) as cnt FROM employee');
  console.log(`Total employees in \`employee\` table now: ${totalCount[0].cnt}`);

  await conn.end();
  console.log('Migration to `employee` table completed successfully!');
})();
