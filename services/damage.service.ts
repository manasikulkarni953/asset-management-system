import { query, execute } from '@/lib/db';
import { DamagedAsset, DamageSeverity, DamageRepairStatus } from '@/types/asset';

export interface DamageFilterOptions {
  search?: string;
  severity?: string;
  repairStatus?: string;
  employeeId?: number;
  page?: number;
  limit?: number;
}

export interface DamageStats {
  totalDamaged: number;
  underInvestigation: number;
  inRepair: number;
  repaired: number;
  writtenOff: number;
  totalEstimatedCost: number;
}

export interface CreateDamagedAssetInput {
  asset_id: number;
  employee_id?: number | null;
  ticket_id?: number | null;
  damage_type: string;
  severity: DamageSeverity;
  incident_date: string;
  description: string;
  repair_status?: DamageRepairStatus;
  repair_cost_estimate?: number;
  actual_repair_cost?: number;
  insurance_claimed?: boolean;
  resolution_notes?: string;
}

export interface UpdateDamagedAssetInput {
  damage_type?: string;
  severity?: DamageSeverity;
  incident_date?: string;
  description?: string;
  repair_status?: DamageRepairStatus;
  repair_cost_estimate?: number;
  actual_repair_cost?: number;
  insurance_claimed?: boolean;
  resolution_notes?: string;
}

export class DamageService {
  static async getDamageStats(employeeId?: number): Promise<DamageStats> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (employeeId) {
      conditions.push('(da.employee_id = ? OR a.current_employee_id = ?)');
      params.push(employeeId, employeeId);
    }

    const whereClause = conditions.join(' AND ');

    const rows = await query<any>(
      `SELECT 
        COUNT(*) as totalDamaged,
        SUM(CASE WHEN da.repair_status = 'under_investigation' OR da.repair_status = 'reported' THEN 1 ELSE 0 END) as underInvestigation,
        SUM(CASE WHEN da.repair_status = 'sent_for_repair' THEN 1 ELSE 0 END) as inRepair,
        SUM(CASE WHEN da.repair_status = 'repaired' THEN 1 ELSE 0 END) as repaired,
        SUM(CASE WHEN da.repair_status = 'written_off' THEN 1 ELSE 0 END) as writtenOff,
        COALESCE(SUM(da.repair_cost_estimate), 0) as totalEstimatedCost
       FROM damaged_assets da
       JOIN assets a ON da.asset_id = a.id
       WHERE ${whereClause}`,
      params
    );

