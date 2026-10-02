'use client';

import React from 'react';
import { cn, formatDateTime } from '@/lib/utils';
import { EmptyState } from '../ui/EmptyState';

export interface TimelineItem {
  id: string | number;
  title: string;
  description?: string;
  timestamp: string;
  user?: string | null;
  tag?: string;
  type?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  emptyMessage?: string;
  className?: string;
}

export function Timeline({
  items,
  emptyMessage = 'No history recorded yet.',
  className,
}: TimelineProps) {
  if (!items || items.length === 0) {
    return (
      <EmptyState
        title="No History"
        description={emptyMessage}
        className="py-8 bg-transparent border-dashed"
      />
    );
  }

  const getEventDotColor = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'created':
        return 'bg-blue-500 ring-blue-100';
      case 'assigned':
        return 'bg-indigo-500 ring-indigo-100';
      case 'transferred':
        return 'bg-amber-500 ring-amber-100';
      case 'returned':
        return 'bg-emerald-500 ring-emerald-100';
      case 'maintenance':
      case 'ticket_raised':
        return 'bg-orange-500 ring-orange-100';
      case 'ticket_resolved':
      case 'resolved':
      case 'closed':
        return 'bg-teal-500 ring-teal-100';
      case 'status_changed':
        return 'bg-purple-500 ring-purple-100';
      case 'retired':
        return 'bg-rose-500 ring-rose-100';
      default:
        return 'bg-slate-400 ring-slate-100';
    }
  };

  return (
    <div className={cn('relative pl-6 space-y-6', className)}>
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden="true" />

      {items.map((item) => (
        <div key={item.id} className="relative group">
          {/* Dot */}
          <div
            className={cn(
              'absolute -left-6 top-1.5 w-3 h-3 rounded-full ring-4 transition-transform group-hover:scale-125',
              getEventDotColor(item.type)
            )}
          />

          {/* Content */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                {item.tag && (
                  <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {item.tag}
                  </span>
                )}
              </div>
              <time className="text-xs text-slate-400 font-mono">
                {formatDateTime(item.timestamp)}
              </time>
            </div>

            {item.description && (
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{item.description}</p>
            )}

            {item.user && (
              <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>Logged by {item.user}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
