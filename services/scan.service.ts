import { AssetService } from './asset.service';
import { cleanBarcodeScan } from '@/lib/barcode';
import { AssetDetailed } from '@/types/asset';
import { query } from '@/lib/db';

export interface ScannedAssetSummary {
  id: number;
  assetId: string;
  assetNumber: string;
  assetName: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  warrantyExpiry?: string | null;
  assignedDate?: string | null;
  openTicketsCount: number;
  isScanned?: boolean;
}

export interface EmployeeAssetGroupData {
  id: number;
  employeeId: string; // e.g. "EMP-1001"
  name: string;
  email: string;
  department: string;
  designation: string;
  location?: string;
}

export interface ScanResult {
  found: boolean;
  assetNumber: string;
  asset: (AssetDetailed & { open_tickets_count?: number }) | null;
  message?: string;
  authorizedActions: {
    canRaiseTicket: boolean;
    canAssign: boolean;
    canTransfer: boolean;
    canReturn: boolean;
    canEdit: boolean;
  };
  data?: {
    scannedAsset: ScannedAssetSummary;
    employee: EmployeeAssetGroupData | null;
    assetCount: number;
    assignedAssets: ScannedAssetSummary[];
  };
}

export class ScanService {
  static async processScan(rawCode: string, userRole: string = 'employee'): Promise<ScanResult> {
    const cleanedCode = cleanBarcodeScan(rawCode);

    if (!cleanedCode) {
      return {
        found: false,
        assetNumber: '',
        asset: null,
        message: 'No barcode content detected. Please align the Code 128 barcode within the scanner frame.',
        authorizedActions: {
          canRaiseTicket: false,
          canAssign: false,
          canTransfer: false,
          canReturn: false,
          canEdit: false,
        },
      };
    }

    try {
      const asset = await AssetService.getAssetByAssetNumber(cleanedCode);

      if (!asset) {
        return {
          found: false,
          assetNumber: cleanedCode,
          asset: null,
          message: `Barcode detected, but no matching asset was found for "${cleanedCode}".`,
          authorizedActions: {
            canRaiseTicket: false,
            canAssign: false,
            canTransfer: false,
            canReturn: false,
            canEdit: false,
          },
        };
      }

      const isPrivileged = ['super_admin', 'admin', 'it_admin'].includes(userRole);

      // Compute active open tickets count for quick operational glance
      const openTicketsCount = Array.isArray(asset.tickets)
        ? asset.tickets.filter((t: any) => t.status !== 'resolved' && t.status !== 'closed').length
        : 0;

      const enrichedAsset: AssetDetailed & { open_tickets_count?: number } = {
        ...asset,
        open_tickets_count: openTicketsCount,
      };

      const scannedAssetSummary: ScannedAssetSummary = {
        id: asset.id,
        assetId: asset.asset_id,
        assetNumber: asset.asset_number,
        assetName: `${asset.brand} ${asset.model}`.trim(),
        category: asset.category,
        brand: asset.brand,
        model: asset.model,
        serialNumber: asset.serial_number,
        status: asset.status,
        warrantyExpiry: asset.warranty_expiry || null,
        openTicketsCount,
        isScanned: true,
      };

      let employeeData: EmployeeAssetGroupData | null = null;
      let assignedAssets: ScannedAssetSummary[] = [];

      // Check current active assignment strictly from active assignment records
      // An asset is currently assigned ONLY when an active assignment record exists
      // where status = 'assigned' AND returned_date IS NULL
      if (asset.status === 'assigned') {
        const activeAssignmentRows = await query<any>(
          `SELECT 
            aa.id AS assignment_id,
            aa.assigned_date,
            aa.employee_id,
            e.id AS employee_pk_id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            e.email AS employee_email,
            e.department,
            e.designation,
            e.location
           FROM asset_assignments aa
           JOIN employees e ON aa.employee_id = e.id
           WHERE aa.asset_id = ? 
             AND aa.status = 'assigned' 
             AND aa.returned_date IS NULL
           ORDER BY aa.id DESC 
           LIMIT 1`,
          [asset.id]
        );

        if (activeAssignmentRows && activeAssignmentRows.length > 0) {
          const assignRow = activeAssignmentRows[0];
          scannedAssetSummary.assignedDate = assignRow.assigned_date;

          employeeData = {
            id: assignRow.employee_pk_id,
            employeeId: assignRow.employee_code,
            name: assignRow.employee_name,
            email: assignRow.employee_email,
            department: assignRow.department,
            designation: assignRow.designation,
            location: assignRow.location,
          };

          // Find ALL assets currently assigned to this employee
          // Must represent only active assignments (not returned, transferred, or historical)
          const allActiveAssetsRows = await query<any>(
            `SELECT 
              a.id,
              a.asset_id,
              a.asset_number,
              CONCAT(a.brand, ' ', a.model) AS asset_name,
              a.category,
              a.brand,
              a.model,
              a.serial_number,
              a.status,
              a.warranty_expiry,
              aa.assigned_date,
              (SELECT COUNT(*) FROM tickets t WHERE t.asset_id = a.id AND t.status NOT IN ('resolved', 'closed')) AS open_tickets_count
             FROM asset_assignments aa
             JOIN assets a ON aa.asset_id = a.id
             WHERE aa.employee_id = ?
               AND aa.status = 'assigned'
               AND aa.returned_date IS NULL
               AND a.status = 'assigned'
             ORDER BY 
               CASE WHEN a.id = ? THEN 0 ELSE 1 END,
               a.category ASC,
               a.brand ASC,
               a.model ASC`,
            [assignRow.employee_pk_id, asset.id]
          );

          assignedAssets = (allActiveAssetsRows || []).map((row: any) => ({
            id: row.id,
            assetId: row.asset_id,
            assetNumber: row.asset_number,
            assetName: (row.asset_name || `${row.brand} ${row.model}`).trim(),
            category: row.category,
            brand: row.brand,
            model: row.model,
            serialNumber: row.serial_number,
            status: row.status,
            warrantyExpiry: row.warranty_expiry || null,
            assignedDate: row.assigned_date || null,
            openTicketsCount: Number(row.open_tickets_count) || 0,
            isScanned: row.id === asset.id,
          }));
        }
      }

      return {
        found: true,
        assetNumber: cleanedCode,
        asset: enrichedAsset,
        authorizedActions: {
          canRaiseTicket: true,
          canAssign: isPrivileged && asset.status === 'in_stock',
          canTransfer: isPrivileged && asset.status === 'assigned',
          canReturn: isPrivileged && asset.status === 'assigned',
          canEdit: isPrivileged,
        },
        data: {
          scannedAsset: scannedAssetSummary,
          employee: employeeData,
          assetCount: assignedAssets.length,
          assignedAssets,
        },
      };
    } catch (err: any) {
      console.error('ScanService.processScan error:', err);
      throw new Error('Database lookup failed during asset scan.');
    }
  }
}

