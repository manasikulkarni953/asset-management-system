'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'white' | 'blue' | 'slate';
  className?: string;
}

export function Spinner({ size = 'md', color = 'blue', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  const colors = {
    white: 'border-white/30 border-t-white',
    blue: 'border-blue-200 border-t-blue-600',
    slate: 'border-slate-300 border-t-slate-700',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full inline-block shrink-0',
        sizes[size],
        colors[color],
        className
      )}
      role="status"
      aria-label="loading"
    />
  );
}
