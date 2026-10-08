import { query, execute } from '@/lib/db';
import { AssetNetwork } from '@/types/asset';
import { NetworkInput } from '@/validations/asset.validation';

export interface NetworkFilterOptions {
  search?: string;
  assignment_type?: string;
  vlan?: string;
  page?: number;
  limit?: number;
  employeeId?: number; // for role-based data isolation
}

export interface NetworkStats {
  totalConfigured: number;
  staticIp: number;
  dhcp: number;
  totalVlans: number;
}

export class NetworkService {
  static async getNetworkStats(employeeId?: number): Promise<NetworkStats> {
    const conditions: string[] = ['an.ip_address IS NOT NULL AND an.ip_address != ""'];
    const params: any[] = [];

    if (employeeId) {
      conditions.push('a.current_employee_id = ?');
      params.push(employeeId);
    }

    const whereClause = conditions.join(' AND ');

    const rows = await query<any>(
      `SELECT 
        COUNT(*) as totalConfigured,
        SUM(CASE WHEN LOWER(an.assignment_type) = 'static' THEN 1 ELSE 0 END) as staticIp,
        SUM(CASE WHEN LOWER(an.assignment_type) = 'dhcp' THEN 1 ELSE 0 END) as dhcp,
        COUNT(DISTINCT NULLIF(TRIM(an.vlan), '')) as totalVlans
       FROM asset_network an
       JOIN assets a ON an.asset_id = a.id
       WHERE ${whereClause}`,
      params
    );

    const r = rows[0] || {};
    return {
      totalConfigured: Number(r.totalConfigured) || 0,
      staticIp: Number(r.staticIp) || 0,
      dhcp: Number(r.dhcp) || 0,
      totalVlans: Number(r.totalVlans) || 0,
    };
  }

