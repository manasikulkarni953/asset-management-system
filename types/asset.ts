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
  asset_model?: string;
  provider: string;
  policy_number: string;
  start_date: string;
  expiry_date: string;
  coverage_amount: number | string;
  document_url: string | null;
  status: InsuranceStatus;
  created_at: string;
  updated_at: string;
}

export interface AssetNetwork {
  id: number;
  asset_id: number;
  asset_number?: string;
  asset_model?: string;
  ip_address: string | null;
  mac_address: string | null;
  hostname: string | null;
  network_name: string | null;
  vlan: string | null;
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
