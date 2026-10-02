'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Ticket } from '@/types/ticket';
import { formatDate } from '@/lib/utils';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'all') params.set('status', status);
      if (priority !== 'all') params.set('priority', priority);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/tickets?${params.toString()}`);
      const data = await res.json();
      if (data.tickets) {
        setTickets(data.tickets);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, status, priority, page]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const columns: Column<Ticket>[] = [
    {
      key: 'ticket_id',
      header: 'Ticket ID',
      render: (row) => (
        <Link
          href={`/tickets/${row.id}`}
          className="font-mono font-bold text-blue-600 hover:underline block text-xs"
        >
          {row.ticket_id}
        </Link>
      ),
    },
    {
      key: 'asset_number',
      header: 'Asset Affected',
      render: (row) => (
        <div>
          <Link
            href={`/assets/${row.asset_id}`}
            className="font-mono text-xs font-semibold text-slate-800 hover:text-blue-600"
          >
            {row.asset_number}
          </Link>
          <span className="text-[11px] text-slate-400 block">{row.asset_model}</span>
        </div>
      ),
    },
    {
      key: 'employee_name',
      header: 'Custodian / Reporter',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs">{row.employee_name}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.employee_code}</span>
        </div>
      ),
    },
    {
      key: 'raised_workstation',
      header: 'Workstation / Desk',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {row.raised_workstation || '—'}
        </span>
      ),
    },
    {
      key: 'issue_category',
      header: 'Issue Category',
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900 block text-xs">{row.issue_category}</span>
          <span className="text-[11px] text-slate-500 max-w-xs truncate block" title={row.issue_description}>
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
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'created_at',
      header: 'Raised Date',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Link href={`/tickets/${row.id}`}>
          <Button variant="ghost" size="sm" className="text-xs text-blue-600 px-2 py-1">
            Resolve / Manage →
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support & Maintenance Tickets"
        description="Track hardware issues, diagnostics, resolutions, and warranty repairs."
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
              Raise Ticket
            </Button>
          </Link>
        }
      />

      {/* Service Desk Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { key: 'all', label: 'All Tickets' },
          { key: 'new', label: 'New' },
          { key: 'assigned', label: 'Assigned' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'waiting_for_user', label: 'Waiting for User' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'closed', label: 'Closed' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setStatus(tab.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              status === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by ticket#, asset#, custodian, workstation (e.g. WS-5-042)..."
        filters={[
          {
            key: 'status',
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'new', label: 'New' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'waiting_for_user', label: 'Waiting for User' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ],
          },
          {
            key: 'priority',
            value: priority,
            onChange: (v) => {
              setPriority(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Priorities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ],
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatus('all');
          setPriority('all');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={tickets}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyTitle="No Support Tickets"
        emptyDescription="There are no active or historical tickets matching the filter criteria."
        emptyAction={
          <Link href="/tickets/new">
            <Button variant="primary" size="sm">
              Raise First Ticket
            </Button>
          </Link>
        }
      />

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
