'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { FilterBar } from '@/components/data-display/FilterBar';
import { Pagination } from '@/components/data-display/Pagination';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { AssetNetwork } from '@/types/asset';

export default function NetworkPage() {
  const [networkList, setNetworkList] = useState<AssetNetwork[]>([]);
  const [total, setTotal] = useState(0);
  const [vlans, setVlans] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [vlan, setVlan] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    asset_id: '',
    ip_address: '',
    mac_address: '',
    hostname: '',
    network_name: 'Corp-HQ-LAN',
    vlan: 'VLAN-10',
  });

  const fetchNetwork = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (vlan !== 'all') params.set('vlan', vlan);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/network?${params.toString()}`);
      const data = await res.json();
      if (data.networkList) {
        setNetworkList(data.networkList);
        setTotal(data.total);
        if (data.vlans) setVlans(data.vlans);
      }
    } catch (err) {
      console.error('Error fetching network items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, vlan, page]);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

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

  const handleSaveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          asset_id: Number(formData.asset_id),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update network settings');

      setIsModalOpen(false);
      setFormData({
        asset_id: '',
        ip_address: '',
        mac_address: '',
        hostname: '',
        network_name: 'Corp-HQ-LAN',
        vlan: 'VLAN-10',
      });
      fetchNetwork();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<AssetNetwork>[] = [
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
      key: 'ip_address',
      header: 'Assigned IP Address',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {row.ip_address || '-'}
        </span>
      ),
    },
    {
      key: 'mac_address',
      header: 'Physical MAC Address',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 uppercase">
          {row.mac_address || '-'}
        </span>
      ),
    },
    {
      key: 'hostname',
      header: 'Hostname / FQDN',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">{row.hostname || '-'}</span>
      ),
    },
    {
      key: 'vlan',
      header: 'VLAN',
      render: (row) => (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          {row.vlan || '-'}
        </span>
      ),
    },
    {
      key: 'network_name',
      header: 'Network / Subnet',
      render: (row) => <span className="text-xs text-slate-600">{row.network_name || '-'}</span>,
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
        title="Network & Host Identity"
        description="IP assignments, MAC addresses, hostnames, and VLAN routing mapped to physical hardware."
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
            Configure Network
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search IP, MAC, hostname, or asset#..."
        filters={[
          {
            key: 'vlan',
            value: vlan,
            onChange: (v) => {
              setVlan(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All VLANs' },
              ...vlans.map((v) => ({ value: v, label: v })),
            ],
          },
        ]}
        onReset={() => {
          setSearch('');
          setVlan('all');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={networkList}
        isLoading={isLoading}
        keyExtractor={(row) => row.id}
        emptyTitle="No Network Interfaces Configured"
        emptyDescription="Map network adapters to assets to monitor connectivity."
        emptyAction={
          <Button variant="primary" size="sm" onClick={openAddModal}>
            Configure First Network Adapter
          </Button>
        }
      />

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* Network Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Map Network Configuration"
        description="Bind static or DHCP network parameters to an asset."
        size="md"
      >
        <form onSubmit={handleSaveNetwork} className="space-y-4">
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
              label="IP Address (IPv4 or IPv6)"
              placeholder="e.g. 192.168.1.105"
              value={formData.ip_address}
              onChange={(e) => setFormData((prev) => ({ ...prev, ip_address: e.target.value }))}
            />

            <Input
              label="Hardware MAC Address"
              placeholder="e.g. 00:1A:2B:3C:4D:5E"
              value={formData.mac_address}
              onChange={(e) => setFormData((prev) => ({ ...prev, mac_address: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Host Name / Computer Name"
              placeholder="e.g. LON-DEV-044.enterprise.internal"
              value={formData.hostname}
              onChange={(e) => setFormData((prev) => ({ ...prev, hostname: e.target.value }))}
            />

            <Input
              label="VLAN Segment"
              placeholder="e.g. VLAN-10 or Voice-VLAN"
              value={formData.vlan}
              onChange={(e) => setFormData((prev) => ({ ...prev, vlan: e.target.value }))}
            />
          </div>

          <Input
            label="Network / Subnet Name"
            placeholder="e.g. Corp-HQ-Wireless"
            value={formData.network_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, network_name: e.target.value }))}
          />

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Network Details
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
