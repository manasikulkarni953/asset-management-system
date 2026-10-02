'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface FileUploadProps {
  label?: string;
  helperText?: string;
  accept?: string;
  value?: string | null;
  onFileSelect?: (file: File) => void;
  className?: string;
}

export function FileUpload({
  label,
  helperText,
  accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg',
  value,
  onFileSelect,
  className,
}: FileUploadProps) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(value || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      if (onFileSelect) {
        onFileSelect(file);
      }
    }
  };

  return (
    <div className={cn('w-full flex flex-col gap-1.5', className)}>
      {label && <label className="text-xs font-semibold text-slate-700 tracking-wide">{label}</label>}
      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 transition-colors cursor-pointer">
        <svg className="w-6 h-6 text-slate-400 mb-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <span className="text-xs font-medium text-slate-700">
          {selectedFileName ? (
            <span className="text-blue-600 font-semibold">{selectedFileName}</span>
          ) : (
            'Click to upload or drag & drop'
          )}
        </span>
        <span className="text-[11px] text-slate-400 mt-0.5">
          {helperText || `Supported formats: ${accept}`}
        </span>
        <input type="file" accept={accept} onChange={handleFileChange} className="hidden" />
      </label>
    </div>
  );
}
