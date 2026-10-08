import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';
import { UserService } from '@/services/user.service';
import { updateUserSchema } from '@/validations/user.validation';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageUsers(user)) {
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required' }, { status: 403 });
    }

    const { userId } = await params;
    const id = Number(userId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const target = await UserService.getUserById(id);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: target });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to retrieve user' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageUsers(user)) {
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required' }, { status: 403 });
    }

    const { userId } = await params;
    const id = Number(userId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const validated = updateUserSchema.parse(body);

    const target = await UserService.getUserById(id);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Role restrictions for IT Admins
    if (user.role === 'admin' && target.role === 'super_admin') {
      return NextResponse.json({ error: 'IT Administrators cannot modify Super Administrator accounts' }, { status: 403 });
    }
    if (user.role === 'admin' && validated.role === 'super_admin') {
      return NextResponse.json({ error: 'Only Super Administrators can assign the Super Administrator role' }, { status: 403 });
    }

    // Prevent deactivating or demoting the last super_admin if this is user id 1 or current user
    if (id === user.id && validated.status === 'inactive') {
      return NextResponse.json({ error: 'Cannot deactivate your own active session account' }, { status: 400 });
    }
    if (id === user.id && validated.role && validated.role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot demote your own Super Administrator role' }, { status: 400 });
    }

    const updated = await UserService.updateUser(id, validated);
    return NextResponse.json({ success: true, user: updated, message: 'User updated successfully' });
  } catch (error: any) {
    if (error?.name === 'ZodError' || error?.issues) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Strict Superadmin credentials requirement
    if (!Permissions.canDeleteUsers(user)) {
      return NextResponse.json(
        { error: 'Forbidden: Super Administrator credentials required to delete user accounts.' },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const id = Number(userId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own active administrator account.' },
        { status: 400 }
      );
    }

    const target = await UserService.getUserById(id);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await UserService.deleteUser(id);
    return NextResponse.json({
      success: true,
      message: `User ${target.name} (${target.email}) deleted successfully`,
    });
  } catch (error: any) {
    console.error('API /admin/users/[userId] DELETE error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete user' }, { status: 500 });
  }
}
