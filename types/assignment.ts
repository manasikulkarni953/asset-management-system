export type AssignmentStatus = 'assigned' | 'transferred' | 'returned';

export interface AssetAssignment {
  id: number;
  asset_id: number;
  asset_number?: string;
  asset_category?: string;
  asset_brand?: string;
  asset_model?: string;
  employee_id: number;
  employee_name?: string;
  employee_code?: string;
  employee_department?: string;
  assigned_date: string;
  returned_date: string | null;
  status: AssignmentStatus;
  notes: string | null;
  assigned_by_user_id: number | null;
  assigned_by_name?: string | null;
  created_at: string;
}
