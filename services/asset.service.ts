import { query, execute, withTransaction } from '@/lib/db';
import { generateNextAssetNumber, generateNextAssetId } from '@/lib/asset-number';
import { Asset, AssetDetailed, AssetHistory } from '@/types/asset';
import { CreateAssetInput, UpdateAssetInput } from '@/validations/asset.validation';

export interface AssetFilterOptions {
  search?: string;
  category?: string;
  status?: string;
  employeeId?: number;
  page?: number;
  limit?: number;
}

export class AssetService {
  static async getAssets(options: AssetFilterOptions = {}): Promise<{ assets: Asset[]; total: number }> {
    const { search, category, status, employeeId, page = 1, limit = 20 } = options;
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

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM assets a 
       LEFT JOIN employees e ON a.current_employee_id = e.id
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
        a.warranty_expiry,
        a.status,
        a.current_employee_id,
        e.name as current_employee_name,
        e.employee_id as current_employee_code,
        a.created_at,
        a.updated_at
       FROM assets a
       LEFT JOIN employees e ON a.current_employee_id = e.id
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
        a.warranty_expiry,
        a.status,
        a.current_employee_id,
        e.name as current_employee_name,
        e.employee_id as current_employee_code,
        a.created_at,
        a.updated_at
       FROM assets a
       LEFT JOIN employees e ON a.current_employee_id = e.id
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

    // Fetch network
    const networkRows = await query<any>(
      `SELECT * FROM asset_network WHERE asset_id = ? LIMIT 1`,
      [id]
    );
    asset.network = networkRows[0] || null;

    // Fetch history
    asset.history = await this.getAssetHistory(id);

    // Fetch assignment history
    asset.assignments = await query<any>(
      `SELECT 
        aa.id,
        aa.asset_id,
        aa.employee_id,
        e.name as employee_name,
        e.employee_id as employee_code,
        e.department as employee_department,
        aa.assigned_date,
        aa.returned_date,
        aa.status,
        aa.notes,
        u.full_name as assigned_by_name
       FROM asset_assignments aa
       JOIN employees e ON aa.employee_id = e.id
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
        e.name as employee_name
       FROM tickets t
       JOIN employees e ON t.employee_id = e.id
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

  static async createAsset(data: CreateAssetInput, userId?: number): Promise<Asset> {
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
          purchase_date, purchase_cost, vendor, warranty_expiry, 
          status, current_employee_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          data.warranty_expiry || null,
          initialStatus,
          data.current_employee_id || null,
        ]
      );

      const internalId = (res as any).insertId;

      // 5. Record creation in history (references assets.id)
      await conn.execute(
        `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
         VALUES (?, 'created', ?, ?)`,
        [internalId, `Asset registered with ID ${assetId} and number ${assetNumber}`, userId || null]
      );

      // 6. If assigned initially, create assignment record and history
      if (data.current_employee_id) {
        await conn.execute(
          `INSERT INTO asset_assignments (asset_id, employee_id, status, notes, assigned_by_user_id)
           VALUES (?, ?, 'assigned', 'Initial assignment during asset registration', ?)`,
          [internalId, data.current_employee_id, userId || null]
        );

        const [empRows] = await conn.query<any[]>(
          'SELECT name, employee_id FROM employees WHERE id = ?',
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
    const defaults = ['Laptop', 'Desktop', 'Monitor', 'Server', 'Mobile', 'Tablet', 'Printer', 'Networking'];
    const existing = rows.map((r) => r.category);
    return Array.from(new Set([...defaults, ...existing]));
  }
}


