import { query, execute } from '@/lib/db';
import { AssetInsurance, InsuranceStatus } from '@/types/asset';
import { InsuranceInput } from '@/validations/asset.validation';

export interface InsuranceFilterOptions {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  employeeId?: number; // for role-based data isolation
}

export interface InsuranceStats {
  totalInsured: number;
  activePolicies: number;
  expiringSoon: number;
  expiredPolicies: number;
}

export class InsuranceService {
  static async getInsuranceStats(employeeId?: number): Promise<InsuranceStats> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (employeeId) {
      conditions.push('a.current_employee_id = ?');
      params.push(employeeId);
    }

    const whereClause = conditions.join(' AND ');

    const rows = await query<any>(
      `SELECT 
        COUNT(*) as totalInsured,
        SUM(CASE WHEN ai.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as activePolicies,
        SUM(CASE WHEN ai.expiry_date >= CURDATE() AND ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as expiringSoon,
        SUM(CASE WHEN ai.expiry_date < CURDATE() THEN 1 ELSE 0 END) as expiredPolicies
       FROM asset_insurance ai
       JOIN assets a ON ai.asset_id = a.id
       WHERE ${whereClause}`,
      params
    );

    const r = rows[0] || {};
    return {
      totalInsured: Number(r.totalInsured) || 0,
      activePolicies: Number(r.activePolicies) || 0,
      expiringSoon: Number(r.expiringSoon) || 0,
      expiredPolicies: Number(r.expiredPolicies) || 0,
    };
  }

  static async getInsuranceList(
    options: InsuranceFilterOptions = {}
  ): Promise<{ insuranceList: AssetInsurance[]; total: number; stats: InsuranceStats }> {
    const { search, status, page = 1, limit = 20, employeeId } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (employeeId) {
      conditions.push('a.current_employee_id = ?');
      params.push(employeeId);
    }

    if (search && search.trim() !== '') {
      conditions.push(
        '(ai.provider LIKE ? OR ai.policy_number LIKE ? OR a.asset_number LIKE ? OR CONCAT(a.brand, " ", a.model) LIKE ?)'
      );
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (status && status !== 'all') {
      if (status === 'expiring') {
        conditions.push('ai.expiry_date >= CURDATE() AND ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
      } else if (status === 'expired') {
        conditions.push('ai.expiry_date < CURDATE()');
      } else if (status === 'active') {
        conditions.push('ai.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
      }
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM asset_insurance ai
       JOIN assets a ON ai.asset_id = a.id
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const insuranceList = await query<AssetInsurance>(
      `SELECT 
        ai.id,
        ai.asset_id,
        a.asset_number,
        CONCAT(a.brand, ' ', a.model) as asset_name,
        a.brand,
        a.model as asset_model,
        a.model,
        a.serial_number,
        ai.provider,
        ai.policy_number,
        ai.start_date,
        ai.expiry_date,
        ai.coverage_amount,
        ai.document_url,
        ai.notes,
        CASE 
          WHEN ai.expiry_date < CURDATE() THEN 'expired'
          WHEN ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring'
          ELSE 'active'
        END as status,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.department, 'Operations') as department,
        e.workstation,
        ai.created_at,
        ai.updated_at
       FROM asset_insurance ai
       JOIN assets a ON ai.asset_id = a.id
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE ${whereClause}
       ORDER BY ai.expiry_date ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const stats = await this.getInsuranceStats(employeeId);

    return { insuranceList, total, stats };
  }

  static async getInsuranceByAssetId(assetId: number): Promise<AssetInsurance | null> {
    const rows = await query<AssetInsurance>(
      `SELECT 
        ai.id,
        ai.asset_id,
        a.asset_number,
        CONCAT(a.brand, ' ', a.model) as asset_name,
        a.brand,
        a.model as asset_model,
        a.model,
        a.serial_number,
        ai.provider,
        ai.policy_number,
        ai.start_date,
        ai.expiry_date,
        ai.coverage_amount,
        ai.document_url,
        ai.notes,
        CASE 
          WHEN ai.expiry_date < CURDATE() THEN 'expired'
          WHEN ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring'
          ELSE 'active'
        END as status,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.department, 'Operations') as department,
        e.workstation,
        ai.created_at,
        ai.updated_at
       FROM asset_insurance ai
       JOIN assets a ON ai.asset_id = a.id
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE ai.asset_id = ?
       LIMIT 1`,
      [assetId]
    );

    return rows[0] || null;
  }

  static async upsertInsurance(assetId: number, data: InsuranceInput): Promise<AssetInsurance> {
    // 1. Verify asset exists
    const assetCheck = await query<any>(
      'SELECT id, asset_number, brand, model FROM assets WHERE id = ? LIMIT 1',
      [assetId]
    );
    if (!assetCheck || assetCheck.length === 0) {
      throw new Error(`Asset with ID ${assetId} does not exist.`);
    }

    // 2. Verify policy_number does not create an unintended duplicate across other assets
    const policyNum = data.policy_number.trim();
    const duplicateCheck = await query<any>(
      'SELECT id, asset_id FROM asset_insurance WHERE policy_number = ? AND asset_id != ? LIMIT 1',
      [policyNum, assetId]
    );
    if (duplicateCheck.length > 0) {
      throw new Error(`Policy number '${policyNum}' is already assigned to another asset.`);
    }

    // 3. Compute status automatically based on expiry_date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(data.expiry_date);
    expiry.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    let calculatedStatus: InsuranceStatus = 'active';
    if (expiry < today) {
      calculatedStatus = 'expired';
    } else if (expiry <= thirtyDaysFromNow) {
      calculatedStatus = 'expiring';
    }

    // 4. Check if record exists for this asset
    const existing = await query<any>(
      'SELECT id FROM asset_insurance WHERE asset_id = ? LIMIT 1',
      [assetId]
    );

    const notes = data.notes && data.notes.trim() ? data.notes.trim() : null;
    const documentUrl = data.document_url && data.document_url.trim() ? data.document_url.trim() : null;

    if (existing && existing.length > 0) {
      await execute(
        `UPDATE asset_insurance SET 
          provider = ?, 
          policy_number = ?, 
          start_date = ?, 
          expiry_date = ?, 
          coverage_amount = ?, 
          notes = ?,
          document_url = ?, 
          status = ?
         WHERE asset_id = ?`,
        [
          data.provider.trim(),
          policyNum,
          data.start_date,
          data.expiry_date,
          data.coverage_amount,
          notes,
          documentUrl,
          calculatedStatus,
          assetId,
        ]
      );
    } else {
      await execute(
        `INSERT INTO asset_insurance (
          asset_id, provider, policy_number, start_date, expiry_date, 
          coverage_amount, notes, document_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assetId,
          data.provider.trim(),
          policyNum,
          data.start_date,
          data.expiry_date,
          data.coverage_amount,
          notes,
          documentUrl,
          calculatedStatus,
        ]
      );
    }

    const saved = await this.getInsuranceByAssetId(assetId);
    return saved!;
  }

  static async deleteInsurance(id: number): Promise<boolean> {
    const res = await execute('DELETE FROM asset_insurance WHERE id = ?', [id]);
    return ((res as any)?.affectedRows || 0) > 0;
  }

  static async deleteInsuranceByAssetId(assetId: number): Promise<boolean> {
    const res = await execute('DELETE FROM asset_insurance WHERE asset_id = ?', [assetId]);
    return ((res as any)?.affectedRows || 0) > 0;
  }
}
