import { query, execute } from '@/lib/db';
import { AssetInsurance, InsuranceStatus } from '@/types/asset';
import { InsuranceInput } from '@/validations/asset.validation';

export interface InsuranceFilterOptions {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class InsuranceService {
  static async getInsuranceList(
    options: InsuranceFilterOptions = {}
  ): Promise<{ insuranceList: AssetInsurance[]; total: number }> {
    const { search, status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim() !== '') {
      conditions.push(
        '(ai.provider LIKE ? OR ai.policy_number LIKE ? OR a.asset_number LIKE ? OR a.model LIKE ?)'
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
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const insuranceList = await query<AssetInsurance>(
      `SELECT 
        ai.id,
        ai.asset_id,
        a.asset_number,
        a.model as asset_model,
        ai.provider,
        ai.policy_number,
        ai.start_date,
        ai.expiry_date,
        ai.coverage_amount,
        ai.document_url,
        CASE 
          WHEN ai.expiry_date < CURDATE() THEN 'expired'
          WHEN ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring'
          ELSE 'active'
        END as status,
        ai.created_at,
        ai.updated_at
       FROM asset_insurance ai
       JOIN assets a ON ai.asset_id = a.id
       WHERE ${whereClause}
       ORDER BY ai.expiry_date ASC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { insuranceList, total };
  }

  static async getInsuranceByAssetId(assetId: number): Promise<AssetInsurance | null> {
    const rows = await query<AssetInsurance>(
      `SELECT 
        ai.id,
        ai.asset_id,
        a.asset_number,
        a.model as asset_model,
        ai.provider,
        ai.policy_number,
        ai.start_date,
        ai.expiry_date,
        ai.coverage_amount,
        ai.document_url,
        CASE 
          WHEN ai.expiry_date < CURDATE() THEN 'expired'
          WHEN ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'expiring'
          ELSE 'active'
        END as status,
        ai.created_at,
        ai.updated_at
       FROM asset_insurance ai
       JOIN assets a ON ai.asset_id = a.id
       WHERE ai.asset_id = ?
       LIMIT 1`,
      [assetId]
    );

    return rows[0] || null;
  }

  static async upsertInsurance(assetId: number, data: InsuranceInput): Promise<AssetInsurance> {
    // Check if exists
    const existing = await query<any>(
      'SELECT id FROM asset_insurance WHERE asset_id = ? LIMIT 1',
      [assetId]
    );

    // Compute status based on expiry_date
    const today = new Date();
    const expiry = new Date(data.expiry_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    let calculatedStatus: InsuranceStatus = 'active';
    if (expiry < today) {
      calculatedStatus = 'expired';
    } else if (expiry <= thirtyDaysFromNow) {
      calculatedStatus = 'expiring';
    }

    if (existing && existing.length > 0) {
      await execute(
        `UPDATE asset_insurance SET 
          provider = ?, policy_number = ?, start_date = ?, expiry_date = ?, 
          coverage_amount = ?, document_url = ?, status = ?
         WHERE asset_id = ?`,
        [
          data.provider,
          data.policy_number,
          data.start_date,
          data.expiry_date,
          data.coverage_amount,
          data.document_url || null,
          calculatedStatus,
          assetId,
        ]
      );
    } else {
      await execute(
        `INSERT INTO asset_insurance (
          asset_id, provider, policy_number, start_date, expiry_date, 
          coverage_amount, document_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assetId,
          data.provider,
          data.policy_number,
          data.start_date,
          data.expiry_date,
          data.coverage_amount,
          data.document_url || null,
          calculatedStatus,
        ]
      );
    }

    const saved = await this.getInsuranceByAssetId(assetId);
    return saved!;
  }
}
