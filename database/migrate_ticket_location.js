// database/migrate_ticket_location.js
// Safe database migration to add raised_building, raised_floor, raised_workstation to tickets table

const mysql = require('mysql2/promise');

async function migrate() {
  console.log('=== STARTING TICKET LOCATION MIGRATION ===\n');

  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'asset_management',
  });

  const connection = await pool.getConnection();

  try {
    // 1. Inspect existing columns
    const [cols] = await connection.query('DESCRIBE tickets');
    const colNames = cols.map(c => c.Field);
    console.log('Existing tickets columns:', colNames.join(', '));

    // 2. Add columns if not already present
    if (!colNames.includes('raised_building')) {
      console.log('Adding raised_building column...');
      await connection.query(
        "ALTER TABLE tickets ADD COLUMN raised_building VARCHAR(100) NOT NULL DEFAULT 'The Space' AFTER employee_id"
      );
    }

    if (!colNames.includes('raised_floor')) {
      console.log('Adding raised_floor column...');
      await connection.query(
        "ALTER TABLE tickets ADD COLUMN raised_floor VARCHAR(50) NOT NULL DEFAULT '5th Floor' AFTER raised_building"
      );
    }

    if (!colNames.includes('raised_workstation')) {
      console.log('Adding raised_workstation column...');
      await connection.query(
        "ALTER TABLE tickets ADD COLUMN raised_workstation VARCHAR(50) NULL DEFAULT NULL AFTER raised_floor"
      );
    }

    // 3. For existing tickets, safely ensure fixed building and floor are set to 'The Space' and '5th Floor'
    const [updateResult] = await connection.query(
      "UPDATE tickets SET raised_building = 'The Space', raised_floor = '5th Floor' WHERE raised_building IS NULL OR raised_building = '' OR raised_floor IS NULL OR raised_floor = ''"
    );
    console.log(`Updated location for ${updateResult.affectedRows} ticket records.`);

    // 4. Inspect result
    const [updatedCols] = await connection.query('DESCRIBE tickets');
    console.log('\nUpdated tickets columns:');
    updatedCols.forEach(c => console.log(`  ${c.Field}: ${c.Type} (Default: ${c.Default})`));

    const [sampleTickets] = await connection.query(
      'SELECT id, ticket_id, raised_building, raised_floor, raised_workstation FROM tickets LIMIT 5'
    );
    console.log('\nSample tickets with location:');
    console.table(sampleTickets);

    console.log('\nMigration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate();
