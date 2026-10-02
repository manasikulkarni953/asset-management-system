'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { BarcodePreview } from './BarcodePreview';

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Asset Barcode Sticker"
      description="Standard Code 128 barcode sticker formatted for thermal or label printers."
      size="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
            }
          >
            Print Sticker ({copies})
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 py-2">
        {/* Copies selector */}
        <div className="w-full flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span className="font-semibold text-slate-700">Label Quantity:</span>
          <div className="flex items-center gap-2">
            {[1, 2, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCopies(num)}
                className={`px-2.5 py-1 rounded font-medium border text-xs cursor-pointer ${
                  copies === num
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {num} {num === 1 ? 'copy' : 'copies'}
              </button>
            ))}
          </div>
        </div>

        {/* Print Container */}
        <div className="print-area w-full flex flex-col gap-4 items-center justify-center p-4 bg-slate-100 rounded-xl border border-slate-200">
          {Array.from({ length: copies }).map((_, idx) => (
            <div key={idx} className="print-sticker-item">
              <BarcodePreview
                assetNumber={asset.asset_number}
                category={asset.category}
                model={asset.brand ? `${asset.brand} ${asset.model || ''}` : asset.model}
                serialNumber={asset.serial_number}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
