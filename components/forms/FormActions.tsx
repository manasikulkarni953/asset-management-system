'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/Button';

export interface FormActionsProps {
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function FormActions({
  onCancel,
  submitText = 'Save Changes',
  cancelText = 'Cancel',
  isSubmitting = false,
  submitDisabled = false,
  className,
  children,
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-200',
        className
      )}
    >
      {children}
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full sm:w-auto"
        >
          {cancelText}
        </Button>
      )}
      <Button
        type="submit"
        variant="primary"
        isLoading={isSubmitting}
        disabled={submitDisabled || isSubmitting}
        className="w-full sm:w-auto"
      >
        {submitText}
      </Button>
    </div>
  );
}
