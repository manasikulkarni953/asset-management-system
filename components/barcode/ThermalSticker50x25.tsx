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
 * Exact 55mm (width) x 25mm (height) thermal label component
 * Formatted for Thermal Label Printers.
 * Uses explicit inline styles to guarantee 100% identical rendering across
 * screen previews, print dialogs, and embedded documents.
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
  const modelText = [brand, model].filter(Boolean).join(' ') || category || 'Hardware';
  
  // Clean serial number: strip accidental leading dashes/spaces and guarantee clear prefix
  const rawSerial = serialNumber ? serialNumber.trim().replace(/^[-_\s]+/, '') : '';
  const displaySerial = rawSerial
    ? (rawSerial.toUpperCase().startsWith('SN:') || rawSerial.toUpperCase().startsWith('S/N:')
        ? rawSerial
        : `SN: ${rawSerial}`)
    : 'PROPERTY OF TGS';

  // Calculate balanced module width and quiet zones to prevent bars from merging or becoming too thick
  const cleanAsset = (assetNumber || '').trim();
  const estModules = (cleanAsset.length * 11) + 35;
  // Module width around 1.25 - 1.4 creates clean, open bar spacing with zero thermal bleed across 55mm
  const barcodeModuleWidth = estModules > 180 ? 1.2 : 1.4;

  return (
    <div
      className={cn(
        'thermal-sticker-50x25 bg-white text-black select-none',
        className
      )}
      style={{
        width: '55mm',
        height: '25mm',
        minWidth: '55mm',
        minHeight: '25mm',
        maxWidth: '55mm',
        maxHeight: '25mm',
        padding: '1.2mm 2.2mm 1mm 2.2mm',
        boxSizing: 'border-box',
        fontFamily: 'Arial, "Helvetica Neue", Helvetica, "Segoe UI", sans-serif',
        backgroundColor: '#ffffff',
        color: '#000000',
        border: '1px solid #000000',
        borderRadius: '1.5mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        boxShadow: 'none',
        filter: 'none',
      }}
    >
      {/* Top Header: Company Name & High-Contrast Framed Badge */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #000000',
          paddingBottom: '0.6mm',
          lineHeight: 1,
          flexShrink: 0,
          color: '#000000',
        }}
      >
        <span
          style={{
            fontSize: '6.8pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: '#000000',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
          }}
        >
          {companyName}
        </span>
        {/* Crisp framed badge with black text on white: prevents thermal heat-bleed blackout */}
        <span
          style={{
            fontSize: '5.5pt',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '0.3mm 1.5mm',
            backgroundColor: '#ffffff',
            color: '#000000',
            border: '1px solid #000000',
            borderRadius: '0.8mm',
            flexShrink: 0,
            lineHeight: 1,
            marginLeft: '1mm',
          }}
        >
          {category || 'ASSET'}
        </span>
      </div>

      {/* Middle Barcode: Vector SVG with ISO Quiet Zones + Bold High-Legibility Asset ID */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          flex: 1,
          margin: '0.2mm 0',
          padding: '0',
          backgroundColor: '#ffffff',
          color: '#000000',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxHeight: '9.8mm',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
          }}
        >
          <BarcodeGenerator
            value={cleanAsset}
            renderMode="svg"
            width={barcodeModuleWidth}
            height={46}
            margin={6}
            textMargin={0}
            displayValue={false}
            background="#ffffff"
            lineColor="#000000"
            className="p-0 bg-transparent shadow-none rounded-none border-0"
          />
        </div>
        <div
          style={{
            width: '100%',
            fontFamily: 'Arial, "Helvetica Neue", Helvetica, "Segoe UI", sans-serif',
            fontSize: '8.8pt',
            fontWeight: 700,
            letterSpacing: '0.06em',
            marginTop: '0.4mm',
            textAlign: 'center',
            textTransform: 'uppercase',
            lineHeight: 1,
            backgroundColor: '#ffffff',
            color: '#000000',
          }}
        >
          {cleanAsset}
        </div>
      </div>

      {/* Bottom Footer: Model (Left) & Serial Number (Right) with enhanced 6.2pt typography */}
      {showDetails && (
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #000000',
            paddingTop: '0.6mm',
            lineHeight: 1.1,
            flexShrink: 0,
            color: '#000000',
            fontSize: '6.2pt',
            gap: '2mm',
          }}
        >
          <span
            title={modelText}
            style={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '26mm',
              flexShrink: 1,
              color: '#000000',
            }}
          >
            {modelText}
          </span>
          <span
            title={displaySerial}
            style={{
              fontWeight: 600,
              flexShrink: 0,
              maxWidth: '25mm',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'right',
              color: '#000000',
            }}
          >
            {displaySerial}
          </span>
        </div>
      )}
    </div>
  );
}

// Export 55x25 alias
export { ThermalSticker50x25 as ThermalSticker55x25 };
export type ThermalSticker55x25Props = ThermalSticker50x25Props;

