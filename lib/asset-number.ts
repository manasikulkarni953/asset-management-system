import { query } from './db';
import { PoolConnection } from 'mysql2/promise';

/**
 * Single source of truth for the company asset prefix across all numbering and barcode workflows.
 */
export const ASSET_PREFIX = 'TGS';

export const CATEGORY_PREFIX_MAP: Record<string, string> = {
  CPU: 'CPU',
  Cpu: 'CPU',
  cpu: 'CPU',
  Monitor: 'MON',
  Laptop: 'LAP',
  Headset: 'HST',
  Keyboard: 'KBD',
  Mouse: 'MSE',
  HDMI: 'HDMI',
  hdmi: 'HDMI',
  'Power Cable': 'PWR',
  'Power Adapter': 'ADP',
  Router: 'RTR',
  Gigswitch: 'GSWH',
  Webcam: 'WEB',
  webcam: 'WEB',
  WEBC: 'WEBC',
  CCTV: 'CCTV',
  cctv: 'CCTV',
  Chair: 'CHR',
  Printer: 'PRN',
  // Preserving legacy categories for backward compatibility
  Desktop: 'DSK',
  Server: 'SVR',
  Mobile: 'MOB',
  Tablet: 'TAB',
  Networking: 'NET',
  Storage: 'STR',
  Peripheral: 'PER',
};

export interface AssetTagSpec {
  category: string;
  tagFormat: string;
  prefix: string;
  description: string;
}

/**
 * Standard asset tagging specifications defined by enterprise inventory sheet:
 * TG-CPU-001, TG-MON-001, TG-LAP-001, TG-HST-001, TG-KBD-001, TG-MSE-001,
 * TG-HDMI-001, TG-PWR-001, TG-ADP-001, TG-RTR-001, TG-GSWH-001, TG-WEB-001,
 * TG-CCTV-001, TG-CHR-001, TGS-PRN-001.
 */
export const ASSET_TAG_SPECS: AssetTagSpec[] = [
  { category: 'CPU', tagFormat: 'TG-CPU-001', prefix: 'CPU', description: 'Central Processing Unit / Desktop Tower' },
  { category: 'Monitor', tagFormat: 'TG-MON-001', prefix: 'MON', description: 'Display Monitor Screen' },
  { category: 'Laptop', tagFormat: 'TG-LAP-001', prefix: 'LAP', description: 'Portable Notebook Computer' },
  { category: 'Headset', tagFormat: 'TG-HST-001', prefix: 'HST', description: 'Audio / Voice Call Headset' },
  { category: 'Keyboard', tagFormat: 'TG-KBD-001', prefix: 'KBD', description: 'Input Keyboard' },
  { category: 'Mouse', tagFormat: 'TG-MSE-001', prefix: 'MSE', description: 'Optical / Ergonomic Mouse' },
  { category: 'HDMI', tagFormat: 'TG-HDMI-001', prefix: 'HDMI', description: 'HDMI Video Interface Cable' },
  { category: 'Power Cable', tagFormat: 'TG-PWR-001', prefix: 'PWR', description: 'AC Mains Power Cable' },
  { category: 'Power Adapter', tagFormat: 'TG-ADP-001', prefix: 'ADP', description: 'DC Power Charger Adapter' },
  { category: 'Router', tagFormat: 'TG-RTR-001', prefix: 'RTR', description: 'Network Gateway / Wi-Fi Router' },
  { category: 'Gigswitch', tagFormat: 'TG-GSWH-001', prefix: 'GSWH', description: 'Gigabit Managed Network Switch' },
  { category: 'Webcam', tagFormat: 'TG-WEB-001', prefix: 'WEB', description: 'HD USB Conference Webcam' },
  { category: 'CCTV', tagFormat: 'TG-CCTV-001', prefix: 'CCTV', description: 'Surveillance Security Camera' },
  { category: 'Chair', tagFormat: 'TG-CHR-001', prefix: 'CHR', description: 'Ergonomic Office Chair' },
  { category: 'Printer', tagFormat: 'TGS-PRN-001', prefix: 'PRN', description: 'Network Document Printer' },
];

export function getAssetTagFormat(category: string): string {
  if (!category) return 'TG-GEN-001';
  const norm = category.trim().toLowerCase();
  const match = ASSET_TAG_SPECS.find((s) => s.category.toLowerCase() === norm);
  if (match) return match.tagFormat;
  if (norm.includes('headphone') || norm.includes('headset')) return 'TG-HST-001';
  if (norm.includes('power cable')) return 'TG-PWR-001';
  if (norm.includes('adapter')) return 'TG-ADP-001';
  if (norm.includes('cable') || norm.includes('pwr')) return 'TG-PWR-001';
  if (norm.includes('hdmi')) return 'TG-HDMI-001';
  if (norm.includes('switch')) return 'TG-GSWH-001';
  if (norm.includes('webcam') || norm.includes('cam')) return 'TG-WEB-001';
  if (norm.includes('cctv')) return 'TG-CCTV-001';
  if (norm.includes('chair')) return 'TG-CHR-001';
  if (norm.includes('printer')) return 'TGS-PRN-001';
  if (norm.includes('desktop') || norm.includes('cpu')) return 'TG-CPU-001';
  if (norm.includes('laptop')) return 'TG-LAP-001';
  if (norm.includes('monitor')) return 'TG-MON-001';
  if (norm.includes('keyboard')) return 'TG-KBD-001';
  if (norm.includes('mouse')) return 'TG-MSE-001';
  if (norm.includes('router')) return 'TG-RTR-001';
  return `TG-${category.substring(0, 3).toUpperCase()}-001`;
}

