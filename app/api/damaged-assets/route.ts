import { NextRequest, NextResponse } from 'next/server';
import { DamageService } from '@/services/damage.service';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    let employeeId: number | undefined = undefined;

    // Role-based data isolation: employees only receive records for their assigned equipment
    if (user.role === 'employee') {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (!ownEmp) {
        return NextResponse.json({
          success: true,
          damagedAssets: [],
          total: 0,
          stats: {
            totalDamaged: 0,
            underInvestigation: 0,
            inRepair: 0,
            repaired: 0,
            writtenOff: 0,
            totalEstimatedCost: 0,
          },
          page: 1,
          limit: 20,
        });
      }
      employeeId = ownEmp.id;
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const repairStatus = searchParams.get('repairStatus') || undefined;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

    const data = await DamageService.getDamagedAssets({
      search,
      severity,
      repairStatus,
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
    console.error('API /damaged-assets GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve damaged assets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request payload' }, { status: 400 });
    }

    if (!body.asset_id) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }
    if (!body.damage_type || !body.damage_type.trim()) {
      return NextResponse.json({ error: 'Damage type is required' }, { status: 400 });
    }
    if (!body.description || !body.description.trim()) {
      return NextResponse.json({ error: 'Detailed damage description is required' }, { status: 400 });
    }

    let employeeId = body.employee_id ? Number(body.employee_id) : null;
    if (user.role === 'employee' && !employeeId) {
      const { EmployeeService } = await import('@/services/employee.service');
      const ownEmp = await EmployeeService.getEmployeeByUser(user);
      if (ownEmp) employeeId = ownEmp.id;
    }

    const created = await DamageService.createDamagedAsset(
      {
        asset_id: Number(body.asset_id),
        employee_id: employeeId,
        ticket_id: body.ticket_id ? Number(body.ticket_id) : null,
        damage_type: body.damage_type.trim(),
        severity: body.severity || 'moderate',
        incident_date: body.incident_date || new Date().toISOString().split('T')[0],
        description: body.description.trim(),
        repair_status: body.repair_status || 'reported',
        repair_cost_estimate: Number(body.repair_cost_estimate) || 0,
        actual_repair_cost: Number(body.actual_repair_cost) || 0,
        insurance_claimed: Boolean(body.insurance_claimed),
        resolution_notes: body.resolution_notes || null,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      damagedAsset: created,
      message: 'Damaged asset incident logged successfully',
    });
  } catch (error: any) {
    console.error('API /damaged-assets POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to report damaged asset' }, { status: 400 });
  }
}
