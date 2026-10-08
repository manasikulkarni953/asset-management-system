'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Timeline, TimelineItem } from '@/components/data-display/Timeline';
import { Spinner } from '@/components/ui/Spinner';
import { TicketDetailed } from '@/types/ticket';
import { formatDateTime } from '@/lib/utils';
import { Building2, Layers, MapPin, UserCheck, ShieldAlert } from 'lucide-react';

interface Specialist {
  id: number;
  name: string;
  email: string;
  designation: string;
}

export default function TicketDetailsPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = use(params);
  const [ticket, setTicket] = useState<TicketDetailed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth User
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Status & Assignment update state
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [assignedSpecialistId, setAssignedSpecialistId] = useState<string>('');
  const [resolutionText, setResolutionText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Available IT Specialists
  const [specialists, setSpecialists] = useState<Specialist[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          if (data.user.role === 'admin' || data.user.role === 'super_admin') {
            fetch('/api/tickets/specialists')
              .then((sRes) => sRes.json())
              .then((sData) => {
                if (sData.specialists) {
                  setSpecialists(sData.specialists);
                }
              })
              .catch((err) => console.error('Error loading specialists:', err));
          }
        }
      })
      .catch((err) => console.error('Error fetching auth user:', err));
  }, []);

  const fetchTicket = useCallback(() => {
    setIsLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);
    fetch(`/api/tickets/${ticketId}`)
      .then(async (res) => {
        if (!res.ok) {
          setErrorStatus(res.status);
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.ticket) {
          setTicket(data.ticket);
          setNewStatus(data.ticket.status);
          setNewPriority(data.ticket.priority);
          setAssignedSpecialistId(data.ticket.assigned_to ? String(data.ticket.assigned_to) : '');
          setResolutionText(data.ticket.resolution || '');
        }
      })
      .catch((err: any) => {
        setErrorMessage(err.message);
      })
      .finally(() => setIsLoading(false));
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      const payload: any = {
        status: newStatus,
        priority: newPriority,
        resolution: resolutionText,
        comment: commentText,
      };

      if (assignedSpecialistId !== '') {
        payload.assigned_to = Number(assignedSpecialistId);
      } else {
        payload.assigned_to = null;
      }

      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update ticket');

      setUpdateMessage({ type: 'success', text: 'Ticket successfully updated & logged in history.' });
      setCommentText('');
      fetchTicket();
    } catch (err: any) {
      setUpdateMessage({ type: 'error', text: err.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading ticket records...</p>
      </div>
    );
  }

  if (errorStatus === 403) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white border border-rose-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-500 mt-2">
          {errorMessage || 'You are not authorized to view this ticket. Employees can only access tickets raised by themselves.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">Go to Dashboard</Button>
          </Link>
          <Link href="/tickets">
            <Button variant="primary" size="sm">My Tickets</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-slate-800">Ticket Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">No ticket matches ID {ticketId}.</p>
        <Link href="/tickets" className="mt-4 inline-block">
          <Button variant="primary" size="sm">Back to Tickets</Button>
        </Link>
      </div>
    );
  }

  const isEmployee = currentUser?.role === 'employee';
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const historyItems: TimelineItem[] =
    ticket.history?.map((h) => ({
      id: h.id,
      title: h.old_status
        ? `Status: ${h.old_status.toUpperCase()} → ${h.new_status.toUpperCase()}`
        : `Initial Status: ${h.new_status.toUpperCase()}`,
      description: h.comment || undefined,
      timestamp: h.created_at,
      user: h.changed_by_name || 'System Support',
      type: h.new_status,
    })) || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={ticket.ticket_id}
        description={`Category: ${ticket.issue_category} • Raised on ${formatDateTime(ticket.created_at)}`}
        backHref="/tickets"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Tickets', href: '/tickets' },
          { label: ticket.ticket_id },
        ]}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.priority} size="md" />
            <StatusBadge status={ticket.status} size="md" />
          </div>
        }
      />

      {/* Lifecycle Progression Indicator */}
      <div className="bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto pb-1 gap-2">
          {[
            { key: 'new', label: '1. New' },
            { key: 'assigned', label: '2. Assigned' },
            { key: 'in_progress', label: '3. In Progress' },
            { key: 'waiting_for_user', label: '4. Waiting User' },
            { key: 'resolved', label: '5. Resolved' },
          ].map((step, idx) => {
            const isCurrent = ticket.status === step.key;
            const statusOrder = ['new', 'assigned', 'in_progress', 'waiting_for_user', 'resolved'];
            const currentIndex = statusOrder.indexOf(ticket.status);
            const isPassed = currentIndex >= idx;
            return (
              <div key={step.key} className="flex items-center gap-2 flex-1 min-w-[110px]">
                <div
                  className={`w-full py-2 px-2.5 rounded-lg text-center text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300 dark:ring-blue-700'
                      : isPassed
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Linked Domain Entities: Asset, Custodian & Assigned Technician */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Linked Asset */}
        <Card title="Affected Physical Asset">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-base font-bold text-blue-600">
                {ticket.asset_number}
              </span>
              {!isEmployee && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/damaged-assets`}>
                    <Button variant="outline" size="sm" className="text-xs p-1 px-2 h-auto text-amber-600 border-amber-200 hover:bg-amber-50">
                      Report Damage
                    </Button>
                  </Link>
                  <Link href={`/assets/${ticket.asset_id}`}>
                    <Button variant="ghost" size="sm" className="text-xs p-1 h-auto text-blue-600">
                      View Asset →
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-800">
              {ticket.asset_brand} {ticket.asset_model} ({ticket.asset_category})
            </p>
            {ticket.asset_serial_number && (
              <p className="text-[11px] font-mono text-slate-500">
                SN: {ticket.asset_serial_number}
              </p>
            )}
          </div>
        </Card>

        {/* Reporting Custodian */}
        <Card title="Reporting Custodian">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">
                {ticket.employee_name}
              </span>
              <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                {ticket.employee_code}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Registered custodian for this equipment record.
            </p>
            {!isEmployee && (
              <Link href={`/employees/${ticket.employee_id}`}>
                <Button variant="ghost" size="sm" className="text-xs p-1 h-auto text-indigo-600">
                  View Profile →
                </Button>
              </Link>
            )}
          </div>
        </Card>

        {/* Assigned IT Specialist */}
        <Card title="Assigned IT Specialist">
          <div className="space-y-2">
            {ticket.assigned_to_name ? (
              <>
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-sm">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  {ticket.assigned_to_name}
                </div>
                <div className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {ticket.assigned_to_designation || 'IT Specialist'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Responsible for resolution & triage
                </p>
              </>
            ) : (
              <div className="py-2">
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Unassigned
                </span>
                <p className="text-xs text-slate-400 mt-1">Pending IT Specialist assignment</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Ticket Physical Location */}
      <Card title="Ticket Location" subtitle="Fixed physical facility and specific desk/workstation identity">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 bg-slate-50 dark:bg-[#0c1428]/60 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
              Building
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {ticket.raised_building || 'The Space'}
            </p>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">Corporate Facility</span>
          </div>

          <div className="p-3 bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
              Floor
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {ticket.raised_floor || '5th Floor'}
            </p>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">Assigned Work Level</span>
          </div>

          <div className="p-3 bg-white dark:bg-[#0b1224] border-2 border-indigo-200 dark:border-indigo-800/80 rounded-lg shadow-2xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-900 dark:text-indigo-300 block flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> Workstation / Desk No.
            </span>
            <p className="font-mono text-base font-extrabold text-indigo-950 dark:text-white mt-1">
              {ticket.raised_workstation || 'Not Specified'}
            </p>
            <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400 mt-0.5 block">Physical Incident Desk</span>
          </div>
        </div>
      </Card>

      {/* Issue Details Card */}
      <Card title="Incident Symptom & Description">
        <div className="p-4 bg-slate-50 dark:bg-[#0c1428]/60 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
          {ticket.issue_description}
        </div>
      </Card>

      {/* Resolution details if present */}
      {ticket.resolution && (
        <Card title="Documented Resolution">
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed whitespace-pre-wrap">
            {ticket.resolution}
          </div>
        </Card>
      )}

      {/* Admin / Super Admin Operational Management Card */}
      {canManage && (
        <Card title="Manage Ticket & Assignment" subtitle="Assign technician, transition lifecycle, and append audit logs">
          {updateMessage && (
            <div
              className={`mb-4 p-3 rounded-lg text-xs font-semibold ${
                updateMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {updateMessage.text}
            </div>
          )}

          <form onSubmit={handleUpdateTicket} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select
                label="Assign IT Specialist"
                options={[
                  { value: '', label: '-- Unassigned --' },
                  ...specialists.map((s) => ({
                    value: String(s.id),
                    label: `${s.name} (${s.designation})`,
                  })),
                ]}
                value={assignedSpecialistId}
                onChange={(e) => setAssignedSpecialistId(e.target.value)}
              />

              <Select
                label="Ticket Status"
                required
                options={[
                  { value: 'new', label: 'New' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'waiting_for_user', label: 'Waiting for User' },
                  { value: 'resolved', label: 'Resolved' },
                ]}
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              />

              <Select
                label="Priority"
                required
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
              />
            </div>

            <Textarea
              label="Resolution Summary (Required when resolving)"
              rows={2}
              placeholder="e.g. Replaced faulty RAM module, conducted memory diagnostic test pass."
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
            />

            <Textarea
              label="Audit History Comment / Action Logged"
              rows={2}
              placeholder="Internal notes regarding troubleshooting steps, component dispatch, or customer feedback."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" size="md" isLoading={isUpdating}>
                Save Changes & Record History
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Ticket History Timeline */}
      <Card title="Ticket Progression Audit Log" subtitle="Historical audit entries stored in ticket_history">
        <Timeline items={historyItems} emptyMessage="No status changes logged yet." />
      </Card>
    </div>
  );
}
