'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ThermalSticker50x25 } from './ThermalSticker50x25';
import { Printer, ZoomIn, ZoomOut, Info, CheckCircle2 } from 'lucide-react';

export interface BarcodePrintProps {
  isOpen: boolean;
  onClose: () => void;
  asset: {
    asset_number: string;
    category?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
  };
}

export function BarcodePrint({ isOpen, onClose, asset }: BarcodePrintProps) {
  const [copies, setCopies] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<'actual' | 'zoomed'>('zoomed');
  const [showDetails, setShowDetails] = useState<boolean>(true);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Asset Barcode Sticker"
      description="Formatted for Thermal Label Printer SRS58D / P58D (50mm × 25mm)."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for SRS58D / P58D thermal printer</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              icon={<Printer className="w-4 h-4" />}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
            >
              Print Sticker ({copies})
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1 text-slate-800 dark:text-slate-200">
        {/* Hardware & Label Specs Banner */}
        <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Thermal Label Printer: SRS58D / P58D</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                  58mm Roll
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                Exact physical sticker size: <strong className="text-blue-600 dark:text-blue-400 font-semibold">50 mm (Width) × 25 mm (Height)</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setZoomLevel(zoomLevel === 'actual' ? 'zoomed' : 'actual')}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              {zoomLevel === 'actual' ? (
                <>
                  <ZoomIn className="w-3.5 h-3.5 text-blue-500" />
                  <span>2x Zoom View</span>
                </>
              ) : (
                <>
                  <ZoomOut className="w-3.5 h-3.5 text-blue-500" />
                  <span>1x Real Size</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Options Toolbar: Quantity & Details */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
          {/* Quantity */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Quantity:</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 4, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCopies(num)}
                  className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                    copies === num
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {num} {num === 1 ? 'copy' : 'copies'}
                </button>
              ))}
            </div>
          </div>

          {/* Details Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Include Model & Serial Number footer</span>
          </label>
        </div>

        {/* Interactive Sticker Preview */}
        <div className="w-full flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-[#070b18] rounded-xl border border-dashed border-slate-300 dark:border-slate-800 overflow-x-auto">
          {/* Dimension Indicators */}
          <div className="flex flex-col items-center mb-1">
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold mb-1 flex items-center gap-1">
              <span>◀</span>
              <span>Width: 50 mm (1.97 in)</span>
              <span>▶</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold -rotate-90 origin-center whitespace-nowrap">
              25 mm ↕
            </div>

            {/* Visual Sticker Card Container */}
            <div
              className={`transition-all duration-200 p-1 bg-white dark:bg-white rounded-md shadow-md border border-slate-300 dark:border-slate-600 ${
                zoomLevel === 'zoomed' ? 'scale-150 origin-center my-6' : 'my-2'
              }`}
              style={{ backgroundColor: '#ffffff' }}
            >
              <ThermalSticker50x25
                assetNumber={asset.asset_number}
                category={asset.category}
                brand={asset.brand}
                model={asset.model}
                serialNumber={asset.serial_number}
                showDetails={showDetails}
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-400 mt-2 text-center">
            High-contrast Code 128 monochrome bars formatted to align with the 50mm × 25mm label sensor on the SRS58D / P58D.
          </p>
        </div>

        {/* Thermal Print Setup Instructions Tip */}
        <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Thermal Printer Settings Guide (SRS58D / P58D):</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5 ml-1">
            <li>
              <strong>Destination:</strong> Select your <strong>SRS58D / P58D</strong> printer.
            </li>
            <li>
              <strong>Paper Size:</strong> Choose <strong>50mm × 25mm</strong> (or <em>User-Defined: 50mm W × 25mm H</em>).
            </li>
            <li>
              <strong>Margins:</strong> Set to <strong>None</strong> (0 mm) so the barcode fits perfectly without blank offsets.
            </li>
            <li>
              <strong>Scale:</strong> Set to <strong>100%</strong> (or <em>Fit to printable area</em>).
            </li>
          </ul>
        </div>

        {/* Dedicated Print Area (positioned off-screen in screen mode, active during window.print) */}
        <div className="print-area">
          {Array.from({ length: copies }).map((_, idx) => (
            <div key={idx} className="print-sticker-item">
              <ThermalSticker50x25
                assetNumber={asset.asset_number}
                category={asset.category}
                brand={asset.brand}
                model={asset.model}
                serialNumber={asset.serial_number}
                showDetails={showDetails}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
