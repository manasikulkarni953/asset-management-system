import { query, execute } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { UserRole } from '@/lib/permissions';

export interface UserRecord {
  id: number;
  username: string;
  name: string;
  full_name: string;
  email: string;
  role: UserRole;
  designation: string | null;
  employee_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ITSpecialistWorkload {
  id: number;
  name: string;
  email: string;
  designation: string;
  role: UserRole;
  status: string;
  total_assigned: number;
  new_tickets: number;
  in_progress_tickets: number;
  waiting_for_user_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
}

export class UserService {
  static async getUsers(options: { search?: string; role?: string; status?: string } = {}): Promise<UserRecord[]> {
    const { search, role, status } = options;
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim()) {
      conditions.push('(u.name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR u.designation LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (role && role !== 'all') {
      conditions.push('u.role = ?');
      params.push(role);
    }

    if (status && status !== 'all') {
      conditions.push('u.status = ?');
      params.push(status);
    }

    const sql = `
      SELECT id, username, COALESCE(name, full_name) as name, full_name, email, role, designation, employee_id, status, created_at, updated_at
      FROM users u
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.id ASC
    `;
    return query<UserRecord>(sql, params);
  }

  static async getUserById(id: number): Promise<UserRecord | null> {
    const rows = await query<UserRecord>(
      `SELECT id, username, COALESCE(name, full_name) as name, full_name, email, role, designation, employee_id, status, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async createUser(data: {
    username?: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
    designation?: string;
    employee_id?: string;
  }): Promise<UserRecord> {
    const email = data.email.trim().toLowerCase();
    const existing = await query<any>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      throw new Error(`Email '${email}' is already registered in the system.`);
    }

    const username = (data.username || email.split('@')[0]).trim().toLowerCase();
    const passwordHash = await hashPassword(data.password);
    const name = data.name.trim();

    const { insertId } = await execute(
      `INSERT INTO users (username, email, password_hash, full_name, name, role, designation, employee_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        username,
        email,
        passwordHash,
        name,
        name,
        data.role,
        data.designation?.trim() || null,
        data.employee_id?.trim() || null,
      ]
    );

    const created = await this.getUserById(insertId);
    return created!;
  }

  static async updateUser(
    id: number,
    data: {
      name?: string;
      email?: string;
      role?: UserRole;
      designation?: string | null;
      employee_id?: string | null;
      status?: 'active' | 'inactive';
      password?: string;
    }
  ): Promise<UserRecord> {
    const existing = await this.getUserById(id);
    if (!existing) {
      throw new Error(`User with ID ${id} not found.`);
    }

    if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
      const email = data.email.trim().toLowerCase();
      const dup = await query<any>('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email, id]);
      if (dup.length > 0) {
        throw new Error(`Email '${email}' is already used by another account.`);
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
    if (data.role !== undefined) {
      updates.push('role = ?');
      params.push(data.role);
    }
    if (data.designation !== undefined) {
      updates.push('designation = ?');
      params.push(data.designation ? data.designation.trim() : null);
    }
    if (data.employee_id !== undefined) {
      updates.push('employee_id = ?');
      params.push(data.employee_id ? data.employee_id.trim() : null);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.password && data.password.trim()) {
      const newHash = await hashPassword(data.password.trim());
      updates.push('password_hash = ?');
      params.push(newHash);
    }

    if (updates.length > 0) {
      await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...params, id]);
    }

    const updated = await this.getUserById(id);
    return updated!;
  }

  // Factual Operational Statistics for IT Specialists (role = admin, designation = IT Specialist)
  static async getITSpecialistWorkload(): Promise<ITSpecialistWorkload[]> {
    const sql = `
      SELECT 
        u.id,
        COALESCE(u.name, u.full_name) as name,
        u.email,
        COALESCE(u.designation, 'IT Specialist') as designation,
        u.role,
        u.status,
        COUNT(t.id) as total_assigned,
        SUM(CASE WHEN t.status = 'new' THEN 1 ELSE 0 END) as new_tickets,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tickets,
        SUM(CASE WHEN t.status = 'waiting_for_user' THEN 1 ELSE 0 END) as waiting_for_user_tickets,
        SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) as resolved_tickets,
        SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) as closed_tickets
      FROM users u
      LEFT JOIN tickets t ON (t.assigned_to = u.id OR t.assigned_to_user_id = u.id)
      WHERE u.role = 'admin' AND u.status = 'active'
      GROUP BY u.id, u.name, u.full_name, u.email, u.designation, u.role, u.status
      ORDER BY total_assigned DESC, u.id ASC
    `;
    return query<ITSpecialistWorkload>(sql);
  }

  // Drilldown into tickets assigned to a specific specialist
  static async getSpecialistTickets(specialistId: number): Promise<any[]> {
    const sql = `
      SELECT 
        t.id,
        t.ticket_id,
        t.issue_category,
        t.issue_description,
        t.priority,
        t.status,
        t.raised_building,
        t.raised_floor,
        t.raised_workstation,
        t.resolution,
        t.created_at,
        t.resolved_at,
        t.closed_at,
        a.asset_number,
        a.asset_id as asset_system_id,
        a.model as asset_model,
        a.category as asset_category,
        e.name as employee_name,
        e.employee_id as employee_code
      FROM tickets t
      LEFT JOIN assets a ON t.asset_id = a.id
      LEFT JOIN employees e ON t.employee_id = e.id
      WHERE t.assigned_to = ? OR t.assigned_to_user_id = ?
      ORDER BY t.created_at DESC
    `;
    return query<any>(sql, [specialistId, specialistId]);
  }
}
