import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/services/asset.service';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const imports = await AssetService.getImportHistory();
    return NextResponse.json({ success: true, imports });
  } catch (error: any) {
    console.error('API /assets/imports GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to retrieve import history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!Permissions.canManageAssets(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to import assets' }, { status: 403 });
    }

    const body = await req.json();
    const { filename, originalName, fileSize, fileContent, rows } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No asset records found in uploaded file payload' }, { status: 400 });
    }

    const result = await AssetService.importAssetsFromData({
      filename: filename || `import_${Date.now()}.csv`,
      originalName: originalName || filename || 'imported_assets.csv',
      fileSize: fileSize || 0,
      fileContent: fileContent || null,
      rows,
      userId: user.id,
      userName: user.fullName || user.username,
    });

    return NextResponse.json({
      success: true,
      message: `Import processed: ${result.successCount} of ${result.totalRecords} assets successfully imported.`,
      ...result,
    });
  } catch (error: any) {
    console.error('API /assets/imports POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to import assets' }, { status: 500 });
  }
}
