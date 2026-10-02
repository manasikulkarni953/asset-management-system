import { query } from './db';
import { PoolConnection } from 'mysql2/promise';

/**
 * Single source of truth for the company asset prefix across all numbering and barcode workflows.
 */
export const ASSET_PREFIX = 'TGS';

export const CATEGORY_PREFIX_MAP: Record<string, string> = {
  Laptop: 'LAP',
  Desktop: 'DSK',
  Monitor: 'MON',
  Server: 'SVR',
  Mobile: 'MOB',
  Tablet: 'TAB',
  Printer: 'PRN',
  Networking: 'NET',
  Storage: 'STR',
  Peripheral: 'PER',
};

export function getCategoryPrefix(category: string): string {
  if (!category) return 'GEN';
  const trimmed = category.trim();
  if (CATEGORY_PREFIX_MAP[trimmed]) {
    return CATEGORY_PREFIX_MAP[trimmed];
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

  let candidate = `${ASSET_PREFIX}-${String(nextSequence).padStart(6, '0')}`;
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
      candidate = `${ASSET_PREFIX}-${String(nextSequence).padStart(6, '0')}`;
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

  let candidate = `${ASSET_PREFIX}-${catPrefix}-${String(nextSequence).padStart(5, '0')}`;
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
      candidate = `${ASSET_PREFIX}-${catPrefix}-${String(nextSequence).padStart(5, '0')}`;
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
