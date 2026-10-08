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
    console.log('--- Creating damaged_assets table ---');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`damaged_assets\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`asset_id\` INT NOT NULL,
        \`employee_id\` INT NULL,
        \`ticket_id\` INT NULL,
        \`damage_type\` VARCHAR(100) NOT NULL,
        \`severity\` ENUM('minor', 'moderate', 'severe', 'total_loss') NOT NULL DEFAULT 'moderate',
        \`incident_date\` DATE NOT NULL,
        \`reported_date\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`description\` TEXT NOT NULL,
        \`repair_status\` ENUM('reported', 'under_investigation', 'sent_for_repair', 'repaired', 'written_off', 'replaced') NOT NULL DEFAULT 'reported',
        \`repair_cost_estimate\` DECIMAL(12, 2) DEFAULT 0.00,
        \`actual_repair_cost\` DECIMAL(12, 2) DEFAULT 0.00,
        \`insurance_claimed\` BOOLEAN DEFAULT FALSE,
        \`resolution_notes\` TEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_damage_asset\` (\`asset_id\`),
        INDEX \`idx_damage_repair_status\` (\`repair_status\`),
        INDEX \`idx_damage_severity\` (\`severity\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('damaged_assets table created or verified.');

    // Check if there are any existing damaged asset records
    const [existing] = await conn.query('SELECT COUNT(*) as cnt FROM damaged_assets');
    if (existing[0].cnt === 0) {
      console.log('Seeding sample damaged asset data...');
      const [assets] = await conn.query('SELECT id, current_employee_id FROM assets LIMIT 2');
      if (assets.length > 0) {
        const a1 = assets[0];
        await conn.query(`
          INSERT INTO damaged_assets 
          (asset_id, employee_id, damage_type, severity, incident_date, description, repair_status, repair_cost_estimate, actual_repair_cost, insurance_claimed)
          VALUES 
          (?, ?, 'Cracked Screen / Display Glitch', 'moderate', CURDATE() - INTERVAL 3 DAY, 'Screen exhibits horizontal color artifacts and small crack on upper right corner after inadvertent impact.', 'sent_for_repair', 14500.00, 0.00, 1)
        `, [a1.id, a1.current_employee_id || null]);
      }
      if (assets.length > 1) {
        const a2 = assets[1];
        await conn.query(`
          INSERT INTO damaged_assets 
          (asset_id, employee_id, damage_type, severity, incident_date, description, repair_status, repair_cost_estimate, actual_repair_cost, insurance_claimed)
          VALUES 
          (?, ?, 'Liquid Ingress / Spill', 'severe', CURDATE() - INTERVAL 7 DAY, 'Coffee spill over keyboard module; power button unresponsive and keys sticky.', 'under_investigation', 22000.00, 0.00, 0)
        `, [a2.id, a2.current_employee_id || null]);
      }
      console.log('Sample damaged asset records inserted.');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await conn.end();
  }
}

migrate();
