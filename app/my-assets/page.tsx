'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { formatDate } from '@/lib/utils';
import type { Asset } from '@/types/asset';

export default function MyAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/assets')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch assets');
        return res.json();
      })
      .then((data) => {
        if (data.assets) {
          setAssets(data.assets);
        }
      })
      .catch((err) => console.error('Error fetching assets:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Asset>[] = [
    {
      key: 'asset_number',
      header: 'Asset Number',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {row.asset_number}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Equipment Category',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
          {row.category}
        </span>
      ),
    },
    {
      key: 'model',
      header: 'Model & Specifications',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs">{row.brand} {row.model}</span>
          <span className="text-[10px] text-slate-400 font-mono">Serial: {row.serial_number}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Operational Status',
      render: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'created_at',
      header: 'Assigned Date',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <Link href={`/tickets/new?assetId=${row.id}`}>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 py-1 px-3"
            icon={
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Raise Support Ticket
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Equipment"
        description="Physical hardware devices and workstations currently assigned to your custody. You can raise a support ticket directly for any equipment encountering issues."
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

      <Card
        title={
          <div className="flex items-center gap-2">
            <span>Currently Held Hardware</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
              {assets.length} Active Items
            </span>
          </div>
        }
        subtitle="Hardware assets registered in your custody. Isolated strictly to your employee identity."
      >
        <DataTable
          columns={columns}
          data={assets}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          emptyTitle="No Assets Assigned"
          emptyDescription="There are currently no active hardware devices assigned to your profile."
        />
      </Card>
    </div>
  );
}
