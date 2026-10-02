import { query, withTransaction } from '@/lib/db';
import { AssetAssignment } from '@/types/assignment';
import { AssignAssetInput, TransferAssetInput, ReturnAssetInput } from '@/validations/assignment.validation';

export interface AssignmentFilterOptions {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class AssignmentService {
  static async getAssignments(
    options: AssignmentFilterOptions = {}
  ): Promise<{ assignments: AssetAssignment[]; total: number }> {
    const { search, status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim() !== '') {
      conditions.push(
        '(a.asset_number LIKE ? OR a.model LIKE ? OR e.name LIKE ? OR e.employee_id LIKE ?)'
      );
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (status && status !== 'all') {
      conditions.push('aa.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.id
       JOIN employees e ON aa.employee_id = e.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const assignments = await query<AssetAssignment>(
      `SELECT 
        aa.id,
        aa.asset_id,
        a.asset_number,
        a.category as asset_category,
        a.brand as asset_brand,
        a.model as asset_model,
        aa.employee_id,
        e.name as employee_name,
        e.employee_id as employee_code,
        e.department as employee_department,
        aa.assigned_date,
        aa.returned_date,
        aa.status,
        aa.notes,
        aa.assigned_by_user_id,
        u.full_name as assigned_by_name,
        aa.created_at
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.id
       JOIN employees e ON aa.employee_id = e.id
       LEFT JOIN users u ON aa.assigned_by_user_id = u.id
       WHERE ${whereClause}
       ORDER BY aa.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { assignments, total };
  }

  static async assignAssets(
    employeeId: number,
    assetIds: number[],
    notes?: string | null,
    userId?: number
  ): Promise<{ count: number; assets: string[]; employeeName: string }> {
    if (!assetIds || assetIds.length === 0) {
      throw new Error('At least one asset must be selected for assignment.');
    }

    const uniqueAssetIds = Array.from(new Set(assetIds));
    if (uniqueAssetIds.length !== assetIds.length) {
      throw new Error('Duplicate asset IDs are not permitted in a single assignment operation.');
    }

    return withTransaction(async (conn) => {
      // 1. Check employee with row locking
      const [empRows] = await conn.query<any[]>(
        'SELECT id, name, employee_id, status FROM employees WHERE id = ? FOR UPDATE',
        [employeeId]
      );
      if (empRows.length === 0) {
        throw new Error('Employee not found.');
      }
      const employee = empRows[0];
      if (employee.status === 'terminated') {
        throw new Error(`Cannot assign assets to terminated employee: ${employee.name} (${employee.employee_id}).`);
      }

      // 2. Validate all requested assets with row-level locking
      const placeholders = uniqueAssetIds.map(() => '?').join(', ');
      const [assetRows] = await conn.query<any[]>(
        `SELECT id, asset_id, asset_number, status, current_employee_id 
         FROM assets 
         WHERE id IN (${placeholders}) 
         FOR UPDATE`,
        uniqueAssetIds
      );

      if (assetRows.length !== uniqueAssetIds.length) {
        const foundIds = new Set(assetRows.map((a) => a.id));
        const missing = uniqueAssetIds.filter((id) => !foundIds.has(id));
        throw new Error(`One or more selected assets were not found in the database (ID: ${missing.join(', ')}).`);
      }

      // Check eligibility of EVERY asset - entire transaction rolls back on any violation
      for (const asset of assetRows) {
        if (asset.status === 'assigned' && asset.current_employee_id) {
          throw new Error(
            `Assignment failed because asset ${asset.asset_number} is already assigned to another employee. Please review selected assets and try again.`
          );
        }
        if (asset.status === 'retired') {
          throw new Error(
            `Assignment failed because asset ${asset.asset_number} is retired/decommissioned.`
          );
        }
        if (asset.status === 'under_maintenance') {
          throw new Error(
            `Assignment failed because asset ${asset.asset_number} is currently under maintenance.`
          );
        }
      }

      // 3. Process every asset in the atomic transaction
      const assignedAssetNumbers: string[] = [];

      for (const asset of assetRows) {
        // Update asset table
        await conn.execute(
          `UPDATE assets SET status = 'assigned', current_employee_id = ? WHERE id = ?`,
          [employeeId, asset.id]
        );

        // Create assignment record
        await conn.execute(
          `INSERT INTO asset_assignments (asset_id, employee_id, status, notes, assigned_by_user_id)
           VALUES (?, ?, 'assigned', ?, ?)`,
          [asset.id, employeeId, notes || null, userId || null]
        );

        // Create asset history entry
        await conn.execute(
          `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
           VALUES (?, 'assigned', ?, ?)`,
          [
            asset.id,
            `Assigned to ${employee.name} (${employee.employee_id})`,
            userId || null,
          ]
        );

        assignedAssetNumbers.push(asset.asset_number);
      }

      return {
        count: assignedAssetNumbers.length,
        assets: assignedAssetNumbers,
        employeeName: `${employee.name} (${employee.employee_id})`,
      };
    });
  }

  static async assignAsset(data: AssignAssetInput, userId?: number): Promise<{ count: number; assets: string[]; employeeName: string }> {
    const employeeId = Number(data.employeeId || data.employee_id);
    const assetIds = data.assetIds || data.asset_ids || (data.asset_id ? [Number(data.asset_id)] : []);
    const notes = data.remarks || data.notes || data.condition || null;
    return this.assignAssets(employeeId, assetIds, notes, userId);
  }

  static async transferAsset(data: TransferAssetInput, userId?: number): Promise<void> {
    await withTransaction(async (conn) => {
      // 1. Check asset
      const [assetRows] = await conn.query<any[]>(
        'SELECT id, asset_number, current_employee_id FROM assets WHERE id = ?',
        [data.asset_id]
      );
      if (assetRows.length === 0) throw new Error('Asset not found');
      const asset = assetRows[0];

      if (!asset.current_employee_id) {
        throw new Error(`Asset ${asset.asset_number} is not currently assigned. Use Assign instead.`);
      }

      if (asset.current_employee_id === data.to_employee_id) {
        throw new Error('Cannot transfer asset to the same employee who currently has it.');
      }

      // 2. Fetch old employee name
      const [oldEmpRows] = await conn.query<any[]>(
        'SELECT id, name, employee_id FROM employees WHERE id = ?',
        [asset.current_employee_id]
      );
      const oldEmpName = oldEmpRows[0]?.name || 'Previous Employee';

      // 3. Fetch new employee name
      const [newEmpRows] = await conn.query<any[]>(
        'SELECT id, name, employee_id, status FROM employees WHERE id = ?',
        [data.to_employee_id]
      );
      if (newEmpRows.length === 0) throw new Error('Target employee not found');
      const newEmp = newEmpRows[0];
      if (newEmp.status === 'terminated') {
        throw new Error('Cannot transfer asset to a terminated employee');
      }

      // 4. Mark existing active assignment as transferred (historical preservation)
      await conn.execute(
        `UPDATE asset_assignments 
         SET status = 'transferred', returned_date = CURRENT_TIMESTAMP, 
             notes = CONCAT(IFNULL(notes, ''), ' [Transferred to: ', ?, ']')
         WHERE asset_id = ? AND status = 'assigned'`,
        [`${newEmp.name} (${newEmp.employee_id})`, data.asset_id]
      );

      // 5. Create new assignment
      await conn.execute(
        `INSERT INTO asset_assignments (asset_id, employee_id, status, notes, assigned_by_user_id)
         VALUES (?, ?, 'assigned', ?, ?)`,
        [
          data.asset_id,
          data.to_employee_id,
          data.notes ? `Transferred from ${oldEmpName}: ${data.notes}` : `Transferred from ${oldEmpName}`,
          userId || null,
        ]
      );

      // 6. Update asset table
      await conn.execute(
        `UPDATE assets SET current_employee_id = ?, status = 'assigned' WHERE id = ?`,
        [data.to_employee_id, data.asset_id]
      );

      // 7. Add asset history
      await conn.execute(
        `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
         VALUES (?, 'transferred', ?, ?)`,
        [
          data.asset_id,
          `Transferred from ${oldEmpName} to ${newEmp.name} (${newEmp.employee_id})`,
          userId || null,
        ]
      );
    });
  }

  static async returnAsset(data: ReturnAssetInput, userId?: number): Promise<void> {
    await withTransaction(async (conn) => {
      // 1. Check asset
      const [assetRows] = await conn.query<any[]>(
        'SELECT id, asset_number, current_employee_id FROM assets WHERE id = ?',
        [data.asset_id]
      );
      if (assetRows.length === 0) throw new Error('Asset not found');
      const asset = assetRows[0];

      if (!asset.current_employee_id) {
        throw new Error(`Asset ${asset.asset_number} is not currently assigned.`);
      }

      // 2. Fetch employee details
      const [empRows] = await conn.query<any[]>(
        'SELECT id, name, employee_id FROM employees WHERE id = ?',
        [asset.current_employee_id]
      );
      const empName = empRows[0]?.name || 'Employee';

      // 3. Mark current assignment as returned
      const noteVal = data.notes || null;
      await conn.execute(
        `UPDATE asset_assignments 
         SET status = 'returned', returned_date = CURRENT_TIMESTAMP, 
             notes = IF(? IS NOT NULL AND ? != '', CONCAT(IFNULL(notes, ''), ' [Return Note: ', ?, ']'), notes)
         WHERE asset_id = ? AND status = 'assigned'`,
        [noteVal, noteVal, noteVal, data.asset_id] as any
      );

      // 4. Update asset table
      await conn.execute(
        `UPDATE assets SET current_employee_id = NULL, status = 'in_stock' WHERE id = ?`,
        [data.asset_id]
      );

      // 5. Add asset history entry
      await conn.execute(
        `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
         VALUES (?, 'returned', ?, ?)`,
        [
          data.asset_id,
          `Returned from ${empName} to inventory stock. ${data.notes ? `Note: ${data.notes}` : ''}`,
          userId || null,
        ]
      );
    });
  }

  static async getAvailableAssets(): Promise<Array<{ id: number; asset_id: string; asset_number: string; category: string; brand: string; model: string; serial_number: string; status: string }>> {
    return query(
      `SELECT id, asset_id, asset_number, category, brand, model, serial_number, status
       FROM assets 
       WHERE status = 'in_stock' AND current_employee_id IS NULL
       ORDER BY category ASC, asset_number ASC`
    );
  }

  static async getAssignedAssets(): Promise<Array<{ id: number; asset_number: string; model: string; employee_name: string; current_employee_id: number }>> {
    return query(
      `SELECT a.id, a.asset_number, a.model, e.name as employee_name, a.current_employee_id 
       FROM assets a
       JOIN employees e ON a.current_employee_id = e.id
       WHERE a.status = 'assigned'
       ORDER BY a.asset_number ASC`
    );
  }
}
