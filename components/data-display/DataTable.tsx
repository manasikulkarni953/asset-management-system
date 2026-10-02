'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor = (_, index) => index,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching the current filter criteria.',
  emptyAction,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" color="blue" />
        <p className="text-sm font-medium text-slate-500">Loading data...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className="bg-white border-slate-200"
      />
    );
  }

  const alignStyles = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'px-4 py-3.5 select-none whitespace-nowrap',
                    alignStyles[col.align || 'left'],
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((row, idx) => {
              const rowKey = keyExtractor(row, idx);
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={cn(
                    'transition-colors duration-100',
                    onRowClick ? 'cursor-pointer hover:bg-blue-50/30' : 'hover:bg-slate-50/80',
                    idx % 2 === 1 && 'bg-slate-50/30'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3.5 text-slate-700 align-middle',
                        alignStyles[col.align || 'left'],
                        col.className
                      )}
                    >
                      {col.render ? col.render(row, idx) : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
