import { NextRequest, NextResponse } from 'next/server';
import { AssignmentService } from '@/services/assignment.service';
import { EmployeeService } from '@/services/employee.service';
import {
  assignAssetSchema,
  transferAssetSchema,
  returnAssetSchema,
} from '@/validations/assignment.validation';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    if (!Permissions.canAssignAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to view assignments.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    const data = await AssignmentService.getAssignments({
      search,
      status,
      page,
      limit,
    });

    const availableAssets = await AssignmentService.getAvailableAssets();
    const assignedAssets = await AssignmentService.getAssignedAssets();
    const activeEmployees = await EmployeeService.getAllActiveEmployees();

    return NextResponse.json({
      success: true,
      ...data,
      availableAssets,
      assignedAssets,
      activeEmployees,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('API /assignments GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve assignments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canAssignAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const action = body.action || 'assign';

    if (action === 'assign') {
      const validated = assignAssetSchema.parse(body);
      const result = await AssignmentService.assignAsset(validated, user.id);
      return NextResponse.json({
        success: true,
        message: `Successfully assigned ${result.count} asset${result.count > 1 ? 's' : ''} to ${result.employeeName}`,
        count: result.count,
        assets: result.assets,
        employeeName: result.employeeName,
      });
    }

    if (action === 'transfer') {
      const validated = transferAssetSchema.parse(body);
      await AssignmentService.transferAsset(validated, user.id);
      return NextResponse.json({
        success: true,
        message: 'Asset transferred successfully',
      });
    }

    if (action === 'return') {
      const validated = returnAssetSchema.parse(body);
      await AssignmentService.returnAsset(validated, user.id);
      return NextResponse.json({
        success: true,
        message: 'Asset returned to IT Admin successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid assignment action' }, { status: 400 });
  } catch (error: any) {
    if (error?.name === 'ZodError' || error?.issues) {
      const msg = error.issues?.[0]?.message || error.errors?.[0]?.message || 'Validation error';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
