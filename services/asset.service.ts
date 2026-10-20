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

export class AssetService {
  static async getAssets(options: AssetFilterOptions = {}): Promise<{ assets: Asset[]; total: number }> {
    const { search, category, status, employeeId, importId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

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

    if (importId) {
      conditions.push('a.import_id = ?');
      params.push(importId);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM assets a 
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

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
        a.import_id,
        ai.original_name as import_filename,
        a.created_at,
        a.updated_at
       FROM assets a
       LEFT JOIN employee e ON a.current_employee_id = e.id
       LEFT JOIN asset_imports ai ON a.import_id = ai.id
       WHERE ${whereClause}
       ORDER BY a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { assets, total };
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

      // 4. Insert asset with both generated asset_id and asset_number
      const [res] = await conn.execute(
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

    // 1. Create initial asset_imports record
    const insertImportRes = await execute(
      `INSERT INTO asset_imports (
        filename, original_name, file_size, file_content, total_records, 
        success_count, failed_count, status, imported_by_user_id, imported_by_name
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 'processing', ?, ?)`,
      [filename, originalName, fileSize, fileContent || null, rows.length, userId || null, userName || null]
    );

    const importId = (insertImportRes as any).insertId;
    const importedAssets: Asset[] = [];
    const errors: Array<{ row: number; serial?: string; error: string }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Flexible column resolver
      const getVal = (possibleKeys: string[]): string => {
        for (const k of possibleKeys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
          }
          // Case-insensitive match check
          const foundKey = Object.keys(row).find((rk) => rk.toLowerCase().replace(/[\s_-]/g, '') === k.toLowerCase().replace(/[\s_-]/g, ''));
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
            return String(row[foundKey]).trim();
          }
        }
        return '';
      };

      const category = getVal(['category', 'asset_type', 'type']) || 'CPU';
      const brand = getVal(['brand', 'manufacturer', 'make']) || 'Standard';
      const model = getVal(['model', 'model_number', 'device']) || 'Standard Hardware';
      const serialNumber = getVal([
        'serial_number',
        'serialno',
        'serial',
        'sn',
        'serial_no',
        'hardware_serial',
        'serialnumber',
        'servicetag',
        'service_tag',
        'asset_tag',
        'assettag',
        'asset_number',
        'assetnumber',
        'tag',
        'code',
        'device_id',
        'imei',
      ]);
      const effectiveSerial =
        serialNumber ||
        `SN-${category.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.floor(
          1000 + Math.random() * 9000
        )}`;

      const purchaseDate = getVal(['purchase_date', 'purchase', 'date', 'acq_date']) || todayStr;
      const rawCost = getVal(['purchase_cost', 'cost', 'price', 'amount']);
      const purchaseCost = parseFloat(rawCost.replace(/[^0-9.]/g, '')) || 0;
      const vendor = getVal(['vendor', 'supplier', 'seller']) || 'Direct Supplier';
      const vendorPhone = getVal(['vendor_phone', 'phone', 'contact_number']) || null;
      const vendorEmail = getVal(['vendor_email', 'email', 'supplier_email']) || null;
      const location = getVal(['location', 'site', 'room', 'floor', 'office']) || 'The Space';
      const warrantyExpiry = getVal(['warranty_expiry', 'warranty', 'warranty_date']) || null;
      const statusRaw = getVal(['status', 'asset_status']).toLowerCase();

      let status: 'in_stock' | 'assigned' | 'under_maintenance' | 'retired' = 'in_stock';
      if (['assigned', 'in_use', 'active'].includes(statusRaw)) status = 'assigned';
      else if (['maintenance', 'under_maintenance', 'repair'].includes(statusRaw)) status = 'under_maintenance';
      else if (['retired', 'disposed'].includes(statusRaw)) status = 'retired';

      try {
        const created = await this.createAsset(
          {
            category,
            brand,
            model,
            serial_number: effectiveSerial,
            purchase_date: purchaseDate,
            purchase_cost: purchaseCost,
            vendor,
            vendor_phone: vendorPhone,
            vendor_email: vendorEmail,
            location,
            warranty_expiry: warrantyExpiry,
            status,
          },
          userId,
          importId
        );
        importedAssets.push(created);
      } catch (err: any) {
        errors.push({
          row: rowNum,
          serial: effectiveSerial,
          error: err?.message || 'Failed to create asset record.',
        });
      }
    }

    const successCount = importedAssets.length;
    const failedCount = errors.length;
    const finalStatus = failedCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'failed');

    // 3. Update asset_imports record
    await execute(
      `UPDATE asset_imports 
       SET total_records = ?, 
           success_count = ?, 
           failed_count = ?, 
           status = ?, 
           error_log = ? 
       WHERE id = ?`,
      [rows.length, successCount, failedCount, finalStatus, errors.length > 0 ? JSON.stringify(errors) : null, importId]
    );

    return {
      importId,
      totalRecords: rows.length,
      successCount,
      failedCount,
      errors,
      importedAssets,
    };
  }

  static async getImportHistory(): Promise<any[]> {
    return query(
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
  }

  static async getImportById(id: number): Promise<any | null> {
    const rows = await query<any>(
      `SELECT * FROM asset_imports WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows && rows.length > 0 ? rows[0] : null;
  }

  static async deleteImportBatch(
    importId: number,
    deleteAssets: boolean = true
  ): Promise<{ success: boolean; deletedAssetsCount: number; message: string }> {
    return withTransaction(async (conn) => {
      const [importRows]: any = await conn.execute(
        'SELECT id, filename, original_name FROM asset_imports WHERE id = ?',
        [importId]
      );
      if (!importRows || importRows.length === 0) {
        throw new Error('Import batch record not found');
      }

      const [assetRows]: any = await conn.execute(
        'SELECT id FROM assets WHERE import_id = ?',
        [importId]
      );
      const assetIds: number[] = (assetRows || []).map((r: any) => r.id);

      let deletedAssetsCount = 0;

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


