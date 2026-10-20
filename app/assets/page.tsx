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
import { BarcodePrint } from '@/components/barcode/BarcodePrint';
import { AssetImportModal } from '@/components/assets/AssetImportModal';
import { ImportedFileFullScreenViewer } from '@/components/assets/ImportedFileFullScreenViewer';
import { Asset } from '@/types/asset';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Upload, FolderOpen, FileSpreadsheet, Trash2, Maximize2 } from 'lucide-react';

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

  // Import modal & filter states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalTab, setImportModalTab] = useState<'import' | 'history'>('import');
  const [importFilter, setImportFilter] = useState<{ id: number; name: string } | null>(null);
  const [importHistoryCount, setImportHistoryCount] = useState<number>(0);
  const [fullScreenImportId, setFullScreenImportId] = useState<number | null>(null);

  // Print modal state
  const [selectedAssetForPrint, setSelectedAssetForPrint] = useState<Asset | null>(null);

  // Delete modal state
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch count of imported files
  const fetchImportCount = useCallback(async () => {
    try {
      const res = await fetch('/api/assets/imports');
      const data = await res.json();
      if (data.imports) setImportHistoryCount(data.imports.length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchImportCount();
  }, [fetchImportCount]);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (category !== 'all') params.set('category', category);
      if (status !== 'all') params.set('status', status);
      if (importFilter?.id) params.set('importId', String(importFilter.id));
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
  }, [search, category, status, importFilter, page]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('all');
    setStatus('all');
    setImportFilter(null);
    setPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/assets/${assetToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete asset');
      }
      setAssetToDelete(null);
      fetchAssets();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting asset');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Asset>[] = [
    {
      key: 'asset_number',
      header: 'Asset Information',
      render: (row) => (
        <div className="flex flex-col">
          <Link
            href={`/assets/${row.id}`}
            className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            title="View Asset Details"
          >
            {row.asset_number}
          </Link>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">ID: {row.asset_id}</span>
          {row.import_filename && (
            <div className="flex items-center gap-1 mt-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (row.import_id) {
                    setImportFilter({ id: row.import_id, name: row.import_filename! });
                    setPage(1);
                  }
                }}
                className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer text-left truncate max-w-[150px]"
                title={`Imported from ${row.import_filename}. Click to filter by this file.`}
              >
                📁 {row.import_filename}
              </button>
              {row.import_id && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullScreenImportId(row.import_id!);
                  }}
                  className="p-0.5 rounded text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="View this imported file in full screen"
                  aria-label="View imported file in full screen"
                >
                  <Maximize2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'model',
      header: 'Name',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900 dark:text-white">
            {row.brand} {row.model}
          </div>
          <span className="inline-block text-xs text-slate-500 dark:text-slate-400">{row.category}</span>
        </div>
      ),
    },
    {
      key: 'serial_number',
      header: 'Serial Number',
      render: (row) => (
        <span className="font-mono font-semibold text-xs text-slate-800 dark:text-slate-200">
          {row.serial_number}
        </span>
      ),
    },
    {
      key: 'purchase_date',
      header: 'Purchase Details',
      render: (row) => (
        <div className="text-xs">
          <span className="text-slate-700 dark:text-slate-200 block">{formatDate(row.purchase_date)}</span>
          <span className="text-slate-500 dark:text-slate-400 font-mono font-medium">{formatCurrency(row.purchase_cost)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'current_employee_name',
      header: 'Assigned Custodian',
      render: (row) =>
        row.current_employee_name ? (
          <div className="text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">{row.current_employee_name}</span>
            {row.current_employee_code && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{row.current_employee_code}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">Unassigned</span>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedAssetForPrint(row)}
            title="Print Barcode Sticker"
            className="px-2 py-1 text-xs"
            icon={
              <svg className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            }
          >
            Sticker
          </Button>

          {/* View Icon */}
          <Link href={`/assets/${row.id}`} title="View Details">
            <button
              type="button"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
              title="View Asset"
              aria-label="View Asset"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </Link>

          {/* Edit Icon */}
          <Link href={`/assets/${row.id}/edit`} title="Edit Asset">
            <button
              type="button"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
              title="Edit Asset"
              aria-label="Edit Asset"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </Link>

          {/* Delete Icon */}
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setAssetToDelete(row);
            }}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
            title="Delete Asset"
            aria-label="Delete Asset"
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
    <div className="space-y-4">
      <PageHeader
        title="Asset Inventory"
        description="Comprehensive inventory of organization hardware, Code 128 barcodes, and custodians."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportModalTab('history');
                setIsImportModalOpen(true);
              }}
              icon={<FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              title="View all imported files and their contents"
            >
              View Imported Files {importHistoryCount > 0 ? `(${importHistoryCount})` : ''}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportModalTab('import');
                setIsImportModalOpen(true);
              }}
              icon={<Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            >
              Import Files
            </Button>
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

      {/* Filtered By Import Banner */}
      {importFilter && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 animate-fadeIn">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Viewing Assets From File:
            </span>
            <span className="font-mono bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded font-bold">
              {importFilter.name}
            </span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">({total} matching records)</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setFullScreenImportId(importFilter.id)}
              className="text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white font-semibold cursor-pointer flex items-center gap-1 hover:underline"
              title="Open this file in full screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              View File in Full Screen
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setImportFilter(null);
                setPage(1);
              }}
              className="text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-white font-semibold underline cursor-pointer"
            >
              Clear Filter (Show All Assets)
            </button>
            <button
              type="button"
              onClick={() => {
                setImportModalTab('history');
                setIsImportModalOpen(true);
              }}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 font-semibold cursor-pointer flex items-center gap-1 hover:underline"
            >
              <Trash2 className="w-3 h-3" />
              Manage / Delete File
            </button>
          </div>
        </div>
      )}

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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!assetToDelete}
        onClose={() => {
          if (!isDeleting) {
            setAssetToDelete(null);
            setDeleteError(null);
          }
        }}
        title="Delete Asset"
        description="Are you sure you want to permanently delete this asset from the inventory?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssetToDelete(null);
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
              Delete Asset
            </Button>
          </div>
        }
      >
        {assetToDelete && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You are about to delete asset{' '}
              <strong className="font-mono text-slate-900 dark:text-white">
                {assetToDelete.asset_number}
              </strong>{' '}
              ({assetToDelete.brand} {assetToDelete.model}).
            </p>
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
              ⚠️ <strong>Warning:</strong> This action cannot be undone. Associated assignment logs and historical records for this asset will be removed.
            </div>
            {deleteError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{deleteError}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Asset Import Modal (Upload & History) */}
      <AssetImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialTab={importModalTab}
        currentImportFilterId={importFilter?.id}
        onClearImportFilter={() => {
          setImportFilter(null);
          setPage(1);
        }}
        onImportSuccess={() => {
          fetchAssets();
          fetchImportCount();
        }}
        onFilterByImport={(id, name) => {
          setImportFilter({ id, name });
          setPage(1);
        }}
      />

      {/* Standalone Full Screen Imported File Viewer */}
      <ImportedFileFullScreenViewer
        isOpen={!!fullScreenImportId}
        onClose={() => setFullScreenImportId(null)}
        importId={fullScreenImportId}
        onFilterByImport={(id, name) => {
          setImportFilter({ id, name });
          setPage(1);
        }}
      />
    </div>
  );
}
