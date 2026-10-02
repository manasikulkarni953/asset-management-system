import { query, execute } from '@/lib/db';
import { verifyPassword, hashPassword, AuthUser } from '@/lib/auth';

export class AuthService {
  static async login(identifier: string, password: string): Promise<AuthUser | null> {
    const users = await query<any>(
      `SELECT id, username, email, password_hash, full_name, name, role, designation, employee_id, status 
       FROM users 
       WHERE (username = ? OR email = ?) AND status = 'active' 
       LIMIT 1`,
      [identifier, identifier]
    );

    if (!users || users.length === 0) {
      return null;
    }

    const user = users[0];
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return null;
    }

    const role = (user.role === 'it_admin' ? 'admin' : user.role) as AuthUser['role'];
    const displayName = user.name || user.full_name || user.username;

    // If employee has no employee_id stored, look up matching record by email in employees table
    let resolvedEmployeeId = user.employee_id;
    if (!resolvedEmployeeId && role === 'employee') {
      const empRows = await query<any>('SELECT employee_id FROM employees WHERE email = ? LIMIT 1', [user.email]);
      if (empRows.length > 0) {
        resolvedEmployeeId = empRows[0].employee_id;
      }
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: displayName,
      fullName: displayName,
      role,
      designation: user.designation || null,
      employee_id: resolvedEmployeeId || null,
    };
  }

  static async getUserById(id: number): Promise<AuthUser | null> {
    const users = await query<any>(
      `SELECT id, username, email, full_name, name, role, designation, employee_id, status 
       FROM users 
       WHERE id = ? AND status = 'active' 
       LIMIT 1`,
      [id]
    );

    if (!users || users.length === 0) return null;
    const user = users[0];
    const role = (user.role === 'it_admin' ? 'admin' : user.role) as AuthUser['role'];
    const displayName = user.name || user.full_name || user.username;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: displayName,
      fullName: displayName,
      role,
      designation: user.designation || null,
      employee_id: user.employee_id || null,
    };
  }

  static async ensureDefaultAdmin(): Promise<void> {
    const existing = await query<any>('SELECT id FROM users LIMIT 1');
    if (!existing || existing.length === 0) {
      const defaultHash = await hashPassword('Admin@123');
      await execute(
        `INSERT INTO users (username, email, password_hash, full_name, role, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin', 'admin@enterprise.com', defaultHash, 'System Administrator', 'super_admin', 'active']
      );
    }
  }
}
