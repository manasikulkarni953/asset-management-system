import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    if (!Permissions.canManageTickets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const specialists = await query<any>(
      `SELECT 
        id, 
        COALESCE(name, full_name) as name, 
        email, 
        COALESCE(designation, 'IT Specialist') as designation 
       FROM users 
       WHERE role = 'admin' AND status = 'active'
       ORDER BY name ASC`
    );

    return NextResponse.json({ success: true, specialists });
  } catch (error: any) {
    console.error('Error fetching specialists:', error);
    return NextResponse.json({ error: 'Failed to fetch specialists' }, { status: 500 });
  }
}
