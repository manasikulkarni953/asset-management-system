export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type TicketStatus =
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'waiting_for_user'
  | 'resolved'
  | 'closed';

export const FIXED_TICKET_LOCATION = {
  building: 'The Space',
  floor: '5th Floor',
} as const;

export interface Ticket {
  id: number;
  ticket_id: string;
  asset_id: number;
  asset_number?: string;
  asset_category?: string;
  asset_brand?: string;
  asset_model?: string;
  asset_system_id?: string;
  asset_serial_number?: string;
  employee_id: number;
  employee_name?: string;
  employee_code?: string;
  raised_building?: string;
  raised_floor?: string;
  raised_workstation?: string | null;
  issue_category: string;
  issue_description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to?: number | null;
  assigned_to_user_id: number | null;
  assigned_to_name?: string | null;
  assigned_to_designation?: string | null;
  attachment_url: string | null;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  updated_at: string;
}

export interface TicketHistory {
  id: number;
  ticket_id: number;
  old_status: string | null;
  new_status: string;
  comment: string | null;
  changed_by_user_id: number | null;
  changed_by_name?: string | null;
  created_at: string;
}

export interface TicketDetailed extends Ticket {
  history?: TicketHistory[];
}
