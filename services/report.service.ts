import { query } from '@/lib/db';

export interface DashboardMetrics {
  totalAssets: number;
  assignedAssets: number;
  inStockAssets: number;
  underMaintenanceAssets: number;
  retiredAssets: number;
  missingAssets: number;
  addedThisMonth: number;
  totalEmployees: number;
  openTickets: number;
  criticalTickets: number;
  ticketBreakdown: {
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    critical: number;
    high: number;
  };
  expiringWarranty: number;
  expiringInsurance: number;
  recentActivity: Array<{
    id: number;
    asset_number: string;
    event_type: string;
    description: string;
    created_at: string;
    performed_by_name: string | null;
  }>;
  recentTickets: Array<{
    id: number;
    ticket_id: string;
    issue_category: string;
    issue_description?: string;
    priority: string;
    status: string;
    created_at: string;
    asset_number: string;
    employee_name: string;
  }>;
  recentAssets: Array<{
    id: number;
    asset_number: string;
    asset_name: string;
    status: string;
    assigned_to: string;
    created_at: string;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
  }>;
  warrantyAlerts: Array<{
    id: number;
    asset_number: string;
    model: string;
    warranty_expiry: string;
  }>;
  insuranceAlerts: Array<{
    id: number;
    asset_number: string;
    provider: string;
    policy_number: string;
    expiry_date: string;
  }>;
}

