'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  borderTop?: boolean;
}

export function FormSection({
  title,
  description,
  children,
  className,
  borderTop = false,
}: FormSectionProps) {
  return (
    <div
      className={cn(
        'space-y-4',
        borderTop && 'pt-6 border-t border-slate-200',
        className
      )}
    >
      <div>
        <h4 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h4>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}
