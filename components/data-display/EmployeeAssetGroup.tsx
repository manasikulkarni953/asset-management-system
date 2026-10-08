'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { formatDate } from '@/lib/utils';
import {
  Laptop,
  Monitor,
  Keyboard,
  Mouse,
  Headphones,
  Smartphone,
  Printer,
  Server,
  HardDrive,
  Cpu,
  Package,
  ExternalLink,
  PlusCircle,
  FileText,
  Repeat,
  CheckCircle2,
  User,
  Building,
  Briefcase,
  MapPin,
  Tag,
  Wrench,
  ShieldCheck,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { EmployeeAssetGroupData, ScannedAssetSummary } from '@/services/scan.service';

export interface EmployeeAssetGroupProps {
  employee: EmployeeAssetGroupData;
  assignedAssets: ScannedAssetSummary[];
  scannedAssetId?: number | string | null;
  scannedAssetNumber?: string | null;
  authorizedActions?: {
    canRaiseTicket?: boolean;
    canAssign?: boolean;
    canTransfer?: boolean;
    canReturn?: boolean;
    canEdit?: boolean;
  };
  className?: string;
  hideEmployeeSummary?: boolean;
}

/**
 * Returns a fitting Lucide icon component according to hardware category.
 */
function getCategoryIcon(category: string = '') {
  const cat = category.toLowerCase().trim();
  if (cat.includes('cpu')) return Cpu;
  if (cat.includes('laptop') || cat.includes('notebook')) return Laptop;
  if (cat.includes('monitor') || cat.includes('screen') || cat.includes('display')) return Monitor;
  if (cat.includes('keyboard')) return Keyboard;
  if (cat.includes('mouse')) return Mouse;
  if (cat.includes('headset') || cat.includes('audio') || cat.includes('headphone')) return Headphones;
  if (cat.includes('mobile') || cat.includes('phone') || cat.includes('tablet')) return Smartphone;
  if (cat.includes('printer') || cat.includes('scanner')) return Printer;
  if (cat.includes('server')) return Server;
  if (cat.includes('storage') || cat.includes('drive')) return HardDrive;
  if (cat.includes('desktop') || cat.includes('workstation') || cat.includes('pc')) return Cpu;
  return Package;
}

export function EmployeeAssetGroup({
  employee,
  assignedAssets = [],
  scannedAssetId,
  scannedAssetNumber,
  authorizedActions = {
    canRaiseTicket: true,
    canAssign: false,
    canTransfer: false,
    canReturn: false,
    canEdit: false,
  },
  className = '',
  hideEmployeeSummary = false,
}: EmployeeAssetGroupProps) {
  const totalAssets = assignedAssets.length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. EMPLOYEE SUMMARY SECTION */}
      {!hideEmployeeSummary && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-t-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-indigo-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-400/20 text-indigo-300 border border-indigo-400/30">
                      {employee.employeeId}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      {employee.name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-300">
                    {employee.designation && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                        {employee.designation}
                      </span>
                    )}
                    {employee.department && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-indigo-400" />
                        {employee.department}
                      </span>
                    )}
                    {employee.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        {employee.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Assigned Assets Count Badge */}
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs border border-white/15 px-4 py-2.5 rounded-xl shrink-0">
                <div className="text-right sm:text-left">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-200 block">
                    Total Assigned Assets
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
                      {totalAssets}
                    </span>
                    <span className="text-xs text-slate-300">
                      {totalAssets === 1 ? 'unit' : 'units'} active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600">
              Direct custody verifiable against active MySQL assignments (
              <strong className="font-medium text-slate-900">{employee.email}</strong>)
            </span>
            <Link
              href={`/employees/${employee.id}`}
              className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
            >
              Full Employee Profile <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      )}

      {/* 2. CURRENTLY ASSIGNED ASSETS (GROUP) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Currently Assigned Assets
              </h4>
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800">
                {totalAssets}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Only active assignments are shown. Closed, transferred, or returned assets are omitted.
            </p>
          </div>

          {authorizedActions.canTransfer && (
            <Link href="/assignments">
              <Button variant="outline" size="sm" className="text-xs" icon={<Repeat className="w-3.5 h-3.5" />}>
                Manage Custody
              </Button>
            </Link>
          )}
        </div>

        {/* Empty State */}
        {totalAssets === 0 ? (
          <Card className="p-8 text-center border-slate-200 bg-slate-50/50">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h5 className="text-sm font-bold text-slate-800">
              No assets are currently assigned to this employee.
            </h5>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {employee.name} ({employee.employeeId}) holds 0 active hardware assignments in the database.
            </p>
            {authorizedActions.canAssign && (
              <Link href="/assignments">
                <Button variant="primary" size="sm">
                  Assign First Asset
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          /* Cards Grid: Mobile 1-col, Desktop 1 or 2-col responsive */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {assignedAssets.map((asset) => {
              const CategoryIcon = getCategoryIcon(asset.category);
              const isCurrentScanned =
                asset.isScanned ||
                (scannedAssetId !== undefined && String(asset.id) === String(scannedAssetId)) ||
                (scannedAssetNumber && asset.assetNumber.toLowerCase() === scannedAssetNumber.toLowerCase());

              return (
                <div
                  key={asset.id}
                  id={`asset-card-${asset.assetNumber}`}
                  className={`relative rounded-xl border transition-all duration-150 p-4 bg-white shadow-xs flex flex-col justify-between ${
                    isCurrentScanned
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/30'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Top Bar: Icon, Category & SCANNED Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrentScanned
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <CategoryIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block leading-tight">
                            {asset.category}
                          </span>
                          <span className="font-bold text-slate-900 text-sm leading-snug">
                            {asset.assetName || `${asset.brand} ${asset.model}`.trim()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isCurrentScanned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide rounded-md bg-indigo-600 text-white shadow-xs animate-in fade-in">
                            <CheckCircle2 className="w-3 h-3" />
                            SCANNED
                          </span>
                        )}
                        <StatusBadge status={asset.status} size="sm" />
                      </div>
                    </div>

                    {/* Hardware Details Table-like Rows */}
                    <div className="space-y-1.5 pt-2 text-xs border-t border-slate-100 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold uppercase text-[10px] flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Asset Number
                        </span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {asset.assetNumber}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-semibold uppercase text-[10px]">
                          Serial Number
                        </span>
                        <span className="font-mono font-medium text-slate-700">
                          {asset.serialNumber || 'N/A'}
                        </span>
                      </div>

                      {asset.assignedDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-semibold uppercase text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Assigned Since
                          </span>
                          <span className="text-slate-600 font-medium">
                            {formatDate(asset.assignedDate)}
                          </span>
                        </div>
                      )}

                      {asset.warrantyExpiry && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-semibold uppercase text-[10px] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Warranty
                          </span>
                          <span className="text-slate-600 text-[11px]">
                            {formatDate(asset.warrantyExpiry)}
                          </span>
                        </div>
                      )}

                      {asset.openTicketsCount > 0 && (
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-amber-700 font-semibold uppercase text-[10px] flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Active Tickets
                          </span>
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            {asset.openTicketsCount} Open
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions Bar */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/assets/${asset.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2.5 border-slate-200 text-slate-700 hover:bg-slate-100"
                          icon={<ExternalLink className="w-3 h-3 text-slate-500" />}
                        >
                          View Asset
                        </Button>
                      </Link>

                      <Link
                        href={`/damaged-assets`}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                          icon={<Wrench className="w-3 h-3 text-amber-600" />}
                          title="Move to Repair"
                        >
                          Repair
                        </Button>
                      </Link>

                      <Link
                        href={`/tickets/new?assetId=${asset.id}&employeeId=${employee.id}`}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] px-2.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                          icon={<PlusCircle className="w-3 h-3 text-rose-600" />}
                        >
                          Raise Ticket
                        </Button>
                      </Link>

                      <Link href={`/assets/${asset.id}?tab=history`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] px-2 text-slate-500 hover:text-slate-800"
                          icon={<FileText className="w-3 h-3" />}
                        >
                          History
                        </Button>
                      </Link>
                    </div>

                    {(authorizedActions.canTransfer || authorizedActions.canReturn) && (
                      <Link href={`/assignments?assetId=${asset.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] px-2 text-indigo-700 hover:bg-indigo-50"
                          icon={<Repeat className="w-3 h-3 text-indigo-600" />}
                        >
                          Transfer / Return
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
