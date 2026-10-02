import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';
import { UserService } from '@/services/user.service';
import { createUserSchema } from '@/validations/user.validation';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    if (!Permissions.canManageUsers(user)) {
      return NextResponse.json({ error: 'Forbidden: Super Administrator privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;

    const users = await UserService.getUsers({ search, role, status });
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('API /admin/users GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    if (!Permissions.canManageUsers(user)) {
      return NextResponse.json({ error: 'Forbidden: Super Administrator privileges required.' }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const validated = createUserSchema.parse(body);
    const created = await UserService.createUser({
      name: validated.name,
      email: validated.email,
      password: validated.password,
      role: validated.role,
      designation: validated.designation || undefined,
      employee_id: validated.employee_id || undefined,
    });

    return NextResponse.json({ success: true, user: created, message: 'User created successfully' }, { status: 201 });
  } catch (error: any) {
    if (error?.name === 'ZodError' || error?.issues) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to create user' }, { status: 400 });
  }
}
