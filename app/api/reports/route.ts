import { NextRequest, NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    if (!Permissions.canViewReports(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to view reports' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'dashboard';

    if (type === 'dashboard') {
      const metrics = await ReportService.getDashboardMetrics();
      return NextResponse.json({ success: true, metrics });
    }

    if (type === 'assets') {
      const category = searchParams.get('category') || undefined;
      const status = searchParams.get('status') || undefined;
      const data = await ReportService.getAssetReport({ category, status });
      return NextResponse.json({ success: true, data });
    }

    if (type === 'employees') {
      const department = searchParams.get('department') || undefined;
      const data = await ReportService.getEmployeeAssetReport({ department });
      return NextResponse.json({ success: true, data });
    }

    if (type === 'tickets') {
      const status = searchParams.get('status') || undefined;
      const priority = searchParams.get('priority') || undefined;
      const data = await ReportService.getTicketReport({ status, priority });
      return NextResponse.json({ success: true, data });
    }

    if (type === 'insurance') {
      const status = searchParams.get('status') || undefined;
      const data = await ReportService.getInsuranceReport({ status });
      return NextResponse.json({ success: true, data });
    }

    if (type === 'history') {
      const eventType = searchParams.get('eventType') || undefined;
      const data = await ReportService.getAssetHistoryReport({ eventType });
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
