'use client';

import React from 'react';
import { BarcodeGenerator } from './BarcodeGenerator';
import { cn } from '@/lib/utils';

export interface ThermalSticker50x25Props {
  assetNumber: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  companyName?: string;
  className?: string;
  showDetails?: boolean;
}

/**
 * Exact 50mm (width) x 25mm (height) thermal label component
 * Specifically formatted for Thermal Label Printers like SRS58D / P58D.
 */
export function ThermalSticker50x25({
  assetNumber,
  category,
  brand,
  model,
  serialNumber,
  companyName = 'TGS ASSET MANAGEMENT',
  className,
  showDetails = true,
}: ThermalSticker50x25Props) {
  const modelText = [brand, model].filter(Boolean).join(' ') || '';

  return (
    <div
      className={cn(
        'thermal-sticker-50x25 bg-white text-black select-none box-border flex flex-col justify-between items-center overflow-hidden',
        className
      )}
      style={{
        width: '50mm',
        height: '25mm',
        minWidth: '50mm',
        minHeight: '25mm',
        maxWidth: '50mm',
        maxHeight: '25mm',
        padding: '1mm 1.5mm 0.8mm 1.5mm',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#ffffff',
        color: '#000000',
      }}
    >
      {/* Top Header: Company Name & Category */}
      <div
        className="w-full flex items-center justify-between border-b border-black pb-[0.4mm] leading-none shrink-0"
        style={{ fontSize: '6.5pt' }}
      >
        <span className="font-extrabold uppercase tracking-tight text-black truncate max-w-[34mm]">
          {companyName}
        </span>
        <span
          className="font-bold uppercase tracking-wide px-[1mm] py-[0.2mm] bg-black text-white rounded-[0.5mm] shrink-0"
          style={{ fontSize: '5pt' }}
        >
          {category || 'ASSET'}
        </span>
      </div>

      {/* Middle Barcode: Code 128 Vector SVG + Bold & Spreadable Asset Name */}
      <div className="w-full flex flex-col justify-center items-center overflow-hidden shrink-0 my-auto py-0">
        <BarcodeGenerator
          value={assetNumber}
          renderMode="svg"
          width={1.15}
          height={24}
          margin={0}
          textMargin={0}
          displayValue={false}
          className="p-0 bg-transparent shadow-none"
        />
        <div
          className="w-full font-mono font-black text-black text-center uppercase select-all leading-none"
          style={{
            fontSize: '8.5pt',
            fontWeight: 800,
            letterSpacing: '0.22em',
            marginRight: '-0.22em',
            marginTop: '0.8mm',
          }}
        >
          {assetNumber}
        </div>
      </div>

      {/* Bottom Footer: Model and Serial Number */}
      {showDetails && (
        <div
          className="w-full flex items-center justify-between border-t border-black/80 pt-[0.4mm] leading-none shrink-0 text-black"
          style={{ fontSize: '5.8pt' }}
        >
          <span className="font-bold truncate max-w-[26mm]" title={modelText}>
            {modelText || category || 'Hardware'}
          </span>
          <span className="font-mono font-bold shrink-0 ml-1">
            {serialNumber ? `SN: ${serialNumber}` : 'PROPERTY OF TGS'}
          </span>
        </div>
      )}
    </div>
  );
}
