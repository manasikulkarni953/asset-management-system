import { query, execute } from '@/lib/db';
import { AssetNetwork } from '@/types/asset';
import { NetworkInput } from '@/validations/asset.validation';

export interface NetworkFilterOptions {
  search?: string;
  vlan?: string;
  page?: number;
  limit?: number;
}

export class NetworkService {
  static async getNetworkList(
    options: NetworkFilterOptions = {}
  ): Promise<{ networkList: AssetNetwork[]; total: number }> {
    const { search, vlan, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (search && search.trim() !== '') {
      conditions.push(
        '(an.ip_address LIKE ? OR an.mac_address LIKE ? OR an.hostname LIKE ? OR a.asset_number LIKE ? OR a.model LIKE ?)'
      );
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    if (vlan && vlan !== 'all') {
      conditions.push('an.vlan = ?');
      params.push(vlan);
    }

    const whereClause = conditions.join(' AND ');

    const countRows = await query<any>(
      `SELECT COUNT(*) as total 
       FROM asset_network an
       JOIN assets a ON an.asset_id = a.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const networkList = await query<AssetNetwork>(
      `SELECT 
        an.id,
        an.asset_id,
        a.asset_number,
        a.model as asset_model,
        an.ip_address,
        an.mac_address,
        an.hostname,
        an.network_name,
        an.vlan,
        an.created_at,
        an.updated_at
       FROM asset_network an
       JOIN assets a ON an.asset_id = a.id
       WHERE ${whereClause}
       ORDER BY an.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    return { networkList, total };
  }

  static async getNetworkByAssetId(assetId: number): Promise<AssetNetwork | null> {
    const rows = await query<AssetNetwork>(
      `SELECT 
        an.id,
        an.asset_id,
        a.asset_number,
        a.model as asset_model,
        an.ip_address,
        an.mac_address,
        an.hostname,
        an.network_name,
        an.vlan,
        an.created_at,
        an.updated_at
       FROM asset_network an
       JOIN assets a ON an.asset_id = a.id
       WHERE an.asset_id = ?
       LIMIT 1`,
      [assetId]
    );

    return rows[0] || null;
  }

  static async upsertNetwork(assetId: number, data: NetworkInput): Promise<AssetNetwork> {
    const existing = await query<any>(
      'SELECT id FROM asset_network WHERE asset_id = ? LIMIT 1',
      [assetId]
    );

    if (existing && existing.length > 0) {
      await execute(
        `UPDATE asset_network SET 
          ip_address = ?, mac_address = ?, hostname = ?, network_name = ?, vlan = ?
         WHERE asset_id = ?`,
        [
          data.ip_address || null,
          data.mac_address || null,
          data.hostname || null,
          data.network_name || null,
          data.vlan || null,
          assetId,
        ]
      );
    } else {
      await execute(
        `INSERT INTO asset_network (
          asset_id, ip_address, mac_address, hostname, network_name, vlan
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          assetId,
          data.ip_address || null,
          data.mac_address || null,
          data.hostname || null,
          data.network_name || null,
          data.vlan || null,
        ]
      );
    }

    const saved = await this.getNetworkByAssetId(assetId);
    return saved!;
  }

  static async getVlans(): Promise<string[]> {
    const rows = await query<{ vlan: string }>(
      'SELECT DISTINCT vlan FROM asset_network WHERE vlan IS NOT NULL AND vlan != "" ORDER BY vlan ASC'
    );
    return rows.map((r) => r.vlan);
  }
}
