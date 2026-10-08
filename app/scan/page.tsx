'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { BarcodeScanner } from '@/components/barcode/BarcodeScanner';
import { BarcodePreview } from '@/components/barcode/BarcodePreview';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Spinner } from '@/components/ui/Spinner';
import { EmployeeAssetGroup } from '@/components/data-display/EmployeeAssetGroup';
import { AssetDetailed } from '@/types/asset';
import { formatDate } from '@/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  PlusCircle,
  FileText,
  Tag,
  Hash,
  Laptop,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { EmployeeAssetGroupData, ScannedAssetSummary } from '@/services/scan.service';

interface ScanPageResult {
  found: boolean;
  assetNumber: string;
  asset: (AssetDetailed & { open_tickets_count?: number }) | null;
  message?: string;
  authorizedActions?: {
    canRaiseTicket: boolean;
    canAssign: boolean;
    canTransfer: boolean;
    canReturn: boolean;
    canEdit: boolean;
  };
  data?: {
    scannedAsset: ScannedAssetSummary;
    employee: EmployeeAssetGroupData | null;
    assetCount: number;
    assignedAssets: ScannedAssetSummary[];
  };
}

export default function ScanPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'scanning' | 'finding_asset' | 'loading_group'>('scanning');
  const [showSampleBarcode, setShowSampleBarcode] = useState(false);
  const [scanResult, setScanResult] = useState<ScanPageResult | null>(null);

  const handleScan = async (scannedCode: string) => {
    const cleanCode = (scannedCode || '').trim();
    if (!cleanCode) return;

    setIsProcessing(true);
    setLoadingStep('finding_asset');
    setScanResult(null);

    try {
      // Step feedback: Finding asset...
      const res = await fetch('/api/assets/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: cleanCode,
          assetNumber: cleanCode,
        }),
      });

      setLoadingStep('loading_group');
      const json = await res.json();

      if (res.ok && json.success && (json.asset || json.data)) {
        const rawAsset = json.asset || json.data;
        const employeeData = json.data?.employee || null;
        const assignedAssets = json.data?.assignedAssets || [];
        const scannedSummary = json.data?.scannedAsset || {
          id: rawAsset.id,
          assetId: rawAsset.asset_id,
          assetNumber: rawAsset.asset_number,
          assetName: `${rawAsset.brand} ${rawAsset.model}`.trim(),
          category: rawAsset.category,
          brand: rawAsset.brand,
          model: rawAsset.model,
          serialNumber: rawAsset.serial_number,
          status: rawAsset.status,
          warrantyExpiry: rawAsset.warranty_expiry,
          openTicketsCount: rawAsset.open_tickets_count || 0,
          isScanned: true,
        };

        setScanResult({
          found: true,
          assetNumber: cleanCode,
          asset: rawAsset,
          message: 'Asset found.',
          authorizedActions: json.authorizedActions || json.data?.authorizedActions,
          data: {
            scannedAsset: scannedSummary,
            employee: employeeData,
            assetCount: json.data?.assetCount ?? (employeeData ? assignedAssets.length : 0),
            assignedAssets,
          },
        });
      } else {
        setScanResult({
          found: false,
          assetNumber: cleanCode,
          asset: null,
          message: json.message || 'Barcode detected, but no matching asset was found.',
        });
      }
    } catch (err: any) {
      setScanResult({
        found: false,
        assetNumber: cleanCode,
        asset: null,
        message: err?.message || 'Unable to retrieve asset information from MySQL backend.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetScan = () => {
    setScanResult(null);
    setIsProcessing(false);
  };

  // Quick test sample barcode
  const handleQuickTestSample = (code: string = 'TGS-LAP-00001') => {
    handleScan(code);
  };

  const hasCurrentEmployee = Boolean(scanResult?.data?.employee);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 px-2 sm:px-4">
      <PageHeader
        title="Asset Barcode Scanner"
        description="Scan any asset barcode to identify the current employee custodian and review their complete assigned asset group with active ticket creation."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Barcode Scanner' },
        ]}
      />

      {/* Main Scanner Section */}
      {!scanResult && !isProcessing && (
        <Card className="p-4 sm:p-6 shadow-sm border-slate-200">
          <BarcodeScanner
            autoStart={true}
            onScan={handleScan}
            showManualInput={true}
            scannerTitle="Multi-Device Code 128 Scanner"
            scannerSubtitle="Hold sticker 15–30 cm from camera or enter asset number below."
          />
        </Card>
      )}

      {/* Verifying & Fetching Loader */}
      {isProcessing && (
        <Card className="py-16 text-center border-slate-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col items-center justify-center gap-3">
            <Spinner size="lg" />
            <h4 className="text-base font-semibold text-slate-900">
              {loadingStep === 'finding_asset' ? 'Finding asset in database...' : 'Resolving employee asset group...'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Verifying Code 128 barcode, retrieving active custody, and loading currently assigned equipment.
            </p>
          </div>
        </Card>
      )}

      {/* CASE A: BARCODE DETECTED AND ASSET ASSIGNED TO AN EMPLOYEE */}
      {scanResult && scanResult.found && scanResult.asset && hasCurrentEmployee && scanResult.data?.employee && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Section 25: Desktop 2-Column / Mobile Stacked Scanner Result Card */}
          <Card className="border-indigo-200 shadow-sm overflow-hidden">
            {/* Header: Scanned Asset Banner */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Asset Found
                    </span>
                    <span className="text-xs text-indigo-200 font-mono font-bold">
                      {scanResult.data.scannedAsset.assetNumber}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    {scanResult.data.scannedAsset.assetName}
                  </h3>
                </div>
              </div>

              {/* Scanned Badge & Reset */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide rounded-md bg-indigo-500 text-white shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SCANNED ASSET
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetScan}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                >
                  Scan Another
                </Button>
              </div>
            </div>

            {/* Content: Responsive Desktop 2-Column / Mobile Stacked Layout */}
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
              {/* Left Column: Asset Details */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-indigo-600" /> Scanned Asset Details
                  </span>
                  <StatusBadge status={scanResult.asset.status} size="sm" />
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Category</span>
                    <span className="font-bold text-slate-800">{scanResult.asset.category}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Model & Brand</span>
                    <span className="font-semibold text-slate-900">
                      {scanResult.asset.brand} {scanResult.asset.model}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Asset Number</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {scanResult.asset.asset_number}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[10px]">Serial Number</span>
                    <span className="font-mono text-slate-700">{scanResult.asset.serial_number}</span>
                  </div>

                  {scanResult.asset.warranty_expiry && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold uppercase text-[10px]">Warranty</span>
                      <span className="text-emerald-700 font-medium">
                        Valid until {formatDate(scanResult.asset.warranty_expiry)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center gap-2 border-t border-slate-100">
                  <Link href={`/assets/${scanResult.asset.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      icon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      View Asset
                    </Button>
                  </Link>

                  <Link
                    href={`/tickets/new?assetId=${scanResult.asset.id}&employeeId=${scanResult.data.employee.id}`}
                    className="flex-1"
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs"
                      icon={<PlusCircle className="w-3.5 h-3.5" />}
                    >
                      Raise Ticket
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right Column: Employee Custodian & Group Summary */}
              <div className="bg-white dark:bg-[#0b1224] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Current Employee
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                      {scanResult.data.employee.employeeId}
                    </span>
                  </div>

                  <div className="pt-2">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {scanResult.data.employee.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {scanResult.data.employee.designation} • {scanResult.data.employee.department}
                    </p>
                  </div>

                  <div className="mt-4 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-900 dark:text-indigo-200 block">
                        Total Current Assigned Assets
                      </span>
                      <span className="text-xs text-indigo-700 dark:text-indigo-300">
                        Active hardware units in custodian&apos;s possession
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold font-mono text-indigo-900 dark:text-indigo-200">
                        {scanResult.data.assetCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {scanResult.data.employee.email}
                  </span>
                  <Link href={`/employees/${scanResult.data.employee.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Employee Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          {/* Complete Employee Asset Group Section */}
          <EmployeeAssetGroup
            employee={scanResult.data.employee}
            assignedAssets={scanResult.data.assignedAssets}
            scannedAssetId={scanResult.asset.id}
            scannedAssetNumber={scanResult.assetNumber}
            authorizedActions={scanResult.authorizedActions}
            hideEmployeeSummary={true}
          />
        </div>
      )}

      {/* CASE B: BARCODE DETECTED BUT ASSET IS UNASSIGNED (IN STOCK / RETIRED) */}
      {scanResult && scanResult.found && scanResult.asset && !hasCurrentEmployee && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Card
            title={
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="font-bold text-slate-900 dark:text-white tracking-wide text-base">
                  ASSET FOUND
                </span>
              </div>
            }
            headerAction={
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Asset found.
                </span>
                <StatusBadge status={scanResult.asset.status} size="md" />
              </div>
            }
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleResetScan}
                  icon={<RotateCcw className="w-4 h-4" />}
                >
                  Scan Again
                </Button>

                <div className="flex items-center gap-2">
                  <Link href={`/assets/${scanResult.asset.id}`}>
                    <Button variant="primary" size="md" icon={<ExternalLink className="w-4 h-4" />}>
                      View Asset
                    </Button>
                  </Link>
                </div>
              </div>
            }
          >
            <div className="space-y-5">
              {/* Asset Key Identities Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-900 text-white rounded-xl">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-cyan-400" /> Asset Number
                  </span>
                  <p className="font-mono font-bold text-cyan-300 text-sm mt-0.5">
                    {scanResult.asset.asset_number}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-indigo-400" /> Asset ID
                  </span>
                  <p className="font-mono font-bold text-slate-200 text-sm mt-0.5">
                    {scanResult.asset.asset_id}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-blue-400" /> Category
                  </span>
                  <p className="font-bold text-slate-200 text-sm mt-0.5">
                    {scanResult.asset.category}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-400" /> Status
                  </span>
                  <p className="font-bold text-sm mt-0.5 text-slate-200 uppercase">
                    {scanResult.asset.status.replace('_', ' ')}
                  </p>
                </div>
              </div>

              {/* Hardware Specifications Grid */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">
                    Asset (Brand & Model)
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {scanResult.asset.brand} {scanResult.asset.model}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">
                    Serial Number
                  </span>
                  <p className="font-mono text-slate-800 font-semibold mt-0.5 text-sm">
                    {scanResult.asset.serial_number}
                  </p>
                </div>
              </div>

              {/* Custody Information: Not Assigned (Section 21 & 22) */}
              <div className="p-4 border border-slate-200 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" /> Current Employee Custodian
                </span>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Not Assigned
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {scanResult.asset.status === 'in_stock'
                        ? 'Available in central inventory stock. Ready for employee assignment.'
                        : `Current asset lifecycle status is "${scanResult.asset.status}". No active employee assignment.`}
                    </p>
                  </div>
                  {scanResult.asset.status === 'in_stock' && (
                    <Link href="/assignments">
                      <Button variant="primary" size="sm" className="text-xs">
                        Assign to Employee
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Operations */}
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetScan}
                  icon={<RotateCcw className="w-4 h-4 text-slate-600" />}
                >
                  Scan Again
                </Button>

                <Link href={`/tickets/new?assetId=${scanResult.asset.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50"
                    icon={<PlusCircle className="w-4 h-4 text-rose-600" />}
                  >
                    Raise Ticket
                  </Button>
                </Link>

                <Link href={`/assets/${scanResult.asset.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<FileText className="w-4 h-4 text-slate-600" />}
                  >
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* CASE C: BARCODE DETECTED BUT NO ASSET FOUND IN MYSQL */}
      {scanResult && (!scanResult.found || !scanResult.asset) && (
        <Card className="py-12 text-center border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200 shadow-sm">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">
            Barcode detected, but no matching asset was found.
          </h4>
          <p className="text-sm text-slate-600 max-w-md mx-auto mt-1 mb-2 font-mono">
            Detected Barcode: <strong className="text-slate-900">&quot;{scanResult.assetNumber}&quot;</strong>
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            {scanResult.message || 'No asset found for this barcode in MySQL database.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={handleResetScan}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Scan Again
            </Button>
            <Link href="/assets/add">
              <Button
                variant="primary"
                size="md"
                icon={<PlusCircle className="w-4 h-4" />}
              >
                Register New Asset
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Interactive Testing Helper: Sample Barcodes */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowSampleBarcode(!showSampleBarcode)}
          className="w-full flex items-center justify-between p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-left cursor-pointer transition shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Testing Helper: Display Real System Barcodes &amp; Scenarios
              </span>
              <span className="text-[11px] text-slate-500 block">
                Test employee asset grouping with Alex Johnson (3 assets), Sarah Connor (2 assets), or unassigned.
              </span>
            </div>
          </div>
          {showSampleBarcode ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showSampleBarcode && (
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 animate-in fade-in duration-150">
            <p className="text-xs text-slate-600 leading-relaxed">
              Below is the authentic Code 128 barcode for existing MySQL asset <strong>TGS-LAP-00001</strong> (assigned to Alex Johnson). Scanning it or clicking simulate will load his complete 3-asset group (Laptop, Monitor, Desktop Stand).
            </p>

            <div className="flex flex-col items-center justify-center py-2">
              <BarcodePreview
                assetNumber="TGS-LAP-00001"
                category="Laptop"
                model="Dell Latitude 5440 Core i7"
                serialNumber="DL5440-SN8829"
                companyName="ENTERPRISE ASSET MANAGEMENT"
                className="max-w-md shadow-md"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleQuickTestSample('TGS-LAP-00001')}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              >
                Simulate TGS-LAP-00001 (Alex Johnson - 3 assets)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickTestSample('TGS-MON-00001')}
                icon={<CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              >
                Simulate TGS-MON-00001 (Monitor in same group)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickTestSample('TGS-DSK-00001')}
              >
                Simulate TGS-DSK-00001 (Unassigned in stock)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