  static async getNetworkList(
    options: NetworkFilterOptions = {}
  ): Promise<{ networkList: AssetNetwork[]; total: number; stats: NetworkStats; vlans: string[] }> {
    const { search, assignment_type, vlan, page = 1, limit = 20, employeeId } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (employeeId) {
      conditions.push('a.current_employee_id = ?');
      params.push(employeeId);
    }

    if (search && search.trim() !== '') {
      conditions.push(
        `(
          a.asset_number LIKE ? OR 
          CONCAT(a.brand, " ", a.model) LIKE ? OR 
          an.ip_address LIKE ? OR 
          an.mac_address LIKE ? OR 
          an.hostname LIKE ? OR 
          an.vlan LIKE ? OR 
          an.network_name LIKE ?
        )`
      );
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
    }

    if (assignment_type && assignment_type !== 'all') {
      conditions.push('LOWER(an.assignment_type) = LOWER(?)');
      params.push(assignment_type);
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
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    const networkList = await query<AssetNetwork>(
      `SELECT 
        an.id,
        an.asset_id,
        a.asset_number,
        CONCAT(a.brand, ' ', a.model) as asset_name,
        a.brand,
        a.model as asset_model,
        a.model,
        a.serial_number,
        an.ip_address,
        COALESCE(an.assignment_type, 'Static') as assignment_type,
        an.subnet_mask,
        an.gateway,
        an.dns_server,
        an.mac_address,
        an.hostname,
        an.network_name,
        an.vlan,
        an.notes,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.department, 'Operations') as department,
        e.workstation,
        an.created_at,
        an.updated_at
       FROM asset_network an
       JOIN assets a ON an.asset_id = a.id
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE ${whereClause}
       ORDER BY an.id DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const stats = await this.getNetworkStats(employeeId);
    const vlans = await this.getVlans();

    return { networkList, total, stats, vlans };
  }

  static async getNetworkByAssetId(assetId: number): Promise<AssetNetwork | null> {
    const rows = await query<AssetNetwork>(
      `SELECT 
        an.id,
        an.asset_id,
        a.asset_number,
        CONCAT(a.brand, ' ', a.model) as asset_name,
        a.brand,
        a.model as asset_model,
        a.model,
        a.serial_number,
        an.ip_address,
        COALESCE(an.assignment_type, 'Static') as assignment_type,
        an.subnet_mask,
        an.gateway,
        an.dns_server,
        an.mac_address,
        an.hostname,
        an.network_name,
        an.vlan,
        an.notes,
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as employee_id,
        COALESCE(e.name, e.full_name) as employee_name,
        COALESCE(e.department, 'Operations') as department,
        e.workstation,
        an.created_at,
        an.updated_at
       FROM asset_network an
       JOIN assets a ON an.asset_id = a.id
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE an.asset_id = ?
       LIMIT 1`,
      [assetId]
    );

    return rows[0] || null;
  }

  static async upsertNetwork(assetId: number, data: NetworkInput): Promise<AssetNetwork> {
    // 1. Verify asset exists
    const assetCheck = await query<any>(
      'SELECT id, asset_number, brand, model FROM assets WHERE id = ? LIMIT 1',
      [assetId]
    );
    if (!assetCheck || assetCheck.length === 0) {
      throw new Error(`Asset with ID ${assetId} does not exist.`);
    }

    const ipAddress = data.ip_address?.trim() || null;
    const macAddress = data.mac_address?.trim() || null;

    // 2. Validate uniqueness of IP Address (if provided)
    if (ipAddress) {
      const duplicateIp = await query<any>(
        'SELECT an.id, a.asset_number FROM asset_network an JOIN assets a ON an.asset_id = a.id WHERE an.ip_address = ? AND an.asset_id != ? LIMIT 1',
        [ipAddress, assetId]
      );
      if (duplicateIp.length > 0) {
        throw new Error(
          `IP address '${ipAddress}' is already assigned to active asset ${duplicateIp[0].asset_number}.`
        );
      }
    }

    // 3. Validate uniqueness of MAC Address (if provided)
    if (macAddress) {
      const duplicateMac = await query<any>(
        'SELECT an.id, a.asset_number FROM asset_network an JOIN assets a ON an.asset_id = a.id WHERE UPPER(an.mac_address) = UPPER(?) AND an.asset_id != ? LIMIT 1',
        [macAddress, assetId]
      );
      if (duplicateMac.length > 0) {
        throw new Error(
          `MAC address '${macAddress}' is already assigned to asset ${duplicateMac[0].asset_number}.`
        );
      }
    }

    const assignmentType = data.assignment_type || 'Static';
    const subnetMask = data.subnet_mask?.trim() || '255.255.255.0';
    const gateway = data.default_gateway?.trim() || null;
    const dnsServer = data.dns_server?.trim() || null;
    const hostname = data.hostname?.trim() || null;
    const networkName = data.network_name?.trim() || null;
    const vlan = data.vlan?.trim() || null;
    const notes = data.notes?.trim() || null;

    const existing = await query<any>(
      'SELECT id FROM asset_network WHERE asset_id = ? LIMIT 1',
      [assetId]
    );

    if (existing && existing.length > 0) {
      await execute(
        `UPDATE asset_network SET 
          ip_address = ?, 
          assignment_type = ?, 
          subnet_mask = ?, 
          gateway = ?, 
          dns_server = ?, 
          mac_address = ?, 
          hostname = ?, 
          network_name = ?, 
          vlan = ?, 
          notes = ?
         WHERE asset_id = ?`,
        [
          ipAddress,
          assignmentType,
          subnetMask,
          gateway,
          dnsServer,
          macAddress,
          hostname,
          networkName,
          vlan,
          notes,
          assetId,
        ]
      );
    } else {
      await execute(
        `INSERT INTO asset_network (
          asset_id, ip_address, assignment_type, subnet_mask, gateway, 
          dns_server, mac_address, hostname, network_name, vlan, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assetId,
          ipAddress,
          assignmentType,
          subnetMask,
          gateway,
          dnsServer,
          macAddress,
          hostname,
          networkName,
          vlan,
          notes,
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
