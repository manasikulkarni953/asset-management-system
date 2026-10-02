import { NextRequest, NextResponse } from 'next/server';
import { ScanService } from '@/services/scan.service';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to scan assets.' },
        { status: 401 }
      );
    }
    const userRole = user.role;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON request payload.',
          message: 'Unable to parse request body.',
        },
        { status: 400 }
      );
    }

    const rawBarcode = body.barcode || body.assetNumber || body.code || '';

    if (!rawBarcode || typeof rawBarcode !== 'string' || !rawBarcode.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Barcode value is required',
          message: 'Please provide a valid barcode string to scan.',
        },
        { status: 400 }
      );
    }

    const cleanBarcode = rawBarcode.trim().slice(0, 100);
    const result = await ScanService.processScan(cleanBarcode, userRole);

    if (!result.found || !result.asset) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          assetNumber: result.assetNumber,
          message: 'No asset found for this barcode.',
        },
        { status: 404 }
      );
    }

    const structuredData = {
      scannedAsset: result.data?.scannedAsset,
      employee: result.data?.employee || null,
      assetCount: result.data?.assetCount ?? 0,
      assignedAssets: result.data?.assignedAssets ?? [],
      ...result.asset,
      assetId: result.asset.asset_id,
      assetNumber: result.asset.asset_number,
      assetName: `${result.asset.brand} ${result.asset.model}`.trim(),
      serialNumber: result.asset.serial_number,
      currentEmployee: result.data?.employee?.name || result.asset.current_employee_name || 'In Inventory',
      currentEmployeeCode: result.data?.employee?.employeeId || result.asset.current_employee_code,
      warrantyExpiry: result.asset.warranty_expiry,
      openTicketsCount: result.asset.open_tickets_count ?? 0,
      authorizedActions: result.authorizedActions,
    };

    return NextResponse.json({
      success: true,
      found: true,
      assetNumber: result.assetNumber,
      asset: result.asset,
      data: structuredData,
      authorizedActions: result.authorizedActions,
    });
  } catch (error: any) {
    console.error('Scan API POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to retrieve asset information. Please try again.',
        message: 'Unable to retrieve asset information. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to scan assets.' },
        { status: 401 }
      );
    }
    const userRole = user.role;

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code') || searchParams.get('barcode') || searchParams.get('assetNumber') || '';

    if (!code || !code.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query parameter "code" is required',
          message: 'Please provide a valid barcode in the "code" query parameter.',
        },
        { status: 400 }
      );
    }

    const result = await ScanService.processScan(code, userRole);
    if (!result.found || !result.asset) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          assetNumber: result.assetNumber,
          message: 'No asset found for this barcode.',
        },
        { status: 404 }
      );
    }

    const structuredData = {
      scannedAsset: result.data?.scannedAsset,
      employee: result.data?.employee || null,
      assetCount: result.data?.assetCount ?? 0,
      assignedAssets: result.data?.assignedAssets ?? [],
      ...result.asset,
      assetId: result.asset.asset_id,
      assetNumber: result.asset.asset_number,
      assetName: `${result.asset.brand} ${result.asset.model}`.trim(),
      serialNumber: result.asset.serial_number,
      currentEmployee: result.data?.employee?.name || result.asset.current_employee_name || 'In Inventory',
      currentEmployeeCode: result.data?.employee?.employeeId || result.asset.current_employee_code,
      warrantyExpiry: result.asset.warranty_expiry,
      openTicketsCount: result.asset.open_tickets_count ?? 0,
      authorizedActions: result.authorizedActions,
    };

    return NextResponse.json({
      success: true,
      found: true,
      assetNumber: result.assetNumber,
      asset: result.asset,
      data: structuredData,
      authorizedActions: result.authorizedActions,
    });
  } catch (error: any) {
    console.error('Scan API GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to retrieve asset information. Please try again.',
        message: 'Unable to retrieve asset information. Please try again.',
      },
      { status: 500 }
    );
  }
}

