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
  const user = env.DB_USER;
  const password = env.DB_PASSWORD;
  const database = env.DB_NAME;

  console.log(`Connecting to ${database} on ${host}:${port}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    console.log('--- Creating asset_imports table ---');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS asset_imports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size INT NOT NULL DEFAULT 0,
        file_content MEDIUMTEXT NULL,
        total_records INT NOT NULL DEFAULT 0,
        success_count INT NOT NULL DEFAULT 0,
        failed_count INT NOT NULL DEFAULT 0,
        status ENUM('completed', 'failed', 'partial') DEFAULT 'completed',
        imported_by_user_id INT NULL,
        imported_by_name VARCHAR(100) NULL,
        error_log TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_imports_date (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('--- Checking import_id in assets ---');
    const [cols] = await conn.query('DESCRIBE assets');
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('import_id')) {
      console.log('Adding import_id column to assets...');
      await conn.query('ALTER TABLE assets ADD COLUMN import_id INT NULL AFTER current_employee_id');
      await conn.query('ALTER TABLE assets ADD INDEX idx_assets_import_id (import_id)');
      console.log('Added import_id column.');
    } else {
      console.log('import_id already exists.');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await conn.end();
  }
}

migrate();
