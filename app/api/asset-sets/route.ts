import { NextRequest, NextResponse } from 'next/server';
import { AssetSetService } from '@/services/asset-set.service';
import { EmployeeService } from '@/services/employee.service';
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
    const department = searchParams.get('department') || undefined;

    const [sets, employees] = await Promise.all([
      AssetSetService.getAssetSets(search, department),
      EmployeeService.getAllActiveEmployees(),
    ]);

    return NextResponse.json({
      success: true,
      assetSets: sets,
      employees,
      total: sets.length,
    });
  } catch (error: any) {
    console.error('API /asset-sets GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve asset sets' }, { status: 500 });
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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Set name is required' }, { status: 400 });
    }
    if (!body.code || !body.code.trim()) {
      return NextResponse.json({ error: 'Unique Set code is required (e.g. SET-DEV-01)' }, { status: 400 });
    }

    const created = await AssetSetService.createAssetSet({
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      tag_number: body.tag_number,
      target_department: body.target_department || 'All',
      description: body.description?.trim() || null,
      employee_id: body.employee_id ? Number(body.employee_id) : undefined,
      selected_asset_ids: Array.isArray(body.selected_asset_ids) ? body.selected_asset_ids.map(Number) : undefined,
      items: body.items || [],
    });

    return NextResponse.json({
      success: true,
      assetSet: created,
      message: 'Asset Set created successfully',
    });
  } catch (error: any) {
    console.error('API /asset-sets POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create asset set' }, { status: 400 });
  }
}
