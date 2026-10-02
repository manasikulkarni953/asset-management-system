'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { formatDate } from '@/lib/utils';
import type { EmployeeDetailed } from '@/types/employee';

export default function MyProfilePage() {
  const [employee, setEmployee] = useState<EmployeeDetailed | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/employees').then((r) => r.json()),
      fetch('/api/tickets?limit=10').then((r) => r.json()),
    ])
      .then(async ([empData, ticketData]) => {
        if (empData.employees && empData.employees.length > 0) {
          const empId = empData.employees[0].id;
          const fullRes = await fetch(`/api/employees/${empId}`);
          const fullData = await fullRes.json();
          if (fullData.employee) {
            setEmployee(fullData.employee);
          }
        }
        if (ticketData.tickets) {
          setTickets(ticketData.tickets);
        }
      })
      .catch((err) => console.error('Error loading employee profile:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const assetColumns: Column<any>[] = [
    {
      key: 'asset_number',
      header: 'Asset Number',
      render: (row) => (
        <span className="font-mono font-bold text-slate-800 text-xs">
          {row.asset_number}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-xs text-slate-700 font-medium">{row.category}</span>,
    },
    {
      key: 'model',
      header: 'Hardware Model',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900 block text-xs">{row.brand} {row.model}</span>
          <span className="text-[10px] text-slate-400 font-mono">SN: {row.serial_number}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <Link href={`/tickets/new?assetId=${row.id}&employeeId=${employee?.id}`}>
          <Button variant="outline" size="sm" className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 py-1 px-2.5">
            Raise Ticket →
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee ? employee.name : 'My Employee Profile'}
        description="View your corporate identity, assigned hardware equipment, physical workstation, and raised support requests."
        action={
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
              Raise New Ticket
            </Button>
          </Link>
        }
      />

      {/* Staff Profile Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-400">Employee Code</span>
          <p className="text-base font-bold text-slate-900 mt-0.5 font-mono">{employee?.employee_id || '—'}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-400">Corporate Email</span>
          <p className="text-xs font-semibold text-slate-900 mt-1 truncate">{employee?.email || '—'}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-400">Department</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">{employee?.department || '—'}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-400">Designation</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">{employee?.designation || '—'}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-400">Workstation / Desk</span>
          <p className="text-sm font-bold text-indigo-700 mt-0.5 font-mono">{employee?.workstation || 'Not Assigned'}</p>
        </div>
        <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200">
          <span className="text-[10px] font-bold uppercase text-indigo-700">Assigned Assets</span>
          <p className="text-xl font-bold text-indigo-950 mt-0.5 font-mono">
            {employee?.current_assets?.length || 0}
          </p>
        </div>
      </div>

      {/* Assigned Equipment Card */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <span>My Assigned Equipment</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
              {employee?.current_assets?.length || 0}
            </span>
          </div>
        }
        subtitle="Physical devices currently in your possession. Click 'Raise Ticket' if any hardware is damaged or malfunctioning."
      >
        <DataTable
          columns={assetColumns}
          data={employee?.current_assets || []}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          emptyTitle="No Assets Currently Assigned"
          emptyDescription="You do not have any company hardware currently assigned to your account."
        />
      </Card>

      {/* My Support Tickets */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span>My Support Tickets</span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                {tickets.length}
              </span>
            </div>
            <Link href="/tickets">
              <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                View All Tickets →
              </Button>
            </Link>
          </div>
        }
        subtitle="Active and resolved support requests raised for your workstation or assigned equipment."
      >
        <div className="divide-y divide-slate-100">
          {tickets.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No active tickets.</p>
          ) : (
            tickets.slice(0, 5).map((tk) => (
              <div key={tk.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600">{tk.ticket_id}</span>
                    <span className="font-medium text-xs text-slate-800">{tk.issue_category}</span>
                    <StatusBadge status={tk.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{tk.issue_description}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block">{formatDate(tk.created_at)}</span>
                  <Link href={`/tickets/${tk.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                    View Details
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
