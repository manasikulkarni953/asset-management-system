export type AssetStatus = 'in_stock' | 'assigned' | 'under_maintenance' | 'retired';

export interface Asset {
  id: number;
  asset_id: string;
  asset_number: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  purchase_cost: number | string;
  vendor: string;
  vendor_phone?: string | null;
  vendor_email?: string | null;
  location?: string | null;
  warranty_expiry: string | null;
  status: AssetStatus;
  current_employee_id: number | null;
  current_employee_name?: string | null;
  current_employee_code?: string | null;
  created_at: string;
  updated_at: string;
}

export type AssetHistoryEventType =
  | 'created'
  | 'assigned'
  | 'transferred'
  | 'returned'
  | 'maintenance'
  | 'ticket_raised'
  | 'ticket_resolved'
  | 'status_changed'
  | 'retired';

export interface AssetHistory {
  id: number;
  asset_id: number;
  event_type: AssetHistoryEventType;
  description: string;
  performed_by_user_id: number | null;
  performed_by_name?: string | null;
  metadata?: string | null;
  created_at: string;
}

export type InsuranceStatus = 'active' | 'expiring' | 'expired';

export interface AssetInsurance {
  id: number;
  asset_id: number;
  asset_number?: string;
  asset_name?: string;
  asset_model?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  provider: string;
  policy_number: string;
  start_date: string;
  expiry_date: string;
  coverage_amount: number | string;
  document_url?: string | null;
  notes?: string | null;
  status: InsuranceStatus;
  employee_id?: string | null;
  employee_name?: string | null;
  department?: string | null;
  workstation?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetNetwork {
  id: number;
  asset_id: number;
  asset_number?: string;
  asset_name?: string;
  asset_model?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  ip_address: string | null;
  assignment_type: 'DHCP' | 'Static';
  subnet_mask?: string | null;
  gateway?: string | null;
  dns_server?: string | null;
  mac_address: string | null;
  hostname: string | null;
  network_name: string | null;
  vlan: string | null;
  notes?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  department?: string | null;
  workstation?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetDetailed extends Asset {
  insurance?: AssetInsurance | null;
  network?: AssetNetwork | null;
  history?: AssetHistory[];
  assignments?: any[];
  tickets?: any[];
}

export type DamageSeverity = 'minor' | 'moderate' | 'severe' | 'total_loss';
export type DamageRepairStatus =
  | 'reported'
  | 'under_investigation'
  | 'sent_for_repair'
  | 'repaired'
  | 'written_off'
  | 'replaced';

export interface DamagedAsset {
  id: number;
  asset_id: number;
  asset_number?: string;
  asset_system_id?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  employee_id?: number | null;
  employee_name?: string | null;
  employee_code?: string | null;
  employee_department?: string | null;
  employee_workstation?: string | null;
  ticket_id?: number | null;
  ticket_code?: string | null;
  damage_type: string;
  severity: DamageSeverity;
  incident_date: string;
  reported_date: string;
  description: string;
  repair_status: DamageRepairStatus;
  repair_cost_estimate: number | string;
  actual_repair_cost: number | string;
  insurance_claimed: boolean;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

