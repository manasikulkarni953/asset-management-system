'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  description?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
  onClick?: () => void;
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  trend,
  description,
  color = 'blue',
  onClick,
  className,
}: StatsCardProps) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition-all',
        onClick && 'cursor-pointer hover:border-slate-300 hover:shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        </div>
        {icon && (
          <div
            className={cn(
              'w-11 h-11 rounded-lg border flex items-center justify-center shrink-0',
              colorStyles[color]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {(trend || description) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center font-medium gap-0.5',
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {description && <span className="text-slate-500">{description}</span>}
        </div>
      )}
    </div>
  );
}
