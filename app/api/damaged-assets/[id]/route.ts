import { NextRequest, NextResponse } from 'next/server';
import { DamageService } from '@/services/damage.service';
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
    const record = await DamageService.getDamagedAssetById(Number(id));
    if (!record) {
      return NextResponse.json({ error: 'Damaged asset record not found' }, { status: 404 });
    }

    // Role isolation check for employees
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp || (record.employee_id && record.employee_id !== ownEmp.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, damagedAsset: record });
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
    if (!Permissions.canManageDamageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const updated = await DamageService.updateDamagedAsset(
      Number(id),
      {
        damage_type: body.damage_type,
        severity: body.severity,
        incident_date: body.incident_date,
        description: body.description,
        repair_status: body.repair_status,
        repair_cost_estimate: body.repair_cost_estimate !== undefined ? Number(body.repair_cost_estimate) : undefined,
        actual_repair_cost: body.actual_repair_cost !== undefined ? Number(body.actual_repair_cost) : undefined,
        insurance_claimed: body.insurance_claimed !== undefined ? Boolean(body.insurance_claimed) : undefined,
        resolution_notes: body.resolution_notes,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      damagedAsset: updated,
      message: 'Damaged asset record updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update record' }, { status: 400 });
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
    if (!Permissions.canManageDamageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { id } = await params;
    const success = await DamageService.deleteDamagedAsset(Number(id));
    if (!success) {
      return NextResponse.json({ error: 'Record not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Damaged asset record deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete record' }, { status: 500 });
  }
}
