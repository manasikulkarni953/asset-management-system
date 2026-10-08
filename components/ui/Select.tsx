'use client';

import React, { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, helperText, placeholder, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const hasGroups = options.some((opt) => opt.group);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full appearance-none rounded-lg border bg-white dark:bg-[#0c1428] px-3 py-2 pr-9 text-sm text-slate-900 dark:text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer',
              error
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:focus:ring-rose-950/40'
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950/40',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="dark:bg-[#0c1428]">
                {placeholder}
              </option>
            )}
            {!hasGroups
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="dark:bg-[#0c1428] dark:text-slate-100"
                  >
                    {opt.label}
                  </option>
                ))
              : (() => {
                  const grouped: Array<
                    | { type: 'option'; option: SelectOption }
                    | { type: 'group'; label: string; options: SelectOption[] }
                  > = [];
                  const groupMap = new Map<string, SelectOption[]>();
                  const seenGroups = new Set<string>();

                  options.forEach((opt) => {
                    if (opt.group) {
                      if (!groupMap.has(opt.group)) {
                        groupMap.set(opt.group, []);
                      }
                      groupMap.get(opt.group)!.push(opt);
                    }
                  });

                  options.forEach((opt) => {
                    if (!opt.group) {
                      grouped.push({ type: 'option', option: opt });
                    } else if (!seenGroups.has(opt.group)) {
                      seenGroups.add(opt.group);
                      grouped.push({
                        type: 'group',
                        label: opt.group,
                        options: groupMap.get(opt.group)!,
                      });
                    }
                  });

                  return grouped.map((item, idx) =>
                    item.type === 'group' ? (
                      <optgroup
                        key={`grp-${item.label}-${idx}`}
                        label={item.label}
                        className="font-bold text-slate-800 dark:text-slate-200 dark:bg-[#0c1428]"
                      >
                        {item.options.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            disabled={opt.disabled}
                            className="dark:bg-[#0c1428] dark:text-slate-100 font-normal"
                          >
                            {opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <option
                        key={item.option.value}
                        value={item.option.value}
                        disabled={item.option.disabled}
                        className="dark:bg-[#0c1428] dark:text-slate-100"
                      >
                        {item.option.label}
                      </option>
                    )
                  );
                })()}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</span>}
        {!error && helperText && <span className="text-xs text-slate-500 dark:text-slate-400">{helperText}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
