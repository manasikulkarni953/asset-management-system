'use client';

import React, { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const checkId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex items-start gap-2.5">
        <div className="flex items-center h-5">
          <input
            id={checkId}
            ref={ref}
            type="checkbox"
            className={cn(
              'h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0c1428] text-blue-600 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 cursor-pointer transition-colors',
              className
            )}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col text-sm">
            {label && (
              <label htmlFor={checkId} className="font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                {label}
              </label>
            )}
            {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
