import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { NotificationService } from '@/services/notification.service';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Role check: notifications are available for admins, super admins, it admins
    const { notifications, unreadCount } = await NotificationService.getUserNotifications(
      user.id,
      user.role,
      30
    );

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('API /notifications GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, markAll } = body;

    if (markAll) {
      await NotificationService.markAllAsRead(user.id, user.role);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (id) {
      await NotificationService.markAsRead(Number(id), user.id);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ error: 'Invalid payload: provide id or markAll' }, { status: 400 });
  } catch (error: any) {
    console.error('API /notifications POST error:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