    const r = rows[0] || {};
    return {
      totalDamaged: Number(r.totalDamaged) || 0,
      underInvestigation: Number(r.underInvestigation) || 0,
      inRepair: Number(r.inRepair) || 0,
      repaired: Number(r.repaired) || 0,
      writtenOff: Number(r.writtenOff) || 0,
      totalEstimatedCost: Number(r.totalEstimatedCost) || 0,
    };
  }

  static async getDamagedAssets(
    options: DamageFilterOptions = {}
  ): Promise<{ damagedAssets: DamagedAsset[]; total: number; stats: DamageStats }> {
    const { search, severity, repairStatus, employeeId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (employeeId) {
      conditions.push('(da.employee_id = ? OR a.current_employee_id = ?)');
      params.push(employeeId, employeeId);
    }

    if (search && search.trim() !== '') {
      conditions.push(
        '(a.asset_number LIKE ? OR a.asset_id LIKE ? OR a.brand LIKE ? OR a.model LIKE ? OR da.damage_type LIKE ? OR da.description LIKE ? OR e.name LIKE ?)'
      );
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    if (severity && severity !== 'all') {
      conditions.push('da.severity = ?');
      params.push(severity);
    }

    if (repairStatus && repairStatus !== 'all') {
      conditions.push('da.repair_status = ?');
      params.push(repairStatus);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM damaged_assets da
       JOIN assets a ON da.asset_id = a.id
       LEFT JOIN employee e ON COALESCE(da.employee_id, a.current_employee_id) = e.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const damagedAssets = await query<DamagedAsset>(
      `SELECT 
        da.id,
        da.asset_id,
        a.asset_number,
        a.asset_id as asset_system_id,
        a.category,
        a.brand,
        a.model,
        a.serial_number,
        COALESCE(da.employee_id, a.current_employee_id) as employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_code,
        e.department as employee_department,
        e.workstation as employee_workstation,
        da.ticket_id,
        t.ticket_id as ticket_code,
        da.damage_type,
        da.severity,
        DATE_FORMAT(da.incident_date, '%Y-%m-%d') as incident_date,
        da.reported_date,
        da.description,
        da.repair_status,
        da.repair_cost_estimate,
        da.actual_repair_cost,
        da.insurance_claimed,
        da.resolution_notes,
        da.created_at,
        da.updated_at
      FROM damaged_assets da
      JOIN assets a ON da.asset_id = a.id
      LEFT JOIN employee e ON COALESCE(da.employee_id, a.current_employee_id) = e.id
      LEFT JOIN tickets t ON da.ticket_id = t.id
      WHERE ${whereClause}
      ORDER BY da.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const stats = await this.getDamageStats(employeeId);

    return {
      damagedAssets,
      total,
      stats,
    };
  }

  static async getDamagedAssetById(id: number): Promise<DamagedAsset | null> {
    const rows = await query<DamagedAsset>(
      `SELECT 
        da.id,
        da.asset_id,
        a.asset_number,
        a.asset_id as asset_system_id,
        a.category,
        a.brand,
        a.model,
        a.serial_number,
        COALESCE(da.employee_id, a.current_employee_id) as employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_code,
        e.department as employee_department,
        e.workstation as employee_workstation,
        da.ticket_id,
        t.ticket_id as ticket_code,
        da.damage_type,
        da.severity,
        DATE_FORMAT(da.incident_date, '%Y-%m-%d') as incident_date,
        da.reported_date,
        da.description,
        da.repair_status,
        da.repair_cost_estimate,
        da.actual_repair_cost,
        da.insurance_claimed,
        da.resolution_notes,
        da.created_at,
        da.updated_at
      FROM damaged_assets da
      JOIN assets a ON da.asset_id = a.id
      LEFT JOIN employee e ON COALESCE(da.employee_id, a.current_employee_id) = e.id
      LEFT JOIN tickets t ON da.ticket_id = t.id
      WHERE da.id = ?`,
      [id]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  static async createDamagedAsset(
    input: CreateDamagedAssetInput,
    userId?: number
  ): Promise<DamagedAsset> {
    const res = await execute(
      `INSERT INTO damaged_assets (
        asset_id,
        employee_id,
        ticket_id,
        damage_type,
        severity,
        incident_date,
        description,
        repair_status,
        repair_cost_estimate,
        actual_repair_cost,
        insurance_claimed,
        resolution_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.asset_id,
        input.employee_id || null,
        input.ticket_id || null,
        input.damage_type,
        input.severity || 'moderate',
        input.incident_date,
        input.description,
        input.repair_status || 'reported',
        input.repair_cost_estimate || 0.0,
        input.actual_repair_cost || 0.0,
        input.insurance_claimed ? 1 : 0,
        input.resolution_notes || null,
      ]
    );

    const insertedId = res.insertId;

    // Log to asset_history
    try {
      await execute(
        `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id, metadata)
         VALUES (?, 'maintenance', ?, ?, ?)`,
        [
          input.asset_id,
          `Damage Incident Logged: ${input.damage_type} (${input.severity} severity)`,
          userId || null,
          JSON.stringify({
            damaged_asset_id: insertedId,
            damage_type: input.damage_type,
            severity: input.severity,
            repair_status: input.repair_status || 'reported',
          }),
        ]
      );
    } catch (e) {
      console.warn('Could not record asset_history for damage incident:', e);
    }

    const record = await this.getDamagedAssetById(insertedId);
    if (!record) throw new Error('Failed to retrieve newly created damage record');
    return record;
  }

  static async updateDamagedAsset(
    id: number,
    input: UpdateDamagedAssetInput,
    userId?: number
  ): Promise<DamagedAsset> {
    const existing = await this.getDamagedAssetById(id);
    if (!existing) throw new Error('Damaged asset record not found');

    const fields: string[] = [];
    const params: any[] = [];

    if (input.damage_type !== undefined) {
      fields.push('damage_type = ?');
      params.push(input.damage_type);
    }
    if (input.severity !== undefined) {
      fields.push('severity = ?');
      params.push(input.severity);
    }
    if (input.incident_date !== undefined) {
      fields.push('incident_date = ?');
      params.push(input.incident_date);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      params.push(input.description);
    }
    if (input.repair_status !== undefined) {
      fields.push('repair_status = ?');
      params.push(input.repair_status);
    }
    if (input.repair_cost_estimate !== undefined) {
      fields.push('repair_cost_estimate = ?');
      params.push(input.repair_cost_estimate);
    }
    if (input.actual_repair_cost !== undefined) {
      fields.push('actual_repair_cost = ?');
      params.push(input.actual_repair_cost);
    }
    if (input.insurance_claimed !== undefined) {
      fields.push('insurance_claimed = ?');
      params.push(input.insurance_claimed ? 1 : 0);
    }
    if (input.resolution_notes !== undefined) {
      fields.push('resolution_notes = ?');
      params.push(input.resolution_notes);
    }

    if (fields.length > 0) {
      params.push(id);
      await execute(`UPDATE damaged_assets SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    // Log history if status changed
    if (input.repair_status && input.repair_status !== existing.repair_status) {
      try {
        await execute(
          `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id, metadata)
           VALUES (?, 'maintenance', ?, ?, ?)`,
          [
            existing.asset_id,
            `Damaged Asset Status updated from ${existing.repair_status} to ${input.repair_status}`,
            userId || null,
            JSON.stringify({ damaged_asset_id: id, new_status: input.repair_status }),
          ]
        );
      } catch (e) {
        console.warn('Failed to insert history for damage update:', e);
      }
    }

    const updated = await this.getDamagedAssetById(id);
    if (!updated) throw new Error('Failed to retrieve updated damage record');
    return updated;
  }

  static async deleteDamagedAsset(id: number): Promise<boolean> {
    const res = await execute('DELETE FROM damaged_assets WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }
}
