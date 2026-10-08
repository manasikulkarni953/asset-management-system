import { NextRequest, NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance.service';
import { insuranceSchema } from '@/validations/asset.validation';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    let employeeId: number | undefined = undefined;

    // Role-based data isolation: employees only receive insurance for their assigned equipment
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp) {
        return NextResponse.json({
          success: true,
          insuranceList: [],
          total: 0,
          stats: { totalInsured: 0, activePolicies: 0, expiringSoon: 0, expiredPolicies: 0 },
          page: 1,
          limit: 20,
        });
      }
      employeeId = ownEmp.id;
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    const data = await InsuranceService.getInsuranceList({
      search,
      status,
      page,
      limit,
      employeeId,
    });

    return NextResponse.json({
      success: true,
      ...data,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('API /insurance GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve insurance data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageInsurance(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    const validated = insuranceSchema.parse(body);
    const insurance = await InsuranceService.upsertInsurance(validated.asset_id, validated);

    return NextResponse.json({
      success: true,
      insurance,
      message: 'Insurance policy saved successfully',
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation error' }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to update insurance details' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageInsurance(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const assetId = searchParams.get('asset_id');

    if (!id && !assetId) {
      return NextResponse.json({ error: 'Missing insurance policy ID or asset ID' }, { status: 400 });
    }

    let deleted = false;
    if (id) {
      deleted = await InsuranceService.deleteInsurance(Number(id));
    } else if (assetId) {
      deleted = await InsuranceService.deleteInsuranceByAssetId(Number(assetId));
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Insurance policy not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Insurance policy deleted successfully',
    });
  } catch (error: any) {
    console.error('API /insurance DELETE error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete insurance policy' }, { status: 500 });
  }
}
