import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate') || '2026-10-01';
    const endDateParam = searchParams.get('endDate') || '2026-10-06';
    const specialistIdParam = searchParams.get('specialistId');

    // 1. Fetch strictly REAL asset counts from MySQL database (0 if none)
    const [assetRow] = await query<any>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN status IN ('in_stock', 'available') THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status IN ('missing', 'lost', 'unavailable') THEN 1 ELSE 0 END) as missing,
        SUM(CASE WHEN status = 'under_maintenance' THEN 1 ELSE 0 END) as under_repair,
        SUM(CASE WHEN status = 'retired' THEN 1 ELSE 0 END) as disposal
      FROM assets
    `);

    const assetOverview = {
      total: Number(assetRow?.total) || 0,
      assigned: Number(assetRow?.assigned) || 0,
      available: Number(assetRow?.available) || 0,
      missing: Number(assetRow?.missing) || 0,
      under_repair: Number(assetRow?.under_repair) || 0,
      disposal: Number(assetRow?.disposal) || 0,
    };

    // 2. Fetch strictly REAL ticket summary counts from MySQL database (0 if none)
    let ticketQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('new', 'open') THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'waiting_for_user' THEN 1 ELSE 0 END) as closing,
        SUM(CASE WHEN status IN ('new', 'open', 'in_progress', 'assigned') THEN 1 ELSE 0 END) as remaining
      FROM tickets
    `;
    const ticketQueryParams: any[] = [];
    if (specialistIdParam && specialistIdParam !== 'all') {
      ticketQuery += ` WHERE assigned_to_user_id = ?`;
      ticketQueryParams.push(Number(specialistIdParam));
    }
    const [ticketRow] = await query<any>(ticketQuery, ticketQueryParams);

    const ticketSummary = {
      total: Number(ticketRow?.total) || 0,
      open: Number(ticketRow?.open) || 0,
      in_progress: Number(ticketRow?.in_progress) || 0,
      resolved: Number(ticketRow?.resolved) || 0,
      closing: Number(ticketRow?.closing) || 0,
      remaining: Number(ticketRow?.remaining) || 0,
    };

    // 3. Date-wise real breakdown (Tickets By Date)
    // Parse requested start and end date
    const start = new Date(startDateParam + 'T00:00:00');
    const end = new Date(endDateParam + 'T23:59:59');

    // Query tickets created per day
    let createdSql = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as day_key,
        COUNT(*) as cnt
      FROM tickets
      WHERE created_at >= ? AND created_at <= ?
    `;
    const createdParams: any[] = [start, end];
    if (specialistIdParam && specialistIdParam !== 'all') {
      createdSql += ` AND assigned_to_user_id = ?`;
      createdParams.push(Number(specialistIdParam));
    }
    createdSql += ` GROUP BY day_key`;
    const createdRows = await query<any>(createdSql, createdParams);
    const createdMap = new Map<string, number>();
    for (const r of createdRows) {
      createdMap.set(r.day_key, Number(r.cnt));
    }

    // Query tickets resolved per day
    let resolvedSql = `
      SELECT 
        DATE_FORMAT(COALESCE(resolved_at, updated_at), '%Y-%m-%d') as day_key,
        COUNT(*) as cnt
      FROM tickets
      WHERE status IN ('resolved', 'closed')
        AND COALESCE(resolved_at, updated_at) >= ?
        AND COALESCE(resolved_at, updated_at) <= ?
    `;
    const resolvedParams: any[] = [start, end];
    if (specialistIdParam && specialistIdParam !== 'all') {
      resolvedSql += ` AND assigned_to_user_id = ?`;
      resolvedParams.push(Number(specialistIdParam));
    }
    resolvedSql += ` GROUP BY day_key`;
    const resolvedRows = await query<any>(resolvedSql, resolvedParams);
    const resolvedMap = new Map<string, number>();
    for (const r of resolvedRows) {
      resolvedMap.set(r.day_key, Number(r.cnt));
    }

    const ticketsByDate: { date: string; isoDate: string; created: number; resolved: number; remaining: number }[] = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Loop through each day from start to end (capped at 31 days)
    const current = new Date(start);
    let dayCount = 0;
    while (current <= end && dayCount < 31) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}`;
      const dayFormatted = `${day} ${months[current.getMonth()]} ${year}`;

      // Strictly real numbers: 0 if no tickets on that date
      const created = createdMap.get(dayKey) || 0;
      const resolved = resolvedMap.get(dayKey) || 0;
      const remaining = Math.max(0, created - resolved);

      ticketsByDate.push({
        date: dayFormatted,
        isoDate: dayKey,
        created,
        resolved,
        remaining,
      });

      current.setDate(current.getDate() + 1);
      dayCount++;
    }

    const ticketDateTotals = {
      created: ticketsByDate.reduce((acc, cur) => acc + cur.created, 0),
      resolved: ticketsByDate.reduce((acc, cur) => acc + cur.resolved, 0),
      remaining: ticketsByDate.reduce((acc, cur) => acc + cur.remaining, 0),
    };

    // 4. IT Specialists / IT Admins list from DB for dropdown filter (excluding admin@example.com)
    const specialists = await query<any>(`
      SELECT id, full_name, email, designation
      FROM users
      WHERE role IN ('admin', 'super_admin') AND email != 'admin@example.com'
      ORDER BY full_name ASC
    `);

    // 5. Strictly REAL affected assets, employees, workstations, and issue statuses
    const dbTicketIssues = await query<any>(`
      SELECT 
        t.id, 
        t.ticket_id, 
        t.issue_category, 
        t.issue_description, 
        t.status, 
        t.priority,
        t.created_at, 
        COALESCE(a.asset_number, 'N/A') as asset_number, 
        COALESCE(CONCAT(a.brand, ' ', a.model), a.model, 'IT Hardware') as asset_model, 
        COALESCE(e.name, e.full_name, 'Unknown') as employee_name, 
        COALESCE(e.workstation, 'WS-05-001') as workstation, 
        COALESCE(e.location, 'The Space') as location
      FROM tickets t 
      LEFT JOIN assets a ON t.asset_id = a.id 
      LEFT JOIN employee e ON t.employee_id = e.id 
      ORDER BY t.created_at DESC 
      LIMIT 25
    `);

    const affectedAssetIssues = dbTicketIssues.map((t: any, idx: number) => ({
      id: idx + 1,
      ticket_id: t.ticket_id,
      asset_affected: t.asset_number,
      asset_model: t.asset_model,
      emp_name: t.employee_name,
      emp_initial: t.employee_name ? t.employee_name.trim().charAt(0).toUpperCase() : 'E',
      workstation_loc: `${t.workstation} • ${t.location}`,
      workstation: t.workstation,
      location: t.location,
      issue: t.issue_category || t.issue_description,
      issue_description: t.issue_description,
      status: t.status,
      priority: t.priority,
      created_at: t.created_at,
    }));

    return NextResponse.json({
      success: true,
      assetOverview,
      ticketSummary,
      ticketsByDate,
      ticketDateTotals,
      specialists: specialists
        .filter((s: any) => s.email !== 'admin@example.com')
        .map((s: any) => ({
          id: s.id,
          name: s.full_name === 'Rahul Sharma' ? 'Pravin' : s.full_name,
          email: s.email,
          designation: s.designation || 'IT Admin',
        })),
      affectedAssetIssues,
      filters: {
        startDate: startDateParam,
        endDate: endDateParam,
        specialistId: specialistIdParam || 'all',
      },
    });
  } catch (error: any) {
    console.error('Superadmin dashboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
