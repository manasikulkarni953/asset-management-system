import { NextRequest, NextResponse } from 'next/server';
import { EmployeeService } from '@/services/employee.service';
import { updateEmployeeSchema } from '@/validations/employee.validation';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { employeeId } = await params;
    const id = Number(employeeId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    const employee = await EmployeeService.getEmployeeById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Role-based data isolation: employees can only view their own profile
    if (user.role === 'employee') {
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp || ownEmp.id !== employee.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view other employees profiles.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, employee });
  } catch (error: any) {
    console.error('API /employees/[employeeId] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve employee details' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageEmployees(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { employeeId } = await params;
    const id = Number(employeeId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const validatedData = updateEmployeeSchema.parse(body);

    const updated = await EmployeeService.updateEmployee(id, validatedData);
    return NextResponse.json({
      success: true,
      employee: updated,
      message: 'Employee updated successfully',
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation error' }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to update employee' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    if (!Permissions.canManageEmployees(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to delete employee records.' }, { status: 403 });
    }

    const { employeeId } = await params;
    const id = Number(employeeId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    const result = await EmployeeService.deleteEmployee(id);
    return NextResponse.json({
      success: true,
      message: `Employee ${result.name} (${result.employee_id}) and linked user account permanently deleted.`,
    });
  } catch (error: any) {
    console.error('API /employees/[employeeId] DELETE error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete employee' }, { status: 400 });
  }
}

