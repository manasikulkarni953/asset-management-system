// database/migrate_prefix_to_tgs.js
// Safe migration script to update asset identity prefix from AST to TGS in MySQL

const mysql = require('mysql2/promise');

async function migrate() {
  console.log('=== STARTING ASSET PREFIX MIGRATION (AST -> TGS) ===\n');

  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'asset_management',
  });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Inspect existing assets before migration
    const [beforeAssets] = await connection.query(
      'SELECT id, asset_id, asset_number, category, model FROM assets ORDER BY id ASC'
    );
    console.log(`Found ${beforeAssets.length} total assets before migration:`);
    beforeAssets.forEach((a) => {
      console.log(`  ID ${a.id}: ${a.asset_id} | ${a.asset_number} (${a.category} - ${a.model})`);
    });

    // 2. Perform safe atomic update on assets
    const [updateResult] = await connection.query(
      `UPDATE assets 
       SET asset_id = REPLACE(asset_id, 'AST-', 'TGS-'),
           asset_number = REPLACE(asset_number, 'AST-', 'TGS-')
       WHERE asset_id LIKE 'AST-%' OR asset_number LIKE 'AST-%'`
    );
    console.log(`\nUpdated ${updateResult.affectedRows} asset records in assets table.`);

    // 3. Update asset_history description references
    const [historyResult] = await connection.query(
      `UPDATE asset_history 
       SET description = REPLACE(description, 'AST-', 'TGS-')
       WHERE description LIKE '%AST-%'`
    );
    console.log(`Updated ${historyResult.affectedRows} historical log entries in asset_history.`);

    // 4. Verify no remaining AST prefixes in assets table
    const [remainingAst] = await connection.query(
      `SELECT id, asset_id, asset_number FROM assets WHERE asset_id LIKE 'AST-%' OR asset_number LIKE 'AST-%'`
    );
    if (remainingAst.length > 0) {
      throw new Error(`Migration incomplete: ${remainingAst.length} assets still have AST prefix!`);
    }

    // 5. Verify uniqueness constraints
    const [uniqueIdCheck] = await connection.query(
      `SELECT asset_id, COUNT(*) as count FROM assets GROUP BY asset_id HAVING count > 1`
    );
    if (uniqueIdCheck.length > 0) {
      throw new Error(`Collision detected in asset_id: ${JSON.stringify(uniqueIdCheck)}`);
    }

    const [uniqueNumCheck] = await connection.query(
      `SELECT asset_number, COUNT(*) as count FROM assets GROUP BY asset_number HAVING count > 1`
    );
    if (uniqueNumCheck.length > 0) {
      throw new Error(`Collision detected in asset_number: ${JSON.stringify(uniqueNumCheck)}`);
    }

    await connection.commit();
    console.log('\nMigration committed successfully!');

    // 6. Print updated assets
    const [afterAssets] = await connection.query(
      'SELECT id, asset_id, asset_number, category, model FROM assets ORDER BY id ASC'
    );
    console.log('\nMigrated Assets:');
    afterAssets.forEach((a) => {
      console.log(`  ID ${a.id}: ${a.asset_id} | ${a.asset_number} (${a.category} - ${a.model})`);
    });

  } catch (err) {
    await connection.rollback();
    console.error('\nMigration FAILED, rolled back transaction:', err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate();
