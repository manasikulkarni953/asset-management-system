import { NextRequest, NextResponse } from 'next/server';
import { EmployeeService } from '@/services/employee.service';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nextEmployeeId = await EmployeeService.getNextAvailableId();
    const nextWorkstation = await EmployeeService.getNextAvailableWorkstation();

    return NextResponse.json({
      success: true,
      nextEmployeeId,
      nextWorkstation,
      location: 'The Space',
    });
  } catch (error: any) {
    console.error('API /employees/next-id GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve next employee identifiers' }, { status: 500 });
  }
}
