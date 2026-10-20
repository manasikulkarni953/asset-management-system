import { query, execute, withTransaction } from '@/lib/db';
import { generateNextAssetNumber, generateNextAssetId } from '@/lib/asset-number';
import { Asset, AssetDetailed, AssetHistory } from '@/types/asset';
import { CreateAssetInput, UpdateAssetInput } from '@/validations/asset.validation';

export interface AssetFilterOptions {
  search?: string;
  category?: string;
  status?: string;
  employeeId?: number;
  importId?: number;
  page?: number;
  limit?: number;
}

let schemaInitPromise: Promise<{ hasImportId: boolean; hasAssetImportsTable: boolean }> | null = null;
let hasImportIdCached: boolean | null = null;
let hasAssetImportsTableCached: boolean | null = null;

async function ensureAssetImportsSchema(): Promise<{ hasImportId: boolean; hasAssetImportsTable: boolean }> {
  if (hasImportIdCached !== null && hasAssetImportsTableCached !== null) {
    return { hasImportId: hasImportIdCached, hasAssetImportsTable: hasAssetImportsTableCached };
  }

  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    // 1. Ensure asset_imports table exists
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS asset_imports (
          id INT AUTO_INCREMENT PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_size INT NOT NULL DEFAULT 0,
          file_content MEDIUMTEXT NULL,
          total_records INT NOT NULL DEFAULT 0,
          success_count INT NOT NULL DEFAULT 0,
          failed_count INT NOT NULL DEFAULT 0,
          status ENUM('completed', 'failed', 'partial') DEFAULT 'completed',
          imported_by_user_id INT NULL,
          imported_by_name VARCHAR(100) NULL,
          error_log TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_imports_date (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      hasAssetImportsTableCached = true;
    } catch (err: any) {
      console.warn('[AssetService] Auto-create asset_imports table notice:', err?.message || err);
      hasAssetImportsTableCached = false;
    }

    // 2. Ensure import_id column exists on assets table
    try {
      const cols = await query<any>(`SHOW COLUMNS FROM assets LIKE 'import_id'`);
      if (!cols || cols.length === 0) {
        try {
          await query(`ALTER TABLE assets ADD COLUMN import_id INT NULL AFTER current_employee_id`);
          try {
            await query(`ALTER TABLE assets ADD INDEX idx_assets_import_id (import_id)`);
          } catch {
            // ignore index warning
          }
          hasImportIdCached = true;
        } catch (alterErr: any) {
          console.warn('[AssetService] Auto-add import_id column notice:', alterErr?.message || alterErr);
          hasImportIdCached = false;
        }
      } else {
        hasImportIdCached = true;
      }
    } catch (colErr: any) {
      console.warn('[AssetService] Check import_id column notice:', colErr?.message || colErr);
      hasImportIdCached = false;
    }

    return {
      hasImportId: Boolean(hasImportIdCached),
      hasAssetImportsTable: Boolean(hasAssetImportsTableCached),
    };
  })();

  return schemaInitPromise;
}

