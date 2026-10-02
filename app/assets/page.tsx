'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Button } from '@/components/ui/Button';
import { BarcodePrint } from '@/components/barcode/BarcodePrint';
import { Asset } from '@/types/asset';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Print modal state
  const [selectedAssetForPrint, setSelectedAssetForPrint] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category !== 'all') params.set('category', category);
      if (status !== 'all') params.set('status', status);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/assets?${params.toString()}`);
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets);
        setTotal(data.total);
        if (data.categories) setCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, category, status, page]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('all');
    setStatus('all');
    setPage(1);
  };

  const columns: Column<Asset>[] = [
    {
      key: 'asset_number',
      header: 'Asset Identity',
      render: (row) => (
        <div className="flex flex-col">
          <Link
            href={`/assets/${row.id}`}
            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
          >
            {row.asset_number}
          </Link>
          <span className="text-[11px] text-slate-500 font-mono">ID: {row.asset_id}</span>
          <span className="text-[11px] text-slate-400 font-mono">SN: {row.serial_number}</span>
        </div>
      ),
    },
    {
      key: 'model',
      header: 'Hardware Details',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">
            {row.brand} {row.model}
          </div>
          <span className="inline-block text-xs text-slate-500">{row.category}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'current_employee_name',
      header: 'Assigned To',
      render: (row) =>
        row.current_employee_name ? (
          <div>
            <span className="font-medium text-slate-800 block">{row.current_employee_name}</span>
            <span className="text-xs text-slate-400 font-mono">{row.current_employee_code}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">In Inventory</span>
        ),
    },
    {
      key: 'purchase_date',
      header: 'Purchased / Cost',
      render: (row) => (
        <div className="text-xs">
          <span className="text-slate-700 block">{formatDate(row.purchase_date)}</span>
          <span className="text-slate-500 font-mono">{formatCurrency(row.purchase_cost)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedAssetForPrint(row)}
            title="Print Barcode Sticker"
            className="px-2 py-1 text-xs"
            icon={
              <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            }
          >
            Sticker
          </Button>
          <Link href={`/assets/${row.id}`}>
            <Button variant="ghost" size="sm" className="px-2 py-1 text-xs text-slate-600">
              View
            </Button>
          </Link>
          <Link href={`/assets/${row.id}/edit`}>
            <Button variant="ghost" size="sm" className="px-2 py-1 text-xs text-blue-600">
              Edit
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset Inventory"
        description="Comprehensive inventory of organization hardware, Code 128 barcodes, and custodians."
        action={
          <div className="flex items-center gap-2">
            <Link href="/scan">
              <Button
                variant="outline"
                size="sm"
                icon={
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                }
              >
                Scan Barcode
              </Button>
            </Link>
            <Link href="/assets/add">
              <Button
                variant="primary"
                size="sm"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Add Asset
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by asset#, brand, model, SN..."
        filters={[
          {
            key: 'category',
            value: category,
            onChange: (v) => {
              setCategory(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Categories' },
              ...categories.map((c) => ({ value: c, label: c })),
            ],
          },
          {
            key: 'status',
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Statuses' },
              { value: 'in_stock', label: 'In Stock' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'under_maintenance', label: 'Maintenance' },
              { value: 'retired', label: 'Retired' },
            ],
          },
        ]}
        onReset={handleResetFilters}
      />

      {/* Assets Table */}
      <DataTable
        columns={columns}
        data={assets}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyTitle="No Assets Found"
        emptyDescription="Try adjusting your search criteria or register a new asset."
        emptyAction={
          <Link href="/assets/add">
            <Button variant="primary" size="sm">
              Register First Asset
            </Button>
          </Link>
        }
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* Barcode Print Modal */}
      {selectedAssetForPrint && (
        <BarcodePrint
          isOpen={!!selectedAssetForPrint}
          onClose={() => setSelectedAssetForPrint(null)}
          asset={selectedAssetForPrint}
        />
      )}
    </div>
  );
}
