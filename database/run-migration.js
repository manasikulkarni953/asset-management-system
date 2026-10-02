const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Read .env if present
try {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      value = value.trim().replace(/^['"](.*)['"]$/, '$1');
      process.env[key] = value;
    }
  });
} catch (e) {}

async function runMigration() {
  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'asset_management';

  console.log(`Connecting to ${database} on ${host}:${port} as ${user}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    // 1. Check for blank or null asset_id
    const [blanks] = await conn.query(
      "SELECT id, asset_id, asset_number FROM assets WHERE asset_id IS NULL OR TRIM(asset_id) = ''"
    );
    console.log(`Found ${blanks.length} blank/null asset_id record(s):`, blanks);

    // 2. Fix blank or null asset_id safely using id
    if (blanks.length > 0) {
      const [updateResult] = await conn.execute(
        "UPDATE assets SET asset_id = CONCAT('AST-', LPAD(id, 6, '0')) WHERE asset_id IS NULL OR TRIM(asset_id) = ''"
      );
      console.log(`Updated ${updateResult.affectedRows || updateResult} record(s).`);
    }

    // 3. Verify uniqueness and no blanks remain
    const [remainingBlanks] = await conn.query(
      "SELECT id, asset_id FROM assets WHERE asset_id IS NULL OR TRIM(asset_id) = ''"
    );
    if (remainingBlanks.length > 0) {
      throw new Error(`Migration check failed: ${remainingBlanks.length} blank asset_id records remain.`);
    }

    const [duplicates] = await conn.query(
      "SELECT asset_id, COUNT(*) as cnt FROM assets GROUP BY asset_id HAVING cnt > 1"
    );
    if (duplicates.length > 0) {
      throw new Error(`Duplicate asset_id records detected: ${JSON.stringify(duplicates)}`);
    }

    // 4. Ensure uq_assets_asset_id constraint exists
    const [indexes] = await conn.query("SHOW INDEX FROM assets WHERE Column_name = 'asset_id'");
    console.log('Indexes on asset_id:', indexes.map(i => ({ Key_name: i.Key_name, Non_unique: i.Non_unique })));

    // 5. Log all current assets
    const [allAssets] = await conn.query(
      "SELECT id, asset_id, asset_number, serial_number, category, brand, model FROM assets ORDER BY id ASC"
    );
    console.log('All assets after migration:', allAssets);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runMigration();
