'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ThermalSticker50x25 } from './ThermalSticker50x25';
import { Printer, Download, ZoomIn, ZoomOut, Info, CheckCircle2, Minus, Plus, Loader2 } from 'lucide-react';
import { downloadBarcodeStickerPDF } from '@/lib/barcode-pdf';

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
  const [isDownloadingPDF, setIsDownloadingPDF] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handlePrint = () => {
    // Check if dark mode is active on html root
    const wasDark = document.documentElement.classList.contains('dark');
    // Temporarily remove dark class so all margins, canvases, and surrounding print areas are 100% pure white
    if (wasDark) {
      document.documentElement.classList.remove('dark');
    }
    // Add printing class to body so only #sticker-print-container is rendered by the print engine
    document.body.classList.add('is-printing-sticker');

    const cleanup = () => {
      document.body.classList.remove('is-printing-sticker');
      if (wasDark) {
        document.documentElement.classList.add('dark');
      }
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    // Give browser time to apply DOM classes and repaint before opening print dialog
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print();
      }, 50);
    });
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPDF(true);
      await downloadBarcodeStickerPDF({
        assetNumber: asset.asset_number,
        category: asset.category,
        brand: asset.brand,
        model: asset.model,
        serialNumber: asset.serial_number,
        copies,
        showDetails,
      });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to download barcode PDF:', err);
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Asset Barcode Sticker"
      description="Formatted for Thermal Label Printer SRS58D / P58D (55mm × 25mm)."
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {downloadSuccess ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>PDF downloaded ({copies} {copies === 1 ? 'label' : 'labels'})!</span>
              </span>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ready for SRS58D / P58D thermal printer</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isDownloadingPDF}>
              Cancel
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
              icon={
                isDownloadingPDF ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )
              }
              className="border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold"
            >
              {isDownloadingPDF ? 'Generating...' : `Download PDF (${copies})`}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={isDownloadingPDF}
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
                Exact physical sticker size: <strong className="text-blue-600 dark:text-blue-400 font-semibold">55 mm (Width) × 25 mm (Height)</strong>
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
          {/* Quantity Selector with Quick Presets & Stepper */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Quantity:</span>
            
            {/* Quick preset buttons */}
            <div className="flex items-center gap-1">
              {[1, 2, 4, 6, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCopies(num)}
                  className={`px-2 py-1 rounded-lg font-medium text-xs transition-all cursor-pointer ${
                    copies === num
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {num} {num === 1 ? 'copy' : 'copies'}
                </button>
              ))}
            </div>

            {/* Stepper with custom input */}
            <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-2xs ml-1">
              <button
                type="button"
                onClick={() => setCopies((prev) => Math.max(1, prev - 1))}
                disabled={copies <= 1}
                className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Decrease quantity"
              >
                <Minus className="w-3 h-3" />
              </button>

              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) {
                    setCopies(Math.min(val, 100));
                  } else if (e.target.value === '') {
                    setCopies(1);
                  }
                }}
                className="w-11 text-center font-bold text-xs bg-transparent text-slate-800 dark:text-white py-1 focus:outline-hidden"
                title="Custom quantity"
              />

              <button
                type="button"
                onClick={() => setCopies((prev) => Math.min(100, prev + 1))}
                disabled={copies >= 100}
                className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Increase quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
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
          {/* Dimension Indicators & Quantity Summary */}
          <div className="flex flex-col items-center mb-1 gap-1">
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
              <span>◀</span>
              <span>Width: 50 mm (1.97 in)</span>
              <span>▶</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[10px] font-semibold border border-blue-200 dark:border-blue-900/60">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span>
                {copies} {copies === 1 ? 'sticker' : 'stickers'} will be printed / downloaded
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold -rotate-90 origin-center whitespace-nowrap">
              25 mm ↕
            </div>

            {/* Visual Sticker Card Container */}
            <div
              className={`transition-all duration-200 rounded-lg shadow-lg ${
                zoomLevel === 'zoomed' ? 'scale-150 origin-center my-6' : 'my-2'
              }`}
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
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
            High-contrast Code 128 monochrome bars formatted to align with the 55mm × 25mm label sensor on the SRS58D / P58D.
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
              <strong>Paper Size:</strong> Choose <strong>55mm × 25mm</strong> (or <em>User-Defined: 55mm W × 25mm H</em>).
            </li>
            <li>
              <strong>Margins:</strong> Set to <strong>None</strong> (0 mm) so the barcode fits perfectly without blank offsets.
            </li>
            <li>
              <strong>Scale:</strong> Set to <strong>100% (Actual Size)</strong> to preserve exact Code 128 bar ratios.
            </li>
            <li>
              <strong>Darkness / Density:</strong> Use <strong>Medium / Normal (8–10)</strong> in printer properties to prevent thermal bleed.
            </li>
          </ul>
        </div>
      </div>
    </Modal>

    {/* Direct Body Portal: The ONLY element displayed during print */}
    {isMounted &&
      createPortal(
        <div id="sticker-print-container">
          {Array.from({ length: copies }).map((_, idx) => (
            <div key={idx} className="sticker-print-page">
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
        </div>,
        document.body
      )}
  </>
  );
}
