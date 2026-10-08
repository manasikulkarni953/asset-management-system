

import { query, withTransaction } from '@/lib/db';
import { generateNextTicketId } from '@/lib/asset-number';
import { Ticket, TicketDetailed, TicketHistory } from '@/types/ticket';
import { CreateTicketInput, UpdateTicketInput } from '@/validations/ticket.validation';
import { NotificationService } from '@/services/notification.service';

export interface TicketFilterOptions {
  search?: string;
  status?: string;
  priority?: string;
  assetId?: number;
  employeeId?: number;
  assignedTo?: number;
  workstation?: string;
  page?: number;
  limit?: number;
}

export class TicketService {
  static async getTickets(
    options: TicketFilterOptions = {}
  ): Promise<{ tickets: Ticket[]; total: number }> {
    const { search, status, priority, assetId, employeeId, assignedTo, workstation, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim() !== '') {
      conditions.push(
        '(t.ticket_id LIKE ? OR t.issue_category LIKE ? OR t.issue_description LIKE ? OR a.asset_number LIKE ? OR a.asset_id LIKE ? OR a.serial_number LIKE ? OR e.name LIKE ? OR e.employee_id LIKE ? OR t.raised_workstation LIKE ?)'
      );
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    if (status && status !== 'all') {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (priority && priority !== 'all') {
      conditions.push('t.priority = ?');
      params.push(priority);
    }

    if (assetId) {
      conditions.push('t.asset_id = ?');
      params.push(assetId);
    }

    if (employeeId) {
      conditions.push('t.employee_id = ?');
      params.push(employeeId);
    }

    if (assignedTo) {
      conditions.push('t.assigned_to_user_id = ?');
      params.push(assignedTo);
    }

    if (workstation && workstation.trim() !== '') {
      conditions.push('t.raised_workstation LIKE ?');
      params.push(`%${workstation.trim()}%`);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM tickets t
       JOIN assets a ON t.asset_id = a.id
       JOIN employee e ON t.employee_id = e.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const tickets = await query<Ticket>(
      `SELECT 
        t.id,
        t.ticket_id,
        t.asset_id,
        a.asset_number,
        a.asset_id as asset_system_id,
        a.category as asset_category,
        a.brand as asset_brand,
        a.model as asset_model,
        a.serial_number as asset_serial_number,
        t.employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_code,
        t.raised_building,
        t.raised_floor,
        t.raised_workstation,
        t.issue_category,
        t.issue_description,
        t.priority,
        t.status,
        t.assigned_to,
        COALESCE(t.assigned_to, t.assigned_to_user_id) as assigned_to_user_id,
        COALESCE(u.name, u.full_name) as assigned_to_name,
        u.designation as assigned_to_designation,
        t.attachment_url,
        t.resolution,
        t.created_at,
        t.resolved_at,
        t.closed_at,
        t.updated_at
       FROM tickets t
       JOIN assets a ON t.asset_id = a.id
       JOIN employee e ON t.employee_id = e.id
       LEFT JOIN users u ON (t.assigned_to = u.id OR (t.assigned_to IS NULL AND t.assigned_to_user_id = u.id))
       WHERE ${whereClause}
       ORDER BY t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { tickets, total };
  }

  static async getTicketById(id: number): Promise<TicketDetailed | null> {
    const rows = await query<Ticket>(
      `SELECT 
        t.id,
        t.ticket_id,
        t.asset_id,
        a.asset_number,
        a.asset_id as asset_system_id,
        a.category as asset_category,
        a.brand as asset_brand,
        a.model as asset_model,
        a.serial_number as asset_serial_number,
        t.employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_code,
        t.raised_building,
        t.raised_floor,
        t.raised_workstation,
        t.issue_category,
        t.issue_description,
        t.priority,
        t.status,
        t.assigned_to,
        COALESCE(t.assigned_to, t.assigned_to_user_id) as assigned_to_user_id,
        COALESCE(u.name, u.full_name) as assigned_to_name,
        u.designation as assigned_to_designation,
        t.attachment_url,
        t.resolution,
        t.created_at,
        t.resolved_at,
        t.closed_at,
        t.updated_at
       FROM tickets t
       JOIN assets a ON t.asset_id = a.id
       JOIN employee e ON t.employee_id = e.id
       LEFT JOIN users u ON (t.assigned_to = u.id OR (t.assigned_to IS NULL AND t.assigned_to_user_id = u.id))
       WHERE t.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return null;
    const ticket = rows[0] as TicketDetailed;

    ticket.history = await query<TicketHistory>(
      `SELECT 
        th.id,
        th.ticket_id,
        th.old_status,
        th.new_status,
        th.comment,
        th.changed_by_user_id,
        u.full_name as changed_by_name,
        th.created_at
       FROM ticket_history th
       LEFT JOIN users u ON th.changed_by_user_id = u.id
       WHERE th.ticket_id = ?
       ORDER BY th.id DESC`,
      [id]
    );

    return ticket;
  }

  static async createTicket(data: CreateTicketInput, userId?: number): Promise<Ticket> {
    return withTransaction(async (conn) => {
      // 1. Generate unique ticket ID (TKT-2026-00001)
      const ticketId = await generateNextTicketId(conn);

      const building = (data.raised_building || 'The Space').trim();
      const floor = (data.raised_floor || '5th Floor').trim();
      let workstation = data.raised_workstation ? data.raised_workstation.trim() : null;

      // If workstation not explicitly provided, look up the reporting employee's assigned workstation
      if (!workstation && data.employee_id) {
        const [empRows] = await conn.query<any>(
          'SELECT workstation FROM employee WHERE id = ? LIMIT 1',
          [data.employee_id]
        );
        if (empRows && empRows[0]?.workstation) {
          workstation = empRows[0].workstation;
        }
      }

      // 2. Insert into tickets with location
      const [res] = await conn.execute(
        `INSERT INTO tickets (
          ticket_id, asset_id, employee_id, raised_building, raised_floor, raised_workstation,
          issue_category, issue_description, priority, status, attachment_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
        [
          ticketId,
          data.asset_id,
          data.employee_id,
          building,
          floor,
          workstation,
          data.issue_category,
          data.issue_description,
          data.priority || 'medium',
          data.attachment_url || null,
        ]
      );

      const dbId = (res as any).insertId;

      // 3. Insert into ticket_history
      await conn.execute(
        `INSERT INTO ticket_history (ticket_id, old_status, new_status, comment, changed_by_user_id)
         VALUES (?, NULL, 'new', 'Ticket created', ?)`,
        [dbId, userId || null]
      );

      // 4. Update asset history
      await conn.execute(
        `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
         VALUES (?, 'ticket_raised', ?, ?)`,
        [
          data.asset_id,
          `Ticket ${ticketId} raised: ${data.issue_category} (${data.priority || 'medium'} priority)`,
          userId || null,
        ]
      );

      const [newTicket] = await conn.query<any[]>(
        'SELECT * FROM tickets WHERE id = ?',
        [dbId]
      );
      const createdTicket = newTicket[0] as Ticket;

      // Broadcast notification to IT Admin and Super Admin
      try {
        const [empRows] = await conn.query<any[]>(
          'SELECT name, full_name FROM employee WHERE id = ? LIMIT 1',
          [data.employee_id]
        );
        const empName = empRows?.[0]?.name || empRows?.[0]?.full_name || 'Employee';

        const [assetRows] = await conn.query<any[]>(
          'SELECT asset_number, model FROM assets WHERE id = ? LIMIT 1',
          [data.asset_id]
        );
        const assetNumber = assetRows?.[0]?.asset_number || `Asset #${data.asset_id}`;

        await NotificationService.notifyTicketCreated({
          ticketDbId: createdTicket.id,
          ticketId: createdTicket.ticket_id,
          employeeName: empName,
          assetNumber,
          issueCategory: data.issue_category,
          priority: data.priority || 'medium',
        });
      } catch (notifErr) {
        console.error('[TicketService] Non-blocking notification dispatch error:', notifErr);
      }

      return createdTicket;
    });
  }

  static async updateTicket(id: number, data: UpdateTicketInput, userId?: number): Promise<Ticket> {
    const existing = await this.getTicketById(id);
    if (!existing) {
      throw new Error(`Ticket with ID ${id} not found`);
    }

    return withTransaction(async (conn) => {
      const updates: string[] = [];
      const params: any[] = [];

      if (data.status !== undefined && data.status !== existing.status) {
        updates.push('status = ?');
        params.push(data.status);

        if (data.status === 'resolved' && !existing.resolved_at) {
          updates.push('resolved_at = CURRENT_TIMESTAMP');
        }
        if (data.status === 'closed' && !existing.closed_at) {
          updates.push('closed_at = CURRENT_TIMESTAMP');
        }
      }

      if (data.priority !== undefined) {
        updates.push('priority = ?');
        params.push(data.priority);
      }

      const assignedTarget = data.assigned_to !== undefined ? data.assigned_to : data.assigned_to_user_id;
      if (assignedTarget !== undefined) {
        updates.push('assigned_to = ?', 'assigned_to_user_id = ?');
        params.push(assignedTarget, assignedTarget);
      }

      if (data.resolution !== undefined) {
        updates.push('resolution = ?');
        params.push(data.resolution);
      }

      if (data.raised_workstation !== undefined) {
        updates.push('raised_workstation = ?');
        params.push(data.raised_workstation ? data.raised_workstation.trim() : null);
      }

      if (updates.length > 0) {
        await conn.execute(
          `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`,
          [...params, id]
        );
      }

      // If status changed, log in ticket_history and optionally asset_history
      if (data.status && data.status !== existing.status) {
        await conn.execute(
          `INSERT INTO ticket_history (ticket_id, old_status, new_status, comment, changed_by_user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [
            id,
            existing.status,
            data.status,
            data.comment || `Status changed from ${existing.status} to ${data.status}`,
            userId || null,
          ]
        );

        if (data.status === 'resolved') {
          await conn.execute(
            `INSERT INTO asset_history (asset_id, event_type, description, performed_by_user_id)
             VALUES (?, 'ticket_resolved', ?, ?)`,
            [
              existing.asset_id,
              `Ticket ${existing.ticket_id} resolved: ${data.resolution || 'Resolution documented'}`,
              userId || null,
            ]
          );
        }
      } else if (data.comment) {
        // Record comment in ticket history
        await conn.execute(
          `INSERT INTO ticket_history (ticket_id, old_status, new_status, comment, changed_by_user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [id, existing.status, existing.status, data.comment, userId || null]
        );
      }

      const [updatedRows] = await conn.query<any[]>(
        'SELECT * FROM tickets WHERE id = ?',
        [id]
      );
      return updatedRows[0] as Ticket;
    });
  }

  static async getIssueCategories(): Promise<string[]> {
    return [
      'Hardware Failure',
      'Display Issue',
      'Operating System / Software',
      'Network / Connectivity',
      'Power / Battery',
      'Physical Damage',
      'Security / Access',
      'General Maintenance',
      'Upgrade Request',
    ];
  }
}
