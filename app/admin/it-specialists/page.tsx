'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import type { ITSpecialistWorkload } from '@/services/user.service';

export default function ITSpecialistAnalyticsPage() {
  const [specialists, setSpecialists] = useState<ITSpecialistWorkload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSpecialist, setSelectedSpecialist] = useState<ITSpecialistWorkload | null>(null);
  const [specialistTickets, setSpecialistTickets] = useState<any[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  const loadSpecialistTickets = useCallback(async (sp: ITSpecialistWorkload) => {
    setSelectedSpecialist(sp);
    setIsLoadingTickets(true);
    try {
      const res = await fetch(`/api/admin/it-specialists?specialistId=${sp.id}`);
      const data = await res.json();
      if (data.tickets) {
        setSpecialistTickets(data.tickets);
      }
    } catch (err) {
      console.error('Error fetching tickets for specialist:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/admin/it-specialists')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthorized or failed to fetch');
        return res.json();
      })
      .then((data) => {
        if (data.specialists) {
          setSpecialists(data.specialists);
          if (data.specialists.length > 0) {
            loadSpecialistTickets(data.specialists[0]);
          }
        }
      })
      .catch((err) => console.error('Error fetching specialists:', err))
      .finally(() => setIsLoading(false));
  }, [loadSpecialistTickets]);

  const ticketColumns: Column<any>[] = [
    {
      key: 'ticket_id',
      header: 'Ticket ID',
      render: (row) => (
        <Link
          href={`/tickets/${row.id}`}
          className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline block text-xs"
        >
          {row.ticket_id}
        </Link>
      ),
    },
    {
      key: 'asset_number',
      header: 'Hardware Asset',
      render: (row) => (
        <div>
          <Link
            href={`/assets/${row.asset_id || ''}`}
            className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
          >
            {row.asset_number}
          </Link>
          <span className="text-[11px] text-slate-400 dark:text-slate-400 block">{row.asset_model}</span>
        </div>
      ),
    },
    {
      key: 'employee_name',
      header: 'Reporting Custodian',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">{row.employee_name}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">{row.employee_code}</span>
        </div>
      ),
    },
    {
      key: 'raised_workstation',
      header: 'Workstation / Desk',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
          {row.raised_workstation || '—'}
        </span>
      ),
    },
    {
      key: 'issue_category',
      header: 'Issue / Diagnosis',
      render: (row) => (
        <div className="max-w-[200px]">
          <span className="font-medium text-slate-900 dark:text-slate-100 block text-xs">{row.issue_category}</span>
          <span
            className="text-[11px] text-slate-500 dark:text-slate-400 block break-words whitespace-normal leading-relaxed line-clamp-2"
            title={row.issue_description}
          >
            {row.issue_description}
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => <StatusBadge status={row.priority} size="sm" />,
    },
    {
      key: 'status',
      header: 'Ticket Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'created_at',
      header: 'Raised Date',
      render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(row.created_at)}</span>,
    },
  ];

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading IT admin metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="IT Admin Workload & Performance Analytics"
        description="Factual operational metrics and ticket resolution data aggregated directly from MySQL records for designated IT Admins."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'IT Admin' },
        ]}
      />

      {/* Specialist Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {specialists.map((sp) => {
          const isSelected = selectedSpecialist?.id === sp.id;
          return (
            <div
              key={sp.id}
              onClick={() => loadSpecialistTickets(sp)}
              className={`p-5 rounded-xl border transition-all cursor-pointer bg-white dark:bg-[#0b1224] ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                  : 'border-slate-200 dark:border-[#162138] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {sp.name}
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-300 font-medium">{sp.designation}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-400 font-mono mt-0.5">{sp.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
                    {sp.total_assigned}
                  </span>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400">Total Assigned</span>
                </div>
              </div>

              {/* Factual Operational Breakdown */}
              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
                <div className="p-1.5 rounded-lg bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                  <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">New</span>
                  <span className="text-sm font-bold font-mono text-blue-950 dark:text-blue-200">{sp.new_tickets}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-amber-50/70 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Active</span>
                  <span className="text-sm font-bold font-mono text-amber-950 dark:text-amber-200">{sp.in_progress_tickets}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Resolved</span>
                  <span className="text-sm font-bold font-mono text-emerald-950 dark:text-emerald-200">{sp.resolved_tickets}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 block">Closed</span>
                  <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">{sp.closed_tickets}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill-Down Ticket Records for Selected Specialist */}
      {selectedSpecialist && (
        <Card
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span>Tickets Handled by {selectedSpecialist.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono font-bold">
                  {specialistTickets.length} Records
                </span>
              </div>
            </div>
          }
          subtitle={`Drilldown audit into hardware issues, affected equipment, custodians, and technical resolutions assigned to this IT admin.`}
        >
          <DataTable
            columns={ticketColumns}
            data={specialistTickets}
            isLoading={isLoadingTickets}
            keyExtractor={(row) => row.id}
            emptyTitle="No Tickets Assigned"
            emptyDescription={`${selectedSpecialist.name} does not have any active or resolved tickets in their queue.`}
          />
        </Card>
      )}
    </div>
  );
}
