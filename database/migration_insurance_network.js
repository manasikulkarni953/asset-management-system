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
    console.log('--- Checking asset_insurance columns ---');
    const [insCols] = await conn.query('DESCRIBE asset_insurance');
    const insColNames = insCols.map(c => c.Field);

    if (!insColNames.includes('notes')) {
      console.log('Adding "notes" column to asset_insurance...');
      await conn.query('ALTER TABLE asset_insurance ADD COLUMN notes TEXT NULL AFTER document_url');
      console.log('Added "notes" column.');
    } else {
      console.log('"notes" column already exists in asset_insurance.');
    }

    console.log('--- Checking asset_network columns ---');
    const [netCols] = await conn.query('DESCRIBE asset_network');
    const netColNames = netCols.map(c => c.Field);

    if (!netColNames.includes('assignment_type')) {
      console.log('Adding "assignment_type" column to asset_network...');
      await conn.query("ALTER TABLE asset_network ADD COLUMN assignment_type VARCHAR(20) NOT NULL DEFAULT 'Static' AFTER ip_address");
      console.log('Added "assignment_type" column.');
    }

    if (!netColNames.includes('subnet_mask')) {
      console.log('Adding "subnet_mask" column to asset_network...');
      await conn.query("ALTER TABLE asset_network ADD COLUMN subnet_mask VARCHAR(45) NULL DEFAULT '255.255.255.0' AFTER assignment_type");
      console.log('Added "subnet_mask" column.');
    }

    if (!netColNames.includes('gateway')) {
      console.log('Adding "gateway" column to asset_network...');
      await conn.query("ALTER TABLE asset_network ADD COLUMN gateway VARCHAR(45) NULL AFTER subnet_mask");
      console.log('Added "gateway" column.');
    }

    if (!netColNames.includes('dns_server')) {
      console.log('Adding "dns_server" column to asset_network...');
      await conn.query("ALTER TABLE asset_network ADD COLUMN dns_server VARCHAR(100) NULL AFTER gateway");
      console.log('Added "dns_server" column.');
    }

    if (!netColNames.includes('notes')) {
      console.log('Adding "notes" column to asset_network...');
      await conn.query("ALTER TABLE asset_network ADD COLUMN notes TEXT NULL AFTER vlan");
      console.log('Added "notes" column.');
    }

    // Populate sensible defaults for existing network records if null
    await conn.query(`
      UPDATE asset_network 
      SET assignment_type = 'Static', 
          subnet_mask = COALESCE(subnet_mask, '255.255.255.0'),
          gateway = COALESCE(gateway, '192.168.10.1'),
          dns_server = COALESCE(dns_server, '1.1.1.1, 8.8.8.8')
      WHERE gateway IS NULL OR subnet_mask IS NULL
    `);

    console.log('Migration completed successfully!');

    const [updatedNet] = await conn.query('SELECT * FROM asset_network');
    console.log('Updated asset_network:', updatedNet);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await conn.end();
  }
}

migrate();
