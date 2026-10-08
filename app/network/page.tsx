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
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { AssetNetwork } from '@/types/asset';

export default function NetworkPage() {
  const [networkList, setNetworkList] = useState<AssetNetwork[]>([]);
  const [total, setTotal] = useState(0);
  const [vlans, setVlans] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalConfigured: 0,
    staticIp: 0,
    dhcp: 0,
    totalVlans: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [assignmentType, setAssignmentType] = useState('all');
  const [vlan, setVlan] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<AssetNetwork | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    asset_id: '',
    assignment_type: 'Static',
    ip_address: '',
    subnet_mask: '255.255.255.0',
    default_gateway: '',
    dns_server: '1.1.1.1, 8.8.8.8',
    mac_address: '',
    hostname: '',
    network_name: 'Corp-HQ-LAN',
    vlan: 'VLAN-10',
    notes: '',
  });

  const fetchNetwork = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (assignmentType !== 'all') params.set('assignment_type', assignmentType);
      if (vlan !== 'all') params.set('vlan', vlan);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/network?${params.toString()}`);
      const data = await res.json();
      if (data.networkList) {
        setNetworkList(data.networkList);
        setTotal(data.total);
        if (data.vlans) setVlans(data.vlans);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching network items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, assignmentType, vlan, page]);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

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
    setSelectedNetwork(null);
    setFormData({
      asset_id: '',
      assignment_type: 'Static',
      ip_address: '',
      subnet_mask: '255.255.255.0',
      default_gateway: '192.168.10.1',
      dns_server: '1.1.1.1, 8.8.8.8',
      mac_address: '',
      hostname: '',
      network_name: 'Corp-HQ-LAN',
      vlan: 'VLAN-10',
      notes: '',
    });
    await loadAssets();
    setIsModalOpen(true);
  };

  const openEditModal = async (record: AssetNetwork) => {
    setModalError(null);
    setSelectedNetwork(record);
    setFormData({
      asset_id: String(record.asset_id),
      assignment_type: record.assignment_type || 'Static',
      ip_address: record.ip_address || '',
      subnet_mask: record.subnet_mask || '255.255.255.0',
      default_gateway: record.gateway || '',
      dns_server: record.dns_server || '1.1.1.1, 8.8.8.8',
      mac_address: record.mac_address || '',
      hostname: record.hostname || '',
      network_name: record.network_name || 'Corp-HQ-LAN',
      vlan: record.vlan || 'VLAN-10',
      notes: record.notes || '',
    });
    await loadAssets();
    setIsModalOpen(true);
  };

  const openDetailsModal = (record: AssetNetwork) => {
    setSelectedNetwork(record);
    setIsDetailsModalOpen(true);
  };

  const handleSaveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      if (!formData.asset_id) {
        throw new Error('Please select an asset.');
      }
      if (!formData.ip_address.trim()) {
        throw new Error('IP address is required.');
      }
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.ip_address.trim())) {
        throw new Error('Invalid IPv4 address format (e.g. 192.168.10.50).');
      }
      if (!formData.mac_address.trim()) {
        throw new Error('MAC address is required.');
      }
      if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(formData.mac_address.trim())) {
        throw new Error('Invalid MAC address format (e.g. A4:83:E7:22:9C:5F).');
      }
      if (!formData.hostname.trim()) {
        throw new Error('Hostname is required.');
      }

      const res = await fetch('/api/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          asset_id: Number(formData.asset_id),
          ip_address: formData.ip_address.trim(),
          mac_address: formData.mac_address.trim().toUpperCase(),
          hostname: formData.hostname.trim(),
          subnet_mask: formData.subnet_mask.trim() || '255.255.255.0',
          default_gateway: formData.default_gateway.trim() || null,
          dns_server: formData.dns_server.trim() || null,
          network_name: formData.network_name.trim() || null,
          vlan: formData.vlan.trim() || null,
          notes: formData.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update network settings');

      setIsModalOpen(false);
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
          {row.asset_name || `${row.brand || ''} ${row.model || row.asset_model || ''}`.trim() || 'Hardware Device'}
        </span>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white block">
          {row.ip_address || '-'}
        </span>
      ),
    },
    {
      key: 'assignment_type',
      header: 'IP Assignment',
      render: (row) => {
        const isStatic = (row.assignment_type || 'Static').toLowerCase() === 'static';
        return (
          <Badge variant={isStatic ? 'purple' : 'info'} size="sm">
            {isStatic ? 'Static' : 'DHCP'}
          </Badge>
        );
      },
    },
    {
      key: 'mac_address',
      header: 'MAC Address',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300 block">
          {row.mac_address || '-'}
        </span>
      ),
    },
    {
      key: 'hostname',
      header: 'Hostname',
      render: (row) => (
        <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-medium block">
          {row.hostname || '-'}
        </span>
      ),
    },
    {
      key: 'vlan',
      header: 'VLAN',
      render: (row) => (
        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60 inline-block font-mono">
          {row.vlan || '-'}
        </span>
      ),
    },
    {
      key: 'network_name',
      header: 'Network / Subnet',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 block text-xs">
            {row.network_name || 'Default Subnet'}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block">
            {row.subnet_mask || '255.255.255.0'}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
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
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Network Configuration Management"
        description="Static IP mappings, DHCP allocation, MAC interfaces, and VLAN subnet topography."
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

      {/* Summary Cards: Fed directly from database (NO fake Online/Offline monitoring) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Configured Assets"
          value={stats.totalConfigured}
          color="blue"
          icon={
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          }
        />
        <StatsCard
          title="Static IP"
          value={stats.staticIp}
          description="Fixed network assignments"
          color="purple"
          icon={
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatsCard
          title="DHCP"
          value={stats.dhcp}
          description="Dynamic lease allocation"
          color="emerald"
          icon={
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
        <StatsCard
          title="Total VLANs"
          value={stats.totalVlans}
          description="Isolated network segments"
          color="amber"
          icon={
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Filter Bar: Search by Asset#, Name, IP, MAC, Hostname, VLAN, Network & Filter by IP Assignment and VLAN */}
      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by Asset #, Name, IP, MAC, Hostname, VLAN, Network..."
        filters={[
          {
            key: 'assignment_type',
            value: assignmentType,
            onChange: (v) => {
              setAssignmentType(v);
              setPage(1);
            },
            options: [
              { value: 'all', label: 'All Assignments' },
              { value: 'Static', label: 'Static IP' },
              { value: 'DHCP', label: 'DHCP' },
            ],
          },
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
          setAssignmentType('all');
          setVlan('all');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={networkList}
        isLoading={isLoading}
        emptyTitle="No Network Records Found"
        emptyDescription={
          search || assignmentType !== 'all' || vlan !== 'all'
            ? 'No network records matched your search filters.'
            : 'Zero network interfaces documented in the database.'
        }
        emptyAction={
          <Button variant="primary" size="sm" onClick={openAddModal}>
            Configure First Device
          </Button>
        }
      />

      <Pagination
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
      />

      {/* Configure Network Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedNetwork ? 'Edit Network Configuration' : 'Configure Asset Network'}
        description="Assign network identifiers, static IP addresses, MAC addresses, and routing."
        size="lg"
      >
        <form onSubmit={handleSaveNetwork} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Asset"
              required
              disabled={!!selectedNetwork}
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

            <Select
              label="IP Assignment"
              required
              options={[
                { value: 'Static', label: 'Static (Fixed IP)' },
                { value: 'DHCP', label: 'DHCP (Dynamic)' },
              ]}
              value={formData.assignment_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, assignment_type: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="IP Address"
              required
              placeholder="e.g. 192.168.10.72"
              value={formData.ip_address}
              onChange={(e) => setFormData((prev) => ({ ...prev, ip_address: e.target.value }))}
              helperText="Must be a valid IPv4 address (e.g. 192.168.10.72)"
            />

            <Input
              label="MAC Address"
              required
              placeholder="e.g. A4:83:E7:22:9C:5F"
              value={formData.mac_address}
              onChange={(e) => setFormData((prev) => ({ ...prev, mac_address: e.target.value.toUpperCase() }))}
              helperText="Hardware MAC format: XX:XX:XX:XX:XX:XX"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Subnet Mask"
              placeholder="255.255.255.0"
              value={formData.subnet_mask}
              onChange={(e) => setFormData((prev) => ({ ...prev, subnet_mask: e.target.value }))}
            />

            <Input
              label="Default Gateway"
              placeholder="e.g. 192.168.10.1"
              value={formData.default_gateway}
              onChange={(e) => setFormData((prev) => ({ ...prev, default_gateway: e.target.value }))}
            />

            <Input
              label="DNS Server"
              placeholder="e.g. 1.1.1.1, 8.8.8.8"
              value={formData.dns_server}
              onChange={(e) => setFormData((prev) => ({ ...prev, dns_server: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Hostname"
              required
              placeholder="e.g. LON-OPS-003"
              value={formData.hostname}
              onChange={(e) => setFormData((prev) => ({ ...prev, hostname: e.target.value }))}
            />

            <Input
              label="Network Name"
              placeholder="e.g. HQ-DevOps-LAN"
              value={formData.network_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, network_name: e.target.value }))}
            />

            <Input
              label="VLAN"
              placeholder="e.g. VLAN-20"
              value={formData.vlan}
              onChange={(e) => setFormData((prev) => ({ ...prev, vlan: e.target.value }))}
            />
          </div>

          <Textarea
            label="Notes"
            rows={2}
            placeholder="Switch port, patch panel socket, static reservation remarks..."
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
          />

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              {selectedNetwork ? 'Update Configuration' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Network Details Modal */}
      {selectedNetwork && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Network Details • ${selectedNetwork.hostname || selectedNetwork.asset_number}`}
          description={`Configuration profile for ${selectedNetwork.asset_number || 'Device'}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* DEVICE INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200">
                Device Information
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Asset Number</span>
                  <Link
                    href={`/assets/${selectedNetwork.asset_id}`}
                    className="font-mono font-bold text-blue-600 hover:underline mt-0.5 block"
                  >
                    {selectedNetwork.asset_number}
                  </Link>
                </div>
                <div>
                  <span className="text-slate-500 block">Asset Name</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {selectedNetwork.asset_name || `${selectedNetwork.brand || ''} ${selectedNetwork.model || selectedNetwork.asset_model || ''}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Brand / Model</span>
                  <span className="text-slate-700 mt-0.5 block">
                    {selectedNetwork.brand || '-'} {selectedNetwork.model || selectedNetwork.asset_model || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Serial Number</span>
                  <span className="font-mono text-slate-800 mt-0.5 block">
                    {selectedNetwork.serial_number || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* NETWORK INFORMATION */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200">
                Network Configuration
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">IP Address</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                    {selectedNetwork.ip_address || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">IP Assignment</span>
                  <div className="mt-1">
                    <Badge variant={(selectedNetwork.assignment_type || 'Static').toLowerCase() === 'static' ? 'purple' : 'info'} size="sm">
                      {selectedNetwork.assignment_type || 'Static'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block">MAC Address</span>
                  <span className="font-mono font-semibold text-slate-800 mt-0.5 block">
                    {selectedNetwork.mac_address || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Hostname</span>
                  <span className="font-mono font-medium text-slate-800 mt-0.5 block">
                    {selectedNetwork.hostname || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Network Name</span>
                  <span className="font-medium text-slate-800 mt-0.5 block">
                    {selectedNetwork.network_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">VLAN</span>
                  <span className="font-mono font-bold text-blue-700 mt-0.5 block">
                    {selectedNetwork.vlan || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Subnet Mask</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">
                    {selectedNetwork.subnet_mask || '255.255.255.0'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Default Gateway</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">
                    {selectedNetwork.gateway || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">DNS Server</span>
                  <span className="font-mono text-slate-700 mt-0.5 block">
                    {selectedNetwork.dns_server || '-'}
                  </span>
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
                    {selectedNetwork.employee_id || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Custodian Name</span>
                  <span className="font-semibold text-slate-900 mt-0.5 block">
                    {selectedNetwork.employee_name || 'In Storage'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department</span>
                  <span className="text-slate-700 mt-0.5 block">{selectedNetwork.department || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Workstation</span>
                  <span className="font-mono font-semibold text-indigo-700 mt-0.5 block">
                    {selectedNetwork.workstation || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* NOTES */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Notes & Remarks</h4>
              <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[60px]">
                {selectedNetwork.notes || 'No network notes recorded.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openEditModal(selectedNetwork);
                }}
              >
                Edit Configuration
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
        </Modal>
      )}
    </div>
  );
}
