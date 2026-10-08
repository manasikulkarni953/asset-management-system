'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Timeline, TimelineItem } from '@/components/data-display/Timeline';
import { DataTable } from '@/components/data-display/DataTable';
import { BarcodePreview } from '@/components/barcode/BarcodePreview';
import { BarcodePrint } from '@/components/barcode/BarcodePrint';
import { Spinner } from '@/components/ui/Spinner';
import { AssetDetailed } from '@/types/asset';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function AssetDetailsPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = use(params);
  const [asset, setAsset] = useState<AssetDetailed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'assignments' | 'tickets' | 'history' | 'insurance' | 'network'
  >('overview');

  useEffect(() => {
    fetch(`/api/assets/${assetId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.asset) setAsset(data.asset);
      })
      .catch((err) => console.error('Error fetching asset:', err))
      .finally(() => setIsLoading(false));
  }, [assetId]);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading asset details...</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Asset Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">The requested asset record does not exist.</p>
        <Link href="/assets" className="mt-4 inline-block">
          <Button variant="primary" size="sm">Back to Assets</Button>
        </Link>
      </div>
    );
  }

  const timelineItems: TimelineItem[] =
    asset.history?.map((h) => ({
      id: h.id,
      title: `${h.event_type.replace('_', ' ').toUpperCase()}`,
      description: h.description,
      timestamp: h.created_at,
      user: h.performed_by_name,
      type: h.event_type,
    })) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset.asset_number}
        description={`${asset.brand} ${asset.model} • Serial: ${asset.serial_number}`}
        backHref="/assets"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Assets', href: '/assets' },
          { label: asset.asset_number },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={asset.status} size="md" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPrintOpen(true)}
              icon={
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              }
            >
              Print Sticker
            </Button>
            <Link href={`/tickets/new?assetId=${asset.id}`}>
              <Button
                variant="outline"
                size="sm"
                className="border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                Raise Ticket
              </Button>
            </Link>
            <Link href={`/assets/${asset.id}/edit`}>
              <Button variant="primary" size="sm">
                Edit Details
              </Button>
            </Link>
          </div>
        }
      />

      {/* Tabs navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'assignments', label: 'Custody & Assignment', count: asset.assignments?.length },
          { key: 'tickets', label: 'Support Tickets', count: asset.tickets?.length },
          { key: 'history', label: 'Audit History', count: asset.history?.length },
          { key: 'insurance', label: 'Insurance' },
          { key: 'network', label: 'Network' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Barcode sticker preview card */}
            <Card title="Permanent Barcode Identification" subtitle="Code 128 scan identity">
              <div className="flex flex-col items-center justify-center p-2">
                <BarcodePreview
                  assetNumber={asset.asset_number}
                  category={asset.category}
                  model={`${asset.brand} ${asset.model}`}
                  serialNumber={asset.serial_number}
                />
                <p className="text-[11px] text-slate-400 mt-3 text-center">
                  Scan this Code 128 barcode with any phone camera from the <strong>Scan</strong> tab to instantly retrieve authorized asset records.
                </p>
                <div className="mt-4 flex gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setIsPrintOpen(true)}
                  >
                    Print Sticker
                  </Button>
                </div>
              </div>
            </Card>

            {/* Center & Right: Specs & Custody */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Hardware Specifications */}
              <Card title="Hardware Specifications" subtitle="Device classification, model and system identities">
                <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Asset Number</dt>
                    <dd className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5">{asset.asset_number || '-'}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">System Asset ID</dt>
                    <dd className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm mt-0.5">{asset.asset_id || '-'}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Category</dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{asset.category}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Brand / Manufacturer</dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{asset.brand}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Model</dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{asset.model}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Hardware Serial Number</dt>
                    <dd className="font-mono font-bold text-slate-900 dark:text-white text-sm mt-0.5">{asset.serial_number}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Physical Location</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{asset.location || 'The Space'}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Registered On</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{formatDate(asset.created_at)}</dd>
                  </div>
                </dl>
              </Card>

              {/* Card 2: Procurement & Warranty */}
              <Card title="Procurement & Financials" subtitle="Acquisition cost, purchase date, and warranty coverage">
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Purchase Date</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{formatDate(asset.purchase_date)}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Purchase Cost</dt>
                    <dd className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{formatCurrency(asset.purchase_cost)}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Warranty Expiry</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                      {asset.warranty_expiry ? formatDate(asset.warranty_expiry) : <span className="text-slate-400">None / Not Specified</span>}
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* Card 3: Vendor Details */}
              <Card title="Vendor Details" subtitle="Supplier and procurement contact information">
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Vendor Name</dt>
                    <dd className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{asset.vendor || '-'}</dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Phone No</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                      {asset.vendor_phone ? (
                        <a href={`tel:${asset.vendor_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                          {asset.vendor_phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">Not Provided</span>
                      )}
                    </dd>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg">
                    <dt className="text-slate-400 dark:text-slate-400 uppercase font-semibold text-[10px]">Email ID</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                      {asset.vendor_email ? (
                        <a href={`mailto:${asset.vendor_email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                          {asset.vendor_email}
                        </a>
                      ) : (
                        <span className="text-slate-400">Not Provided</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </Card>

              {/* Current Custodian */}
              <Card title="Current Custodian Assignment">
                {asset.current_employee_id ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl gap-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-blue-900 block">
                        Current Employee
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                          {asset.current_employee_code}
                        </span>
                        <span className="text-slate-400 font-bold">–</span>
                        <span className="font-bold text-slate-900 text-base">{asset.current_employee_name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">Currently holding physical possession of this asset.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/employees/${asset.current_employee_id}#current-assets`}>
                        <Button variant="outline" size="sm" className="bg-white text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                          View Employee Assets
                        </Button>
                      </Link>
                      <Link href="/assignments">
                        <Button variant="secondary" size="sm" className="text-xs">
                          Transfer / Return
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between text-xs text-slate-600">
                    <span>Asset is currently unassigned in central inventory stock.</span>
                    <Link href="/assignments">
                      <Button variant="primary" size="sm" className="text-xs">
                        Assign to Employee
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Assignments */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <Card title="Current Custody Status">
            {asset.current_employee_id ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-base">{asset.current_employee_name}</span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                      {asset.current_employee_code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Physical hardware in possession.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/employees/${asset.current_employee_id}`}>
                    <Button variant="outline" size="sm" className="bg-white text-xs">
                      View Profile
                    </Button>
                  </Link>
                  <Link href="/assignments">
                    <Button variant="secondary" size="sm" className="text-xs">
                      Initiate Transfer / Return
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between text-xs text-slate-600">
                <span>In inventory stock. Ready for deployment.</span>
                <Link href="/assignments">
                  <Button variant="primary" size="sm" className="text-xs">
                    Assign Custody
                  </Button>
                </Link>
              </div>
            )}
          </Card>

          <Card title="Assignment History" subtitle="Full immutable chain of custody audit log">
            <DataTable
              columns={[
                {
                  key: 'employee_name',
                  header: 'Employee',
                  render: (row) => (
                    <div>
                      <span className="font-semibold text-slate-800 block text-xs">{row.employee_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{row.employee_code}</span>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
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
                  render: (row) => <span className="text-xs text-slate-600">{formatDate(row.returned_date)}</span>,
                },
              ]}
              data={asset.assignments || []}
              emptyTitle="No Custody Records"
              emptyDescription="This asset has never been assigned to any employee."
            />
          </Card>
        </div>
      )}

      {/* Tab: Tickets */}
      {activeTab === 'tickets' && (
        <Card
          title="Linked Support Tickets"
          subtitle="Tickets created against this hardware"
          headerAction={
            <Link href={`/tickets/new?assetId=${asset.id}${asset.current_employee_id ? `&employeeId=${asset.current_employee_id}` : ''}`}>
              <Button variant="primary" size="sm" className="text-xs">
                + Raise Support Ticket
              </Button>
            </Link>
          }
        >
          <DataTable
            columns={[
              {
                key: 'ticket_id',
                header: 'Ticket ID',
                render: (row) => (
                  <Link href={`/tickets/${row.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                    {row.ticket_id}
                  </Link>
                ),
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
            ]}
            data={asset.tickets || []}
            emptyTitle="No Support Tickets"
            emptyDescription="Zero hardware tickets have been raised for this equipment."
          />
        </Card>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <Card title="Asset Audit Log & Complete History" subtitle="Full immutable chronological event timeline">
          <Timeline items={timelineItems} emptyMessage="No audit logs available for this asset." />
        </Card>
      )}

      {/* Tab: Insurance */}
      {activeTab === 'insurance' && (
        <Card
          title="Insurance Policy"
          subtitle={`Policy details for ${asset.asset_number}`}
          headerAction={
            <Link href="/insurance" className="text-xs text-blue-600 hover:underline">
              Manage Insurance →
            </Link>
          }
        >
          {asset.insurance ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Insurance Provider</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{asset.insurance.provider}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Policy Number</span>
                  <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block">{asset.insurance.policy_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Coverage Amount</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{formatCurrency(asset.insurance.coverage_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Start Date</span>
                  <span className="font-medium text-slate-700 mt-0.5 block">{formatDate(asset.insurance.start_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Expiry Date</span>
                  <span className="font-medium text-slate-700 mt-0.5 block">{formatDate(asset.insurance.expiry_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status</span>
                  <div className="mt-1">
                    <StatusBadge status={asset.insurance.status} size="sm" />
                  </div>
                </div>
              </div>
              {asset.insurance.notes && (
                <div className="pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-semibold block mb-1">Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {asset.insurance.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              <p>No insurance policy mapped to this asset.</p>
              <Link href="/insurance" className="inline-block mt-2 text-blue-600 hover:underline font-medium">
                + Add Insurance Policy
              </Link>
            </div>
          )}
        </Card>
      )}

      {/* Tab: Network */}
      {activeTab === 'network' && (
        <Card
          title="Network Configuration"
          subtitle={`Network interface details for ${asset.asset_number}`}
          headerAction={
            <Link href="/network" className="text-xs text-blue-600 hover:underline">
              Manage Network →
            </Link>
          }
        >
          {asset.network ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">IP Address</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{asset.network.ip_address || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">IP Assignment</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {asset.network.assignment_type || 'Static'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">MAC Address</span>
                  <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block">{asset.network.mac_address || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Hostname</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">{asset.network.hostname || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Network Name</span>
                  <span className="font-medium text-slate-700 mt-0.5 block">{asset.network.network_name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">VLAN</span>
                  <span className="font-bold text-blue-600 font-mono mt-0.5 block">{asset.network.vlan || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Subnet Mask</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">{asset.network.subnet_mask || '255.255.255.0'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Default Gateway</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">{asset.network.gateway || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">DNS Server</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">{asset.network.dns_server || '-'}</span>
                </div>
              </div>
              {asset.network.notes && (
                <div className="pt-3 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-semibold block mb-1">Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">
                    {asset.network.notes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              <p>No network interface configured for this asset.</p>
              <Link href="/network" className="inline-block mt-2 text-blue-600 hover:underline font-medium">
                + Configure Network Interface
              </Link>
            </div>
          )}
        </Card>
      )}

      {/* Print modal */}
      {isPrintOpen && (
        <BarcodePrint
          isOpen={isPrintOpen}
          onClose={() => setIsPrintOpen(false)}
          asset={asset}
        />
      )}
    </div>
  );
}
