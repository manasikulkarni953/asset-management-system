import { NextRequest, NextResponse } from 'next/server';
import { AssetSetService } from '@/services/asset-set.service';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const set = await AssetSetService.getAssetSetById(Number(id));
    if (!set) {
      return NextResponse.json({ error: 'Asset set not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, assetSet: set });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const updated = await AssetSetService.updateAssetSet(Number(id), {
      name: body.name,
      code: body.code ? body.code.toUpperCase() : undefined,
      tag_number: body.tag_number,
      target_department: body.target_department,
      description: body.description,
      is_active: body.is_active,
      items: body.items,
    });

    return NextResponse.json({
      success: true,
      assetSet: updated,
      message: 'Asset Set updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update asset set' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { id } = await params;
    const deleted = await AssetSetService.deleteAssetSet(Number(id));
    if (!deleted) {
      return NextResponse.json({ error: 'Asset set not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Asset Set deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete asset set' }, { status: 500 });
  }
}
