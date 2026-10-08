import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/services/asset.service';
import { updateAssetSchema } from '@/validations/asset.validation';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { assetId } = await params;
    const id = Number(assetId);

    const asset = !isNaN(id)
      ? await AssetService.getAssetById(id)
      : await AssetService.getAssetByAssetNumber(assetId);

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Role-based data isolation: employees can only view assets currently assigned to them
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp || asset.current_employee_id !== ownEmp.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view other equipment.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ success: true, asset });
  } catch (error: any) {
    console.error('API /assets/[assetId] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve asset' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { assetId } = await params;
    const id = Number(assetId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const validatedData = updateAssetSchema.parse(body);

    const updated = await AssetService.updateAsset(id, validatedData, user.id);
    return NextResponse.json({
      success: true,
      asset: updated,
      message: 'Asset updated successfully',
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error?.message || 'Failed to update asset' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { assetId } = await params;
    const id = Number(assetId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'retire') {
      const body = await req.json().catch(() => ({}));
      const reason = body?.reason || 'Asset retired by administrator';
      await AssetService.retireAsset(id, reason, user.id);
      return NextResponse.json({
        success: true,
        message: 'Asset marked as retired successfully',
      });
    }

    await AssetService.deleteAsset(id);

    return NextResponse.json({
      success: true,
      message: 'Asset deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete asset' }, { status: 400 });
  }
}