export function getCategoryPrefix(category: string): string {
  if (!category) return 'GEN';
  const trimmed = category.trim();
  if (CATEGORY_PREFIX_MAP[trimmed]) {
    return CATEGORY_PREFIX_MAP[trimmed];
  }
  const key = Object.keys(CATEGORY_PREFIX_MAP).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  if (key) {
    return CATEGORY_PREFIX_MAP[key];
  }
  // Fallback: take first 3 alphanumeric characters uppercase
  const clean = trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.length >= 3 ? clean.substring(0, 3) : (clean + 'GEN').substring(0, 3);
}

/**
 * Generates the next sequential unique Asset ID (e.g. TGS-000008).
 * Scans both active TGS- and legacy AST- patterns so sequence continuity is strictly preserved.
 */
export async function generateNextAssetId(
  connection?: PoolConnection
): Promise<string> {
  const lockClause = connection ? ' FOR UPDATE' : '';

  let rows: any[] = [];
  const sql = `SELECT asset_id FROM assets 
       WHERE asset_id LIKE '${ASSET_PREFIX}-%' OR asset_id LIKE 'AST-%'
       ORDER BY CAST(SUBSTRING(asset_id, INSTR(asset_id, '-') + 1) AS UNSIGNED) DESC 
       LIMIT 1${lockClause}`;

  if (connection) {
    const [res] = await connection.query(sql);
    rows = res as any[];
  } else {
    rows = await query(sql);
  }

  let nextSequence = 1;

  if (rows && rows.length > 0 && rows[0]?.asset_id) {
    const lastId = String(rows[0].asset_id);
    const parts = lastId.split('-');
    if (parts.length >= 2) {
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed) && parsed >= 1) {
        nextSequence = parsed + 1;
      }
    }
  }

  let candidate = `${ASSET_PREFIX}-${String(nextSequence).padStart(3, '0')}`;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 1000;

  while (exists && attempts < maxAttempts) {
    attempts++;
    let checkRows: any[] = [];
    const checkSql = `SELECT id FROM assets WHERE asset_id = ? LIMIT 1${lockClause}`;
    if (connection) {
      const [res] = await connection.query(checkSql, [candidate]);
      checkRows = res as any[];
    } else {
      checkRows = await query(checkSql, [candidate]);
    }

    if (checkRows && checkRows.length > 0) {
      nextSequence++;
      candidate = `${ASSET_PREFIX}-${String(nextSequence).padStart(3, '0')}`;
    } else {
      exists = false;
    }
  }

  if (exists) {
    throw new Error('Asset identity generation failed: maximum collision resolution attempts exceeded.');
  }

  return candidate;
}

/**
 * Generates the next sequential unique category-based Asset Number (e.g. TGS-LAP-00004).
 * Maintains category-specific sequences while checking both TGS- and legacy AST- patterns.
 */
export async function generateNextAssetNumber(
  category: string,
  connection?: PoolConnection
): Promise<string> {
  const catPrefix = getCategoryPrefix(category);
  const pattern = `${ASSET_PREFIX}-${catPrefix}-%`;
  const legacyPattern = `AST-${catPrefix}-%`;
  const lockClause = connection ? ' FOR UPDATE' : '';

  let rows: any[] = [];
  const sql = `SELECT asset_number FROM assets 
       WHERE asset_number LIKE ? OR asset_number LIKE ?
       ORDER BY CAST(SUBSTRING_INDEX(asset_number, '-', -1) AS UNSIGNED) DESC 
       LIMIT 1${lockClause}`;

  if (connection) {
    const [res] = await connection.query(sql, [pattern, legacyPattern]);
    rows = res as any[];
  } else {
    rows = await query(sql, [pattern, legacyPattern]);
  }

  let nextSequence = 1;

  if (rows && rows.length > 0 && rows[0]?.asset_number) {
    const lastNumber = rows[0].asset_number as string;
    const parts = lastNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed) && parsed >= 1) {
        nextSequence = parsed + 1;
      }
    }
  }

  let candidate = `${ASSET_PREFIX}-${catPrefix}-${String(nextSequence).padStart(4, '0')}`;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 1000;

  while (exists && attempts < maxAttempts) {
    attempts++;
    let checkRows: any[] = [];
    const checkSql = `SELECT id FROM assets WHERE asset_number = ? LIMIT 1${lockClause}`;
    if (connection) {
      const [res] = await connection.query(checkSql, [candidate]);
      checkRows = res as any[];
    } else {
      checkRows = await query(checkSql, [candidate]);
    }

    if (checkRows && checkRows.length > 0) {
      nextSequence++;
      candidate = `${ASSET_PREFIX}-${catPrefix}-${String(nextSequence).padStart(4, '0')}`;
    } else {
      exists = false;
    }
  }

  if (exists) {
    throw new Error('Asset number generation failed: maximum collision resolution attempts exceeded.');
  }

  return candidate;
}

export async function generateNextTicketId(
  connection?: PoolConnection
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const pattern = `TKT-${currentYear}-%`;

  let rows: any[] = [];
  if (connection) {
    const [res] = await connection.query(
      'SELECT ticket_id FROM tickets WHERE ticket_id LIKE ? ORDER BY id DESC LIMIT 1',
      [pattern]
    );
    rows = res as any[];
  } else {
    rows = await query(
      'SELECT ticket_id FROM tickets WHERE ticket_id LIKE ? ORDER BY id DESC LIMIT 1',
      [pattern]
    );
  }

  let nextSeq = 1;
  if (rows && rows.length > 0) {
    const lastId = rows[0].ticket_id as string;
    const parts = lastId.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
  }

  const padded = String(nextSeq).padStart(5, '0');
  return `TKT-${currentYear}-${padded}`;
}
