import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { createTicketSchema } from '@/validations/ticket.validation';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const rawAssetId = searchParams.get('assetId');
    const assetId = rawAssetId && !isNaN(Number(rawAssetId)) ? Number(rawAssetId) : undefined;
    const rawEmployeeId = searchParams.get('employeeId');
    let employeeId = rawEmployeeId && !isNaN(Number(rawEmployeeId)) ? Number(rawEmployeeId) : undefined;

    // Role-based data isolation: employees can only view their own raised tickets
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp) {
        return NextResponse.json({ success: true, tickets: [], total: 0, page: 1, limit: 20, issueCategories: [] });
      }
      employeeId = ownEmp.id;
    }

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    const data = await TicketService.getTickets({
      search,
      status,
      priority,
      assetId,
      employeeId,
      page,
      limit,
    });

    const issueCategories = await TicketService.getIssueCategories();

    return NextResponse.json({
      success: true,
      ...data,
      issueCategories,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('API /tickets GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required to raise a ticket.' }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const validatedData = createTicketSchema.parse(body);

    // If employee, enforce that ticket belongs to own employee record and asset
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp) {
        return NextResponse.json({ error: 'Forbidden: No linked employee profile found for your account.' }, { status: 403 });
      }
      validatedData.employee_id = ownEmp.id;

      // Verify that the requested asset is assigned to this employee
      const ownAssets = await EmployeeService.getEmployeeAssets(ownEmp.id);
      const isAssigned = ownAssets.some((a: any) => a.id === validatedData.asset_id);
      if (!isAssigned) {
        return NextResponse.json(
          { error: 'Forbidden: Employees can only raise tickets for equipment currently assigned to them.' },
          { status: 403 }
        );
      }
    }

    const ticket = await TicketService.createTicket(validatedData, user.id);

    return NextResponse.json({
      success: true,
      ticket,
      message: `Ticket ${ticket.ticket_id} created successfully`,
    }, { status: 201 });
  } catch (error: any) {
    if (error?.name === 'ZodError' || error?.issues) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to create ticket' }, { status: 400 });
  }
}
