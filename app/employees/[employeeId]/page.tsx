'use client';

import React, { useEffect, useState, use, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { DataTable } from '@/components/data-display/DataTable';
import { Spinner } from '@/components/ui/Spinner';
import { EmployeeDetailed } from '@/types/employee';
import { formatDate } from '@/lib/utils';
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Search,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Wrench,
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

interface ActiveEmployeeItem {
  id: number;
  employee_id: string;
  name: string;
  department: string;
}

export default function EmployeeDetailsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);
  const router = useRouter();
  const [employee, setEmployee] = useState<EmployeeDetailed | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Assign Asset Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<AvailableAssetItem[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployeeItem[]>([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState<string>('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [assignCondition, setAssignCondition] = useState('Good');
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    message: string;
    assets: string[];
  } | null>(null);

  // Edit Employee Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    department: 'Operations',
    designation: '',
    location: 'The Space',
    workstation: '',
    phone_number: '',
    status: 'active' as 'active' | 'on_leave' | 'terminated',
  });

  // Delete Employee Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Move to Repair Modal States
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [assetToRepair, setAssetToRepair] = useState<any>(null);
  const [repairCategory, setRepairCategory] = useState('Hardware Issue');
  const [repairSeverity, setRepairSeverity] = useState('medium');
  const [repairDescription, setRepairDescription] = useState('');
  const [isSubmittingRepair, setIsSubmittingRepair] = useState(false);
  const [repairModalError, setRepairModalError] = useState<string | null>(null);

  const openMoveToRepairModal = (asset: any) => {
    setAssetToRepair(asset);
    setRepairCategory('Hardware Issue');
    setRepairSeverity('medium');
    setRepairDescription('');
    setRepairModalError(null);
    setIsRepairModalOpen(true);
  };

  const handleConfirmMoveToRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetToRepair) return;

    if (!repairDescription.trim()) {
      setRepairModalError('Issue Description is required.');
      return;
    }

    setIsSubmittingRepair(true);
    setRepairModalError(null);

    const severityMap: Record<string, string> = {
      low: 'minor',
      medium: 'moderate',
      high: 'severe',
      critical: 'total_loss',
    };
    const dbSeverity = severityMap[repairSeverity] || 'moderate';

    try {
      const resAsset = await fetch(`/api/assets/${assetToRepair.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'under_maintenance',
        }),
      });

      if (!resAsset.ok) {
        const errData = await resAsset.json();
        throw new Error(errData.error || 'Failed to update asset status');
      }

      const resDamage = await fetch('/api/damaged-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetToRepair.id,
          employee_id: employee?.id ? Number(employee.id) : null,
          damage_type: repairCategory,
          severity: dbSeverity,
          incident_date: new Date().toISOString().split('T')[0],
          repair_status: 'sent_for_repair',
          description: repairDescription.trim(),
        }),
      });

      if (!resDamage.ok) {
        const errDamage = await resDamage.json();
        throw new Error(errDamage.error || 'Failed to record in Damaged Assets section');
      }

      setIsRepairModalOpen(false);

      // Navigate directly to https://localhost:3000/damaged-assets
      router.push('/damaged-assets');
    } catch (err: any) {
      setRepairModalError(err.message || 'Failed to move asset to repair');
    } finally {
      setIsSubmittingRepair(false);
    }
  };

  const fetchEmployee = useCallback(() => {
    fetch(`/api/employees/${employeeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.employee) setEmployee(data.employee);
      })
      .catch((err) => console.error('Error fetching employee:', err))
      .finally(() => setIsLoading(false));
  }, [employeeId]);

  useEffect(() => {
    setIsLoading(true);
    fetchEmployee();
  }, [fetchEmployee]);

  const openAssignModal = async () => {
    setIsAssignModalOpen(true);
    setModalError(null);
    setAssignEmployeeId(String(employee?.id || employeeId));
    setSelectedAssetIds([]);
    setAssetSearchQuery('');
    setAssetCategoryFilter('all');
    setAssignCondition('Good');

    try {
      const res = await fetch('/api/assignments?limit=1');
      const data = await res.json();
      if (data.availableAssets) setAvailableAssets(data.availableAssets);
      if (data.activeEmployees) setActiveEmployees(data.activeEmployees);
    } catch (err) {
      console.error('Error fetching assignment options:', err);
    }
  };

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    availableAssets.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [availableAssets]);

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

  const handleToggleAsset = (id: number) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const visibleIds = filteredAvailableAssets.map((a) => a.id);
    setSelectedAssetIds((prev) => {
      const set = new Set([...prev, ...visibleIds]);
      return Array.from(set);
    });
  };

  const handleClearSelection = () => {
    setSelectedAssetIds([]);
  };

  const selectedEmployeeObj = useMemo(() => {
    if (activeEmployees.length > 0) {
      const found = activeEmployees.find((e) => String(e.id) === String(assignEmployeeId));
      if (found) return found;
    }
    if (employee && String(employee.id) === String(assignEmployeeId)) {
      return {
        id: employee.id,
        name: employee.name,
        employee_id: employee.employee_id,
        department: employee.department,
      };
    }
    return null;
  }, [activeEmployees, assignEmployeeId, employee]);

  const allDepartmentOptions = useMemo(() => {
    const defaults = [
      'Quality',
      'Development',
      'Operations',
      'DBMS',
      'Email Marketing',
      'Management',
      'Sales',
      'Human Resources',
    ];
    const list = [...defaults];
    if (employee?.department && !list.includes(employee.department)) {
      list.push(employee.department);
    }
    return list.map((dept) => ({ value: dept, label: dept }));
  }, [employee?.department]);

  const openEditModal = () => {
    if (!employee) return;
    setEditFormData({
      name: employee.name || '',
      email: employee.email || '',
      department: employee.department || 'Operations',
      designation: employee.designation || '',
      location: employee.location || 'The Space',
      workstation: employee.workstation || '',
      phone_number: employee.phone_number || '',
      status: (employee.status as any) || 'active',
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name.trim()) {
      setEditError('Employee name is required.');
      return;
    }
    if (!editFormData.email.trim()) {
      setEditError('Corporate email is required.');
      return;
    }

    setIsUpdating(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          email: editFormData.email.trim().toLowerCase(),
          department: editFormData.department.trim(),
          designation: editFormData.designation.trim(),
          location: editFormData.location.trim() || 'The Space',
          workstation: editFormData.workstation.trim() || null,
          phone_number: editFormData.phone_number.trim() || null,
          status: editFormData.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update employee profile.');
      }

      setIsEditModalOpen(false);
      setSuccessBanner({
        message: data.message || 'Employee profile updated successfully',
        assets: [],
      });
      fetchEmployee();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update employee');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete employee.');
      }

      setIsDeleteModalOpen(false);
      router.push('/employees');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete employee.');
      setIsDeleting(false);
    }
  };

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

      setIsAssignModalOpen(false);
      setSuccessBanner({
        message: data.message || `Successfully assigned ${selectedAssetIds.length} assets`,
        assets: data.assets || [],
      });
      setSelectedAssetIds([]);

      // Refresh employee profile data to reflect newly assigned assets
      fetchEmployee();
    } catch (err: any) {
      setModalError(err.message || 'Assignment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading employee profile...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Employee Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No employee matches ID {employeeId}.</p>
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
            <Button
              variant="primary"
              size="sm"
              onClick={openAssignModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Assign Asset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openEditModal}
              icon={<Pencil className="w-4 h-4" />}
              title="Edit Profile"
            >
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
              icon={<Trash2 className="w-4 h-4" />}
              title="Permanently Delete Employee"
            >
              Delete
            </Button>
          </div>
        }
      />

      {/* Success Alert Banner */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold">{successBanner.message}</span>
              {successBanner.assets.length > 0 && (
                <span className="font-mono ml-2 text-emerald-700 dark:text-emerald-300">
                  [{successBanner.assets.join(', ')}]
                </span>
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

      {/* Staff profile summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        <div className="p-4 bg-white dark:bg-[#0b1224] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Employee Code</span>
          <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5 font-mono">{employee.employee_id}</p>
        </div>
        <div className="p-4 bg-white dark:bg-[#0b1224] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Corporate Email</span>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5 truncate">{employee.email}</p>
        </div>
        <div className="p-4 bg-white dark:bg-[#0b1224] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Department</span>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{employee.department}</p>
        </div>
        <div className="p-4 bg-white dark:bg-[#0b1224] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Office Location</span>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{employee.location || 'The Space'}</p>
        </div>
        <div className="p-4 bg-white dark:bg-[#0b1224] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Workstation / Seat Number</span>
          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">{employee.workstation || 'Not Assigned'}</p>
        </div>
        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800/60 col-span-2 sm:col-span-1 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase text-indigo-700 dark:text-indigo-300">Total Current Assets</span>
          <p className="text-xl font-bold text-indigo-950 dark:text-white mt-0.5 font-mono">
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
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <Link href={`/tickets/new?assetId=${row.id}&employeeId=${employee.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 font-medium"
                      >
                        Raise Ticket
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => openMoveToRepairModal(row)}
                      className="h-8 w-8 rounded-lg border border-amber-300 dark:border-amber-700/80 bg-amber-50/60 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                      title="Move Equipment to Repair"
                      aria-label="Move Equipment to Repair"
                    >
                      <Wrench className="w-4 h-4" />
                    </button>
                  </div>
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

      {/* ================================================================= */}
      {/* MULTI-ASSET ASSIGNMENT MODAL (Enterprise Multi-Asset Workflow)     */}
      {/* ================================================================= */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
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
                <span className="text-xs text-blue-700 font-semibold bg-blue-100/80 px-2 py-0.5 rounded">
                  Target Employee
                </span>
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
                onClick={() => setIsAssignModalOpen(false)}
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

      {/* Edit Employee Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Employee Profile"
        description={`Modify information, designation, and status for ${employee.name}.`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {editError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Employee ID (Read-only / Permanent) */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Employee Code (Permanent)
              </label>
              <Input
                value={employee.employee_id}
                disabled
                className="bg-slate-100 text-slate-500 font-mono font-bold cursor-not-allowed"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Account Status <span className="text-rose-500">*</span>
              </label>
              <Select
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'on_leave', label: 'On Leave' },
                  { value: 'terminated', label: 'Terminated' },
                ]}
                value={editFormData.status}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, status: e.target.value as any })
                }
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <Input
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                placeholder="e.g. John Doe"
                required
              />
            </div>

            {/* Corporate Email */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Corporate Email <span className="text-rose-500">*</span>
              </label>
              <Input
                type="email"
                value={editFormData.email}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, email: e.target.value })
                }
                placeholder="e.g. john.doe@company.com"
                required
              />
            </div>

            {/* Department */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Department <span className="text-rose-500">*</span>
              </label>
              <Select
                options={allDepartmentOptions}
                value={editFormData.department}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, department: e.target.value })
                }
              />
            </div>

            {/* Designation */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Designation / Job Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={editFormData.designation}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, designation: e.target.value })
                }
                placeholder="e.g. Senior Software Engineer"
                required
              />
            </div>

            {/* Workstation / Desk */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Workstation / Seat Number
              </label>
              <Input
                value={editFormData.workstation}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, workstation: e.target.value })
                }
                placeholder="e.g. WS-05-001"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Format: WS-05-XXX
              </span>
            </div>

            {/* Office Location */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Office Location
              </label>
              <Input
                value={editFormData.location}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, location: e.target.value })
                }
                placeholder="e.g. The Space"
              />
            </div>

            {/* Phone Number */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Contact Phone Number
              </label>
              <Input
                value={editFormData.phone_number}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, phone_number: e.target.value })
                }
                placeholder="e.g. +91 98765 43210"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdating}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Employee Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Permanently Delete Employee"
        description="This action is irreversible and permanently removes the employee record."
        size="md"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-900 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Are you sure you want to permanently delete this user?</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              You are about to delete <strong className="text-slate-900">{employee.name}</strong> (Code: <span className="font-mono font-bold text-slate-900">{employee.employee_id}</span>, Email: <span className="font-mono text-slate-900">{employee.email}</span>).
            </p>
            <div className="p-3 bg-white rounded-lg border border-rose-200 space-y-1.5 text-slate-600">
              <div className="flex items-center justify-between">
                <span>Currently Assigned Assets:</span>
                <span className="font-bold text-slate-900">{employee.current_assets?.length || 0} Assets (will be returned to stock)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Associated User Login Account:</span>
                <span className="font-bold text-rose-700">Permanently deleted</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteSubmit}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Permanently Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Move Equipment to Repair Modal */}
      <Modal
        isOpen={isRepairModalOpen}
        onClose={() => !isSubmittingRepair && setIsRepairModalOpen(false)}
        title="Move Equipment to Repair"
        description="Transition this hardware into maintenance status and log repair triage."
        size="md"
      >
        {assetToRepair && (
          <form onSubmit={handleConfirmMoveToRepair} className="space-y-4">
            {repairModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                {repairModalError}
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-blue-600">
                  {assetToRepair.asset_number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Moving to Repair
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {assetToRepair.brand} {assetToRepair.model} ({assetToRepair.category})
              </p>
              {assetToRepair.serial_number && (
                <p className="text-[11px] font-mono text-slate-400">
                  SN: {assetToRepair.serial_number}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {/* Repair / Fault Category* — Dropdown */}
              <Select
                label="Repair / Fault Category *"
                required
                options={[
                  { value: 'Hardware Issue', label: 'Hardware Issue' },
                  { value: 'Software Issue', label: 'Software Issue' },
                  { value: 'Display / Screen', label: 'Display / Screen' },
                  { value: 'Keyboard / Mouse', label: 'Keyboard / Mouse' },
                  { value: 'Battery / Power', label: 'Battery / Power' },
                  { value: 'Network / Connectivity', label: 'Network / Connectivity' },
                  { value: 'Operating System', label: 'Operating System' },
                  { value: 'Performance Issue', label: 'Performance Issue' },
                  { value: 'Physical Damage', label: 'Physical Damage' },
                  { value: 'Peripheral / Accessory', label: 'Peripheral / Accessory' },
                  { value: 'Other', label: 'Other' },
                ]}
                value={repairCategory}
                onChange={(e) => setRepairCategory(e.target.value)}
              />

              {/* Severity* — Dropdown */}
              <Select
                label="Severity *"
                required
                options={[
                  { value: 'low', label: 'Low — Minor issue; asset is still usable' },
                  { value: 'medium', label: 'Medium — Normal work is affected' },
                  { value: 'high', label: 'High — Major functionality is affected' },
                  { value: 'critical', label: 'Critical — Asset cannot be used' },
                ]}
                value={repairSeverity}
                onChange={(e) => setRepairSeverity(e.target.value)}
              />

              {/* Issue Description* — Textarea */}
              <Textarea
                label="Issue Description *"
                required
                rows={3}
                placeholder="Describe the issue, symptoms, or reason for repair..."
                value={repairDescription}
                onChange={(e) => setRepairDescription(e.target.value)}
                helperText="Please describe the fault or symptoms observed."
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmittingRepair}
                onClick={() => setIsRepairModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmittingRepair}
                icon={<Wrench className="w-3.5 h-3.5" />}
              >
                Confirm Move to Repair
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
