import { NextRequest, NextResponse } from 'next/server';
import { AssetService } from '@/services/asset.service';
import { getAuthUserFromRequest } from '@/lib/auth';
import { Permissions } from '@/lib/permissions';
import * as XLSX from 'xlsx';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: paramId } = await params;
    const id = Number(paramId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid import ID' }, { status: 400 });
    }

    const record = await AssetService.getImportById(id);
    if (!record) {
      return NextResponse.json({ error: 'Import batch record not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const isDownload = searchParams.get('download') === 'true';

    if (isDownload && record.file_content) {
      const originalName = record.original_name || 'imported_file.csv';
      const isExcel = originalName.toLowerCase().endsWith('.xlsx') || originalName.toLowerCase().endsWith('.xls');

      if (isExcel) {
        let buf: any;
        try {
          if (typeof record.file_content === 'string' && record.file_content.startsWith('PK')) {
            buf = Buffer.from(record.file_content, 'binary');
          } else {
            const wb = XLSX.read(record.file_content, { type: 'string' });
            buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
          }
        } catch {
          const ws = XLSX.utils.aoa_to_sheet([['Asset Import'], [record.original_name]]);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
          buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        }
        const downloadName = originalName.toLowerCase().endsWith('.xls')
          ? originalName.replace(/\.xls$/i, '.xlsx')
          : originalName;

        return new NextResponse(buf, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${downloadName}"`,
          },
        });
      }

      return new NextResponse(record.file_content, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${originalName}"`,
        },
      });
    }

    return NextResponse.json({ success: true, importRecord: record });
  } catch (error: any) {
    console.error('API /assets/imports/[id] GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to retrieve import record' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const { id: paramId } = await params;
    const id = Number(paramId);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid import ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const deleteAssets = searchParams.get('deleteAssets') !== 'false';

    const result = await AssetService.deleteImportBatch(id, deleteAssets);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /assets/imports/[id] DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete imported file' },
      { status: 500 }
    );
  }
}