export class AssetService {
  static async getAssets(options: AssetFilterOptions = {}): Promise<{ assets: Asset[]; total: number }> {
    const { search, category, status, employeeId, importId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { hasImportId, hasAssetImportsTable } = await ensureAssetImportsSchema();

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim() !== '') {
      conditions.push(
        '(a.asset_id LIKE ? OR a.asset_number LIKE ? OR a.brand LIKE ? OR a.model LIKE ? OR a.serial_number LIKE ?)'
      );
      const searchPattern = `%${search.trim()}%`;
      params.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    if (category && category !== 'all') {
      conditions.push('a.category = ?');
      params.push(category);
    }

    if (status && status !== 'all') {
      conditions.push('a.status = ?');
      params.push(status);
    }

    if (employeeId) {
      conditions.push('a.current_employee_id = ?');
      params.push(employeeId);
    }

    if (hasImportId) {
      if (importId) {
        conditions.push('a.import_id = ?');
        params.push(importId);
      } else {
        conditions.push('a.import_id IS NULL');
      }
    }

    const whereClause = conditions.join(' AND ');

    try {
      const countRows = await query<any>(
        `SELECT COUNT(*) as total 
         FROM assets a 
         LEFT JOIN employee e ON a.current_employee_id = e.id
         WHERE ${whereClause}`,
        params
      );
      const total = countRows[0]?.total || 0;

      const canJoinImports = hasImportId && hasAssetImportsTable;

      const assets = await query<Asset>(
        `SELECT 
          a.id,
          a.asset_id,
          a.asset_number,
          a.category,
          a.brand,
          a.model,
          a.serial_number,
          a.purchase_date,
          a.purchase_cost,
          a.vendor,
          a.vendor_phone,
          a.vendor_email,
          a.location,
          a.warranty_expiry,
          a.status,
          a.current_employee_id,
          COALESCE(e.name, e.full_name) as current_employee_name,
          COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as current_employee_code,
          ${canJoinImports ? 'a.import_id, ai.original_name as import_filename,' : 'NULL as import_id, NULL as import_filename,'}
          a.created_at,
          a.updated_at
         FROM assets a
         LEFT JOIN employee e ON a.current_employee_id = e.id
         ${canJoinImports ? 'LEFT JOIN asset_imports ai ON a.import_id = ai.id' : ''}
         WHERE ${whereClause}
         ORDER BY a.id DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), Number(offset)]
      );

      return { assets, total };
    } catch (queryErr: any) {
      // Fallback: If table or column is missing on production database (e.g. Hostinger/Vercel)
      const isMissingSchema =
        queryErr?.code === 'ER_BAD_FIELD_ERROR' ||
        queryErr?.code === 'ER_NO_SUCH_TABLE' ||
        queryErr?.message?.includes('import_id') ||
        queryErr?.message?.includes('asset_imports');

      if (isMissingSchema) {
        console.warn('[AssetService] Schema fallback triggered for getAssets:', queryErr?.message);
        hasImportIdCached = false;
        hasAssetImportsTableCached = false;

        const fbConditions: string[] = ['1=1'];
        const fbParams: any[] = [];
        if (search && search.trim() !== '') {
          fbConditions.push(
            '(a.asset_id LIKE ? OR a.asset_number LIKE ? OR a.brand LIKE ? OR a.model LIKE ? OR a.serial_number LIKE ?)'
          );
          const sp = `%${search.trim()}%`;
          fbParams.push(sp, sp, sp, sp, sp);
        }
        if (category && category !== 'all') {
          fbConditions.push('a.category = ?');
          fbParams.push(category);
        }
        if (status && status !== 'all') {
          fbConditions.push('a.status = ?');
          fbParams.push(status);
        }
        if (employeeId) {
          fbConditions.push('a.current_employee_id = ?');
          fbParams.push(employeeId);
        }

        const fbWhere = fbConditions.join(' AND ');
        const countRows = await query<any>(
          `SELECT COUNT(*) as total FROM assets a WHERE ${fbWhere}`,
          fbParams
        );
        const assets = await query<Asset>(
          `SELECT 
            a.id,
            a.asset_id,
            a.asset_number,
            a.category,
            a.brand,
            a.model,
            a.serial_number,
            a.purchase_date,
            a.purchase_cost,
            a.vendor,
            a.vendor_phone,
            a.vendor_email,
            a.location,
            a.warranty_expiry,
            a.status,
            a.current_employee_id,
            COALESCE(e.name, e.full_name) as current_employee_name,
            COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as current_employee_code,
            NULL as import_id,
            NULL as import_filename,
            a.created_at,
            a.updated_at
           FROM assets a
           LEFT JOIN employee e ON a.current_employee_id = e.id
           WHERE ${fbWhere}
           ORDER BY a.id DESC
           LIMIT ? OFFSET ?`,
          [...fbParams, Number(limit), Number(offset)]
        );

        return { assets, total: countRows[0]?.total || 0 };
      }

      throw queryErr;
    }
  }

  static async getAssetById(id: number): Promise<AssetDetailed | null> {
    const rows = await query<Asset>(
      `SELECT 
        a.id,
        a.asset_id,
        a.asset_number,
        a.category,
        a.brand,
        a.model,
        a.serial_number,
        a.purchase_date,
        a.purchase_cost,
        a.vendor,
        a.vendor_phone,
        a.vendor_email,
        a.location,
        a.warranty_expiry,
        a.status,
        a.current_employee_id,
        COALESCE(e.name, e.full_name) as current_employee_name,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as current_employee_code,
        a.created_at,
        a.updated_at
       FROM assets a
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE a.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return null;
    const asset = rows[0] as AssetDetailed;

    // Fetch insurance
    const insuranceRows = await query<any>(
      `SELECT * FROM asset_insurance WHERE asset_id = ? LIMIT 1`,
      [id]
    );
    asset.insurance = insuranceRows[0] || null;

    // Fetch history
    asset.history = await this.getAssetHistory(id);

    // Fetch assignment history
    asset.assignments = await query<any>(
      `SELECT 
        aa.id,
        aa.asset_id,
        aa.employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_code,
        COALESCE(e.department, 'Operations') as employee_department,
        aa.assigned_date,
        aa.returned_date,
        aa.status,
        aa.notes,
        u.full_name as assigned_by_name
       FROM asset_assignments aa
       JOIN employee e ON aa.employee_id = e.id
       LEFT JOIN users u ON aa.assigned_by_user_id = u.id
       WHERE aa.asset_id = ?
       ORDER BY aa.id DESC`,
      [id]
    );

    // Fetch tickets
    asset.tickets = await query<any>(
      `SELECT 
        t.id,
        t.ticket_id,
        t.issue_category,
        t.priority,
        t.status,
        t.created_at,
        COALESCE(e.name, e.full_name) as employee_name
       FROM tickets t
       JOIN employee e ON t.employee_id = e.id
       WHERE t.asset_id = ?
       ORDER BY t.id DESC`,
      [id]
    );

    return asset;
  }

  static async getAssetByAssetNumber(assetNumber: string): Promise<AssetDetailed | null> {
    if (!assetNumber || typeof assetNumber !== 'string') return null;
    const trimmed = assetNumber.trim();
    if (!trimmed) return null;

    // 1. Direct match by asset_number, asset_id, or serial_number (case-insensitive)
    let rows = await query<Asset>(
      `SELECT id FROM assets 
       WHERE LOWER(asset_number) = LOWER(?) 
          OR LOWER(asset_id) = LOWER(?) 
          OR LOWER(serial_number) = LOWER(?) 
       LIMIT 1`,
      [trimmed, trimmed, trimmed]
    );

    // 2. Fallback check: without hyphens or spaces (e.g. ASTLAP00001)
    if (!rows || rows.length === 0) {
      const stripped = trimmed.replace(/[-\s_]/g, '');
      if (stripped.length >= 3) {
        rows = await query<Asset>(
          `SELECT id FROM assets 
           WHERE REPLACE(REPLACE(LOWER(asset_number), '-', ''), '_', '') = LOWER(?)
              OR REPLACE(REPLACE(LOWER(asset_id), '-', ''), '_', '') = LOWER(?)
              OR REPLACE(REPLACE(LOWER(serial_number), '-', ''), '_', '') = LOWER(?)
           LIMIT 1`,
          [stripped, stripped, stripped]
        );
      }
    }

    if (!rows || rows.length === 0) return null;
    return this.getAssetById(rows[0].id);
  }

  static async createAsset(data: CreateAssetInput, userId?: number, importId?: number): Promise<Asset> {
    return withTransaction(async (conn) => {
      // 1. Hardware serial number validation and uniqueness check
      const trimmedSerial = (data.serial_number || '').trim();
      if (!trimmedSerial) {
        throw new Error('Hardware serial number is required.');
      }

      // Check unique serial number with row locking to prevent concurrent collision
      const [existingSerial] = await conn.query<any[]>(
        'SELECT id FROM assets WHERE serial_number = ? LIMIT 1 FOR UPDATE',
        [trimmedSerial]
      );
      if (existingSerial.length > 0) {
        throw new Error('This hardware serial number already exists.');
      }

      // 2. Server-side generate permanent unique asset_id (e.g., AST-000006)
      let assetId: string;
      try {
        assetId = await generateNextAssetId(conn);
      } catch (err: any) {
        throw new Error(`Asset identity generation failed: ${err?.message || 'Generator error'}`);
      }

      if (!assetId || assetId.trim() === '') {
        throw new Error('Asset identity generation failed: produced invalid or empty ID.');
      }

      // 3. Server-side generate category-based asset_number (e.g., AST-LAP-00004)
      let assetNumber: string;
      try {
        assetNumber = await generateNextAssetNumber(data.category, conn);
      } catch (err: any) {
        throw new Error(`Asset number generation failed: ${err?.message || 'Generator error'}`);
      }

      if (!assetNumber || assetNumber.trim() === '') {
        throw new Error('Asset number generation failed: produced invalid or empty number.');
      }

      const initialStatus = data.current_employee_id ? 'assigned' : (data.status || 'in_stock');

      const { hasImportId } = await ensureAssetImportsSchema();

      let res: any;
      if (hasImportId) {
        [res] = await conn.execute(
          `INSERT INTO assets (
            asset_id, asset_number, category, brand, model, serial_number, 
            purchase_date, purchase_cost, vendor, vendor_phone, vendor_email, location,
            warranty_expiry, status, current_employee_id, import_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            assetId,
            assetNumber,
            data.category.trim(),
            data.brand.trim(),
            data.model.trim(),
            trimmedSerial,
            data.purchase_date,
            data.purchase_cost,
            data.vendor.trim(),
            data.vendor_phone ? data.vendor_phone.trim() : null,
            data.vendor_email ? data.vendor_email.trim() : null,
            data.location ? data.location.trim() : 'The Space',
            data.warranty_expiry || null,
            initialStatus,
            data.current_employee_id || null,
            importId || null,
          ]
        );
      } else {
        [res] = await conn.execute(
          `INSERT INTO assets (
            asset_id, asset_number, category, brand, model, serial_number, 
            purchase_date, purchase_cost, vendor, vendor_phone, vendor_email, location,
            warranty_expiry, status, current_employee_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            assetId,
            assetNumber,
            data.category.trim(),
            data.brand.trim(),
            data.model.trim(),
            trimmedSerial,
            data.purchase_date,
            data.purchase_cost,
            data.vendor.trim(),
            data.vendor_phone ? data.vendor_phone.trim() : null,
            data.vendor_email ? data.vendor_email.trim() : null,
            data.location ? data.location.trim() : 'The Space',
            data.warranty_expiry || null,
            initialStatus,
            data.current_employee_id || null,
          ]
        );
      }

      const internalId = (res as any).insertId;

      // 5. Record creation in history (references assets.id)
      const desc = importId
        ? `Asset imported via file with ID ${assetId} and number ${assetNumber}`
        : `Asset registered with ID ${assetId} and number ${assetNumber}`;
      await conn.execute(
        `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
         VALUES (?, 'created', ?, ?)`,
        [internalId, desc, userId || null]
      );

      // 6. If assigned initially, create assignment record and history
      if (data.current_employee_id) {
        await conn.execute(
          `INSERT INTO asset_assignments (asset_id, employee_id, status, notes, assigned_by_user_id)
           VALUES (?, ?, 'assigned', 'Initial assignment during asset registration', ?)`,
          [internalId, data.current_employee_id, userId || null]
        );

        const [empRows] = await conn.query<any[]>(
          'SELECT COALESCE(name, full_name) as name, employee_id FROM employee WHERE id = ?',
          [data.current_employee_id]
        );
        const empName = empRows[0]?.name || 'Employee';

        await conn.execute(
          `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
           VALUES (?, 'assigned', ?, ?)`,
          [internalId, `Initially assigned to ${empName}`, userId || null]
        );
      }

      const [newAssetRows] = await conn.query<any[]>(
        'SELECT * FROM assets WHERE id = ?',
        [internalId]
      );
      return newAssetRows[0] as Asset;
    });
  }

  static async updateAsset(id: number, data: UpdateAssetInput, userId?: number): Promise<Asset> {
    const existing = await this.getAssetById(id);
    if (!existing) {
      throw new Error(`Asset with ID ${id} not found.`);
    }

    if (data.serial_number && data.serial_number.trim() !== existing.serial_number) {
      const trimmedSerial = data.serial_number.trim();
      const existingSerial = await query<any>(
        'SELECT id FROM assets WHERE serial_number = ? AND id != ? LIMIT 1',
        [trimmedSerial, id]
      );
      if (existingSerial.length > 0) {
        throw new Error('This hardware serial number already exists.');
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.category !== undefined) { updates.push('category = ?'); params.push(data.category); }
    if (data.brand !== undefined) { updates.push('brand = ?'); params.push(data.brand); }
    if (data.model !== undefined) { updates.push('model = ?'); params.push(data.model); }
    if (data.serial_number !== undefined) { updates.push('serial_number = ?'); params.push(data.serial_number); }
    if (data.purchase_date !== undefined) { updates.push('purchase_date = ?'); params.push(data.purchase_date); }
    if (data.purchase_cost !== undefined) { updates.push('purchase_cost = ?'); params.push(data.purchase_cost); }
    if (data.vendor !== undefined) { updates.push('vendor = ?'); params.push(data.vendor); }
    if (data.vendor_phone !== undefined) { updates.push('vendor_phone = ?'); params.push(data.vendor_phone ? data.vendor_phone.trim() : null); }
    if (data.vendor_email !== undefined) { updates.push('vendor_email = ?'); params.push(data.vendor_email ? data.vendor_email.trim() : null); }
    if (data.location !== undefined) { updates.push('location = ?'); params.push(data.location ? data.location.trim() : null); }
    if (data.warranty_expiry !== undefined) { updates.push('warranty_expiry = ?'); params.push(data.warranty_expiry || null); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }

    if (updates.length > 0) {
      await execute(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);

      if (data.status && data.status !== existing.status) {
        await execute(
          `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
           VALUES (?, 'status_changed', ?, ?)`,
          [id, `Status updated from ${existing.status} to ${data.status}`, userId || null]
        );
      }
    }

    const updated = await this.getAssetById(id);
    return updated!;
  }

  static async retireAsset(id: number, reason: string, userId?: number): Promise<void> {
    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE assets SET status = 'retired', current_employee_id = NULL WHERE id = ?`,
        [id]
      );

      // Return any active assignment
      await conn.execute(
        `UPDATE asset_assignments 
         SET status = 'returned', returned_date = CURRENT_TIMESTAMP, notes = CONCAT(IFNULL(notes, ''), ' [Auto-returned upon asset retirement]')
         WHERE asset_id = ? AND status = 'assigned'`,
        [id]
      );

      await conn.execute(
        `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
         VALUES (?, 'retired', ?, ?)`,
        [id, `Asset retired. Reason: ${reason || 'End of lifecycle'}`, userId || null]
      );
    });
  }

  static async deleteAsset(id: number): Promise<void> {
    await withTransaction(async (conn) => {
      // 1. Delete associated network config
      await conn.execute('DELETE FROM asset_network WHERE asset_id = ?', [id]);
      // 2. Delete associated insurance
      await conn.execute('DELETE FROM asset_insurance WHERE asset_id = ?', [id]);
      // 3. Nullify tickets referencing this asset
      await conn.execute('UPDATE tickets SET asset_id = NULL WHERE asset_id = ?', [id]);
      // 4. Delete assignment history
      await conn.execute('DELETE FROM asset_assignments WHERE asset_id = ?', [id]);
      // 5. Delete asset history
      await conn.execute('DELETE FROM asset_history WHERE asset_id = ?', [id]);
      // 6. Delete asset record
      await conn.execute('DELETE FROM assets WHERE id = ?', [id]);
    });
  }

  static async getAssetHistory(assetId: number): Promise<AssetHistory[]> {
    return query<AssetHistory>(
      `SELECT 
        ah.id,
        ah.asset_id,
        ah.event_type,
        ah.description,
        ah.performed_by_user_id,
        u.full_name as performed_by_name,
        ah.metadata,
        ah.created_at
       FROM asset_history ah
       LEFT JOIN users u ON ah.performed_by_user_id = u.id
       WHERE ah.asset_id = ?
       ORDER BY ah.id DESC`,
      [assetId]
    );
  }

  static async getCategories(): Promise<string[]> {
    const rows = await query<{ category: string }>(
      'SELECT DISTINCT category FROM assets WHERE category IS NOT NULL AND category != "" ORDER BY category ASC'
    );
    const defaults = [
      'CPU',
      'Monitor',
      'Laptop',
      'Headset',
      'Keyboard',
      'Mouse',
      'HDMI',
      'Power Cable',
      'Power Adapter',
      'Router',
      'Gigswitch',
      'Webcam',
      'CCTV',
      'Chair',
      'Printer',
    ];
    const existing = rows.map((r) => r.category);
    return Array.from(new Set([...defaults, ...existing]));
  }

  /**
   * Import batch of assets from parsed file data (CSV / Excel).
   * Creates an asset_imports audit record and individual asset records with full identities.
   */
  static async importAssetsFromData({
    filename,
    originalName,
    fileSize,
    fileContent,
    rows,
    userId,
    userName,
  }: {
    filename: string;
    originalName: string;
    fileSize: number;
    fileContent?: string;
    rows: any[];
    userId?: number;
    userName?: string;
  }): Promise<{
    importId: number;
    totalRecords: number;
    successCount: number;
    failedCount: number;
    errors: Array<{ row: number; serial?: string; error: string }>;
    importedAssets: Asset[];
  }> {
    if (!rows || rows.length === 0) {
      throw new Error('No asset rows provided in the file to import.');
    }

    await ensureAssetImportsSchema();

    // 1. Create asset_imports record with completed status and full spreadsheet content
    // Kept separate from the main assets inventory table so uploaded files only appear in View File
    const insertImportRes = await execute(
      `INSERT INTO asset_imports (
        filename, original_name, file_size, file_content, total_records, 
        success_count, failed_count, status, imported_by_user_id, imported_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 'completed', ?, ?)`,
      [
        filename,
        originalName,
        fileSize,
        fileContent || null,
        rows.length,
        rows.length,
        userId || null,
        userName || null,
      ]
    );

    const importId = (insertImportRes as any).insertId;

    return {
      importId,
      totalRecords: rows.length,
      successCount: rows.length,
      failedCount: 0,
      errors: [],
      importedAssets: [],
    };
  }

  static async getImportHistory(): Promise<any[]> {
    await ensureAssetImportsSchema();
    try {
      return await query(
        `SELECT 
          id,
          filename,
          original_name,
          file_size,
          total_records,
          success_count,
          failed_count,
          status,
          imported_by_user_id,
          imported_by_name,
          error_log,
          created_at
         FROM asset_imports
         ORDER BY id DESC`
      );
    } catch (error: any) {
      if (
        error?.code === 'ER_NO_SUCH_TABLE' ||
        error?.message?.includes("doesn't exist") ||
        error?.message?.includes('asset_imports')
      ) {
        console.warn('[AssetService] asset_imports table does not exist in production database. Returning empty array.');
        return [];
      }
      throw error;
    }
  }

  static async getImportById(id: number): Promise<any | null> {
    await ensureAssetImportsSchema();
    try {
      const rows = await query<any>(
        `SELECT * FROM asset_imports WHERE id = ? LIMIT 1`,
        [id]
      );
      return rows && rows.length > 0 ? rows[0] : null;
    } catch (error: any) {
      if (
        error?.code === 'ER_NO_SUCH_TABLE' ||
        error?.message?.includes("doesn't exist") ||
        error?.message?.includes('asset_imports')
      ) {
        return null;
      }
      throw error;
    }
  }

  static async deleteImportBatch(
    importId: number,
    deleteAssets: boolean = true
  ): Promise<{ success: boolean; deletedAssetsCount: number; message: string }> {
    const { hasImportId } = await ensureAssetImportsSchema();

    return withTransaction(async (conn) => {
      const [importRows]: any = await conn.execute(
        'SELECT id, filename, original_name FROM asset_imports WHERE id = ?',
        [importId]
      );
      if (!importRows || importRows.length === 0) {
        throw new Error('Import batch record not found');
      }

      let deletedAssetsCount = 0;

      if (hasImportId) {
        const [assetRows]: any = await conn.execute(
          'SELECT id FROM assets WHERE import_id = ?',
          [importId]
        );
        const assetIds: number[] = (assetRows || []).map((r: any) => r.id);

        if (deleteAssets && assetIds.length > 0) {
          for (const assetId of assetIds) {
            await conn.execute('DELETE FROM asset_network WHERE asset_id = ?', [assetId]);
            await conn.execute('DELETE FROM asset_insurance WHERE asset_id = ?', [assetId]);
            await conn.execute('UPDATE tickets SET asset_id = NULL WHERE asset_id = ?', [assetId]);
            await conn.execute('DELETE FROM asset_assignments WHERE asset_id = ?', [assetId]);
            await conn.execute('DELETE FROM asset_history WHERE asset_id = ?', [assetId]);
            await conn.execute('DELETE FROM assets WHERE id = ?', [assetId]);
          }
          deletedAssetsCount = assetIds.length;
        } else if (!deleteAssets && assetIds.length > 0) {
          await conn.execute('UPDATE assets SET import_id = NULL WHERE import_id = ?', [importId]);
        }
      }

      await conn.execute('DELETE FROM asset_imports WHERE id = ?', [importId]);

      return {
        success: true,
        deletedAssetsCount,
        message: deleteAssets
          ? `Imported file and ${deletedAssetsCount} associated asset(s) deleted successfully.`
          : 'Imported file record deleted successfully.',
      };
    });
  }
}


