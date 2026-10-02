import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';
import { UserService } from '@/services/user.service';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canViewITPerformance(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Super Administrator privileges required to access IT Specialist performance analytics.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const specialistId = searchParams.get('specialistId');

    if (specialistId) {
      const id = Number(specialistId);
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid specialist ID' }, { status: 400 });
      }
      const tickets = await UserService.getSpecialistTickets(id);
      const specialist = await UserService.getUserById(id);
      return NextResponse.json({ success: true, specialist, tickets });
    }

    const specialists = await UserService.getITSpecialistWorkload();
    return NextResponse.json({ success: true, specialists });
  } catch (error: any) {
    console.error('API /admin/it-specialists GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve IT specialist analytics' }, { status: 500 });
  }
}
