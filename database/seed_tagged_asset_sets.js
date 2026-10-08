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

async function seed() {
  const host = cleanHost(env.DB_HOST);
  const port = Number(env.DB_PORT) || 3306;
  const user = env.DB_USER;
  const password = env.DB_PASSWORD;
  const database = env.DB_NAME;

  console.log(`Connecting to ${database}...`);
  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    const [sets] = await conn.query('SELECT code FROM asset_sets');
    const existingCodes = new Set(sets.map(s => s.code));

    // 1. Standard Desktop Workstation Group
    if (!existingCodes.has('SET-DSK-01')) {
      const [r] = await conn.query(
        'INSERT INTO asset_sets (name, code, target_department, description) VALUES (?, ?, ?, ?)',
        [
          'Desktop PC Workstation Group',
          'SET-DSK-01',
          'Operations',
          'Standard desktop workstation package with CPU tower, monitor, input peripherals, and cabling.'
        ]
      );
      const sid = r.insertId;
      await conn.query(
        `INSERT INTO asset_set_items (set_id, category, quantity, notes) VALUES 
         (?, 'CPU', 1, 'Core i5/i7 Workstation Tower (TG-CPU-001)'),
         (?, 'Monitor', 1, '24-inch FHD IPS Display (TG-MON-001)'),
         (?, 'Keyboard', 1, 'Standard 104-Key USB Keyboard (TG-KBD-001)'),
         (?, 'Mouse', 1, 'Optical Scroll Mouse (TG-MSE-001)'),
         (?, 'HDMI', 1, 'High-Speed 2m HDMI Cable (TG-HDMI-001)'),
         (?, 'Power Cable', 1, '3-Pin Heavy Duty AC Power Cord (TG-PWR-001)')`,
        [sid, sid, sid, sid, sid, sid]
      );
      console.log('Seeded SET-DSK-01');
    }

    // 2. Network & Security Infrastructure Group
    if (!existingCodes.has('SET-NET-03')) {
      const [r] = await conn.query(
        'INSERT INTO asset_sets (name, code, target_department, description) VALUES (?, ?, ?, ?)',
        [
          'Network & Surveillance Infrastructure Group',
          'SET-NET-03',
          'Engineering',
          'Core network infrastructure and office surveillance monitoring equipment bundle.'
        ]
      );
      const sid = r.insertId;
      await conn.query(
        `INSERT INTO asset_set_items (set_id, category, quantity, notes) VALUES 
         (?, 'Router', 1, 'Dual-Band Gigabit Wi-Fi Gateway (TG-RTR-001)'),
         (?, 'Gigswitch', 1, '24-Port Managed PoE Gigabit Switch (TG-GSWH-001)'),
         (?, 'Webcam', 1, '1080p HD Conference Webcam (TG-WEB-001)'),
         (?, 'CCTV', 2, 'Dome IP Security Surveillance Camera (TG-CCTV-001)')`,
        [sid, sid, sid, sid]
      );
      console.log('Seeded SET-NET-03');
    }

    // 3. Executive Office & Printing Setup
    if (!existingCodes.has('SET-OFF-04')) {
      const [r] = await conn.query(
        'INSERT INTO asset_sets (name, code, target_department, description) VALUES (?, ?, ?, ?)',
        [
          'Executive Office & Facilities Setup',
          'SET-OFF-04',
          'Operations',
          'Executive ergonomics and shared network printing station bundle.'
        ]
      );
      const sid = r.insertId;
      await conn.query(
        `INSERT INTO asset_set_items (set_id, category, quantity, notes) VALUES 
         (?, 'Chair', 1, 'High-Back Ergonomic Mesh Chair (TG-CHR-001)'),
         (?, 'Printer', 1, 'Heavy Duty Network Laser Multifunction Printer (TGS-PRN-001)'),
         (?, 'Headset', 1, 'Noise-Cancelling USB Headset (TG-HST-001)'),
         (?, 'Power Adapter', 1, '65W USB-C Quick Charger Adapter (TG-ADP-001)')`,
        [sid, sid, sid, sid]
      );
      console.log('Seeded SET-OFF-04');
    }

    console.log('Seeding finished successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await conn.end();
  }
}

seed();
