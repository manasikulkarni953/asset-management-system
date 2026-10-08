'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { AssetAssignment } from '@/types/assignment';
import { formatDate, cn } from '@/lib/utils';
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRightLeft,
  RotateCcw,
  Search,
  X,
  UserCheck,
} from 'lucide-react';

interface AvailableAssetItem {
  id: number;
  asset_id: string;
  asset_number: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  status: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Metadata dropdowns
  const [availableAssets, setAvailableAssets] = useState<AvailableAssetItem[]>([]);
  const [assignedAssets, setAssignedAssets] = useState<any[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);

  // Modals state
  const [activeModal, setActiveModal] = useState<'assign' | 'transfer' | 'return' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    message: string;
    assets: string[];
    employeeName: string;
  } | null>(null);

  // Multi-Asset Assignment Form State
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [assignNotes, setAssignNotes] = useState('');
  const [assignCondition, setAssignCondition] = useState('Good');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('all');

  // Single Transfer & Return form states
  const [transferForm, setTransferForm] = useState({ asset_id: '', to_employee_id: '', notes: '' });
  const [returnForm, setReturnForm] = useState({ asset_id: '', return_to: 'itadmin', notes: '' });
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setIsLoading(true);
    setPermissionError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'all') params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/assignments?${params.toString()}`);
      if (res.status === 403) {
        setPermissionError(
          'Permission Required: You are signed in with an account that cannot view assignments. Please sign out and log in as Super Admin (admin / Admin@123) or Admin (itadmin / Admin@123).'
        );
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      if (data.assignments) {
        setAssignments(data.assignments);
        setTotal(data.total);
        if (data.availableAssets) setAvailableAssets(data.availableAssets);
        if (data.assignedAssets) setAssignedAssets(data.assignedAssets);
        if (data.activeEmployees) setActiveEmployees(data.activeEmployees);
      }
    } catch (err) {
      console.error('Assignments error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Categories extracted from available assets
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    availableAssets.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [availableAssets]);

  // Filtered available assets for multi-select
  const filteredAvailableAssets = useMemo(() => {
    return availableAssets.filter((a) => {
      const matchesCategory =
        assetCategoryFilter === 'all' || a.category === assetCategoryFilter;
      const q = assetSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.asset_number.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.serial_number.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [availableAssets, assetCategoryFilter, assetSearchQuery]);

  // Toggle selection for an individual asset
  const handleToggleAsset = (id: number) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all currently visible filtered assets
  const handleSelectAllFiltered = () => {
    const visibleIds = filteredAvailableAssets.map((a) => a.id);
    setSelectedAssetIds((prev) => {
      const set = new Set([...prev, ...visibleIds]);
      return Array.from(set);
    });
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedAssetIds([]);
  };

  // Open assign modal and reset states with fallback employee fetch
  const openAssignModal = async () => {
    setAssignEmployeeId('');
    setSelectedAssetIds([]);
    setAssignNotes('');
    setAssignCondition('Good');
    setAssetSearchQuery('');
    setAssetCategoryFilter('all');
    setModalError(null);
    setActiveModal('assign');

    if (activeEmployees.length === 0) {
      try {
        const empRes = await fetch('/api/employees?status=active&limit=100');
        const empData = await empRes.json();
        if (empData.employees) {
          setActiveEmployees(
            empData.employees.map((e: any) => ({
              id: e.id,
              employee_id: e.employee_id,
              name: e.name,
              department: e.department,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load active employees fallback:', err);
      }
    }
  };

  // Selected employee metadata
  const selectedEmployeeObj = useMemo(() => {
    return activeEmployees.find((e) => String(e.id) === String(assignEmployeeId));
  }, [activeEmployees, assignEmployeeId]);

  // Options for return modal ensuring active, transferred, or pre-selected assets appear
  const returnAssetOptions = useMemo(() => {
    const list: Array<{ value: string | number; label: string }> = [
      { value: '', label: '-- Choose Assigned Asset --' },
    ];
    const map = new Map<number, string>();
    assignedAssets.forEach((a) => {
      map.set(Number(a.id), `${a.asset_number} (${a.model || ''}) — Currently with: ${a.employee_name}`);
    });

    if (returnForm.asset_id && !map.has(Number(returnForm.asset_id))) {
      const match = assignments.find((a) => Number(a.asset_id) === Number(returnForm.asset_id));
      if (match) {
        map.set(
          Number(match.asset_id),
          `${match.asset_number} (${match.asset_model || ''}) — Custodian: ${match.employee_name || 'Assigned'}`
        );
      }
    }

    map.forEach((lbl, id) => {
      list.push({ value: id, label: lbl });
    });
    return list;
  }, [assignedAssets, returnForm.asset_id, assignments]);

  // Options for transfer modal ensuring active, transferred, or returned assets appear
  const transferAssetOptions = useMemo(() => {
    const list: Array<{ value: string | number; label: string }> = [
      { value: '', label: '-- Choose Asset to Transfer --' },
    ];
    const map = new Map<number, string>();
    assignedAssets.forEach((a) => {
      map.set(Number(a.id), `${a.asset_number} (${a.model || ''}) — Currently with: ${a.employee_name}`);
    });

    if (transferForm.asset_id && !map.has(Number(transferForm.asset_id))) {
      const match = assignments.find((a) => Number(a.asset_id) === Number(transferForm.asset_id));
      if (match) {
        const fromLabel =
          match.status === 'returned'
            ? 'Central Inventory (Returned)'
            : match.employee_name || 'Custodian';
        map.set(
          Number(match.asset_id),
          `${match.asset_number} (${match.asset_model || ''}) — Source: ${fromLabel}`
        );
      }
    }

    map.forEach((lbl, id) => {
      list.push({ value: id, label: lbl });
    });
    return list;
  }, [assignedAssets, transferForm.asset_id, assignments]);

  // Submit multi-asset assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmployeeId) {
      setModalError('Please select a custodian employee.');
      return;
    }
    if (selectedAssetIds.length === 0) {
      setModalError('Please select at least one asset to assign.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          employeeId: Number(assignEmployeeId),
          assetIds: selectedAssetIds,
          remarks: assignCondition ? `Condition: ${assignCondition}` : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete assignment operation.');
      }

      // Success
      setActiveModal(null);
      setSuccessBanner({
        message: data.message || `Successfully assigned ${selectedAssetIds.length} assets`,
        assets: data.assets || [],
        employeeName: data.employeeName || selectedEmployeeObj?.name || 'Employee',
      });

      // Reset
      setSelectedAssetIds([]);
      setAssignEmployeeId('');
      setAssignNotes('');
      fetchAssignments();
    } catch (err: any) {
      setModalError(err.message || 'Assignment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer',
          asset_id: Number(transferForm.asset_id),
          to_employee_id: Number(transferForm.to_employee_id),
          notes: transferForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to transfer asset');

      setActiveModal(null);
      setTransferForm({ asset_id: '', to_employee_id: '', notes: '' });
      fetchAssignments();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'return',
          asset_id: Number(returnForm.asset_id),
          return_to: returnForm.return_to,
          notes: returnForm.notes || 'Returned to IT Admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to return asset');

      setActiveModal(null);
      setReturnForm({ asset_id: '', return_to: 'itadmin', notes: '' });
      fetchAssignments();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTransferForAsset = (assetId: number) => {
    setTransferForm({ asset_id: String(assetId), to_employee_id: '', notes: '' });
    setModalError(null);
    setActiveModal('transfer');
  };

  const openReturnForAsset = (assetId: number) => {
    setReturnForm({ asset_id: String(assetId), return_to: 'itadmin', notes: '' });
    setModalError(null);
    setActiveModal('return');
  };

  const getAllocationType = (row: AssetAssignment) => {
    const note = (row.notes || '').toLowerCase();
    if (row.status === 'transferred' || note.includes('transferred') || note.includes('transfer')) {
      return {
        label: 'Transfer Allocation',
        color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      };
    }
    if (note.includes('temporary') || note.includes('loaner')) {
      return {
        label: 'Temporary Allocation',
        color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      };
    }
    if (note.includes('primary') || note.includes('initial') || note.includes('onboarding') || note.includes('new joiner')) {
      return {
        label: 'Primary Allocation',
        color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      };
    }
    return {
      label: 'Direct Allocation',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    };
  };

  const columns: Column<AssetAssignment>[] = [
    {
      key: 'asset_number',
      header: 'ASSET',
      render: (row) => (
        <div>
          <Link
            href={`/assets/${row.asset_id}`}
            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline block text-xs"
          >
            {row.asset_number}
          </Link>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {row.asset_brand} {row.asset_model}
          </span>
        </div>
      ),
    },
    {
      key: 'employee_name',
      header: 'EMPLOYEE / CUSTODIAN',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`/employees/${row.employee_id}`}
            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline block text-xs"
          >
            {row.employee_name || 'Unassigned'}
          </Link>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 text-[10px]">
              {row.employee_code || `EMP-${row.employee_id}`}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'allocation_type',
      header: 'ALLOCATION TYPE',
      render: (row) => {
        const typeInfo = getAllocationType(row);
        return (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border tracking-wide whitespace-nowrap',
              typeInfo.color
            )}
          >
            {typeInfo.label}
          </span>
        );
      },
    },
    {
      key: 'assigned_date',
      header: 'ALLOCATED DATE',
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">
          {formatDate(row.assigned_date)}
        </span>
      ),
    },
    {
      key: 'returned_date',
      header: 'RETURNED DATE',
      render: (row) => (
        <span className="text-xs font-mono">
          {row.returned_date ? (
            <span className="text-slate-500 dark:text-slate-400">{formatDate(row.returned_date)}</span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Active Custody</span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      align: 'right',
      render: (row) => {
        const isAssigned = row.status === 'assigned' && !row.returned_date;
        const isTransferred = row.status === 'transferred';
        const isReturned =
          row.status === 'returned' || (row.status as string) === 'refund';

        if (isAssigned) {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openTransferForAsset(row.asset_id)}
                className="text-xs px-2.5 py-1"
                icon={<ArrowRightLeft className="w-3 h-3" />}
              >
                Transfer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openReturnForAsset(row.asset_id)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 py-1"
                icon={<RotateCcw className="w-3 h-3" />}
              >
                Return
              </Button>
            </div>
          );
        }

        if (isTransferred) {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openReturnForAsset(row.asset_id)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 py-1 font-medium border border-rose-200/80 dark:border-rose-900/50"
                icon={<RotateCcw className="w-3 h-3" />}
              >
                Return
              </Button>
            </div>
          );
        }

        if (isReturned) {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openTransferForAsset(row.asset_id)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2.5 py-1 font-medium border border-blue-200/80 dark:border-blue-900/50"
                icon={<ArrowRightLeft className="w-3 h-3" />}
              >
                Transfer
              </Button>
            </div>
          );
        }

        return (
          <span className="text-xs text-slate-400 dark:text-zinc-500 italic">
            Archived
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Custody & Assignments"
        description="Comprehensive audit trail of hardware allocations, custodian transfers, and returns across the enterprise."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={openAssignModal}
            icon={<Plus className="w-4 h-4" />}
          >
            Assign Assets
          </Button>
        }
      />

      {/* Permission Warning Banner */}
      {permissionError && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Access Restricted to Administrators
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {permissionError}
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
              >
                Sign In as Admin
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-950/80 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-start justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-200">
                {successBanner.message}
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                Custodian: <span className="font-semibold">{successBanner.employeeName}</span>
              </p>
              {successBanner.assets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {successBanner.assets.map((num) => (
                    <span
                      key={num}
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by asset#, model, employee..."
        filters={[
          {
            key: 'status',
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Lifecycle Events' },
              { value: 'assigned', label: 'Currently Assigned' },
              { value: 'transferred', label: 'Transferred' },
              { value: 'returned', label: 'Returned to Stock' },
            ],
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatus('all');
          setPage(1);
        }}
      />

      {/* Main Assignments Data Table */}
      <DataTable
        columns={columns}
        data={assignments}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyTitle="No Assignment Records Found"
        emptyDescription="Assign assets from available stock to create physical custody tracking."
        emptyAction={
          <Button variant="primary" size="sm" onClick={openAssignModal}>
            Assign Assets Now
          </Button>
        }
      />

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* ================================================================= */}
      {/* MULTI-ASSET ASSIGNMENT MODAL (Enterprise Multi-Asset Workflow)     */}
      {/* ================================================================= */}
      <Modal
        isOpen={activeModal === 'assign'}
        onClose={() => setActiveModal(null)}
        title="Assign Assets from Available Stock"
        description="Allocate one or multiple equipment items to an employee custodian in a single atomic transaction."
        size="xl"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-5">
          {modalError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{modalError}</span>
            </div>
          )}

          {/* STEP 1: Select Custodian Employee */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
              Step 1: Select Custodian Employee <span className="text-rose-500">*</span>
            </label>
            <Select
              options={[
                { value: '', label: '-- Choose Employee Custodian --' },
                ...activeEmployees.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.employee_id})`,
                })),
              ]}
              value={assignEmployeeId}
              onChange={(e) => setAssignEmployeeId(e.target.value)}
            />

            {selectedEmployeeObj && (
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900">
                    {selectedEmployeeObj.name}
                  </span>
                  <span className="text-slate-600 font-mono">
                    ({selectedEmployeeObj.employee_id})
                  </span>
                </div>
                <Link
                  href={`/employees/${selectedEmployeeObj.id}`}
                  target="_blank"
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  View Profile ↗
                </Link>
              </div>
            )}
          </div>

          {/* STEP 2: Multi-Asset Selection */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Step 2: Select Available Assets <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Check all physical devices you want to assign to this employee.
                </p>
              </div>

              {/* Selection Summary Pill */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Selected: {selectedAssetIds.length} Assets
                </span>
                {filteredAvailableAssets.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllFiltered}
                    className="text-xs py-1 px-2 h-7"
                  >
                    Select All ({filteredAvailableAssets.length})
                  </Button>
                )}
                {selectedAssetIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-xs py-1 px-2 h-7 text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* In-Modal Search & Category Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <Input
                  value={assetSearchQuery}
                  onChange={(e) => setAssetSearchQuery(e.target.value)}
                  placeholder="Search by asset number, serial, model, brand..."
                  leftIcon={<Search className="w-3.5 h-3.5 text-slate-400" />}
                />
              </div>
              <div>
                <Select
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...availableCategories.map((c) => ({ value: c, label: c })),
                  ]}
                  value={assetCategoryFilter}
                  onChange={(e) => setAssetCategoryFilter(e.target.value)}
                />
              </div>
            </div>

            {/* Asset Selection List */}
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
              {availableAssets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No assets currently in stock. Register new assets before assigning.
                </div>
              ) : filteredAvailableAssets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No available assets match &ldquo;{assetSearchQuery}&rdquo;.
                </div>
              ) : (
                filteredAvailableAssets.map((asset) => {
                  const isChecked = selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleToggleAsset(asset.id)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-blue-50/80 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled by container onClick
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {asset.asset_number}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {asset.category}
                            </span>
                            <StatusBadge status={asset.status} size="sm" />
                          </div>
                          <p className="text-xs text-slate-700 font-medium truncate mt-0.5">
                            {asset.brand} {asset.model}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-slate-400 block">
                          SN: {asset.serial_number}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                          ✓ Ready to assign
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* STEP 3: Asset Condition */}
          <div className="pt-2 border-t border-slate-200">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Asset Condition
              </label>
              <Select
                options={[
                  { value: 'New', label: 'New / Sealed' },
                  { value: 'Good', label: 'Good — Standard Working' },
                  { value: 'Excellent', label: 'Excellent — Refurbished' },
                  { value: 'Fair', label: 'Fair — Functional Wear' },
                ]}
                value={assignCondition}
                onChange={(e) => setAssignCondition(e.target.value)}
              />
            </div>
          </div>

          {/* Review Summary Bar */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                Assignment Summary
              </span>
              <div className="text-xs text-slate-700 mt-0.5">
                Recipient:{' '}
                <span className="font-bold text-slate-900">
                  {selectedEmployeeObj ? `${selectedEmployeeObj.name} (${selectedEmployeeObj.employee_id})` : 'None selected'}
                </span>
                {' • '}
                Total Assets:{' '}
                <span className="font-mono font-bold text-blue-600">
                  {selectedAssetIds.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                disabled={!assignEmployeeId || selectedAssetIds.length === 0}
              >
                Assign {selectedAssetIds.length > 0 ? `${selectedAssetIds.length} Assets` : 'Assets'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ================================================================= */}
      {/* 2. TRANSFER MODAL (Single Asset Transfer)                         */}
      {/* ================================================================= */}
      <Modal
        isOpen={activeModal === 'transfer'}
        onClose={() => setActiveModal(null)}
        title="Transfer Asset Custody"
        description="Transfer physical possession from one staff member to another while maintaining complete historical logs."
        size="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {modalError}
            </div>
          )}

          <Select
            label="Select Asset to Transfer"
            required
            options={transferAssetOptions}
            value={transferForm.asset_id}
            onChange={(e) => setTransferForm((prev) => ({ ...prev, asset_id: e.target.value }))}
          />

          <Select
            label="Transfer To New Employee"
            required
            options={[
              { value: '', label: '-- Choose New Custodian --' },
              ...activeEmployees.map((e) => ({
                value: e.id,
                label: `${e.name} (${e.employee_id})`,
              })),
            ]}
            value={transferForm.to_employee_id}
            onChange={(e) =>
              setTransferForm((prev) => ({ ...prev, to_employee_id: e.target.value }))
            }
          />

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" isLoading={isSubmitting}>
              Execute Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================================================================= */}
      {/* 3. RETURN MODAL (Single Asset Return)                             */}
      {/* ================================================================= */}
      <Modal
        isOpen={activeModal === 'return'}
        onClose={() => setActiveModal(null)}
        title="Return Asset to IT Admin"
        description="Release equipment from employee custody and return directly to IT Admin."
        size="md"
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
              {modalError}
            </div>
          )}

          <Select
            label="Select Assigned Asset to Return"
            required
            options={returnAssetOptions}
            value={returnForm.asset_id}
            onChange={(e) => setReturnForm((prev) => ({ ...prev, asset_id: e.target.value }))}
          />

          <Select
            label="Return Option"
            required
            options={[
              { value: 'itadmin', label: 'Return to IT Admin' },
            ]}
            value={returnForm.return_to}
            onChange={(e) => setReturnForm((prev) => ({ ...prev, return_to: e.target.value }))}
            helperText="Custody is returned exclusively to IT Admin."
          />

          <Input
            label="Return Notes / Remarks (Optional)"
            placeholder="e.g. Returned to IT Admin in good working condition"
            value={returnForm.notes}
            onChange={(e) => setReturnForm((prev) => ({ ...prev, notes: e.target.value }))}
          />

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" isLoading={isSubmitting}>
              Confirm Return to IT Admin
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
