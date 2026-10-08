import { query, execute } from '@/lib/db';

export interface NotificationItem {
  id: number;
  user_id: number | null;
  role: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  ticket_id: string | null;
  is_read: number;
  created_at: string;
}

export class NotificationService {
  /**
   * Broadcasts a notification to all active Super Admins and IT Admins/Managers
   */
  static async notifyTicketCreated(params: {
    ticketDbId: number;
    ticketId: string;
    employeeName: string;
    assetNumber: string;
    issueCategory: string;
    priority: string;
  }): Promise<void> {
    try {
      const { ticketDbId, ticketId, employeeName, assetNumber, issueCategory, priority } = params;

      // Find all active IT Admins, Admins, and Super Admins
      const adminUsers = await query<{ id: number; role: string }>(
        `SELECT id, role FROM users 
         WHERE role IN ('super_admin', 'admin', 'it_admin') 
           AND status = 'active'`
      );

      const title = `New Ticket: ${ticketId}`;
      const message = `${employeeName || 'An employee'} raised a ${priority} priority ticket for ${assetNumber || 'an assigned asset'} (${issueCategory}).`;
      const link = `/tickets/${ticketDbId}`;

      for (const admin of adminUsers) {
        await execute(
          `INSERT INTO notifications (user_id, role, type, title, message, link, ticket_id, is_read)
           VALUES (?, ?, 'ticket_created', ?, ?, ?, ?, 0)`,
          [admin.id, admin.role, title, message, link, ticketId]
        );
      }
    } catch (error) {
      console.error('[NotificationService] Error creating ticket notifications:', error);
      // Non-blocking: ticket creation still succeeds even if notification fails
    }
  }

  /**
   * Fetch recent notifications and unread count for the given user
   */
  static async getUserNotifications(userId: number, role: string, limit = 20): Promise<{
    notifications: NotificationItem[];
    unreadCount: number;
  }> {
    try {
      const notifications = await query<NotificationItem>(
        `SELECT id, user_id, role, type, title, message, link, ticket_id, is_read, created_at
         FROM notifications
         WHERE user_id = ? OR (user_id IS NULL AND (role = ? OR role = 'all'))
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, role, limit]
      );

      const unreadRows = await query<{ count: number }>(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE (user_id = ? OR (user_id IS NULL AND (role = ? OR role = 'all')))
           AND is_read = 0`,
        [userId, role]
      );

      const unreadCount = unreadRows[0]?.count || 0;

      return {
        notifications,
        unreadCount,
      };
    } catch (error) {
      console.error('[NotificationService] Error fetching notifications:', error);
      return { notifications: [], unreadCount: 0 };
    }
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId: number, userId: number): Promise<void> {
    try {
      await execute(
        `UPDATE notifications 
         SET is_read = 1 
         WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
        [notificationId, userId]
      );
    } catch (error) {
      console.error('[NotificationService] Error marking notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: number, role: string): Promise<void> {
    try {
      await execute(
        `UPDATE notifications 
         SET is_read = 1 
         WHERE (user_id = ? OR (user_id IS NULL AND (role = ? OR role = 'all')))
           AND is_read = 0`,
        [userId, role]
      );
    } catch (error) {
      console.error('[NotificationService] Error marking all notifications as read:', error);
    }
  }
}
