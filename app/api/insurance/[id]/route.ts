import { NextRequest, NextResponse } from 'next/server';
import { InsuranceService } from '@/services/insurance.service';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!Permissions.canManageInsurance(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { id } = await params;
    const policyId = Number(id);
    if (isNaN(policyId)) {
      return NextResponse.json({ error: 'Invalid policy ID' }, { status: 400 });
    }

    const deleted = await InsuranceService.deleteInsurance(policyId);
    if (!deleted) {
      return NextResponse.json({ error: 'Insurance policy not found or already deleted' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Insurance policy deleted successfully',
    });
  } catch (error: any) {
    console.error('API /insurance/[id] DELETE error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete insurance policy' }, { status: 500 });
  }
}
