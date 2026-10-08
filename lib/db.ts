import mysql, { Pool, PoolConnection } from 'mysql2/promise';

declare global {
  var __mysqlPool: Pool | undefined;
  var __dbHealthChecked: boolean | undefined;
}

function sanitizeHost(rawHost?: string): string {
  if (!rawHost) return 'localhost';
  let host = rawHost.trim();
  // Strip protocol if mistakenly passed (e.g. https:// or http://)
  host = host.replace(/^https?:\/\//i, '');
  // Strip trailing slashes or URL paths (e.g. auth-db1274.hstgr.io/ or auth-db1274.hstgr.io/db)
  host = host.replace(/\/.*$/, '');
  // Strip port if accidentally part of host (e.g. auth-db1274.hstgr.io:3306)
  if (host.includes(':')) {
    host = host.split(':')[0];
  }
  return host.trim() || 'localhost';
}

function sanitizePort(rawPort?: string | number): number {
  if (!rawPort) return 3306;
  const parsed = parseInt(String(rawPort).trim(), 10);
  return isNaN(parsed) || parsed <= 0 ? 3306 : parsed;
}

const dbConfig = {
  host: sanitizeHost(process.env.DB_HOST),
  port: sanitizePort(process.env.DB_PORT),
  user: (process.env.DB_USER || 'root').trim(),
  password: process.env.DB_PASSWORD || '',
  database: (process.env.DB_NAME || 'asset_management').trim(),
  waitForConnections: true,
  connectionLimit: 5, // Serverless-optimized limit for Vercel lambdas
  queueLimit: 0,
  connectTimeout: 10000, // 10s connection timeout prevents hangs
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00',
  dateStrings: true,
};

export function getPool(): Pool {
  if (!global.__mysqlPool) {
    console.log('[DB] Initializing MySQL pool:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      connectionLimit: dbConfig.connectionLimit,
      hasPassword: Boolean(dbConfig.password && dbConfig.password.length > 0),
    });
    global.__mysqlPool = mysql.createPool(dbConfig);
  }
  return global.__mysqlPool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getPool();
  try {
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  } catch (error: any) {
    console.error('[DB] MySQL Query Error:', {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sql: sql.replace(/\s+/g, ' ').trim(),
    });
    throw error;
  }
}

export async function execute(
  sql: string,
  params?: any[]
): Promise<{ insertId: number; affectedRows: number }> {
  const pool = getPool();
  try {
    const [result] = await pool.execute(sql, params);
    const r = result as any;
    return {
      insertId: r.insertId || 0,
      affectedRows: r.affectedRows || 0,
    };
  } catch (error: any) {
    console.error('[DB] MySQL Execute Error:', {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      sql: sql.replace(/\s+/g, ' ').trim(),
    });
    throw error;
  }
}

export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export interface DbHealthResult {
  ok: boolean;
  status: 'connected' | 'disconnected';
  database: string;
  host: string;
  port: number;
  reason?: string;
  latencyMs?: number;
}

function getSafeErrorMessage(error: any): string {
  if (!error) return 'Unknown database error occurred.';
  const code = error.code || '';
  const host = dbConfig.host;
  const port = dbConfig.port;
  const database = dbConfig.database;

  switch (code) {
    case 'ECONNREFUSED':
      return `MySQL server is not running or connection was refused on ${host}:${port}. Please verify that the MySQL service is active.`;
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
      return `Authentication failed: Incorrect database credentials for user '${dbConfig.user}'.`;
    case 'ER_BAD_DB_ERROR':
      return `Database '${database}' does not exist on MySQL server (${host}:${port}).`;
    case 'ETIMEDOUT':
    case 'CONNECT_TIMEOUT':
      return `Connection timed out while connecting to MySQL server on ${host}:${port}.`;
    case 'ENOTFOUND':
      return `Database host '${host}' could not be resolved.`;
    case 'PROTOCOL_CONNECTION_LOST':
      return 'Connection to MySQL server was lost.';
    default: {
      let msg = error.message || 'Failed to establish database connection.';
      if (dbConfig.password && dbConfig.password.length > 0) {
        msg = msg.replaceAll(dbConfig.password, '****');
      }
      return `${code ? `[${code}] ` : ''}${msg}`;
    }
  }
}

export async function checkDatabaseConnection(options?: {
  logToConsole?: boolean;
  forceCheck?: boolean;
}): Promise<DbHealthResult> {
  const shouldLog = options?.logToConsole ?? false;
  const isDuplicateLog = !options?.forceCheck && global.__dbHealthChecked;

  const startTime = Date.now();
  try {
    const pool = getPool();
    // Execute a lightweight query to verify active connectivity
    const [rows] = await pool.query('SELECT 1 AS health');
    const latencyMs = Date.now() - startTime;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Database ping query returned no results.');
    }

    if (shouldLog && !isDuplicateLog) {
      console.log('✓ Database connected successfully');
      console.log(`✓ Database: ${dbConfig.database}`);
      console.log(`✓ Database host: ${dbConfig.host}`);
      console.log('✓ Database connection verified');
      global.__dbHealthChecked = true;
    }

    return {
      ok: true,
      status: 'connected',
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      latencyMs,
    };
  } catch (error: any) {
    const reason = getSafeErrorMessage(error);

    if (shouldLog) {
      console.error('✗ Database connection failed');
      console.error(`✗ Reason: ${reason}`);
    }

    return {
      ok: false,
      status: 'disconnected',
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      reason,
    };
  }
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const res = await checkDatabaseConnection({ logToConsole: false, forceCheck: true });
  return {
    ok: res.ok,
    message: res.ok
      ? 'Database connected successfully'
      : `Database connection failed (${res.reason || 'Unknown error'})`,
  };
}
