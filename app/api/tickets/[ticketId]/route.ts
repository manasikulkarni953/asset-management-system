import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { updateTicketSchema } from '@/validations/ticket.validation';
import { getAuthUserFromRequest } from '@/lib/auth';

import { Permissions } from '@/lib/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { ticketId } = await params;
    const id = Number(ticketId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    const ticket = await TicketService.getTicketById(id);
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Role-based data isolation: employees can only view their own tickets
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp || ticket.employee_id !== ownEmp.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view other employees tickets.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error('API /tickets/[ticketId] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve ticket details' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageTickets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { ticketId } = await params;
    const id = Number(ticketId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const validatedData = updateTicketSchema.parse(body);

    const updated = await TicketService.updateTicket(id, validatedData, user.id);
    return NextResponse.json({
      success: true,
      ticket: updated,
      message: 'Ticket updated successfully',
    });
  } catch (error: any) {
    if (error?.name === 'ZodError' || error?.issues) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to update ticket' }, { status: 400 });
  }
}
