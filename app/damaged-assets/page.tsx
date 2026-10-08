'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { StatsCard } from '@/components/data-display/StatsCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { DamagedAsset, DamageSeverity, DamageRepairStatus } from '@/types/asset';
import { formatDate, formatCurrency } from '@/lib/utils';
import { 
  AlertTriangle, 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  ShieldAlert, 
  FileText, 
  ArrowUpRight,
  Layers,
  Clock,
  Sparkles
} from 'lucide-react';

export default function DamagedAssetsPage() {
  const [damagedAssets, setDamagedAssets] = useState<DamagedAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    totalDamaged: 0,
    underInvestigation: 0,
    inRepair: 0,
    repaired: 0,
    writtenOff: 0,
    totalEstimatedCost: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [repairStatus, setRepairStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DamagedAsset | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Assets & Employees list for dropdowns
  const [assetOptions, setAssetOptions] = useState<any[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<any[]>([]);

  const today = new Date().toISOString().split('T')[0];

  // New Damage Form State
  const [formData, setFormData] = useState({
    asset_id: '',
    employee_id: '',
    damage_type: 'Screen Cracked / Broken Display',
    custom_damage_type: '',
    severity: 'moderate' as DamageSeverity,
    incident_date: today,
    repair_cost_estimate: '',
    insurance_claimed: false,
    description: '',
  });

  // Update Status Form State
  const [updateFormData, setUpdateFormData] = useState({
    repair_status: 'reported' as DamageRepairStatus,
    actual_repair_cost: '',
    repair_cost_estimate: '',
    insurance_claimed: false,
    resolution_notes: '',
  });

  const fetchDamagedAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (severity !== 'all') params.set('severity', severity);
      if (repairStatus !== 'all') params.set('repairStatus', repairStatus);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/damaged-assets?${params.toString()}`);
      const data = await res.json();
      if (data.damagedAssets) {
        setDamagedAssets(data.damagedAssets);
        setTotal(data.total);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching damaged assets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, severity, repairStatus, page]);

  useEffect(() => {
    fetchDamagedAssets();
  }, [fetchDamagedAssets]);

  const loadMetadata = async () => {
    try {
      const [resAssets, resEmps] = await Promise.all([
        fetch('/api/assets?limit=100').then((r) => r.json()),
        fetch('/api/employees?limit=100').then((r) => r.json()),
      ]);
      if (resAssets.assets) setAssetOptions(resAssets.assets);
      if (resEmps.employees) setEmployeeOptions(resEmps.employees);
    } catch (err) {
      console.error('Failed to load assets/employees:', err);
    }
  };

  const openAddModal = async () => {
    setModalError(null);
    setFormData({
      asset_id: '',
      employee_id: '',
      damage_type: 'Screen Cracked / Broken Display',
      custom_damage_type: '',
      severity: 'moderate',
      incident_date: today,
      repair_cost_estimate: '',
      insurance_claimed: false,
      description: '',
    });
    setIsAddModalOpen(true);
    await loadMetadata();
  };

  const handleAssetSelect = (assetId: string) => {
    const selected = assetOptions.find((a) => String(a.id) === assetId);
    setFormData((prev) => ({
      ...prev,
      asset_id: assetId,
      employee_id: selected?.current_employee_id ? String(selected.current_employee_id) : prev.employee_id,
    }));
  };

  const handleCreateDamageReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    const damageType =
      formData.damage_type === 'Other Physical Damage' && formData.custom_damage_type.trim()
        ? formData.custom_damage_type.trim()
        : formData.damage_type;

    try {
      const res = await fetch('/api/damaged-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: formData.asset_id,
          employee_id: formData.employee_id ? Number(formData.employee_id) : null,
          damage_type: damageType,
          severity: formData.severity,
          incident_date: formData.incident_date,
          repair_cost_estimate: formData.repair_cost_estimate ? Number(formData.repair_cost_estimate) : 0,
          insurance_claimed: formData.insurance_claimed,
          description: formData.description,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit damage report');

      setIsAddModalOpen(false);
      fetchDamagedAssets();
    } catch (err: any) {
      setModalError(err.message || 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUpdateModal = (record: DamagedAsset) => {
    setSelectedRecord(record);
    setModalError(null);
    setUpdateFormData({
      repair_status: record.repair_status,
      actual_repair_cost: record.actual_repair_cost ? String(record.actual_repair_cost) : '',
      repair_cost_estimate: record.repair_cost_estimate ? String(record.repair_cost_estimate) : '',
      insurance_claimed: Boolean(record.insurance_claimed),
      resolution_notes: record.resolution_notes || '',
    });
    setIsUpdateModalOpen(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/damaged-assets/${selectedRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repair_status: updateFormData.repair_status,
          actual_repair_cost: updateFormData.actual_repair_cost ? Number(updateFormData.actual_repair_cost) : 0,
          repair_cost_estimate: updateFormData.repair_cost_estimate ? Number(updateFormData.repair_cost_estimate) : 0,
          insurance_claimed: updateFormData.insurance_claimed,
          resolution_notes: updateFormData.resolution_notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update record');

      setIsUpdateModalOpen(false);
      fetchDamagedAssets();
    } catch (err: any) {
      setModalError(err.message || 'Update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!confirm('Are you sure you want to delete this damaged asset incident record?')) return;
    try {
      const res = await fetch(`/api/damaged-assets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDamagedAssets();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const getSeverityBadge = (sev: DamageSeverity) => {
    switch (sev) {
      case 'minor':
        return <Badge variant="info" size="sm">Minor</Badge>;
      case 'moderate':
        return <Badge variant="warning" size="sm">Moderate</Badge>;
      case 'severe':
        return <Badge variant="danger" size="sm">Severe</Badge>;
      case 'total_loss':
        return <Badge variant="danger" size="sm">Total Loss</Badge>;
      default:
        return <Badge variant="default" size="sm">{sev}</Badge>;
    }
  };

  const columns: Column<DamagedAsset>[] = [
    {
      key: 'asset_number',
      header: 'Damaged Asset',
      render: (row) => (
        <div className="flex flex-col">
          <Link
            href={`/assets/${row.asset_id}`}
            className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1"
          >
            {row.asset_number}
            <ArrowUpRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
          </Link>
          <span className="text-xs font-medium text-slate-900 dark:text-white mt-0.5">
            {row.brand} {row.model}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {row.category} {row.serial_number ? `• SN: ${row.serial_number}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'employee_name',
      header: 'Custodian / Reported By',
      render: (row) => (
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white block">
            {row.employee_name || 'Unassigned / Company Pool'}
          </span>
          {row.employee_code && (
            <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-medium">
              {row.employee_code} {row.employee_workstation ? `(${row.employee_workstation})` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'damage_type',
      header: 'Incident & Severity',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-white">{row.damage_type}</span>
            {getSeverityBadge(row.severity)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xs">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'incident_date',
      header: 'Incident Date',
      render: (row) => (
        <div className="text-xs">
          <span className="font-medium text-slate-900 dark:text-white block">{formatDate(row.incident_date)}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Logged {formatDate(row.reported_date)}
          </span>
        </div>
      ),
    },
    {
      key: 'repair_status',
      header: 'Repair Status',
      render: (row) => <StatusBadge status={row.repair_status} size="sm" />,
    },
    {
      key: 'repair_cost_estimate',
      header: 'Est. Cost',
      render: (row) => (
        <div className="text-xs">
          <span className="font-mono font-semibold text-slate-900 dark:text-white block">
            {formatCurrency(row.repair_cost_estimate)}
          </span>
          {Number(row.actual_repair_cost) > 0 && (
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
              Actual: {formatCurrency(row.actual_repair_cost)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'insurance_claimed',
      header: 'Insurance',
      render: (row) =>
        row.insurance_claimed ? (
          <Badge variant="success" size="sm" dot>Claimed</Badge>
        ) : (
          <Badge variant="default" size="sm">No Claim</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedRecord(row);
              setIsDetailsModalOpen(true);
            }}
            className="text-xs text-slate-600 hover:text-slate-900"
          >
            Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUpdateModal(row)}
            className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Update
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteRecord(row.id)}
            className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Damaged Assets Management"
        description="Monitor hardware damage incidents, diagnostic assessments, repair progress, and write-offs."
        action={
          <Button
            variant="primary"
            size="md"
            icon={<AlertTriangle className="w-4 h-4" />}
            onClick={openAddModal}
          >
            Report Damaged Asset
          </Button>
        }
      />

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Incidents"
          value={stats.totalDamaged}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="amber"
          description="Recorded damaged devices"
        />
        <StatsCard
          title="Under Investigation"
          value={stats.underInvestigation}
          icon={<Clock className="w-5 h-5" />}
          color="blue"
          description="Pending IT triage"
        />
        <StatsCard
          title="In Repair / Vendor"
          value={stats.inRepair}
          icon={<Wrench className="w-5 h-5" />}
          color="purple"
          description="At service center"
        />
        <StatsCard
          title="Repaired & Restored"
          value={stats.repaired}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
          description="Returned to pool"
        />
        <StatsCard
          title="Est. Repair Total"
          value={formatCurrency(stats.totalEstimatedCost)}
          icon={<DollarSign className="w-5 h-5" />}
          color="rose"
          description="Budget allocation impact"
        />
      </div>

      {/* Filters Bar */}
      <FilterBar
        searchPlaceholder="Search by Asset #, brand, model, employee, or symptom..."
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        filters={[
          {
            key: 'severity',
            label: 'Severity',
            options: [
              { value: 'all', label: 'All Severities' },
              { value: 'minor', label: 'Minor' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'severe', label: 'Severe' },
              { value: 'total_loss', label: 'Total Loss' },
            ],
            value: severity,
            onChange: (val) => {
              setSeverity(val);
              setPage(1);
            },
          },
          {
            key: 'repairStatus',
            label: 'Repair Status',
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'reported', label: 'Reported' },
              { value: 'under_investigation', label: 'Under Investigation' },
              { value: 'sent_for_repair', label: 'Sent for Repair' },
              { value: 'repaired', label: 'Repaired' },
              { value: 'written_off', label: 'Written Off' },
              { value: 'replaced', label: 'Replaced' },
            ],
            value: repairStatus,
            onChange: (val) => {
              setRepairStatus(val);
              setPage(1);
            },
          },
        ]}
        onReset={() => {
          setSearch('');
          setSeverity('all');
          setRepairStatus('all');
          setPage(1);
        }}
      />

      {/* Table Section */}
      <DataTable
        columns={columns}
        data={damagedAssets}
        isLoading={isLoading}
        keyExtractor={(item) => item.id}
        emptyTitle="No Damaged Assets Recorded"
        emptyDescription="All corporate hardware is healthy and in working operational condition."
        emptyAction={
          <Button variant="outline" size="sm" onClick={openAddModal}>
            Report Incident
          </Button>
        }
      />

      {/* Pagination */}
      {total > pageSize && (
        <Pagination
          currentPage={page}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}

      {/* Modal: Report Damaged Asset */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Report Damaged Hardware"
        description="Log physical device impact, hardware component malfunction, or water damage incident."
        size="lg"
      >
        <form onSubmit={handleCreateDamageReport} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Affected Hardware Asset"
              required
              options={[
                { value: '', label: '-- Select Equipment --' },
                ...assetOptions.map((a) => ({
                  value: a.id,
                  label: `${a.asset_number} — ${a.brand} ${a.model} (${a.category})`,
                })),
              ]}
              value={formData.asset_id}
              onChange={(e) => handleAssetSelect(e.target.value)}
              helperText="Device undergoing physical or mechanical impairment"
            />

            <Select
              label="Reporting Custodian / Staff"
              options={[
                { value: '', label: '-- Unassigned / Direct Lab Stock --' },
                ...employeeOptions.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.employee_id}) — ${e.department}`,
                })),
              ]}
              value={formData.employee_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, employee_id: e.target.value }))}
              helperText="Employee who had custody at time of incident"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Damage Classification"
              required
              options={[
                { value: 'Screen Cracked / Broken Display', label: 'Screen Cracked / Broken Display' },
                { value: 'Liquid Spill / Water Ingress', label: 'Liquid Spill / Water Ingress' },
                { value: 'Physical Chassis / Casing Dent', label: 'Physical Chassis / Casing Dent' },
                { value: 'Keyboard / Trackpad Failure', label: 'Keyboard / Trackpad Failure' },
                { value: 'Power / Charging Port Damaged', label: 'Power / Charging Port Damaged' },
                { value: 'Drop Impact / Component Shock', label: 'Drop Impact / Component Shock' },
                { value: 'Electrical Surge / Burn', label: 'Electrical Surge / Burn' },
                { value: 'VoIP / Calling', label: 'VoIP / Calling' },
                { value: 'Other Physical Damage', label: 'Other Physical Damage' },
              ]}
              value={formData.damage_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, damage_type: e.target.value }))}
            />

            <Select
              label="Damage Severity Level"
              required
              options={[
                { value: 'minor', label: 'Minor — Cosmetic or partial function' },
                { value: 'moderate', label: 'Moderate — Major function affected' },
                { value: 'severe', label: 'Severe — Device unusable / diagnostic failure' },
                { value: 'total_loss', label: 'Total Loss — Beyond economical repair' },
              ]}
              value={formData.severity}
              onChange={(e) => setFormData((prev) => ({ ...prev, severity: e.target.value as DamageSeverity }))}
            />
          </div>

          {formData.damage_type === 'Other Physical Damage' && (
            <Input
              label="Custom Damage Category"
              required
              placeholder="e.g. Broken hinge mechanism, shattered webcam glass"
              value={formData.custom_damage_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, custom_damage_type: e.target.value }))}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DateInput
              label="Incident Date"
              required
              value={formData.incident_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, incident_date: e.target.value }))}
            />

            <Input
              label="Estimated Repair Cost ($)"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 150.00"
              value={formData.repair_cost_estimate}
              onChange={(e) => setFormData((prev) => ({ ...prev, repair_cost_estimate: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="insurance_claimed"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              checked={formData.insurance_claimed}
              onChange={(e) => setFormData((prev) => ({ ...prev, insurance_claimed: e.target.checked }))}
            />
            <label htmlFor="insurance_claimed" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Initiate insurance reimbursement claim for this incident
            </label>
          </div>

          <Textarea
            label="Incident Circumstance & Physical Assessment Description"
            required
            rows={3}
            placeholder="Specify what happened, visual observations, broken internal parts, or failure behavior..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="md" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              Log Incident Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Incident Details */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Damaged Asset Full Dossier"
        description="Comprehensive audit specifications and diagnostic timeline."
        size="lg"
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-base font-bold text-blue-600">
                    {selectedRecord.asset_number}
                  </span>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {selectedRecord.brand} {selectedRecord.model} ({selectedRecord.category})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(selectedRecord.severity)}
                  <StatusBadge status={selectedRecord.repair_status} size="sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs border-t border-slate-200 pt-3">
                <div>
                  <span className="text-slate-400 block">Serial Number:</span>
                  <span className="font-mono font-medium text-slate-800">
                    {selectedRecord.serial_number || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Incident Date:</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(selectedRecord.incident_date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Reported On:</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(selectedRecord.reported_date)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                  Reporting Custodian
                </span>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {selectedRecord.employee_name || 'Direct Company Inventory'}
                </p>
                {selectedRecord.employee_code && (
                  <span className="text-xs text-indigo-600 font-mono">
                    {selectedRecord.employee_code} • {selectedRecord.employee_department}
                  </span>
                )}
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                  Financial Impact
                </span>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <span className="text-[11px] text-slate-400">Estimated Cost:</span>
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {formatCurrency(selectedRecord.repair_cost_estimate)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Actual Cost:</span>
                    <p className="font-mono text-sm font-bold text-emerald-600">
                      {formatCurrency(selectedRecord.actual_repair_cost)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                Incident Description & Observations
              </span>
              <p className="text-xs text-slate-700 leading-relaxed mt-1.5 whitespace-pre-wrap">
                {selectedRecord.description}
              </p>
            </div>

            {selectedRecord.resolution_notes && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-800 block">
                  Technician Resolution & Action Log
                </span>
                <p className="text-xs text-emerald-900 leading-relaxed mt-1.5 whitespace-pre-wrap">
                  {selectedRecord.resolution_notes}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <Link
                href={`/assets/${selectedRecord.asset_id}`}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                Inspect Asset Profile →
              </Link>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    openUpdateModal(selectedRecord);
                  }}
                >
                  Update Status
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Update Repair Status & Costs */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="Update Repair Status & Costs"
        description="Progress workflow from triage through vendor repair or scrapping."
        size="md"
      >
        <form onSubmit={handleUpdateStatus} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
              {modalError}
            </div>
          )}

          <Select
            label="Workflow Repair Status"
            required
            options={[
              { value: 'reported', label: 'Reported — Awaiting IT assessment' },
              { value: 'under_investigation', label: 'Under Investigation — Diagnostic running' },
              { value: 'sent_for_repair', label: 'Sent for Repair — At authorized vendor' },
              { value: 'repaired', label: 'Repaired — Tested & restored to working stock' },
              { value: 'written_off', label: 'Written Off — Scrapped / disposed' },
              { value: 'replaced', label: 'Replaced — Replaced with new equipment' },
            ]}
            value={updateFormData.repair_status}
            onChange={(e) =>
              setUpdateFormData((prev) => ({
                ...prev,
                repair_status: e.target.value as DamageRepairStatus,
              }))
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estimated Cost ($)"
              type="number"
              min="0"
              step="0.01"
              value={updateFormData.repair_cost_estimate}
              onChange={(e) =>
                setUpdateFormData((prev) => ({ ...prev, repair_cost_estimate: e.target.value }))
              }
            />

            <Input
              label="Actual Final Cost ($)"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 185.00"
              value={updateFormData.actual_repair_cost}
              onChange={(e) =>
                setUpdateFormData((prev) => ({ ...prev, actual_repair_cost: e.target.value }))
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="update_insurance_claimed"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              checked={updateFormData.insurance_claimed}
              onChange={(e) =>
                setUpdateFormData((prev) => ({ ...prev, insurance_claimed: e.target.checked }))
              }
            />
            <label htmlFor="update_insurance_claimed" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Insurance claim filed / approved
            </label>
          </div>

          <Textarea
            label="Resolution & Action Notes"
            rows={3}
            placeholder="e.g. Replaced screen assembly at official Apple / Dell service center. Full diagnostic passed."
            value={updateFormData.resolution_notes}
            onChange={(e) =>
              setUpdateFormData((prev) => ({ ...prev, resolution_notes: e.target.value }))
            }
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="md" onClick={() => setIsUpdateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
              Save Updates
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
