'use client';

import React from 'react';
import { Badge, BadgeProps } from '../ui/Badge';
import { getStatusVariant, formatStatusLabel } from '@/lib/utils';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  customLabel?: string;
  className?: string;
}

export function StatusBadge({
  status,
  size = 'md',
  customLabel,
  className,
}: StatusBadgeProps) {
  if (!status) return null;

  const variant = getStatusVariant(status) as BadgeProps['variant'];
  const label = customLabel || formatStatusLabel(status);

  return (
    <Badge variant={variant} size={size} dot className={className}>
      {label}
    </Badge>
  );
}
