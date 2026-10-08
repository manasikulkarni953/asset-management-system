'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { StatsCard } from '@/components/data-display/StatsCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { AssetInsurance } from '@/types/asset';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function InsurancePage() {
  const [insuranceList, setInsuranceList] = useState<AssetInsurance[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    totalInsured: 0,
    activePolicies: 0,
    expiringSoon: 0,
    expiredPolicies: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<AssetInsurance | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);

  // Delete modal state
  const [policyToDelete, setPolicyToDelete] = useState<AssetInsurance | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    asset_id: '',
    provider: '',
    policy_number: '',
    start_date: today,
    expiry_date: nextYear,
    coverage_amount: '',
    notes: '',
  });

  const fetchInsurance = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'all') params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/insurance?${params.toString()}`);
      const data = await res.json();
      if (data.insuranceList) {
        setInsuranceList(data.insuranceList);
        setTotal(data.total);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching insurance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    fetchInsurance();
  }, [fetchInsurance]);

  const loadAssets = async () => {
    try {
      const res = await fetch('/api/assets?limit=100');
      const data = await res.json();
      if (data.assets) setAssets(data.assets);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  };

  const openAddModal = async () => {
    setModalError(null);
    setFormData({
      asset_id: '',
      provider: '',
      policy_number: '',
      start_date: today,
      expiry_date: nextYear,
      coverage_amount: '',
      notes: '',
    });
    setSelectedPolicy(null);
    await loadAssets();
    setIsAddEditModalOpen(true);
  };

  const openEditModal = async (policy: AssetInsurance) => {
    setModalError(null);
    setSelectedPolicy(policy);
    setFormData({
      asset_id: String(policy.asset_id),
      provider: policy.provider,
      policy_number: policy.policy_number,
      start_date: policy.start_date ? policy.start_date.split('T')[0] : today,
      expiry_date: policy.expiry_date ? policy.expiry_date.split('T')[0] : nextYear,
      coverage_amount: String(policy.coverage_amount || ''),
      notes: policy.notes || '',
    });
    await loadAssets();
    setIsAddEditModalOpen(true);
  };

  const openDetailsModal = (policy: AssetInsurance) => {
    setSelectedPolicy(policy);
    setIsDetailsModalOpen(true);
  };

  const openDeleteModal = (policy: AssetInsurance) => {
    setDeleteError(null);
    setPolicyToDelete(policy);
  };

  const handleConfirmDelete = async () => {
    if (!policyToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/insurance/${policyToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete insurance policy');
      }
      setPolicyToDelete(null);
      fetchInsurance();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting insurance policy');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      if (!formData.asset_id) {
        throw new Error('Please select an asset.');
      }
      if (!formData.provider.trim()) {
        throw new Error('Insurance provider is required.');
      }
      if (!formData.policy_number.trim()) {
        throw new Error('Policy number is required.');
      }
      if (Number(formData.coverage_amount) < 0 || isNaN(Number(formData.coverage_amount))) {
        throw new Error('Coverage amount must be a valid number.');
      }
      if (new Date(formData.expiry_date) <= new Date(formData.start_date)) {
        throw new Error('Expiry date must be after Start date.');
      }

      const res = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: Number(formData.asset_id),
          provider: formData.provider.trim(),
          policy_number: formData.policy_number.trim(),
          start_date: formData.start_date,
          expiry_date: formData.expiry_date,
          coverage_amount: parseFloat(formData.coverage_amount) || 0,
          notes: formData.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save policy');

      setIsAddEditModalOpen(false);
      fetchInsurance();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (policyStatus: string) => {
    switch (policyStatus?.toLowerCase()) {
      case 'active':
        return (
          <Badge variant="success" size="sm" dot>
            ACTIVE
          </Badge>
        );
      case 'expiring':
        return (
          <Badge variant="warning" size="sm" dot>
            EXPIRING SOON
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="danger" size="sm" dot>
            EXPIRED
          </Badge>
        );
      default:
        return (
          <Badge variant="default" size="sm">
            {policyStatus?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        );
    }
  };

  const columns: Column<AssetInsurance>[] = [
    {
      key: 'asset_number',
      header: 'Asset Number',
      render: (row) => (
        <Link
          href={`/assets/${row.asset_id}`}
          className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline block text-xs"
        >
          {row.asset_number}
        </Link>
      ),
    },
    {
      key: 'asset_name',
      header: 'Asset Name',
      render: (row) => (
        <span className="font-semibold text-slate-900 dark:text-white block text-xs">
          {row.asset_name || `${row.brand || ''} ${row.model || row.asset_model || ''}`.trim() || 'Unknown Equipment'}
        </span>
      ),
    },
    {
      key: 'provider',
      header: 'Insurance Provider',
      render: (row) => <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{row.provider}</span>,
    },
    {
      key: 'policy_number',
      header: 'Policy Number',
      render: (row) => <span className="font-mono font-medium text-xs text-slate-700 dark:text-slate-300">{row.policy_number}</span>,
    },
    {
      key: 'coverage_amount',
      header: 'Coverage Amount',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-white text-xs">
          {formatCurrency(row.coverage_amount)}
        </span>
      ),
    },
    {
      key: 'start_date',
      header: 'Start Date',
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-300">{formatDate(row.start_date)}</span>,
    },
    {
      key: 'expiry_date',
      header: 'Expiry Date',
      render: (row) => <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">{formatDate(row.expiry_date)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => renderStatusBadge(row.status),
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
            onClick={() => openDetailsModal(row)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 px-2 py-1"
          >
            View Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditModal(row)}
            className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1"
          >
            Edit
          </Button>
          <button
            type="button"
            onClick={() => openDeleteModal(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40"
            title="Delete Insurance Policy"
            aria-label="Delete Insurance Policy"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asset Insurance Management"
        description="Warranty protection, risk coverage, policy numbers, and expiration tracking."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add / Link Insurance
          </Button>
        }
      />

      {/* Summary Cards: All fed directly from database */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Insured Assets"
          value={stats.totalInsured}
          color="blue"
          icon={
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />
        <StatsCard
          title="Active Policies"
          value={stats.activePolicies}
          color="emerald"
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatsCard
          title="Expiring Soon"
          value={stats.expiringSoon}
          description="Within next 30 days"
          color="amber"
          icon={
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Expired Policies"
          value={stats.expiredPolicies}
          color="rose"
          icon={
            <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
      </div>

      {/* Filter bar: Search by Asset#, Name, Provider, Policy# & Filter Status */}
      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by Asset #, Asset Name, Provider, or Policy #..."
        filters={[
          {
            key: 'status',
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Policies' },
              { value: 'active', label: 'Active' },
              { value: 'expiring', label: 'Expiring Soon' },
              { value: 'expired', label: 'Expired' },
            ],
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatus('all');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={insuranceList}
        isLoading={isLoading}
        emptyTitle="No Insurance Policies Found"
        emptyDescription={
          search || status !== 'all'
            ? 'No policies matched your current filter criteria.'
            : 'Zero active insurance policies recorded in the asset register.'
        }
        emptyAction={
          <Button variant="primary" size="sm" onClick={openAddModal}>
            Add First Policy
          </Button>
        }
      />

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* Add / Edit Policy Modal */}
      <Modal
        isOpen={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        title={selectedPolicy ? 'Edit Insurance Policy' : 'Add Insurance Policy'}
        description="Provide policy coverage, terms, and linked equipment details."
        size="lg"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {modalError}
            </div>
          )}

          <div>
            <Select
              label="Linked Asset"
              required
              disabled={!!selectedPolicy}
              options={[
                { value: '', label: '-- Select an asset from inventory --' },
                ...assets.map((a) => ({
                  value: String(a.id),
                  label: `${a.asset_number} — ${a.brand} ${a.model} (${a.serial_number})`,
                })),
              ]}
              value={formData.asset_id}
              onChange={(e) => setFormData((prev) => ({ ...prev, asset_id: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Insurance Provider"
              required
              placeholder="e.g. Chubb Business, Allianz, AIG"
              value={formData.provider}
              onChange={(e) => setFormData((prev) => ({ ...prev, provider: e.target.value }))}
            />

            <Input
              label="Policy Number"
              required
              placeholder="e.g. POL-CHB-44120"
              value={formData.policy_number}
              onChange={(e) => setFormData((prev) => ({ ...prev, policy_number: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Coverage Amount"
              type="number"
              min="0"
              step="any"
              required
              placeholder="e.g. 200000"
              value={formData.coverage_amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, coverage_amount: e.target.value }))}
            />

            <DateInput
              label="Start Date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
            />

            <DateInput
              label="Expiry Date"
              required
              value={formData.expiry_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, expiry_date: e.target.value }))}
            />
          </div>

          <Textarea
            label="Notes"
            rows={3}
            placeholder="Coverage terms, claim helpline, deductible details..."
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
            <span>Insurance Status is <strong>automatically calculated</strong> from the Expiry Date (30-day window).</span>
            <span className="font-semibold text-slate-800">System Managed</span>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {selectedPolicy ? 'Update Policy' : 'Save Policy'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Insurance Details Modal */}
      {selectedPolicy && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Policy Details • ${selectedPolicy.policy_number}`}
          description={`Insurance records for ${selectedPolicy.asset_number || 'Asset'}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* POLICY INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200">
                Policy Information
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Insurance Provider</span>
                  <span className="font-semibold text-slate-900 text-sm mt-0.5 block">{selectedPolicy.provider}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Policy Number</span>
                  <span className="font-mono font-semibold text-slate-900 text-sm mt-0.5 block">{selectedPolicy.policy_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Coverage Amount</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{formatCurrency(selectedPolicy.coverage_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Start Date</span>
                  <span className="font-medium text-slate-800 mt-0.5 block">{formatDate(selectedPolicy.start_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Expiry Date</span>
                  <span className="font-medium text-slate-800 mt-0.5 block">{formatDate(selectedPolicy.expiry_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <div className="mt-1">{renderStatusBadge(selectedPolicy.status)}</div>
                </div>
              </div>
            </div>

            {/* LINKED ASSET */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200">
                Linked Asset
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Asset Number</span>
                  <Link
                    href={`/assets/${selectedPolicy.asset_id}`}
                    className="font-mono font-bold text-blue-600 hover:underline mt-0.5 block"
                  >
                    {selectedPolicy.asset_number}
                  </Link>
                </div>
                <div>
                  <span className="text-slate-500 block">Asset Name</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">{selectedPolicy.asset_name || `${selectedPolicy.brand || ''} ${selectedPolicy.model || selectedPolicy.asset_model || ''}`}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Brand / Model</span>
                  <span className="text-slate-700 mt-0.5 block">{selectedPolicy.brand || '-'} {selectedPolicy.model || selectedPolicy.asset_model || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Serial Number</span>
                  <span className="font-mono text-slate-800 mt-0.5 block">{selectedPolicy.serial_number || '-'}</span>
                </div>
              </div>
            </div>

            {/* CURRENT ASSIGNMENT */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200">
                Current Custody & Assignment
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Employee ID</span>
                  <span className="font-mono font-bold text-slate-800 mt-0.5 block">
                    {selectedPolicy.employee_id || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Custodian Name</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {selectedPolicy.employee_name || 'In Storage'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department</span>
                  <span className="text-slate-700 mt-0.5 block">{selectedPolicy.department || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Workstation</span>
                  <span className="font-mono font-semibold text-indigo-700 mt-0.5 block">
                    {selectedPolicy.workstation || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* NOTES */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Notes & Coverage Details</h4>
              <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[60px]">
                {selectedPolicy.notes || 'No policy notes recorded.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openDeleteModal(selectedPolicy);
                }}
              >
                Delete Policy
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    openEditModal(selectedPolicy);
                  }}
                >
                  Edit Policy
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!policyToDelete}
        onClose={() => {
          if (!isDeleting) {
            setPolicyToDelete(null);
            setDeleteError(null);
          }
        }}
        title="Delete Insurance Policy"
        description="Are you sure you want to permanently delete this insurance policy?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPolicyToDelete(null);
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
            >
              Delete Policy
            </Button>
          </div>
        }
      >
        {policyToDelete && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You are about to delete insurance policy{' '}
              <strong className="font-mono text-slate-900 dark:text-white">
                {policyToDelete.policy_number}
              </strong>{' '}
              ({policyToDelete.provider}) linked to asset{' '}
              <strong className="font-mono text-blue-600 dark:text-blue-400">
                {policyToDelete.asset_number}
              </strong>.
            </p>
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              ⚠️ <strong>Warning:</strong> This action cannot be undone. The warranty and insurance protection record for this equipment will be permanently removed.
            </div>
            {deleteError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{deleteError}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
