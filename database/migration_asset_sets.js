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
    console.log('--- Creating asset_sets table ---');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`asset_sets\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL,
        \`code\` VARCHAR(50) NOT NULL UNIQUE,
        \`tag_number\` VARCHAR(10) DEFAULT '001',
        \`target_department\` VARCHAR(100) NULL DEFAULT 'All',
        \`description\` TEXT NULL,
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_asset_sets_code\` (\`code\`),
        INDEX \`idx_asset_sets_dept\` (\`target_department\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('--- Creating asset_set_items table ---');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`asset_set_items\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`set_id\` INT NOT NULL,
        \`category\` VARCHAR(50) NOT NULL,
        \`quantity\` INT NOT NULL DEFAULT 1,
        \`notes\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_set_items_set\` FOREIGN KEY (\`set_id\`) REFERENCES \`asset_sets\` (\`id\`) ON DELETE CASCADE,
        INDEX \`idx_set_items_set_id\` (\`set_id\`),
        INDEX \`idx_set_items_category\` (\`category\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if seed data exists
    const [existing] = await conn.query('SELECT COUNT(*) as cnt FROM asset_sets');
    if (existing[0].cnt === 0) {
      console.log('Seeding enterprise asset sets...');

      // 1. Engineering Developer Kit
      const [r1] = await conn.query(`
        INSERT INTO asset_sets (name, code, target_department, description)
        VALUES ('Full-Stack Developer Setup Kit', 'SET-DEV-01', 'Engineering', 'Standard high-performance bundle provisioned for software engineers and DevOps architects.')
      `);
      const set1Id = r1.insertId;
      await conn.query(`
        INSERT INTO asset_set_items (set_id, category, quantity, notes) VALUES
        (?, 'Laptop', 1, 'Core i7 / Ryzen 7, 32GB RAM developer grade'),
        (?, 'Monitor', 1, '27-inch 4K or QHD IPS external display'),
        (?, 'Keyboard', 1, 'Mechanical or wireless ergonomic keyboard'),
        (?, 'Mouse', 1, 'Precision laser ergonomic mouse')
      `, [set1Id, set1Id, set1Id, set1Id]);

      // 2. UI/UX Designer Kit
      const [r2] = await conn.query(`
        INSERT INTO asset_sets (name, code, target_department, description)
        VALUES ('Creative UI/UX Designer Bundle', 'SET-DES-02', 'Design', 'Color-calibrated creative workstation kit tailored for digital designers and multimedia artists.')
      `);
      const set2Id = r2.insertId;
      await conn.query(`
        INSERT INTO asset_set_items (set_id, category, quantity, notes) VALUES
        (?, 'Laptop', 1, 'Retina / 100% sRGB color accurate display'),
        (?, 'Monitor', 1, 'Dual display or 32-inch 4K designer monitor'),
        (?, 'Headphones', 1, 'Noise-cancelling over-ear headset')
      `, [set2Id, set2Id, set2Id]);

      // 3. Operations & Executive Kit
      const [r3] = await conn.query(`
        INSERT INTO asset_sets (name, code, target_department, description)
        VALUES ('Operations & Management Kit', 'SET-OPS-03', 'Operations', 'Lightweight portable ultrabook kit for business operations, marketing, and leadership custodians.')
      `);
      const set3Id = r3.insertId;
      await conn.query(`
        INSERT INTO asset_set_items (set_id, category, quantity, notes) VALUES
        (?, 'Laptop', 1, 'Lightweight portable business laptop'),
        (?, 'Headphones', 1, 'VoIP conference headset for stakeholder meetings'),
        (?, 'Mouse', 1, 'Wireless Bluetooth mouse')
      `, [set3Id, set3Id, set3Id]);

      console.log('Seeded 3 standard enterprise asset sets successfully.');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await conn.end();
  }
}

migrate();
