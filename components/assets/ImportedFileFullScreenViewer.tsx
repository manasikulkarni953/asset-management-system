'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AssetImport, Asset } from '@/types/asset';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  X,
  Search,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Calendar,
  Layers,
  HardDrive,
  User,
  ExternalLink,
  Code2,
  Table as TableIcon,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  FileWarning,
} from 'lucide-react';

interface ImportedFileFullScreenViewerProps {
  isOpen: boolean;
  onClose: () => void;
  importId: number | null;
  initialImport?: AssetImport | null;
  onFilterByImport?: (importId: number, filename: string) => void;
}

export function ImportedFileFullScreenViewer({
  isOpen,
  onClose,
  importId,
  initialImport,
  onFilterByImport,
}: ImportedFileFullScreenViewerProps) {
  const [importRecord, setImportRecord] = useState<AssetImport | null>(initialImport || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<'table' | 'raw' | 'assets' | 'errors'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);

  // Pagination for large files
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Associated created assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);

  // Fetch full record including file_content when modal opens
  const fetchImportDetails = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/imports/${id}`);
      const data = await res.json();
      if (!res.ok || !data.importRecord) {
        throw new Error(data.error || 'Failed to load imported file details');
      }
      setImportRecord(data.importRecord);
    } catch (err: any) {
      console.error('Error loading import details:', err);
      setError(err?.message || 'Failed to retrieve file contents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch created assets
  const fetchImportAssets = useCallback(async (id: number) => {
    setIsLoadingAssets(true);
    try {
      const res = await fetch(`/api/assets?importId=${id}&limit=100`);
      const data = await res.json();
      if (data.assets) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error('Failed to load created assets for import:', err);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && importId) {
      fetchImportDetails(importId);
      fetchImportAssets(importId);
      setSearchTerm('');
      setCurrentPage(1);
    } else if (!isOpen) {
      setImportRecord(null);
      setAssets([]);
      setError(null);
    }
  }, [isOpen, importId, fetchImportDetails, fetchImportAssets]);

  // Handle ESC key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Parsed Error Log from Database
  const errorLogList = useMemo(() => {
    if (!importRecord?.error_log) return [];
    try {
      const parsed = typeof importRecord.error_log === 'string'
        ? JSON.parse(importRecord.error_log)
        : importRecord.error_log;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [importRecord?.error_log]);

  // Robust Spreadsheet & CSV Parser with XLSX engine & Binary Detection
  const { headers, rows, rawLines, isBinary, parseMessage } = useMemo(() => {
    const content = importRecord?.file_content || '';
    if (!content || !content.trim()) {
      return { headers: [], rows: [], rawLines: [], isBinary: false, parseMessage: null };
    }

    // Check if content is raw binary (starts with PK zip header or contains binary control chars)
    const hasBinarySignature =
      content.startsWith('PK') ||
      content.includes('[Content_Types].xml') ||
      /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content.slice(0, 500));

    if (hasBinarySignature) {
      return {
        headers: [],
        rows: [],
        rawLines: [
          `[Binary Microsoft Excel Spreadsheet: ${importRecord?.original_name || importRecord?.filename || 'spreadsheet.xlsx'}]`,
          `Size: ${importRecord?.file_size || 0} bytes`,
          `Format: OpenXML Spreadsheet (Binary Zip Package)`,
          `Status: Stored in raw binary format in this historical batch.`,
        ],
        isBinary: true,
        parseMessage:
          'This Excel spreadsheet was recorded as raw binary in this historical batch. To view its interactive spreadsheet table, please re-import the file in the "Upload & Import" tab, or click "Download" to open in Microsoft Excel.',
      };
    }

    // Attempt standard XLSX string parsing (supports CSV, TSV, converted Excel sheets)
    try {
      const wb = XLSX.read(content, { type: 'string' });
      if (wb.SheetNames && wb.SheetNames.length > 0) {
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
        if (json.length > 0) {
          const parsedHeaders = Object.keys(json[0]);
          const parsedRows = json.map((r, idx) => ({ _rowNum: idx + 1, ...r }));
          const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
          return { headers: parsedHeaders, rows: parsedRows, rawLines: lines, isBinary: false, parseMessage: null };
        }
      }
    } catch {
      // fallback to manual CSV line parser below
    }

    // Manual CSV Parser fallback
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (char === '"' || char === "'") {
        if (inQuotes && nextChar === char) {
          currentLine += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (currentLine.trim()) lines.push(currentLine);
        currentLine = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) lines.push(currentLine);

    if (lines.length === 0) {
      return { headers: [], rows: [], rawLines: [], isBinary: false, parseMessage: null };
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

    const parsedHeaders = splitRow(lines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
    const parsedRows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = splitRow(line).map((v) => v.replace(/^["']|["']$/g, '').trim());
      const rowObj: any = { _rowNum: i };
      parsedHeaders.forEach((header, index) => {
        rowObj[header] = values[index] !== undefined ? values[index] : '';
      });
      parsedRows.push(rowObj);
    }

    return { headers: parsedHeaders, rows: parsedRows, rawLines: lines, isBinary: false, parseMessage: null };
  }, [importRecord?.file_content, importRecord?.original_name, importRecord?.filename, importRecord?.file_size]);

  // Filtered rows based on search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((row) =>
      Object.entries(row).some(([key, val]) => {
        if (key.startsWith('_')) return false;
        return String(val).toLowerCase().includes(term);
      })
    );
  }, [rows, searchTerm]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows; // All
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredRows.length / pageSize);

  const handleCopyRaw = () => {
    if (!importRecord?.file_content) return;
    navigator.clipboard.writeText(importRecord.file_content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!importRecord?.id) return;
    window.open(`/api/assets/imports/${importRecord.id}?download=true`, '_blank');
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  const fileName = importRecord?.original_name || importRecord?.filename || 'Imported File';

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col bg-slate-950/90 backdrop-blur-md transition-all duration-300 animate-in fade-in ${
        isFullscreen ? 'p-0' : 'p-3 sm:p-6'
      }`}
      role="dialog"
      aria-modal="true"
    >
      {/* Main Container */}
      <div
        className={`flex flex-col w-full h-full bg-[#0a0f1d] text-slate-100 border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'rounded-none' : 'rounded-2xl max-w-7xl mx-auto max-h-[96vh]'
        }`}
      >
        {/* TOP BAR: File Info & Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 px-5 py-3.5 bg-[#0e162b] border-b border-slate-800/80 shrink-0">
          {/* Left: File Title & Meta Chips */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate max-w-md" title={fileName}>
                  {fileName}
                </h2>
                {importRecord && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      importRecord.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : importRecord.status === 'partial'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {importRecord.status === 'completed'
                      ? 'Fully Imported'
                      : importRecord.status === 'partial'
                      ? 'Partially Imported'
                      : 'Import Failed'}
                  </span>
                )}
              </div>

              {/* Quick Metadata */}
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                {importRecord?.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {formatDate(importRecord.created_at)}
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-slate-300">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  {importRecord?.total_records || rows.length} records in file ({importRecord?.success_count || 0} registered)
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  {formatBytes(importRecord?.file_size || 0)}
                </span>
                {importRecord?.imported_by_name && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      Uploaded by: <strong className="text-slate-300 font-medium">{importRecord.imported_by_name}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Tabs & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-end lg:self-center shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveView('table')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'table'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Spreadsheet tabular view"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Spreadsheet</span>
                {rows.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-700 text-blue-100">
                    {rows.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveView('assets')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'assets'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="View assets created from this file in inventory"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Created Assets</span>
                {assets.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-900/60 text-emerald-300">
                    {assets.length}
                  </span>
                )}
              </button>

              {errorLogList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveView('errors')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeView === 'errors'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-rose-400 hover:text-rose-300 hover:bg-rose-950/40'
                  }`}
                  title="View import processing errors and skipped records"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Issues ({errorLogList.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveView('raw')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'raw'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Raw file text"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Raw File</span>
              </button>
            </div>

            {/* Download File */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              icon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
              title="Download original imported file"
              className="bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200"
            >
              <span className="hidden sm:inline">Download</span>
            </Button>

            {/* Toggle Fullscreen mode */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Restore window size' : 'Expand to full screen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
              title="Close Full Screen View (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
              <kbd className="hidden sm:inline-block px-1 py-0.2 text-[10px] font-mono bg-rose-950/60 text-rose-300 rounded border border-rose-800/40">
                ESC
              </kbd>
            </button>
          </div>
        </div>

        {/* SUB-HEADER: Search & Quick Filters (shown for table view) */}
        {activeView === 'table' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 py-2.5 bg-[#0b1224] border-b border-slate-800/60 text-xs shrink-0">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search across all columns (Serial, Model, Brand, Category, etc.)..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-slate-400 self-end sm:self-center">
              <span>
                Showing <strong className="text-white">{filteredRows.length}</strong> of{' '}
                <strong className="text-white">{rows.length}</strong> rows
                {searchTerm && ` (filtered from total)`}
              </span>

              {/* Rows Per Page */}
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-slate-500">Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="0">All</option>
                </select>
              </div>

              {onFilterByImport && importRecord && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onFilterByImport(importRecord.id, fileName);
                    onClose();
                  }}
                  icon={<ExternalLink className="w-3 h-3 text-blue-400" />}
                  className="bg-blue-950/40 border-blue-800/60 text-blue-300 hover:bg-blue-900/60"
                  title="Filter inventory table by this file"
                >
                  View in Inventory
                </Button>
              )}
            </div>
          </div>
        )}

        {/* BODY AREA */}
        <div className="flex-1 overflow-auto bg-[#070b18] relative">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
              <Spinner size="lg" />
              <p className="text-sm font-medium">Loading imported file content...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Failed to display file</h3>
              <p className="text-sm text-slate-400 max-w-md mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => importId && fetchImportDetails(importId)}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* VIEW 1: SPREADSHEET TABLE */}
              {activeView === 'table' && (
                <div className="h-full flex flex-col">
                  {isBinary ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-300">
                      <div className="w-16 h-16 rounded-2xl bg-blue-950/60 border border-blue-800 text-blue-400 flex items-center justify-center mb-4 shadow-lg">
                        <FileSpreadsheet className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Excel Spreadsheet (.xlsx)</h3>
                      <p className="text-xs text-slate-400 max-w-lg mt-2 leading-relaxed">
                        {parseMessage ||
                          `This file (${fileName}) was recorded in raw binary format in this historical import batch. To view its interactive spreadsheet table, please re-import the file in the "Upload & Import" tab, or click "Download" to open in Microsoft Excel.`}
                      </p>
                      <div className="flex items-center gap-3 mt-6">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleDownload}
                          icon={<Download className="w-4 h-4" />}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                        >
                          Download & Open in Excel
                        </Button>
                        {errorLogList.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveView('errors')}
                            icon={<AlertCircle className="w-4 h-4 text-rose-400" />}
                            className="bg-slate-900 border-slate-700 text-slate-200"
                          >
                            View Import Issues ({errorLogList.length})
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-400">
                      <FileSpreadsheet className="w-12 h-12 text-slate-600 mb-3" />
                      <h4 className="text-base font-semibold text-slate-200">No data rows found in this file</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">
                        The file content could not be parsed into spreadsheet rows, or the file was empty.
                      </p>
                      {assets.length > 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="mt-4"
                          onClick={() => setActiveView('assets')}
                        >
                          View {assets.length} Created Assets Instead
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto">
                      <table className="w-full border-collapse text-left text-xs font-sans">
                        <thead className="sticky top-0 z-20 bg-[#0e172e] text-slate-300 font-semibold border-b border-slate-800 shadow-sm">
                          <tr>
                            <th className="p-3 w-12 text-center text-slate-500 bg-[#0e172e] border-r border-slate-800/80">
                              #
                            </th>
                            {headers.map((header, idx) => (
                              <th
                                key={idx}
                                className="p-3 whitespace-nowrap bg-[#0e172e] border-r border-slate-800/80 font-semibold text-slate-200 tracking-wide uppercase text-[11px]"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                          {paginatedRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={headers.length + 1}
                                className="p-12 text-center text-slate-400 font-sans"
                              >
                                <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                <p className="font-medium text-slate-300">No matching rows found</p>
                                <p className="text-xs text-slate-500 mt-0.5">Try searching for a different keyword</p>
                              </td>
                            </tr>
                          ) : (
                            paginatedRows.map((row, rowIdx) => {
                              const actualRowIndex =
                                pageSize === 0 ? rowIdx + 1 : (currentPage - 1) * pageSize + rowIdx + 1;
                              return (
                                <tr
                                  key={row._rowNum || rowIdx}
                                  className="hover:bg-blue-950/30 transition-colors group"
                                >
                                  <td className="p-3 text-center text-slate-500 bg-slate-950/40 border-r border-slate-800/60 font-mono text-[11px] select-none">
                                    {actualRowIndex}
                                  </td>
                                  {headers.map((header, colIdx) => {
                                    const value = row[header];
                                    const isSerial =
                                      header.toLowerCase().includes('serial') || header.toLowerCase() === 'sn';
                                    const isCost =
                                      header.toLowerCase().includes('cost') || header.toLowerCase().includes('price');
                                    const isStatus = header.toLowerCase().includes('status');
                                    const isCategory = header.toLowerCase().includes('category');

                                    return (
                                      <td
                                        key={colIdx}
                                        className={`p-3 whitespace-nowrap border-r border-slate-800/40 ${
                                          isSerial
                                            ? 'font-bold text-cyan-400 font-mono'
                                            : isCost
                                            ? 'text-emerald-400 font-mono text-right'
                                            : isStatus
                                            ? 'text-center'
                                            : 'text-slate-300 font-sans'
                                        }`}
                                      >
                                        {isStatus ? (
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                              String(value).toLowerCase().includes('stock')
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                : String(value).toLowerCase().includes('assign')
                                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                                            }`}
                                          >
                                            {value || '-'}
                                          </span>
                                        ) : isCategory ? (
                                          <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-medium border border-slate-700/60">
                                            {value || '-'}
                                          </span>
                                        ) : isCost && value ? (
                                          `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                        ) : (
                                          value || <span className="text-slate-600">-</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination Footer */}
                  {pageSize > 0 && totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-2.5 bg-[#0e162b] border-t border-slate-800 text-xs shrink-0">
                      <span className="text-slate-400">
                        Page <strong className="text-white">{currentPage}</strong> of{' '}
                        <strong className="text-white">{totalPages}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="bg-slate-900 border-slate-700 text-slate-300 py-1 px-2.5 text-xs"
                        >
                          Previous
                        </Button>
                        <span className="px-2 font-mono text-slate-300">{currentPage}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="bg-slate-900 border-slate-700 text-slate-300 py-1 px-2.5 text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: CREATED ASSETS IN DATABASE */}
              {activeView === 'assets' && (
                <div className="h-full flex flex-col p-5 overflow-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Assets Created From This Import</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {assets.length} Assets Registered
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        These are the official inventory assets that were registered and assigned barcodes from this file.
                      </p>
                    </div>

                    {onFilterByImport && importRecord && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          onFilterByImport(importRecord.id, fileName);
                          onClose();
                        }}
                        icon={<ExternalLink className="w-3.5 h-3.5" />}
                      >
                        Open In Inventory Management Table
                      </Button>
                    )}
                  </div>

                  {isLoadingAssets ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-2">
                      <Spinner size="md" />
                      <p className="text-xs text-slate-400">Loading created assets...</p>
                    </div>
                  ) : assets.length === 0 ? (
                    <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                      <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="font-semibold text-slate-300 text-sm">No assets currently linked to this import</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        The assets might have been removed or modified. Check the spreadsheet tab to view the raw imported records.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-[#0e162b] text-slate-300 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="p-3">Asset Number</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Brand & Model</th>
                              <th className="p-3">Serial Number</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Location</th>
                              <th className="p-3">Purchase Date</th>
                              <th className="p-3">Assigned To</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {assets.map((asset) => (
                              <tr key={asset.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-3 font-mono font-bold text-blue-400">
                                  <a
                                    href={`/assets/${asset.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:underline flex items-center gap-1"
                                  >
                                    {asset.asset_number}
                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                  </a>
                                </td>
                                <td className="p-3 text-slate-300 font-medium">{asset.category}</td>
                                <td className="p-3 font-semibold text-white">
                                  {asset.brand} {asset.model}
                                </td>
                                <td className="p-3 font-mono text-cyan-400 font-bold">{asset.serial_number}</td>
                                <td className="p-3">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                      asset.status === 'in_stock'
                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                        : asset.status === 'assigned'
                                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                        : asset.status === 'under_maintenance'
                                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                    }`}
                                  >
                                    {asset.status}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-300">{asset.location || '-'}</td>
                                <td className="p-3 text-slate-400 font-mono">{asset.purchase_date || '-'}</td>
                                <td className="p-3 text-slate-300">
                                  {asset.current_employee_name ? (
                                    <span className="font-medium text-white">{asset.current_employee_name}</span>
                                  ) : (
                                    <span className="text-slate-500">Unassigned</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <a
                                    href={`/assets/${asset.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-semibold border border-slate-700 transition-colors"
                                  >
                                    View Asset
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 3: IMPORT ERRORS / ISSUES LOG */}
              {activeView === 'errors' && (
                <div className="h-full flex flex-col p-5 overflow-auto">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Import Processing Issues & Row Diagnostics</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        {errorLogList.length} Issues Recorded
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review diagnostic reasons why specific rows from this file were skipped or could not be registered.
                    </p>
                  </div>

                  {errorLogList.length === 0 ? (
                    <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-slate-200 text-sm">No errors recorded for this import</p>
                      <p className="text-xs text-slate-500 mt-1">All processed records were imported successfully.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#0e162b] text-slate-300 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3 w-16 text-center">Row #</th>
                            <th className="p-3 w-48">Serial Number</th>
                            <th className="p-3">Error / Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                          {errorLogList.map((errItem: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="p-3 text-center text-slate-400 font-bold">{errItem.row || idx + 1}</td>
                              <td className="p-3 text-cyan-400 font-bold">{errItem.serial || '-'}</td>
                              <td className="p-3 font-sans text-rose-300">{errItem.error || 'Processing error'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 4: RAW FILE VIEW */}
              {activeView === 'raw' && (
                <div className="h-full flex flex-col p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 shrink-0">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      {isBinary
                        ? `Binary Excel Archive (${formatBytes(importRecord?.file_size || 0)})`
                        : `Original File Content (${rawLines.length} lines, ${formatBytes(importRecord?.file_size || 0)})`}
                    </span>

                    {!isBinary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyRaw}
                        icon={
                          isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-300" />
                          )
                        }
                        className="bg-slate-900 border-slate-700 text-slate-200"
                      >
                        {isCopied ? 'Copied to Clipboard!' : 'Copy Raw Content'}
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto rounded-xl border border-slate-800/80 bg-[#050813] p-4 font-mono text-xs text-slate-300 leading-relaxed">
                    {isBinary ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <FileSpreadsheet className="w-10 h-10 text-blue-500" />
                        <div>
                          <p className="font-semibold text-slate-200">
                            Binary Excel OpenXML File (.xlsx)
                          </p>
                          <p className="text-xs text-slate-500 mt-1 max-w-md">
                            Binary spreadsheet byte code cannot be displayed as plain text. Use the download button below to inspect this file in Microsoft Excel or LibreOffice.
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleDownload}
                          icon={<Download className="w-3.5 h-3.5" />}
                          className="bg-blue-600 hover:bg-blue-700 text-white mt-2"
                        >
                          Download Excel File
                        </Button>
                      </div>
                    ) : rawLines.length === 0 ? (
                      <p className="text-slate-500 italic">No raw file content available for this record.</p>
                    ) : (
                      <pre className="overflow-x-auto whitespace-pre font-mono">
                        {rawLines.map((line, idx) => (
                          <div key={idx} className="flex hover:bg-slate-900/60 py-0.5">
                            <span className="w-12 shrink-0 select-none text-right pr-4 text-slate-600 font-mono text-[11px]">
                              {idx + 1}
                            </span>
                            <span className={idx === 0 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                              {line}
                            </span>
                          </div>
                        ))}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
