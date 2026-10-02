// Safe database migration for 3-Role RBAC: super_admin, admin, employee
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function migrate() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'asset_management',
  });

  try {
    console.log('--- STARTING RBAC DATABASE MIGRATION ---');

    // 1. Inspect existing users columns
    const [userCols] = await pool.query('SHOW COLUMNS FROM users');
    const colNames = userCols.map((c) => c.Field);

    if (!colNames.includes('name')) {
      console.log('Adding name column to users...');
      await pool.query('ALTER TABLE users ADD COLUMN name VARCHAR(100) NULL AFTER full_name');
      await pool.query('UPDATE users SET name = full_name WHERE name IS NULL');
    }

    if (!colNames.includes('designation')) {
      console.log('Adding designation column to users...');
      await pool.query('ALTER TABLE users ADD COLUMN designation VARCHAR(100) NULL DEFAULT NULL AFTER role');
    }

    if (!colNames.includes('employee_id')) {
      console.log('Adding employee_id column to users...');
      await pool.query('ALTER TABLE users ADD COLUMN employee_id VARCHAR(50) NULL DEFAULT NULL AFTER designation');
    }

    // 2. Map existing 'it_admin' users to role = 'admin', designation = 'IT Specialist'
    console.log("Mapping any legacy 'it_admin' users to role='admin', designation='IT Specialist'...");
    await pool.query(
      "UPDATE users SET role = 'admin', designation = 'IT Specialist', name = 'Rahul Sharma', full_name = 'Rahul Sharma' WHERE role = 'it_admin' OR username = 'itadmin'"
    );

    // 3. Restrict role ENUM strictly to: super_admin, admin, employee
    console.log("Restricting users role enum strictly to ('super_admin', 'admin', 'employee')...");
    await pool.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin', 'admin', 'employee') NOT NULL DEFAULT 'employee'"
    );

    // 4. In tickets table, ensure assigned_to column exists
    const [tktCols] = await pool.query('SHOW COLUMNS FROM tickets');
    const tktColNames = tktCols.map((c) => c.Field);
    if (!tktColNames.includes('assigned_to')) {
      console.log('Adding assigned_to column to tickets...');
      await pool.query('ALTER TABLE tickets ADD COLUMN assigned_to INT NULL AFTER status');
      await pool.query('UPDATE tickets SET assigned_to = assigned_to_user_id WHERE assigned_to_user_id IS NOT NULL');
    }

    // 5. Ensure the 3 standard test accounts exist with known hashes:
    // Admin hash for Admin@123
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const empHash = await bcrypt.hash('Employee@123', 10);

    // Update Super Admin
    await pool.query(
      "UPDATE users SET designation = 'Head of Infrastructure', name = 'System Administrator' WHERE role = 'super_admin' AND id = 1"
    );

    // Ensure superadmin@example.com exists or is aliasable
    const [saRows] = await pool.query("SELECT id FROM users WHERE email = 'superadmin@example.com'");
    if (saRows.length === 0) {
      // Keep primary admin@enterprise.com, and we can also support superadmin@example.com if needed or update
      console.log('Adding superadmin@example.com alias/user...');
      await pool.query(
        `INSERT INTO users (username, email, password_hash, full_name, name, role, designation, status)
         VALUES (?, ?, ?, ?, ?, 'super_admin', 'Super Administrator', 'active')
         ON DUPLICATE KEY UPDATE role = 'super_admin'`,
        ['superadmin', 'superadmin@example.com', adminHash, 'Super Admin', 'Super Admin']
      );
    }

    // Ensure IT Specialist admin@example.com exists
    const [adRows] = await pool.query("SELECT id FROM users WHERE email = 'admin@example.com'");
    if (adRows.length === 0) {
      console.log('Adding admin@example.com (IT Specialist) user...');
      await pool.query(
        `INSERT INTO users (username, email, password_hash, full_name, name, role, designation, status)
         VALUES (?, ?, ?, ?, ?, 'admin', 'IT Specialist', 'active')
         ON DUPLICATE KEY UPDATE role = 'admin', designation = 'IT Specialist'`,
        ['admin_specialist', 'admin@example.com', adminHash, 'Rahul Sharma', 'Rahul Sharma']
      );
    }

    // Ensure employee user (Alex Johnson, EMP-1001) exists
    const [empUserRows] = await pool.query("SELECT id FROM users WHERE email = 'employee@example.com' OR employee_id = 'EMP-1001'");
    if (empUserRows.length === 0) {
      console.log('Adding employee@example.com (Alex Johnson) user...');
      await pool.query(
        `INSERT INTO users (username, email, password_hash, full_name, name, role, designation, employee_id, status)
         VALUES (?, ?, ?, ?, ?, 'employee', 'Senior Software Engineer', 'EMP-1001', 'active')`,
        ['employee', 'employee@example.com', empHash, 'Alex Johnson', 'Alex Johnson']
      );
    } else {
      await pool.query(
        "UPDATE users SET role = 'employee', employee_id = 'EMP-1001', name = 'Alex Johnson' WHERE id = ?",
        [empUserRows[0].id]
      );
    }

    // Link alex.j@enterprise.com as employee too if exists
    const [alexRows] = await pool.query("SELECT id FROM users WHERE email = 'alex.j@enterprise.com'");
    if (alexRows.length === 0) {
      await pool.query(
        `INSERT INTO users (username, email, password_hash, full_name, name, role, designation, employee_id, status)
         VALUES (?, ?, ?, ?, ?, 'employee', 'Senior Software Engineer', 'EMP-1001', 'active')`,
        ['alex', 'alex.j@enterprise.com', adminHash, 'Alex Johnson', 'Alex Johnson']
      );
    }

    // Print all users in DB
    const [allUsers] = await pool.query('SELECT id, username, email, name, role, designation, employee_id, status FROM users');
    console.log('\n--- CURRENT MYSQL USERS ---');
    console.table(allUsers);

    console.log('RBAC Database Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
