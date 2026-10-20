'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { AssetImport } from '@/types/asset';
import { formatDate } from '@/lib/utils';
import {
  Upload,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Eye,
  FileSpreadsheet,
  RefreshCw,
  FolderOpen,
  Trash2,
  Maximize2,
  Plus,
  X,
  Layers,
} from 'lucide-react';
import { ImportedFileFullScreenViewer } from './ImportedFileFullScreenViewer';
import * as XLSX from 'xlsx';

export interface UploadFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  content: string;
  rows: any[];
  error?: string | null;
}

interface AssetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importId?: number) => void;
  initialTab?: 'import' | 'history';
  onFilterByImport?: (importId: number, filename: string) => void;
  currentImportFilterId?: number | null;
  onClearImportFilter?: () => void;
}

export function AssetImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  initialTab = 'import',
  onFilterByImport,
  currentImportFilterId,
  onClearImportFilter,
}: AssetImportModalProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'history'>(initialTab);

  // Multi-file queue state (supports 1 or many files)
  const [fileQueue, setFileQueue] = useState<UploadFileItem[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
  } | null>(null);

  const [batchResult, setBatchResult] = useState<{
    files: Array<{
      fileName: string;
      importId: number;
      successCount: number;
      failedCount: number;
      totalRecords: number;
      fileContent: string;
      fileSize: number;
      errors: Array<{ row: number; serial?: string; error: string }>;
    }>;
    totalSuccess: number;
    totalFailed: number;
    totalRecords: number;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<AssetImport[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<AssetImport | null>(null);

  // Full screen file viewer state
  const [viewingFileImport, setViewingFileImport] = useState<AssetImport | null>(null);

  // Delete state
  const [deletingImportItem, setDeletingImportItem] = useState<AssetImport | null>(null);
  const [deleteWithAssets, setDeleteWithAssets] = useState(true);
  const [isDeletingImport, setIsDeletingImport] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchHistory();
    } else {
      resetImportForm();
    }
  }, [isOpen, initialTab]);

  const resetImportForm = () => {
    setFileQueue([]);
    setActivePreviewIndex(0);
    setIsDragging(false);
    setIsSubmitting(false);
    setBatchProgress(null);
    setBatchResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/assets/imports');
      const data = await res.json();
      if (data.imports) {
        setHistory(data.imports);
      }
    } catch (err) {
      console.error('Failed to fetch import history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteImport = async (importId: number) => {
    setIsDeletingImport(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/assets/imports/${importId}?deleteAssets=${deleteWithAssets}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete imported file');
      }
      if (currentImportFilterId === importId) {
        onClearImportFilter?.();
      }
      onImportSuccess();
      setDeletingImportItem(null);
      await fetchHistory();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete imported file');
    } finally {
      setIsDeletingImport(false);
    }
  };

  // Robust CSV Parser handling quotes, commas, escaped quotes
  const parseCSV = (text: string): any[] => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"' || char === "'") {
        if (inQuotes && nextChar === char) {
          currentLine += char;
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
        if (char === '\r' && nextChar === '\n') {
          i++; // skip CRLF
        }
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine);
    }

    if (lines.length < 2) {
      throw new Error('CSV file must contain a header row and at least one data row.');
    }

    const splitRow = (rowStr: string): string[] => {
      const cells: string[] = [];
      let cell = '';
      let quote = false;

      for (let i = 0; i < rowStr.length; i++) {
        const c = rowStr[i];
        if (c === '"') {
          if (quote && rowStr[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            quote = !quote;
          }
        } else if (c === ',' && !quote) {
          cells.push(cell.trim());
          cell = '';
        } else {
          cell += c;
        }
      }
      cells.push(cell.trim());
      return cells;
    };

    const headers = splitRow(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = splitRow(line).map((v) => v.replace(/^["']|["']$/g, '').trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] !== undefined ? values[index] : '';
      });
      results.push(obj);
    }

    return results;
  };

  const handleFilesAdded = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    const newItems: UploadFileItem[] = [];

    for (const f of filesArray) {
      try {
        const lowerName = f.name.toLowerCase();
        const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

        let parsed: any[] = [];
        let fileTextContent = '';

        if (isExcel) {
          const arrayBuffer = await f.arrayBuffer();
          const wb = XLSX.read(arrayBuffer, { type: 'array' });
          if (!wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error('Excel workbook has no sheets.');
          }
          const firstSheetName = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheetName];
          parsed = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
          if (parsed.length === 0) {
            throw new Error('No valid asset rows found in this Excel sheet.');
          }
          fileTextContent = XLSX.utils.sheet_to_csv(ws);
        } else {
          fileTextContent = await f.text();
          parsed = parseCSV(fileTextContent);
          if (parsed.length === 0) {
            throw new Error('No valid asset rows found in this file.');
          }
        }

        newItems.push({
          id: `${f.name}_${f.size}_${Date.now()}_${Math.random()}`,
          file: f,
          name: f.name,
          size: f.size,
          content: fileTextContent,
          rows: parsed,
        });
      } catch (err: any) {
        newItems.push({
          id: `${f.name}_${f.size}_${Date.now()}_${Math.random()}`,
          file: f,
          name: f.name,
          size: f.size,
          content: '',
          rows: [],
          error: err?.message || 'Failed to parse file',
        });
      }
    }

    setFileQueue((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (id: string) => {
    setFileQueue((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (activePreviewIndex >= next.length) {
        setActivePreviewIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const sampleHeaders = [
    'Category',
    'Brand',
    'Model',
    'Serial Number',
    'Purchase Date',
    'Purchase Cost',
    'Vendor',
    'Vendor Phone',
    'Vendor Email',
    'Location',
    'Warranty Expiry',
    'Status',
  ];

  const sampleRows = [
    [
      'Laptop',
      'Dell',
      'Latitude 5440',
      'SN-DELL-9921',
      '2026-03-15',
      '1250.00',
      'Dell Direct',
      '800-555-0199',
      'support@dell.com',
      'The Space',
      '2027-03-15',
      'in_stock',
    ],
    [
      'Monitor',
      'HP',
      'E24 G4 FHD',
      'SN-HP-4412',
      '2026-04-10',
      '220.00',
      'HP Store',
      '800-555-0144',
      'sales@hp.com',
      'Floor 2',
      '2028-04-10',
      'in_stock',
    ],
    [
      'CPU',
      'Lenovo',
      'ThinkCentre M70q',
      'SN-LNV-1109',
      '2026-02-20',
      '780.00',
      'Insight Direct',
      '800-555-0122',
      'orders@insight.com',
      'The Space',
      '2027-02-20',
      'in_stock',
    ],
    [
      'Headset',
      'Jabra',
      'Evolve2 65',
      'SN-JBR-8823',
      '2026-05-01',
      '180.00',
      'Amazon Business',
      '',
      '',
      'Storage',
      '2027-05-01',
      'in_stock',
    ],
  ];

  const handleDownloadTemplate = () => {
    const csvContent = [sampleHeaders.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'asset_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcelTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([sampleHeaders, ...sampleRows]);
    ws['!cols'] = sampleHeaders.map((h) => ({ wch: Math.max(h.length + 4, 15) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Template');
    XLSX.writeFile(wb, 'asset_import_template.xlsx');
  };

  const handleSubmitImport = async () => {
    const validFiles = fileQueue.filter((f) => !f.error && f.rows.length > 0);
    if (validFiles.length === 0) return;

    setIsSubmitting(true);
    setBatchProgress({ current: 0, total: validFiles.length, currentFileName: validFiles[0].name });

    const results: Array<{
      fileName: string;
      importId: number;
      successCount: number;
      failedCount: number;
      totalRecords: number;
      fileContent: string;
      fileSize: number;
      errors: Array<{ row: number; serial?: string; error: string }>;
    }> = [];

    let totalSuccess = 0;
    let totalFailed = 0;
    let totalRecords = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const item = validFiles[i];
      setBatchProgress({ current: i + 1, total: validFiles.length, currentFileName: item.name });

      try {
        const res = await fetch('/api/assets/imports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: item.name,
            originalName: item.name,
            fileSize: item.size,
            fileContent: item.content,
            rows: item.rows,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to import ${item.name}`);
        }

        results.push({
          fileName: item.name,
          importId: data.importId,
          successCount: data.successCount,
          failedCount: data.failedCount,
          totalRecords: data.totalRecords,
          fileContent: item.content,
          fileSize: item.size,
          errors: data.errors || [],
        });

        totalSuccess += data.successCount;
        totalFailed += data.failedCount;
        totalRecords += data.totalRecords;
      } catch (err: any) {
        results.push({
          fileName: item.name,
          importId: 0,
          successCount: 0,
          failedCount: item.rows.length,
          totalRecords: item.rows.length,
          fileContent: item.content,
          fileSize: item.size,
          errors: [{ row: 0, error: err?.message || 'Failed to process file' }],
        });
        totalFailed += item.rows.length;
        totalRecords += item.rows.length;
      }
    }

    setBatchResult({
      files: results,
      totalSuccess,
      totalFailed,
      totalRecords,
    });

    fetchHistory();
    if (results.length > 0 && results[0].importId) {
      onImportSuccess(results[0].importId);
    } else {
      onImportSuccess();
    }
    setIsSubmitting(false);
  };

  const handleDownloadOriginalFile = async (importItem: AssetImport) => {
    window.open(`/api/assets/imports/${importItem.id}?download=true`, '_blank');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Asset Files"
      description="Upload CSV or spreadsheet files to register multiple assets into inventory at once."
      size="xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload & Import</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchHistory();
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Imported Files History</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                {history.length}
              </span>
            )}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcelTemplate}
              icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            >
              Sample Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              icon={<Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
            >
              Sample CSV
            </Button>
          </div>
        </div>

        {/* TAB 1: UPLOAD & IMPORT (Supports 1 or Multiple Files) */}
        {activeTab === 'import' && (() => {
          const totalValidRecords = fileQueue.reduce((acc, f) => acc + (f.error ? 0 : f.rows.length), 0);
          const totalValidFiles = fileQueue.filter((f) => !f.error && f.rows.length > 0).length;
          const totalSize = fileQueue.reduce((acc, f) => acc + f.size, 0);
          const currentPreviewFile = fileQueue[activePreviewIndex] || fileQueue[0];

          return (
            <div className="space-y-4">
              {!batchResult ? (
                <>
                  {/* Drag and Drop Upload Area (Accepts 1 or Many Files) */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) {
                        handleFilesAdded(e.dataTransfer.files);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 scale-[1.01]'
                        : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20'
                    } group`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".xlsx, .xls, .csv, .txt, .tsv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                      onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                      className="hidden"
                    />
                    <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                      {fileQueue.length > 0
                        ? 'Click to add more files or drag & drop here'
                        : 'Click to select Excel (.xlsx, .xls) or CSV file(s) or drag & drop here'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      You can select <strong>one or multiple files</strong>. Supports Excel spreadsheets (.xlsx, .xls) and standard CSV files.
                    </p>
                  </div>

                  {/* Queue Summary & File List */}
                  {fileQueue.length > 0 && (
                    <div className="space-y-3">
                      {/* Summary bar */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-2 flex-wrap font-medium">
                          <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                            <Layers className="w-4 h-4 text-blue-500" />
                            {fileQueue.length} {fileQueue.length === 1 ? 'File' : 'Files'} Selected
                          </span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {totalValidRecords} total asset records ready
                          </span>
                          <span>•</span>
                          <span className="text-slate-500">{formatBytes(totalSize)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add More</span>
                          </button>
                          <button
                            type="button"
                            onClick={resetImportForm}
                            className="px-2.5 py-1 text-xs font-semibold rounded text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer transition-colors"
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      {/* Queued Files Pills / Cards */}
                      <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                        {fileQueue.map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={() => !item.error && setActivePreviewIndex(idx)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                              item.error
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                                : activePreviewIndex === idx
                                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 dark:border-blue-500 text-blue-900 dark:text-blue-200 shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                            }`}
                          >
                            <FileSpreadsheet className={`w-3.5 h-3.5 ${item.error ? 'text-rose-500' : 'text-blue-500'}`} />
                            <span className="font-semibold truncate max-w-[160px]" title={item.name}>
                              {item.name}
                            </span>
                            {item.error ? (
                              <span className="text-[10px] text-rose-600 font-bold">Error</span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                {item.rows.length} rows
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">{formatBytes(item.size)}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFile(item.id);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                              title="Remove file from queue"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Preview Table of Active File */}
                      {currentPreviewFile && currentPreviewFile.rows.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Preview: First {Math.min(5, currentPreviewFile.rows.length)} of {currentPreviewFile.rows.length} assets from{' '}
                              <strong className="text-blue-600 dark:text-blue-400">{currentPreviewFile.name}</strong>
                            </span>
                            <span className="text-slate-500">Auto-assigned barcodes & asset IDs</span>
                          </div>

                          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-48">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-semibold text-slate-700 dark:text-slate-300">
                                <tr>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">#</th>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">Category</th>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">Brand & Model</th>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">Serial Number</th>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">Purchase Date</th>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">Cost</th>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">Vendor</th>
                                  <th className="p-2 border-b border-slate-200 dark:border-slate-700">Location</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                                {currentPreviewFile.rows.slice(0, 5).map((r: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-2 font-bold text-slate-400">{i + 1}</td>
                                    <td className="p-2 font-sans font-medium text-slate-800 dark:text-slate-200">
                                      {r.Category || r.category || 'CPU'}
                                    </td>
                                    <td className="p-2 font-sans text-slate-800 dark:text-slate-200">
                                      {r.Brand || r.brand || ''} {r.Model || r.model || ''}
                                    </td>
                                    <td className="p-2 text-blue-600 dark:text-blue-400 font-bold">
                                      {r['Serial Number'] || r.serial_number || r.serial || <span className="text-rose-500">Missing!</span>}
                                    </td>
                                    <td className="p-2 text-slate-600 dark:text-slate-400">
                                      {r['Purchase Date'] || r.purchase_date || '-'}
                                    </td>
                                    <td className="p-2 text-slate-600 dark:text-slate-400">
                                      ${r['Purchase Cost'] || r.purchase_cost || '0'}
                                    </td>
                                    <td className="p-2 font-sans text-slate-600 dark:text-slate-400">
                                      {r.Vendor || r.vendor || '-'}
                                    </td>
                                    <td className="p-2 font-sans text-slate-600 dark:text-slate-400">
                                      {r.Location || r.location || 'The Space'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Progress Banner while importing */}
                      {isSubmitting && batchProgress && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between text-xs animate-pulse">
                          <div className="flex items-center gap-2">
                            <Spinner size="sm" />
                            <span className="font-semibold text-blue-900 dark:text-blue-200">
                              Importing file {batchProgress.current} of {batchProgress.total}: &quot;{batchProgress.currentFileName}&quot;...
                            </span>
                          </div>
                          <span className="text-blue-600 dark:text-blue-400 font-mono">
                            {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                          </span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <Button variant="outline" size="sm" onClick={resetImportForm} disabled={isSubmitting}>
                          Cancel / Reset
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSubmitImport}
                          isLoading={isSubmitting}
                          disabled={totalValidFiles === 0}
                          icon={<CheckCircle2 className="w-4 h-4" />}
                        >
                          {totalValidFiles > 1
                            ? `Import All ${totalValidFiles} Files (${totalValidRecords} Assets)`
                            : `Import ${totalValidRecords} Assets`}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Success Result Card (for Single or Multiple Files) */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                      {batchResult.files.length > 1
                        ? `All ${batchResult.files.length} Files Imported Successfully!`
                        : 'File Imported Successfully!'}
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      <strong>{batchResult.totalSuccess}</strong> total assets registered into inventory with official TGS barcode identities.
                      {batchResult.totalFailed > 0 && ` (${batchResult.totalFailed} records skipped)`}
                    </p>
                  </div>

                  {/* Per-File Results List */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Imported Files Summary:</span>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-xs">
                      {batchResult.files.map((f, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{f.fileName}</p>
                              <p className="text-[11px] text-slate-500">
                                <strong>{f.successCount}</strong> of {f.totalRecords} assets registered
                                {f.failedCount > 0 && ` • ${f.failedCount} skipped`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {f.importId > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setViewingFileImport({
                                    id: f.importId,
                                    filename: f.fileName,
                                    original_name: f.fileName,
                                    file_size: f.fileSize,
                                    file_content: f.fileContent,
                                    total_records: f.totalRecords,
                                    success_count: f.successCount,
                                    failed_count: f.failedCount,
                                    status: f.failedCount === 0 ? 'completed' : 'partial',
                                    imported_by_user_id: null,
                                    imported_by_name: null,
                                    created_at: new Date().toISOString(),
                                  });
                                }}
                                icon={<Maximize2 className="w-3 h-3 text-blue-500" />}
                                className="text-xs py-1 px-2.5"
                              >
                                View File
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <Button variant="outline" size="sm" onClick={resetImportForm}>
                      Import More Files
                    </Button>
                    <Button variant="outline" size="sm" onClick={onClose}>
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 2: IMPORTED FILES HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                Log of all bulk files imported into the system. You can view assets or download the files.
              </span>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer font-medium"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Spinner size="md" />
                <p className="text-xs text-slate-500">Loading imported files...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Imported Files Yet</h4>
                <p className="text-xs text-slate-500 mt-1">Upload a CSV file from the Upload tab to populate inventory.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab('import')}>
                  Import First File
                </Button>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group"
                  >
                    <div
                      className="flex items-start gap-3 min-w-0 cursor-pointer flex-1"
                      onClick={() => setViewingFileImport(item)}
                      title="Click to view file in full screen"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform shadow-xs">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingFileImport(item);
                            }}
                            className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate text-left cursor-pointer flex items-center gap-1.5"
                          >
                            <span>{item.original_name || item.filename}</span>
                            <Maximize2 className="w-3 h-3 text-slate-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                              item.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : item.status === 'partial'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {item.status === 'completed' ? 'Fully Imported' : item.status === 'partial' ? 'Partially Imported' : 'Failed'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.created_at)}
                          </span>
                          <span>•</span>
                          <span>
                            <strong>{item.success_count}</strong> of {item.total_records} assets imported
                          </span>
                          <span>•</span>
                          <span>{formatBytes(item.file_size)}</span>
                          {item.imported_by_name && (
                            <>
                              <span>•</span>
                              <span>By: {item.imported_by_name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Click to view full screen</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setViewingFileImport(item)}
                        icon={<Maximize2 className="w-3 h-3" />}
                        title="View imported file in full screen"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        View File
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadOriginalFile(item)}
                        icon={<Download className="w-3 h-3 text-slate-600 dark:text-slate-300" />}
                        title="Download original file"
                      >
                        Download
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeletingImportItem(item);
                          setDeleteWithAssets(true);
                          setDeleteError(null);
                        }}
                        icon={<Trash2 className="w-3 h-3" />}
                        title="Delete imported file"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {deletingImportItem && (
              <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 space-y-3 mt-3 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <h4 className="font-semibold text-rose-950 dark:text-rose-200 text-sm">
                      Delete File: &quot;{deletingImportItem.original_name || deletingImportItem.filename}&quot;?
                    </h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                      This will remove this file record from your imported files log.
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={deleteWithAssets}
                      onChange={(e) => setDeleteWithAssets(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <span>Also delete all assets created from this file ({deletingImportItem.success_count} assets)</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                        If checked, all {deletingImportItem.success_count} asset(s) imported from this file and their histories will be permanently removed from inventory.
                        If unchecked, the assets remain in inventory, but the file log is removed.
                      </p>
                    </div>
                  </label>
                </div>

                {deleteError && (
                  <div className="p-2.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 text-xs">
                    {deleteError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDeletingImport}
                    onClick={() => {
                      setDeletingImportItem(null);
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={isDeletingImport}
                    onClick={() => handleDeleteImport(deletingImportItem.id)}
                  >
                    {isDeletingImport ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Screen Imported File Viewer */}
      <ImportedFileFullScreenViewer
        isOpen={!!viewingFileImport}
        onClose={() => setViewingFileImport(null)}
        importId={viewingFileImport?.id || null}
        initialImport={viewingFileImport}
        onFilterByImport={onFilterByImport}
      />
    </Modal>
  );
}
