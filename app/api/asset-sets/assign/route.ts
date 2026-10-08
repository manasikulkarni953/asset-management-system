import { NextRequest, NextResponse } from 'next/server';
import { AssetSetService } from '@/services/asset-set.service';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }
    if (!Permissions.canAssignAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to assign equipment.' }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    if (!body.set_id) {
      return NextResponse.json({ error: 'Asset Set ID is required' }, { status: 400 });
    }
    if (!body.employee_id) {
      return NextResponse.json({ error: 'Please select an employee recipient for this asset set' }, { status: 400 });
    }
    if (!body.selected_asset_ids || !Array.isArray(body.selected_asset_ids) || body.selected_asset_ids.length === 0) {
      return NextResponse.json({ error: 'At least one asset must be chosen for deployment' }, { status: 400 });
    }

    const result = await AssetSetService.deployAssetSetToEmployee(
      {
        set_id: Number(body.set_id),
        employee_id: Number(body.employee_id),
        selected_asset_ids: body.selected_asset_ids.map((id: any) => Number(id)),
        notes: body.notes,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      message: `Successfully provisioned ${result.count} assets to ${result.employeeName}`,
      ...result,
    });
  } catch (error: any) {
    console.error('API /asset-sets/assign POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to deploy asset set' }, { status: 400 });
  }
}
