import { query, execute } from '@/lib/db';
import { Employee, EmployeeDetailed } from '@/types/employee';
import { CreateEmployeeInput, UpdateEmployeeInput } from '@/validations/employee.validation';

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
      const rows = await query<any>('SELECT id FROM employees WHERE employee_id = ? LIMIT 1', [user.employee_id]);
      if (rows.length > 0) return this.getEmployeeById(rows[0].id);
    }
    if (user.email) {
      const rows = await query<any>('SELECT id FROM employees WHERE email = ? LIMIT 1', [user.email]);
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
      conditions.push('(e.name LIKE ? OR e.employee_id LIKE ? OR e.email LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    if (department && department !== 'all') {
      conditions.push('e.department = ?');
      params.push(department);
    }

    if (status && status !== 'all') {
      conditions.push('e.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total FROM employees e WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const employees = await query<Employee>(
      `SELECT 
        e.id,
        e.employee_id,
        e.name,
        e.email,
        e.department,
        e.designation,
        e.location,
        e.workstation,
        e.status,
        (SELECT COUNT(*) FROM asset_assignments aa JOIN assets a ON aa.asset_id = a.id WHERE aa.employee_id = e.id AND aa.status = 'assigned' AND aa.returned_date IS NULL AND a.status = 'assigned') as asset_count,
        e.created_at,
        e.updated_at
       FROM employees e
       WHERE ${whereClause}
       ORDER BY e.name ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { employees, total };
  }

  static async getEmployeeById(id: number): Promise<EmployeeDetailed | null> {
    const rows = await query<Employee>(
      `SELECT 
        e.id,
        e.employee_id,
        e.name,
        e.email,
        e.department,
        e.designation,
        e.location,
        e.workstation,
        e.status,
        e.created_at,
        e.updated_at
       FROM employees e
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

  static async createEmployee(data: CreateEmployeeInput): Promise<Employee> {
    const existing = await query<any>(
      'SELECT id FROM employees WHERE employee_id = ? OR email = ? LIMIT 1',
      [data.employee_id, data.email]
    );

    if (existing.length > 0) {
      throw new Error(`An employee with ID '${data.employee_id}' or Email '${data.email}' already exists.`);
    }

    const { insertId } = await execute(
      `INSERT INTO employees (employee_id, name, email, department, designation, location, workstation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.employee_id,
        data.name,
        data.email,
        data.department,
        data.designation,
        data.location,
        data.workstation || null,
        data.status || 'active',
      ]
    );

    const created = await this.getEmployeeById(insertId);
    return created!;
  }

  static async updateEmployee(id: number, data: UpdateEmployeeInput): Promise<Employee> {
    const existing = await this.getEmployeeById(id);
    if (!existing) {
      throw new Error(`Employee with ID ${id} not found.`);
    }

    if (data.employee_id && data.employee_id !== existing.employee_id) {
      const dup = await query<any>(
        'SELECT id FROM employees WHERE employee_id = ? AND id != ? LIMIT 1',
        [data.employee_id, id]
      );
      if (dup.length > 0) {
        throw new Error(`Employee ID '${data.employee_id}' is already assigned to another employee.`);
      }
    }

    if (data.email && data.email !== existing.email) {
      const dup = await query<any>(
        'SELECT id FROM employees WHERE email = ? AND id != ? LIMIT 1',
        [data.email, id]
      );
      if (dup.length > 0) {
        throw new Error(`Email '${data.email}' is already used by another employee.`);
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.employee_id !== undefined) { updates.push('employee_id = ?'); params.push(data.employee_id); }
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.email !== undefined) { updates.push('email = ?'); params.push(data.email); }
    if (data.department !== undefined) { updates.push('department = ?'); params.push(data.department); }
    if (data.designation !== undefined) { updates.push('designation = ?'); params.push(data.designation); }
    if (data.location !== undefined) { updates.push('location = ?'); params.push(data.location); }
    if (data.workstation !== undefined) { updates.push('workstation = ?'); params.push(data.workstation); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }

    if (updates.length > 0) {
      await execute(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
    }

    const updated = await this.getEmployeeById(id);
    return updated!;
  }

  static async getDepartments(): Promise<string[]> {
    const rows = await query<{ department: string }>(
      'SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department != "" ORDER BY department ASC'
    );
    const defaults = ['Engineering', 'DevOps & Cloud', 'Product Management', 'Design', 'Finance', 'Human Resources', 'Sales & Marketing', 'Operations'];
    const existing = rows.map((r) => r.department);
    return Array.from(new Set([...defaults, ...existing]));
  }

  static async getAllActiveEmployees(): Promise<Array<{ id: number; employee_id: string; name: string; department: string }>> {
    return query(
      `SELECT id, employee_id, name, department 
       FROM employees 
       WHERE status = 'active' 
       ORDER BY name ASC`
    );
  }
}
