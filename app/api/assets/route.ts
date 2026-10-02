import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/services/asset.service';
import { createAssetSchema } from '@/validations/asset.validation';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const rawEmployeeId = searchParams.get('employeeId');
    let employeeId = rawEmployeeId && !isNaN(Number(rawEmployeeId)) ? Number(rawEmployeeId) : undefined;

    // Role-based data isolation: employees can only view assets currently assigned to them
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp) {
        return NextResponse.json({
          success: true,
          assets: [],
          total: 0,
          page: 1,
          limit: 20,
          categories: [],
        });
      }
      employeeId = ownEmp.id;
    }

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    const data = await AssetService.getAssets({
      search,
      category,
      status,
      employeeId,
      page,
      limit,
    });

    const categories = await AssetService.getCategories();

    return NextResponse.json({
      success: true,
      ...data,
      page,
      limit,
      categories,
    });
  } catch (error: any) {
    console.error('API /assets GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!Permissions.canManageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await req.json();
    const validatedData = createAssetSchema.parse(body);

    const asset = await AssetService.createAsset(validatedData, user.id);

    return NextResponse.json({
      success: true,
      asset,
      message: `Asset ${asset.asset_number} created successfully`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('API /assets POST error:', error);
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const message = error?.message || '';
    const isDup = error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062 || message.includes('Duplicate entry');

    if (isDup) {
      if (message.includes('serial_number')) {
        return NextResponse.json(
          { error: 'This hardware serial number already exists.' },
          { status: 409 }
        );
      }
      if (message.includes('asset_id') || message.includes('uq_assets_asset_id')) {
        return NextResponse.json(
          { error: 'Failed to generate unique asset identity. Please try again.' },
          { status: 500 }
        );
      }
      if (message.includes('asset_number')) {
        return NextResponse.json(
          { error: 'Failed to generate unique asset number. Please try again.' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'A duplicate record already exists in the system.' },
        { status: 409 }
      );
    }

    if (message.includes('hardware serial number already exists') || message.includes('Serial number')) {
      return NextResponse.json(
        { error: 'This hardware serial number already exists.' },
        { status: 409 }
      );
    }

    if (message.includes('Asset identity generation failed') || message.includes('asset identity')) {
      return NextResponse.json(
        { error: 'Failed to generate unique asset identity.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: message || 'Failed to create asset' },
      { status: 400 }
    );
  }
}
