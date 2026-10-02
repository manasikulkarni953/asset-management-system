'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard } from '@/components/data-display/StatsCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Timeline, TimelineItem } from '@/components/data-display/Timeline';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { formatDate } from '@/lib/utils';
import type { DashboardMetrics } from '@/services/report.service';
import type { ITSpecialistWorkload } from '@/services/user.service';
import type { EmployeeDetailed } from '@/types/employee';

export default function DashboardPage() {
  const [user, setUser] = useState<{
    id?: number;
    fullName?: string;
    role?: 'super_admin' | 'admin' | 'employee';
    email?: string;
    designation?: string | null;
  } | null>(null);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [specialists, setSpecialists] = useState<ITSpecialistWorkload[]>([]);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeDetailed | null>(null);
  const [employeeTickets, setEmployeeTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Identify current authenticated user
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (authData) => {
        if (!authData?.user) return;
        const currentUser = authData.user;
        setUser(currentUser);

        // 2. Fetch role-specific datasets
        if (currentUser.role === 'employee') {
          // Employee portal data
          const [empRes, tktRes] = await Promise.all([
            fetch('/api/employees'),
            fetch('/api/tickets?limit=10'),
          ]);
          const empJson = await empRes.json();
          const tktJson = await tktRes.json();
          if (empJson.employees && empJson.employees.length > 0) {
            const fullEmpRes = await fetch(`/api/employees/${empJson.employees[0].id}`);
            const fullEmpData = await fullEmpRes.json();
            if (fullEmpData.employee) {
              setEmployeeProfile(fullEmpData.employee);
            }
          }
          if (tktJson.tickets) {
            setEmployeeTickets(tktJson.tickets);
          }
        } else {
          // Admin & Super Admin datasets
          const reportRes = await fetch('/api/reports?type=dashboard');
          const reportData = await reportRes.json();
          if (reportData.metrics) {
            setMetrics(reportData.metrics);
          }

          // Super Admin exclusive IT Specialist analytics
          if (currentUser.role === 'super_admin') {
            const specRes = await fetch('/api/admin/it-specialists');
            if (specRes.ok) {
              const specData = await specRes.json();
              if (specData.specialists) {
                setSpecialists(specData.specialists);
              }
            }
          }
        }
      })
      .catch((err) => console.error('Dashboard init error:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const timelineItems: TimelineItem[] =
    metrics?.recentActivity?.map((act) => ({
      id: act.id,
      title: `${act.asset_number} • ${act.event_type.replace('_', ' ').toUpperCase()}`,
      description: act.description,
      timestamp: act.created_at,
      user: act.performed_by_name,
      type: act.event_type,
    })) || [];

  // ==========================================================
  // VIEW 1: EMPLOYEE SELF-SERVICE PORTAL (Section 19 & 20)
  // ==========================================================
  if (user?.role === 'employee') {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome back, ${employeeProfile ? employeeProfile.name : user.fullName}`}
          description="Employee Self-Service Portal. View your physical equipment, reported issues, and raise hardware maintenance tickets."
          action={
            <div className="flex items-center gap-2">
              <Link href="/scan">
                <Button variant="outline" size="sm">
                  Scan Barcode
                </Button>
              </Link>
              <Link href="/tickets/new">
                <Button
                  variant="primary"
                  size="sm"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  Raise Ticket
                </Button>
              </Link>
            </div>
          }
        />

        {/* Employee Summary Card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400">Employee Code</span>
            <p className="text-base font-bold text-slate-900 mt-0.5 font-mono">{employeeProfile?.employee_id || '—'}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400">Department</span>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{employeeProfile?.department || '—'}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400">Designation</span>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{employeeProfile?.designation || '—'}</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400">Building</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">The Space</p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400">Workstation / Desk</span>
            <p className="text-sm font-bold text-indigo-700 mt-0.5 font-mono">{employeeProfile?.workstation || 'WS-5-042'}</p>
          </div>
          <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200">
            <span className="text-[10px] font-bold uppercase text-indigo-700">My Assigned Assets</span>
            <p className="text-xl font-bold text-indigo-950 mt-0.5 font-mono">
              {employeeProfile?.current_assets?.length || 0}
            </p>
          </div>
        </div>

        {/* Assigned Hardware Cards */}
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span>My Assigned Assets</span>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                  {employeeProfile?.current_assets?.length || 0}
                </span>
              </div>
              <Link href="/my-assets">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                  View Full Asset List →
                </Button>
              </Link>
            </div>
          }
          subtitle="Devices and accessories registered in your possession. Click 'Raise Ticket' to report hardware failure."
        >
          {(!employeeProfile?.current_assets || employeeProfile.current_assets.length === 0) ? (
            <p className="text-xs text-slate-400 py-6 text-center">No hardware assets currently assigned to your account.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {employeeProfile.current_assets.map((asset) => (
                <div key={asset.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{asset.asset_number}</span>
                      <StatusBadge status={asset.status} size="sm" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-1">{asset.brand} {asset.model}</p>
                    <p className="text-[11px] text-slate-400 font-mono">SN: {asset.serial_number}</p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
                    <Link href={`/tickets/new?assetId=${asset.id}&employeeId=${employeeProfile.id}`}>
                      <Button variant="outline" size="sm" className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 py-1 px-2.5">
                        Raise Ticket →
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* My Open & Recent Tickets */}
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span>My Active & Recent Tickets</span>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                  {employeeTickets.length}
                </span>
              </div>
              <Link href="/tickets">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                  All Support Tickets →
                </Button>
              </Link>
            </div>
          }
          subtitle="Real-time status of service desk tickets reported for your assigned devices or workstation."
        >
          {employeeTickets.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">You have no active support tickets.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {employeeTickets.map((tk) => (
                <div key={tk.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-blue-600">{tk.ticket_id}</span>
                      <span className="font-semibold text-xs text-slate-800">{tk.issue_category}</span>
                      <StatusBadge status={tk.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tk.issue_description}</p>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                      Location: {tk.raised_building || 'The Space'} • {tk.raised_floor || '5th Floor'} • {tk.raised_workstation || 'WS-5-042'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">{formatDate(tk.created_at)}</span>
                    <Link href={`/tickets/${tk.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                      View Ticket →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ==========================================================
  // VIEW 2: ADMIN & SUPER ADMIN OPERATIONAL DASHBOARDS
  // ==========================================================
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <PageHeader
        title={isSuperAdmin ? 'Enterprise Oversight Command Center' : 'Operational Service Desk Command Center'}
        description={
          isSuperAdmin
            ? 'Complete system administration, IT specialist workload tracking, hardware lifecycle metrics, and active support tickets.'
            : 'Daily operational management: hardware lifecycle tracking, inventory status, custodian assignments, and active ticket triage.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isSuperAdmin && (
              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50">
                  User Management
                </Button>
              </Link>
            )}
            <Link href="/scan">
              <Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                Scan Barcode
              </Button>
            </Link>
            <Link href="/tickets/new">
              <Button variant="outline" size="sm" className="border-rose-200 text-rose-700 hover:bg-rose-50">
                Raise Ticket
              </Button>
            </Link>
            <Link href="/assets/add">
              <Button variant="primary" size="sm">
                Register Asset
              </Button>
            </Link>
          </div>
        }
      />

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatsCard
          title="Total Assets"
          value={isLoading ? '-' : metrics?.totalAssets || 0}
          color="blue"
          description="In MySQL database"
        />
        <StatsCard
          title="In Stock"
          value={isLoading ? '-' : metrics?.inStockAssets || 0}
          color="emerald"
          description="Available for assignment"
        />
        <StatsCard
          title="Assigned Assets"
          value={isLoading ? '-' : metrics?.assignedAssets || 0}
          color="purple"
          description="In active employee custody"
        />
        <StatsCard
          title="Open Tickets"
          value={isLoading ? '-' : metrics?.openTickets || 0}
          color="rose"
          description="Requiring IT response"
        />
        <StatsCard
          title={isSuperAdmin ? 'IT Specialists' : 'Under Repair'}
          value={
            isLoading
              ? '-'
              : isSuperAdmin
              ? specialists.length
              : metrics?.underMaintenanceAssets || 0
          }
          color="amber"
          description={isSuperAdmin ? 'Active technicians' : 'Maintenance in progress'}
        />
      </div>

      {/* 3. SUPER ADMIN EXCLUSIVE: IT SPECIALIST WORKLOAD SECTION (Section 6 & 7) */}
      {isSuperAdmin && (
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span>IT Specialist Ticket Workload & Performance</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold">
                  {specialists.length} Specialists
                </span>
              </div>
              <Link href="/admin/it-specialists">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                  Full Analytics & Drilldown →
                </Button>
              </Link>
            </div>
          }
          subtitle="Factual operational ticket statistics assigned to each IT Specialist (role = admin, designation = IT Specialist)."
        >
          {specialists.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No IT specialists registered in the system.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {specialists.map((sp) => (
                <div key={sp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{sp.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">{sp.designation}</p>
                    </div>
                    <span className="text-xl font-bold font-mono text-slate-900">{sp.total_assigned}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-slate-200 text-center">
                    <div className="p-1 rounded bg-blue-50 border border-blue-100">
                      <span className="text-[9px] uppercase font-bold text-blue-600 block">New</span>
                      <span className="text-xs font-bold font-mono text-blue-950">{sp.new_tickets}</span>
                    </div>
                    <div className="p-1 rounded bg-amber-50 border border-amber-100">
                      <span className="text-[9px] uppercase font-bold text-amber-600 block">Active</span>
                      <span className="text-xs font-bold font-mono text-amber-950">{sp.in_progress_tickets}</span>
                    </div>
                    <div className="p-1 rounded bg-emerald-50 border border-emerald-100">
                      <span className="text-[9px] uppercase font-bold text-emerald-600 block">Resolved</span>
                      <span className="text-xs font-bold font-mono text-emerald-950">{sp.resolved_tickets}</span>
                    </div>
                    <div className="p-1 rounded bg-slate-100 border border-slate-200">
                      <span className="text-[9px] uppercase font-bold text-slate-600 block">Closed</span>
                      <span className="text-xs font-bold font-mono text-slate-800">{sp.closed_tickets}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 4. Active Ticket Queue & Recent Lifecycle Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <span>Operational Ticket Queue</span>
              <Link href="/tickets">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                  View All Tickets →
                </Button>
              </Link>
            </div>
          }
          subtitle="Support requests requiring triage, diagnosis, or resolution."
        >
          {(!metrics?.recentTickets || metrics.recentTickets.length === 0) ? (
            <p className="text-xs text-slate-400 py-6 text-center">No open tickets in queue.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.recentTickets.map((ticket: any) => (
                <div key={ticket.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/tickets/${ticket.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                        {ticket.ticket_id}
                      </Link>
                      <span className="text-xs font-medium text-slate-800">{ticket.issue_category}</span>
                      <StatusBadge status={ticket.priority} size="sm" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.issue_description}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Desk: {ticket.raised_workstation || 'Not specified'} • Custodian: {ticket.employee_name}
                    </span>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={ticket.status} size="sm" />
                    <Link href={`/tickets/${ticket.id}`} className="text-xs text-blue-600 hover:underline block mt-1">
                      Manage →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Recent Hardware Activity"
          subtitle="Real-time audit log of asset registrations, custodian assignments, and transfers."
        >
          <Timeline items={timelineItems} emptyMessage="No recent activity logged in database." />
        </Card>
      </div>
    </div>
  );
}
