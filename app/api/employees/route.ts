import { NextRequest, NextResponse } from 'next/server';
import { EmployeeService } from '@/services/employee.service';
import { createEmployeeSchema } from '@/validations/employee.validation';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Role-based data isolation: employees only receive their own profile
    if (user.role === 'employee') {
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      return NextResponse.json({
        success: true,
        employees: ownEmp ? [ownEmp] : [],
        total: ownEmp ? 1 : 0,
        departments: ownEmp ? [ownEmp.department] : [],
        page: 1,
        limit: 20,
      });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const department = searchParams.get('department') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    const data = await EmployeeService.getEmployees({
      search,
      department,
      status,
      page,
      limit,
    });

    const departments = await EmployeeService.getDepartments();

    return NextResponse.json({
      success: true,
      ...data,
      departments,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('API /employees GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve employees' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageEmployees(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const validatedData = createEmployeeSchema.parse(body);
    const employee = await EmployeeService.createEmployee(validatedData);

    return NextResponse.json({
      success: true,
      employee,
      message: 'Employee created successfully',
    }, { status: 201 });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation error' }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to create employee' }, { status: 400 });
  }
}
