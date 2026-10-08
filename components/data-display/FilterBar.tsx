'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

export interface FilterItem {
  key: string;
  label?: string;
  value: string;
  options: { value: string; label: string; group?: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  filters?: FilterItem[];
  onReset?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onReset,
  action,
  className,
}: FilterBarProps) {
  const hasActiveFilters =
    (search && search.trim() !== '') ||
    filters.some((f) => f.value && f.value !== 'all' && f.value !== '');

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#0b1224] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 flex-1 min-w-[280px]">
        {onSearchChange !== undefined && (
          <div className="w-full sm:w-64">
            <Input
              value={search || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              leftIcon={
                <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              }
            />
          </div>
        )}

        {filters.map((filter) => (
          <div key={filter.key} className="w-full sm:w-44">
            <Select
              options={filter.options}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              placeholder={filter.placeholder}
            />
          </div>
        ))}

        {hasActiveFilters && onReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white text-xs h-9"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}
