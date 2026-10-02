'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { AssetInsurance } from '@/types/asset';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function InsurancePage() {
  const [insuranceList, setInsuranceList] = useState<AssetInsurance[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    asset_id: '',
    provider: '',
    policy_number: '',
    start_date: today,
    expiry_date: nextYear,
    coverage_amount: '',
    document_url: '',
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

  const openAddModal = async () => {
    setModalError(null);
    setIsModalOpen(true);
    try {
      const res = await fetch('/api/assets?limit=100');
      const data = await res.json();
      if (data.assets) setAssets(data.assets);
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          asset_id: Number(formData.asset_id),
          coverage_amount: parseFloat(formData.coverage_amount) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save policy');

      setIsModalOpen(false);
      setFormData({
        asset_id: '',
        provider: '',
        policy_number: '',
        start_date: today,
        expiry_date: nextYear,
        coverage_amount: '',
        document_url: '',
      });
      fetchInsurance();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<AssetInsurance>[] = [
    {
      key: 'asset_number',
      header: 'Linked Asset',
      render: (row) => (
        <div>
          <Link
            href={`/assets/${row.asset_id}`}
            className="font-mono font-bold text-blue-600 hover:underline block text-xs"
          >
            {row.asset_number}
          </Link>
          <span className="text-[11px] text-slate-400">{row.asset_model}</span>
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Insurance Provider',
      render: (row) => <span className="font-semibold text-slate-900 text-xs">{row.provider}</span>,
    },
    {
      key: 'policy_number',
      header: 'Policy Number',
      render: (row) => <span className="font-mono text-xs text-slate-700">{row.policy_number}</span>,
    },
    {
      key: 'coverage_amount',
      header: 'Coverage Amount',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-800 text-xs">
          {formatCurrency(row.coverage_amount)}
        </span>
      ),
    },
    {
      key: 'start_date',
      header: 'Policy Period',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {formatDate(row.start_date)} to {formatDate(row.expiry_date)}
        </span>
      ),
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
        <Link href={`/assets/${row.asset_id}`}>
          <Button variant="ghost" size="sm" className="text-xs text-blue-600 px-2 py-1">
            View Asset →
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
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

      {/* Filter bar with All, Active, Expiring, Expired */}
      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search provider, policy#, or asset#..."
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
              { value: 'active', label: 'Active Coverage' },
              { value: 'expiring', label: 'Expiring Soon (30d)' },
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
        keyExtractor={(row) => row.id}
        emptyTitle="No Insurance Policies"
        emptyDescription="No equipment insurance policies match the active filter criteria."
        emptyAction={
          <Button variant="primary" size="sm" onClick={openAddModal}>
            Register First Policy
          </Button>
        }
      />

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* Policy Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Link Insurance Policy to Asset"
        description="Configure coverage amount, provider, and policy validity period."
        size="md"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {modalError}
            </div>
          )}

          <Select
            label="Select Asset"
            required
            options={[
              { value: '', label: '-- Choose Equipment --' },
              ...assets.map((a) => ({
                value: a.id,
                label: `${a.asset_number} — ${a.brand} ${a.model}`,
              })),
            ]}
            value={formData.asset_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, asset_id: e.target.value }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Insurance Underwriter / Provider"
              required
              placeholder="e.g. Allianz, Chubb, Hartford"
              value={formData.provider}
              onChange={(e) => setFormData((prev) => ({ ...prev, provider: e.target.value }))}
            />

            <Input
              label="Policy Number"
              required
              placeholder="e.g. POL-2026-9921"
              value={formData.policy_number}
              onChange={(e) => setFormData((prev) => ({ ...prev, policy_number: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateInput
              label="Effective Start Date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
            />

            <DateInput
              label="Policy Expiry Date"
              required
              value={formData.expiry_date}
              onChange={(e) => setFormData((prev) => ({ ...prev, expiry_date: e.target.value }))}
            />
          </div>

          <Input
            label="Coverage Amount ($ USD)"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="e.g. 2500.00"
            value={formData.coverage_amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, coverage_amount: e.target.value }))}
          />

          <Input
            label="Certificate / Document URL"
            placeholder="https://storage.enterprise.internal/docs/..."
            value={formData.document_url}
            onChange={(e) => setFormData((prev) => ({ ...prev, document_url: e.target.value }))}
          />

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Insurance Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