export class ReportService {
  static async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [assetCounts] = await query<any>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status IN ('in_stock', 'available') THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN status IN ('under_maintenance', 'repair') THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN status IN ('retired', 'disposal', 'disposed') THEN 1 ELSE 0 END) as retired,
        SUM(CASE WHEN status IN ('missing', 'lost', 'unavailable') THEN 1 ELSE 0 END) as missing,
        SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as added_this_month
      FROM assets
    `);

    const [empCount] = await query<any>(`
      SELECT COUNT(*) as total FROM employee WHERE status = 'active' OR is_active = 1
    `);

    const [ticketCounts] = await query<any>(`
      SELECT 
        COUNT(*) as open_total,
        SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_total
      FROM tickets 
      WHERE status NOT IN ('resolved', 'closed')
    `);

    const [ticketBreakdownRow] = await query<any>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('new', 'open') THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_count
      FROM tickets
    `);

    const [warrantyCount] = await query<any>(`
      SELECT COUNT(*) as total 
      FROM assets 
      WHERE warranty_expiry IS NOT NULL 
        AND warranty_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
        AND warranty_expiry >= CURDATE()
    `);

    const [insuranceCount] = await query<any>(`
      SELECT COUNT(*) as total 
      FROM asset_insurance 
      WHERE expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND expiry_date >= CURDATE()
    `);

    const recentActivity = await query<any>(`
      SELECT 
        ah.id,
        a.asset_number,
        ah.event_type,
        ah.description,
        ah.created_at,
        u.full_name as performed_by_name
      FROM asset_history ah
      JOIN assets a ON ah.asset_id = a.id
      LEFT JOIN users u ON ah.performed_by_user_id = u.id
      ORDER BY ah.created_at DESC
      LIMIT 8
    `);

    const recentTickets = await query<any>(`
      SELECT 
        t.id,
        t.ticket_id,
        t.issue_category,
        t.issue_description,
        t.priority,
        t.status,
        t.created_at,
        COALESCE(a.asset_number, '-') as asset_number,
        COALESCE(e.name, e.full_name, 'Unknown') as employee_name
      FROM tickets t
      LEFT JOIN assets a ON t.asset_id = a.id
      LEFT JOIN employee e ON t.employee_id = e.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    const recentAssets = await query<any>(`
      SELECT 
        a.id,
        a.asset_number,
        TRIM(CONCAT(COALESCE(a.brand, ''), ' ', COALESCE(a.model, ''))) as asset_name,
        a.status,
        COALESCE(e.name, e.full_name, '-') as assigned_to,
        COALESCE(a.created_at, a.purchase_date, CURDATE()) as created_at
      FROM assets a
      LEFT JOIN employee e ON a.current_employee_id = e.id
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

    const categoryDistribution = await query<any>(`
      SELECT category, COUNT(*) as count 
      FROM assets 
      GROUP BY category 
      ORDER BY count DESC
    `);

    const warrantyAlerts = await query<any>(`
      SELECT id, asset_number, CONCAT(brand, ' ', model) as model, warranty_expiry
      FROM assets
      WHERE warranty_expiry IS NOT NULL 
        AND warranty_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
        AND warranty_expiry >= CURDATE()
      ORDER BY warranty_expiry ASC
      LIMIT 5
    `);

    const insuranceAlerts = await query<any>(`
      SELECT ai.id, a.asset_number, ai.provider, ai.policy_number, ai.expiry_date
      FROM asset_insurance ai
      JOIN assets a ON ai.asset_id = a.id
      WHERE ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND ai.expiry_date >= CURDATE()
      ORDER BY ai.expiry_date ASC
      LIMIT 5
    `);

    return {
      totalAssets: Number(assetCounts?.total || 0),
      assignedAssets: Number(assetCounts?.assigned || 0),
      inStockAssets: Number(assetCounts?.in_stock || 0),
      underMaintenanceAssets: Number(assetCounts?.maintenance || 0),
      retiredAssets: Number(assetCounts?.retired || 0),
      missingAssets: Number(assetCounts?.missing || 0),
      addedThisMonth: Number(assetCounts?.added_this_month || 0),
      totalEmployees: Number(empCount?.total || 0),
      openTickets: Number(ticketCounts?.open_total || 0),
      criticalTickets: Number(ticketCounts?.critical_total || 0),
      ticketBreakdown: {
        total: Number(ticketBreakdownRow?.total || 0),
        open: Number(ticketBreakdownRow?.open_count || 0),
        in_progress: Number(ticketBreakdownRow?.in_progress_count || 0),
        resolved: Number(ticketBreakdownRow?.resolved_count || 0),
        critical: Number(ticketBreakdownRow?.critical_count || 0),
        high: Number(ticketBreakdownRow?.high_count || 0),
      },
      expiringWarranty: Number(warrantyCount?.total || 0),
      expiringInsurance: Number(insuranceCount?.total || 0),
      recentActivity,
      recentTickets,
      recentAssets,
      categoryDistribution,
      warrantyAlerts,
      insuranceAlerts,
    };
  }

  static async getAssetReport(filters: { category?: string; status?: string } = {}): Promise<any[]> {
    const conditions = ['1=1'];
    const params: any[] = [];

    if (filters.category && filters.category !== 'all') {
      conditions.push('a.category = ?');
      params.push(filters.category);
    }
    if (filters.status && filters.status !== 'all') {
      conditions.push('a.status = ?');
      params.push(filters.status);
    }

    return query(
      `SELECT 
        a.asset_number as "Asset Number",
        a.category as "Category",
        a.brand as "Brand",
        a.model as "Model",
        a.serial_number as "Serial Number",
        a.purchase_date as "Purchase Date",
        a.purchase_cost as "Purchase Cost ($)",
        a.vendor as "Vendor",
        a.warranty_expiry as "Warranty Expiry",
        a.status as "Status",
        IFNULL(COALESCE(e.name, e.full_name), 'Unassigned') as "Current Employee",
        IFNULL(e.department, '-') as "Department"
       FROM assets a
       LEFT JOIN employee e ON a.current_employee_id = e.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.asset_number ASC`,
      params
    );
  }

  static async getEmployeeAssetReport(filters: { department?: string } = {}): Promise<any[]> {
    const conditions = ['1=1'];
    const params: any[] = [];

    if (filters.department && filters.department !== 'all') {
      conditions.push('e.department = ?');
      params.push(filters.department);
    }

    return query(
      `SELECT 
        COALESCE(e.employee_id, CONCAT('TGS-', LPAD(e.id, 3, '0'))) as "Employee ID",
        COALESCE(e.name, e.full_name) as "Employee Name",
        COALESCE(e.department, 'Operations') as "Department",
        COALESCE(e.designation, e.job_title, 'Staff') as "Designation",
        e.email as "Email",
        COALESCE(e.location, 'The Space') as "Location",
        (SELECT COUNT(*) FROM assets a2 WHERE a2.current_employee_id = e.id AND a2.status = 'assigned') as "Total Current Assets",
        IFNULL(a.asset_number, 'None') as "Assigned Asset Number",
        IFNULL(a.category, '-') as "Asset Category",
        IFNULL(a.model, '-') as "Asset Model",
        IFNULL(a.status, 'No Assets') as "Status",
        IFNULL(aa.assigned_date, '-') as "Assigned Date"
       FROM employee e
       LEFT JOIN assets a ON e.id = a.current_employee_id AND a.status = 'assigned'
       LEFT JOIN asset_assignments aa ON a.id = aa.asset_id AND aa.employee_id = e.id AND aa.status = 'assigned'
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.name ASC, a.asset_number ASC`,
      params
    );
  }

  static async getTicketReport(filters: { status?: string; priority?: string } = {}): Promise<any[]> {
    const conditions = ['1=1'];
    const params: any[] = [];

    if (filters.status && filters.status !== 'all') {
      conditions.push('t.status = ?');
      params.push(filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      conditions.push('t.priority = ?');
      params.push(filters.priority);
    }

    return query(
      `SELECT 
        t.ticket_id as "Ticket ID",
        a.asset_number as "Asset Number",
        a.model as "Asset Model",
        COALESCE(e.name, e.full_name) as "Employee Name",
        COALESCE(e.department, 'Operations') as "Department",
        t.issue_category as "Issue Category",
        t.priority as "Priority",
        t.status as "Status",
        IFNULL(u.full_name, 'Unassigned') as "Assigned To",
        t.created_at as "Created Date",
        t.resolved_at as "Resolved Date",
        IFNULL(t.resolution, '-') as "Resolution"
       FROM tickets t
       JOIN assets a ON t.asset_id = a.id
       JOIN employee e ON t.employee_id = e.id
       LEFT JOIN users u ON t.assigned_to_user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC`,
      params
    );
  }

  static async getInsuranceReport(filters: { status?: string } = {}): Promise<any[]> {
    const conditions = ['1=1'];
    const params: any[] = [];

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'expiring') {
        conditions.push('ai.expiry_date >= CURDATE() AND ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
      } else if (filters.status === 'expired') {
        conditions.push('ai.expiry_date < CURDATE()');
      } else if (filters.status === 'active') {
        conditions.push('ai.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
      }
    }

    return query(
      `SELECT 
        a.asset_number as "Asset Number",
        a.model as "Asset Model",
        ai.provider as "Insurance Provider",
        ai.policy_number as "Policy Number",
        ai.start_date as "Start Date",
        ai.expiry_date as "Expiry Date",
        ai.coverage_amount as "Coverage Amount ($)",
        CASE 
          WHEN ai.expiry_date < CURDATE() THEN 'Expired'
          WHEN ai.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring Soon'
          ELSE 'Active'
        END as "Status"
       FROM asset_insurance ai
       JOIN assets a ON ai.asset_id = a.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ai.expiry_date ASC`,
      params
    );
  }

  static async getAssetHistoryReport(filters: { eventType?: string } = {}): Promise<any[]> {
    const conditions = ['1=1'];
    const params: any[] = [];

    if (filters.eventType && filters.eventType !== 'all') {
      conditions.push('ah.event_type = ?');
      params.push(filters.eventType);
    }

    return query(
      `SELECT 
        a.asset_number as "Asset Number",
        a.model as "Asset Model",
        ah.event_type as "Event Type",
        ah.description as "Description",
        IFNULL(u.full_name, 'System') as "Performed By",
        ah.created_at as "Timestamp"
       FROM asset_history ah
       JOIN assets a ON ah.asset_id = a.id
       LEFT JOIN users u ON ah.performed_by_user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ah.created_at DESC
       LIMIT 500`,
      params
    );
  }
}
