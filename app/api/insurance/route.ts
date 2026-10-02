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
    if (!Permissions.canManageInsurance(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
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

    const assetId = Number(body.asset_id);
    if (!assetId || isNaN(assetId)) {
      return NextResponse.json({ error: 'Valid asset_id is required' }, { status: 400 });
    }

    const validated = insuranceSchema.parse(body);
    const insurance = await InsuranceService.upsertInsurance(assetId, validated);

    return NextResponse.json({
      success: true,
      insurance,
      message: 'Insurance details updated successfully',
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: error.errors[0]?.message || 'Validation error' }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to update insurance details' }, { status: 400 });
  }
}
