const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const envFile = path.resolve(__dirname, '../.env');
let env = {};
if (fs.existsSync(envFile)) {
  env = Object.fromEntries(
    fs.readFileSync(envFile, 'utf8')
      .split('\n')
      .filter(l => l.includes('=') && !l.startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
}

function cleanHost(h) {
  if (!h) return 'localhost';
  return h.replace(/^https?:\/\//i, '').replace(/\/+.*$/, '').split(':')[0].trim();
}

async function migrate() {
  const host = cleanHost(env.DB_HOST || process.env.DB_HOST);
  const port = Number(env.DB_PORT || process.env.DB_PORT) || 3306;
  const user = (env.DB_USER || process.env.DB_USER || 'root').trim();
  const password = (env.DB_PASSWORD || process.env.DB_PASSWORD || '').trim();
  const database = (env.DB_NAME || process.env.DB_NAME || 'asset_management').trim();

  console.log(`Connecting to ${database} on ${host}:${port}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    console.log('--- Creating notifications table ---');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`notifications\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` INT NULL,
        \`role\` VARCHAR(50) NULL,
        \`type\` VARCHAR(50) NOT NULL DEFAULT 'ticket_created',
        \`title\` VARCHAR(255) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`link\` VARCHAR(255) NULL,
        \`ticket_id\` VARCHAR(50) NULL,
        \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_notifications_user\` (\`user_id\`, \`is_read\`),
        INDEX \`idx_notifications_role\` (\`role\`, \`is_read\`),
        INDEX \`idx_notifications_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('--- Checking existing tickets to seed initial notifications for demonstration ---');
    const [existingTickets] = await conn.query(`
      SELECT t.id, t.ticket_id, t.issue_category, t.priority, t.created_at,
             COALESCE(e.name, e.full_name) as employee_name,
             a.asset_number
      FROM tickets t
      LEFT JOIN employee e ON t.employee_id = e.id
      LEFT JOIN assets a ON t.asset_id = a.id
      ORDER BY t.id DESC
      LIMIT 5
    `);

    const [adminUsers] = await conn.query(`
      SELECT id, role, full_name FROM users WHERE role IN ('super_admin', 'admin', 'it_admin')
    `);

    console.log(`Found ${adminUsers.length} admin users and ${existingTickets.length} recent tickets.`);

    for (const ticket of existingTickets) {
      for (const adminUser of adminUsers) {
        const [existing] = await conn.query(
          'SELECT id FROM notifications WHERE user_id = ? AND ticket_id = ? LIMIT 1',
          [adminUser.id, ticket.ticket_id]
        );
        if (existing.length === 0) {
          await conn.query(`
            INSERT INTO notifications (user_id, role, type, title, message, link, ticket_id, is_read, created_at)
            VALUES (?, ?, 'ticket_created', ?, ?, ?, ?, 0, ?)
          `, [
            adminUser.id,
            adminUser.role,
            `New Ticket: ${ticket.ticket_id}`,
            `${ticket.employee_name || 'An employee'} raised a ${ticket.priority || 'medium'} priority ticket for ${ticket.asset_number || 'asset'} (${ticket.issue_category || 'Hardware'}).`,
            `/tickets/${ticket.id}`,
            ticket.ticket_id,
            ticket.created_at || new Date()
          ]);
        }
      }
    }

    console.log('--- Migration completed successfully ---');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();
