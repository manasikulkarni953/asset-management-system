'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/data-display/DataTable';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type ReportType = 'assets' | 'employees' | 'tickets' | 'insurance' | 'history';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('assets');
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${reportType}`);
      const json = await res.json();
      if (json.data) {
        setReportData(json.data);
      } else {
        setReportData([]);
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setReportData([]);
    } finally {
      setIsLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) return;

    const headers = Object.keys(reportData[0]);
    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

    // Data rows
    for (const row of reportData) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate dynamic table columns from the report dataset keys
  const columns: Column<any>[] =
    reportData.length > 0
      ? Object.keys(reportData[0]).map((key) => ({
          key,
          header: key,
          render: (row) => {
            const val = row[key];
            if (val === null || val === undefined || val === '') return <span className="text-slate-300 dark:text-slate-600">-</span>;
            return <span className="text-xs text-slate-700 dark:text-slate-200">{String(val)}</span>;
          },
        }))
      : [];

  const reportTabs = [
    { type: 'assets' as ReportType, label: 'Asset Report', count: reportType === 'assets' ? reportData.length : null },
    { type: 'employees' as ReportType, label: 'Employee Asset Report', count: reportType === 'employees' ? reportData.length : null },
    { type: 'tickets' as ReportType, label: 'Ticket Report', count: reportType === 'tickets' ? reportData.length : null },
    { type: 'insurance' as ReportType, label: 'Insurance Report', count: reportType === 'insurance' ? reportData.length : null },
    { type: 'history' as ReportType, label: 'Asset History Report', count: reportType === 'history' ? reportData.length : null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Compliance & Inventory Reports"
        description="Audit-ready dataset extractions, custody allocations, SLA tickets, and lifecycle logs."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCSV}
            disabled={reportData.length === 0 || isLoading}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            }
          >
            Export to CSV
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {reportTabs.map((tab) => {
          const isActive = reportType === tab.type;
          return (
            <button
              key={tab.type}
              type="button"
              onClick={() => setReportType(tab.type)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-[#0b1224] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0e172e] border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Report Table Card */}
      <Card
        title={`${reportTabs.find((t) => t.type === reportType)?.label} Data Extraction`}
        subtitle={`${reportData.length} records retrieved from MySQL.`}
        padding="none"
      >
        <DataTable
          columns={columns}
          data={reportData}
          isLoading={isLoading}
          keyExtractor={(_, index) => `rep-${reportType}-${index}`}
          emptyTitle="No Data Returned"
          emptyDescription="There are no records in the database matching this report criteria."
        />
      </Card>
    </div>
  );
}
