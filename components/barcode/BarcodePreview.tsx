'use client';

import React from 'react';
import { BarcodeGenerator } from './BarcodeGenerator';
import { cn } from '@/lib/utils';

export interface BarcodePreviewProps {
  assetNumber: string;
  category?: string;
  model?: string;
  serialNumber?: string;
  companyName?: string;
  className?: string;
}

export function BarcodePreview({
  assetNumber,
  category,
  model,
  serialNumber,
  companyName = 'ENTERPRISE ASSET MANAGEMENT',
  className,
}: BarcodePreviewProps) {
  return (
    <div
      className={cn(
        'w-full max-w-md mx-auto bg-white border border-slate-300 rounded-xl p-5 shadow-sm flex flex-col items-center select-none text-slate-900',
        className
      )}
    >
      {/* Top Header */}
      <div className="w-full flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-slate-700">
          {companyName}
        </span>
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">PROPERTY OF ORG</span>
      </div>

      {/* Barcode Graphic with isolated high-contrast quiet zone */}
      <div className="w-full flex justify-center py-2 bg-white rounded-lg overflow-x-auto">
        <BarcodeGenerator
          value={assetNumber}
          width={2.5} // Large module width for maximum camera and cross-screen decodability
          height={95} // Taller bars ensure horizontal scanlines intersect reliably
          displayValue={true}
          fontSize={15}
          renderMode="svg"
        />
      </div>

      {/* Asset Metadata footer */}
      {(category || model || serialNumber) && (
        <div className="w-full mt-3 pt-2 border-t border-dashed border-slate-300 text-left grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600">
          {category && (
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Type</span>
              <span className="font-semibold text-slate-800 truncate block">{category}</span>
            </div>
          )}
          {model && (
            <div>
              <span className="text-slate-400 block text-[9px] uppercase">Model</span>
              <span className="font-semibold text-slate-800 truncate block">{model}</span>
            </div>
          )}
          {serialNumber && (
            <div className="col-span-2">
              <span className="text-slate-400 block text-[9px] uppercase">Serial Number</span>
              <span className="font-mono text-slate-800">{serialNumber}</span>
            </div>
          )}
        </div>
      )}

      {/* Security notice */}
      <div className="w-full text-center mt-2 pt-1 border-t border-slate-100">
        <p className="text-[9px] text-slate-400 uppercase tracking-wider">
          DO NOT REMOVE • SCANNABLE ID
        </p>
      </div>
    </div>
  );
}
