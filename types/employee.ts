export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';

export interface Employee {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  location: string;
  workstation?: string | null;
  phone_number?: string | null;
  status: EmployeeStatus;
  asset_count?: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDetailed extends Employee {
  current_assets?: Array<{
    id: number;
    asset_number: string;
    category: string;
    brand: string;
    model: string;
    serial_number: string;
    status: string;
    assigned_date: string;
  }>;
  assignment_history?: Array<{
    id: number;
    asset_id: number;
    asset_number: string;
    category: string;
    brand: string;
    model: string;
    assigned_date: string;
    returned_date: string | null;
    status: string;
    notes: string | null;
  }>;
  tickets?: Array<{
    id: number;
    ticket_id: string;
    asset_number: string;
    issue_category: string;
    priority: string;
    status: string;
    created_at: string;
  }>;
}
