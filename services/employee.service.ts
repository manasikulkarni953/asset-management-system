import { query, execute, withTransaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { Employee, EmployeeDetailed } from '@/types/employee';
import { CreateEmployeeInput, UpdateEmployeeInput } from '@/validations/employee.validation';
import {
  getNextEmployeeId,
  getNextAvailableWorkstation,
  isWorkstationAssignedToActiveEmployee,
  normalizeWorkstation,
  isValidWorkstation,
  normalizeEmployeeId,
  isValidEmployeeId,
} from '@/lib/employee-id';

export interface EmployeeFilterOptions {
  search?: string;
  department?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class EmployeeService {
  static async getEmployeeByUser(user: { employee_id?: string | null; email?: string }): Promise<EmployeeDetailed | null> {
    if (user.employee_id) {
      const rows = await query<any>('SELECT id FROM employee WHERE employee_id = ? LIMIT 1', [user.employee_id]);
      if (rows.length > 0) return this.getEmployeeById(rows[0].id);
    }
    if (user.email) {
      const rows = await query<any>('SELECT id FROM employee WHERE email = ? LIMIT 1', [user.email]);
      if (rows.length > 0) return this.getEmployeeById(rows[0].id);
    }
    return null;
  }

  static async getEmployees(
    options: EmployeeFilterOptions = {}
  ): Promise<{ employees: Employee[]; total: number }> {
    const { search, department, status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim() !== '') {
      conditions.push('(e.name LIKE ? OR e.full_name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ? OR e.workstation LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (department && department !== 'all') {
      if (department.toLowerCase() === 'operations') {
        conditions.push('(e.department = ? OR e.department = ? OR e.department = ?)');
        params.push('Operations', 'DBMS', 'Email Marketing');
      } else {
        conditions.push('e.department = ?');
        params.push(department);
      }
    }

    if (status && status !== 'all') {
      conditions.push('e.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total FROM employee e WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const employees = await query<Employee>(
      `SELECT 
        e.id,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_id,
        COALESCE(e.name, e.full_name) as name,
        e.email,
        COALESCE(e.department, 'Operations') as department,
        COALESCE(e.designation, e.job_title, 'Staff') as designation,
        COALESCE(e.location, 'The Space') as location,
        e.workstation,
        COALESCE(e.status, IF(e.is_active = 1, 'active', 'terminated')) as status,
        (SELECT COUNT(*) FROM asset_assignments aa JOIN assets a ON aa.asset_id = a.id WHERE aa.employee_id = e.id AND aa.status = 'assigned' AND aa.returned_date IS NULL AND a.status = 'assigned') as asset_count,
        e.created_at,
        e.updated_at
       FROM employee e
       WHERE ${whereClause}
       ORDER BY CAST(REGEXP_SUBSTR(COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))), '[0-9]+') AS UNSIGNED) ASC, e.id ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { employees, total };
  }

  static async getEmployeeById(id: number): Promise<EmployeeDetailed | null> {
    const rows = await query<Employee>(
      `SELECT 
        e.id,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_id,
        COALESCE(e.name, e.full_name) as name,
        e.email,
        COALESCE(e.department, 'Operations') as department,
        COALESCE(e.designation, e.job_title, 'Staff') as designation,
        COALESCE(e.location, 'The Space') as location,
        e.workstation,
        e.phone_number as phone_number,
        COALESCE(e.status, IF(e.is_active = 1, 'active', 'terminated')) as status,
        e.created_at,
        e.updated_at
       FROM employee e
       WHERE e.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return null;
    const employee = rows[0] as EmployeeDetailed;

    // Current assets strictly derived from active assignment records
    employee.current_assets = await query<any>(
      `SELECT 
        a.id,
        a.asset_id,
        a.asset_number,
        a.category,
        a.brand,
        a.model,
        a.serial_number,
        a.status,
        aa.assigned_date
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.id
       WHERE aa.employee_id = ? 
         AND aa.status = 'assigned' 
         AND aa.returned_date IS NULL
         AND a.status = 'assigned'
       ORDER BY a.category ASC, a.brand ASC, a.model ASC`,
      [id]
    );

    employee.asset_count = employee.current_assets?.length || 0;

    // Full historical assignments (never overwritten)
    employee.assignment_history = await query<any>(
      `SELECT 
        aa.id,
        aa.asset_id,
        a.asset_number,
        a.category,
        a.brand,
        a.model,
        aa.assigned_date,
        aa.returned_date,
        aa.status,
        aa.notes
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.id
       WHERE aa.employee_id = ?
       ORDER BY aa.id DESC`,
      [id]
    );

    // Tickets raised for/by employee
    employee.tickets = await query<any>(
      `SELECT 
        t.id,
        t.ticket_id,
        a.asset_number,
        t.issue_category,
        t.priority,
        t.status,
        t.created_at
       FROM tickets t
       LEFT JOIN assets a ON t.asset_id = a.id
       WHERE t.employee_id = ?
       ORDER BY t.id DESC`,
      [id]
    );

    return employee;
  }

  static async getEmployeeAssets(employeeId: number): Promise<any[]> {
    return query<any>(
      `SELECT 
        a.id,
        a.asset_id,
        a.asset_number,
        a.category,
        a.brand,
        a.model,
        a.serial_number,
        a.status,
        aa.assigned_date
       FROM asset_assignments aa
       JOIN assets a ON aa.asset_id = a.id
       WHERE aa.employee_id = ? 
         AND aa.status = 'assigned' 
         AND aa.returned_date IS NULL
         AND a.status = 'assigned'
       ORDER BY a.category ASC, a.brand ASC, a.model ASC`,
      [employeeId]
    );
  }

  static async getNextAvailableId(): Promise<string> {
    return getNextEmployeeId();
  }

  static async getNextAvailableWorkstation(): Promise<string> {
    return getNextAvailableWorkstation();
  }

  static async createEmployee(data: CreateEmployeeInput): Promise<Employee> {
    const email = data.email.trim().toLowerCase();
    const existing = await query<any>(
      'SELECT id FROM employee WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      throw new Error(`An employee with Email '${data.email}' already exists.`);
    }

    // 1. Employee ID handling:
    let employeeId: string;
    if (data.employee_id && data.employee_id.trim()) {
      employeeId = normalizeEmployeeId(data.employee_id);
      if (!isValidEmployeeId(employeeId)) {
        throw new Error(`Invalid employee ID '${data.employee_id}'. Must be in TGS-XXX format.`);
      }
      const existingId = await query<any>(
        'SELECT id, name FROM employee WHERE employee_id = ? LIMIT 1',
        [employeeId]
      );
      if (existingId.length > 0) {
        throw new Error(`Employee ID '${employeeId}' is already assigned to ${existingId[0].name}.`);
      }
    } else {
      employeeId = await getNextEmployeeId();
    }

    // 2. Location is an independent field, set to 'The Space'
    const location = (data.location && data.location.trim()) ? data.location.trim() : 'The Space';

    // 3. Workstation format: WS-05-XXX (05 = fixed facility/workstation code, XXX = physical seat number)
    let workstation: string;
    if (data.workstation && data.workstation.trim()) {
      const normalized = normalizeWorkstation(data.workstation);
      if (!isValidWorkstation(normalized)) {
        throw new Error(`Invalid workstation format '${data.workstation}'. Expected format is WS-05-XXX (e.g. WS-05-007).`);
      }
      const check = await isWorkstationAssignedToActiveEmployee(normalized);
      if (check.assigned && check.occupant) {
        throw new Error(`Workstation '${normalized}' is already assigned to active employee ${check.occupant.name} (${check.occupant.employee_id}).`);
      }
      workstation = normalized;
    } else {
      workstation = await getNextAvailableWorkstation();
    }

    const { insertId } = await execute(
      `INSERT INTO employee (employee_id, name, full_name, username, email, department, designation, job_title, location, workstation, phone_number, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employeeId,
        data.name.trim(),
        data.name.trim(),
        email.split('@')[0],
        email,
        data.department.trim(),
        data.designation.trim(),
        data.designation.trim(),
        location,
        workstation,
        data.phone_number ? data.phone_number.trim() : null,
        data.status || 'active',
        data.status === 'terminated' ? 0 : 1,
      ]
    );

    // Synchronize to `users` table so user account exists for login & User Management
    try {
      const existingUser = await query<any>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      if (existingUser.length === 0) {
        const defaultPasswordHash = await hashPassword('Employee@123');
        await execute(
          `INSERT INTO users (username, email, password_hash, full_name, name, role, designation, employee_id, status)
           VALUES (?, ?, ?, ?, ?, 'employee', ?, ?, ?)`,
          [
            email.split('@')[0],
            email,
            defaultPasswordHash,
            data.name.trim(),
            data.name.trim(),
            data.designation.trim(),
            employeeId,
            data.status === 'terminated' ? 'inactive' : 'active',
          ]
        );
      } else {
        await execute(
          `UPDATE users SET
             name = ?,
             full_name = ?,
             designation = ?,
             employee_id = ?,
             status = ?
           WHERE id = ?`,
          [
            data.name.trim(),
            data.name.trim(),
            data.designation.trim(),
            employeeId,
            data.status === 'terminated' ? 'inactive' : 'active',
            existingUser[0].id,
          ]
        );
      }
    } catch (userSyncErr: any) {
      console.error('[EMPLOYEE_SERVICE] Error syncing employee to users table:', userSyncErr?.message);
    }

    const created = await this.getEmployeeById(insertId);
    return created!;
  }

  static async updateEmployee(id: number, data: UpdateEmployeeInput): Promise<Employee> {
    const existing = await this.getEmployeeById(id);
    if (!existing) {
      throw new Error(`Employee with ID ${id} not found.`);
    }

    // Employee ID is strictly immutable after creation. Changes to employee_id are ignored.

    if (data.email && data.email.trim().toLowerCase() !== existing.email.toLowerCase()) {
      const dup = await query<any>(
        'SELECT id FROM employee WHERE email = ? AND id != ? LIMIT 1',
        [data.email.trim().toLowerCase(), id]
      );
      if (dup.length > 0) {
        throw new Error(`Email '${data.email}' is already used by another employee.`);
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) { 
      updates.push('name = ?', 'full_name = ?'); 
      params.push(data.name.trim(), data.name.trim()); 
    }
    if (data.email !== undefined) { 
      updates.push('email = ?'); 
      params.push(data.email.trim().toLowerCase()); 
    }
    if (data.department !== undefined) { 
      updates.push('department = ?'); 
      params.push(data.department.trim()); 
    }
    if (data.designation !== undefined) { 
      updates.push('designation = ?', 'job_title = ?'); 
      params.push(data.designation.trim(), data.designation.trim()); 
    }
    if (data.location !== undefined) { 
      updates.push('location = ?'); 
      params.push(data.location.trim() || 'The Space'); 
    }

    if (data.workstation !== undefined) {
      if (data.workstation && data.workstation.trim()) {
        const normalized = normalizeWorkstation(data.workstation);
        if (!isValidWorkstation(normalized)) {
          throw new Error(`Invalid workstation format '${data.workstation}'. Expected format is WS-05-XXX (e.g. WS-05-007).`);
        }
        const check = await isWorkstationAssignedToActiveEmployee(normalized, id);
        if (check.assigned && check.occupant) {
          throw new Error(`Workstation '${normalized}' is already assigned to active employee ${check.occupant.name} (${check.occupant.employee_id}).`);
        }
        updates.push('workstation = ?');
        params.push(normalized);
      } else {
        updates.push('workstation = NULL');
      }
    }

    if (data.phone_number !== undefined) {
      updates.push('phone_number = ?');
      params.push(data.phone_number ? data.phone_number.trim() : null);
    }

    if (data.status !== undefined) { 
      updates.push('status = ?', 'is_active = ?'); 
      params.push(data.status, data.status === 'terminated' ? 0 : 1); 
    }

    if (updates.length > 0) {
      await execute(`UPDATE employee SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
    }

    // Synchronize updates to `users` table
    try {
      const empStatus = (data.status || existing.status) === 'active' ? 'active' : 'inactive';
      await execute(
        `UPDATE users SET
           name = COALESCE(?, name),
           full_name = COALESCE(?, full_name),
           email = COALESCE(?, email),
           designation = COALESCE(?, designation),
           status = ?
         WHERE email = ? OR (employee_id IS NOT NULL AND employee_id = ?)`,
        [
          data.name?.trim() || null,
          data.name?.trim() || null,
          data.email?.trim().toLowerCase() || null,
          data.designation?.trim() || null,
          empStatus,
          existing.email,
          existing.employee_id,
        ]
      );
    } catch (userSyncErr: any) {
      console.error('[EMPLOYEE_SERVICE] Error syncing employee update to users table:', userSyncErr?.message);
    }

    const updated = await this.getEmployeeById(id);
    return updated!;
  }

  static async deleteEmployee(id: number): Promise<{ success: boolean; name: string; employee_id: string }> {
    return await withTransaction(async (conn) => {
      const [empRows]: any = await conn.query('SELECT * FROM employee WHERE id = ?', [id]);
      if (!empRows || empRows.length === 0) {
        throw new Error(`Employee with ID ${id} not found.`);
      }
      const emp = empRows[0];
      const empIdStr = emp.employee_id || `TGS-${String(id).padStart(3, '0')}`;
      const empName = emp.name || emp.full_name || 'Employee';

      // 1. Release currently assigned/held assets back to stock
      await conn.execute(
        "UPDATE assets SET current_employee_id = NULL, status = 'in_stock' WHERE current_employee_id = ?",
        [id]
      );

      // 2. Delete tickets raised by this employee (ticket_history automatically cascades)
      await conn.execute('DELETE FROM tickets WHERE employee_id = ?', [id]);

      // 3. Delete assignment records for this employee
      await conn.execute('DELETE FROM asset_assignments WHERE employee_id = ?', [id]);

      // 4. Delete the employee record permanently
      await conn.execute('DELETE FROM employee WHERE id = ?', [id]);

      // 5. Delete linked user account from users table if one exists
      if (emp.email || emp.employee_id) {
        await conn.execute(
          'DELETE FROM users WHERE (employee_id IS NOT NULL AND employee_id = ?) OR (email IS NOT NULL AND email = ?)',
          [emp.employee_id || '__no_id__', emp.email || '__no_email__']
        );
      }

      return {
        success: true,
        name: empName,
        employee_id: empIdStr,
      };
    });
  }

  static async getDepartments(): Promise<string[]> {
    return [
      'Quality',
      'Development',
      'Operations',
      'DBMS',
      'Email Marketing',
      'Management',
      'Sales',
      'Human Resources',
    ];
  }

  static async getAllActiveEmployees(): Promise<Array<{ id: number; employee_id: string; name: string; department: string }>> {
    return query(
      `SELECT id, COALESCE(employee_id, CONCAT('TGS-', LPAD(id, 3, '0'))) as employee_id, COALESCE(name, full_name) as name, COALESCE(department, 'Operations') as department 
       FROM employee 
       WHERE status = 'active' OR is_active = 1 
       ORDER BY CAST(REGEXP_SUBSTR(COALESCE(employee_id, CONCAT('TGS-', LPAD(id, 3, '0'))), '[0-9]+') AS UNSIGNED) ASC`
    );
  }
}
