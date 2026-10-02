'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { DataTable } from '@/components/data-display/DataTable';
import { Spinner } from '@/components/ui/Spinner';
import { EmployeeDetailed } from '@/types/employee';
import { formatDate } from '@/lib/utils';

export default function EmployeeDetailsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);
  const [employee, setEmployee] = useState<EmployeeDetailed | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/employees/${employeeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.employee) setEmployee(data.employee);
      })
      .catch((err) => console.error('Error fetching employee:', err))
      .finally(() => setIsLoading(false));
  }, [employeeId]);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading employee profile...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-slate-800">Employee Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">No employee matches ID {employeeId}.</p>
        <Link href="/employees" className="mt-4 inline-block">
          <Button variant="primary" size="sm">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.name}
        description={`${employee.designation} • ${employee.department} • Code: ${employee.employee_id}`}
        backHref="/employees"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Employees', href: '/employees' },
          { label: employee.name },
        ]}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={employee.status} size="md" />
            <Link href="/assignments">
              <Button variant="primary" size="sm">
                Assign Asset
              </Button>
            </Link>
          </div>
        }
      />

      {/* Staff profile summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Employee Code</span>
          <p className="text-base font-bold text-slate-900 mt-0.5 font-mono">{employee.employee_id}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Corporate Email</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{employee.email}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Department</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">{employee.department}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Office Location</span>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">{employee.location}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Workstation / Desk</span>
          <p className="text-sm font-bold text-indigo-700 mt-0.5 font-mono">{employee.workstation || 'Not Assigned'}</p>
        </div>
        <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold uppercase text-indigo-700">Total Current Assets</span>
          <p className="text-xl font-bold text-indigo-950 mt-0.5 font-mono">
            {employee.current_assets?.length || 0}
          </p>
        </div>
      </div>

      {/* Currently Held Assets */}
      <div id="current-assets">
        <Card
          title={
            <div className="flex items-center gap-2">
              <span>Currently Assigned Assets</span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800">
                {employee.current_assets?.length || 0}
              </span>
            </div>
          }
          subtitle={`Employee: ${employee.employee_id} – ${employee.name} • Total Current Assets: ${employee.current_assets?.length || 0}`}
          headerAction={
            <Link href="/assignments">
              <Button variant="outline" size="sm" className="text-xs">
                Manage Custody
              </Button>
            </Link>
          }
        >
          <DataTable
            columns={[
              {
                key: 'asset_number',
                header: 'Asset Number',
                render: (row) => (
                  <Link
                    href={`/assets/${row.id}`}
                    className="font-mono font-bold text-blue-600 hover:underline"
                  >
                    {row.asset_number}
                  </Link>
                ),
              },
              {
                key: 'model',
                header: 'Hardware Model',
                render: (row) => (
                  <div>
                    <span className="font-semibold text-slate-800 block text-xs">
                      {row.brand} {row.model}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">SN: {row.serial_number}</span>
                  </div>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                render: (row) => <span className="text-xs text-slate-600">{row.category}</span>,
              },
              {
                key: 'assigned_date',
                header: 'Assigned Date',
                render: (row) => <span className="text-xs text-slate-600">{formatDate(row.assigned_date)}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => <StatusBadge status={row.status} size="sm" />,
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (row) => (
                  <Link href={`/tickets/new?assetId=${row.id}&employeeId=${employee.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs text-rose-600 hover:bg-rose-50">
                      Raise Ticket
                    </Button>
                  </Link>
                ),
              },
            ]}
            data={employee.current_assets || []}
            emptyTitle="No Assets Currently Held"
            emptyDescription={`Employee ${employee.employee_id} – ${employee.name} currently holds 0 active hardware assignments. No assets are currently assigned to this employee.`}
          />
        </Card>
      </div>

      {/* Complete Historical Assignment Records (Never Overwritten) */}
      <Card
        title="Complete Historical Assignment Log"
        subtitle="All assets assigned, transferred, or returned throughout employment history"
      >
        <DataTable
          columns={[
            {
              key: 'asset_number',
              header: 'Asset Number',
              render: (row) => (
                <Link
                  href={`/assets/${row.asset_id}`}
                  className="font-mono font-bold text-blue-600 hover:underline text-xs"
                >
                  {row.asset_number}
                </Link>
              ),
            },
            {
              key: 'hardware',
              header: 'Equipment',
              render: (row) => (
                <span className="text-xs font-medium text-slate-800">
                  {row.brand} {row.model} ({row.category})
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Event Status',
              render: (row) => <StatusBadge status={row.status} size="sm" />,
            },
            {
              key: 'assigned_date',
              header: 'Assigned Date',
              render: (row) => <span className="text-xs text-slate-600">{formatDate(row.assigned_date)}</span>,
            },
            {
              key: 'returned_date',
              header: 'Returned Date',
              render: (row) => (
                <span className="text-xs text-slate-600">{formatDate(row.returned_date) || '-'}</span>
              ),
            },
            {
              key: 'notes',
              header: 'Notes / Audit Details',
              render: (row) => <span className="text-xs text-slate-500 italic">{row.notes || '-'}</span>,
            },
          ]}
          data={employee.assignment_history || []}
          emptyTitle="No Historical Assignments"
          emptyDescription="Zero past assignment records recorded for this employee."
        />
      </Card>

      {/* Support tickets linked */}
      <Card title="Support Tickets History">
        <DataTable
          columns={[
            {
              key: 'ticket_id',
              header: 'Ticket ID',
              render: (row) => (
                <Link
                  href={`/tickets/${row.id}`}
                  className="font-mono text-xs font-bold text-blue-600 hover:underline"
                >
                  {row.ticket_id}
                </Link>
              ),
            },
            {
              key: 'asset_number',
              header: 'Asset Number',
              render: (row) => <span className="font-mono text-xs text-slate-700">{row.asset_number || '-'}</span>,
            },
            {
              key: 'issue_category',
              header: 'Category',
              render: (row) => <span className="text-xs font-medium text-slate-800">{row.issue_category}</span>,
            },
            {
              key: 'priority',
              header: 'Priority',
              render: (row) => <StatusBadge status={row.priority} size="sm" />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <StatusBadge status={row.status} size="sm" />,
            },
            {
              key: 'created_at',
              header: 'Raised Date',
              render: (row) => <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>,
            },
          ]}
          data={employee.tickets || []}
          emptyTitle="No Support Tickets"
          emptyDescription="This employee has not raised any support requests."
        />
      </Card>
    </div>
  );
}
