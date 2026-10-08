'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { cn } from '@/lib/utils';
import { DEFAULT_BARCODE_OPTIONS } from '@/lib/barcode';

export interface BarcodeGeneratorProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
  renderMode?: 'canvas' | 'svg';
}

export function BarcodeGenerator({
  value,
  width = DEFAULT_BARCODE_OPTIONS.width,
  height = DEFAULT_BARCODE_OPTIONS.height,
  displayValue = true,
  fontSize = DEFAULT_BARCODE_OPTIONS.fontSize,
  className,
  renderMode = 'canvas',
}: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!value) return;

    const barcodeConfig: JsBarcode.BaseOptions = {
      format: 'CODE128',
      width: Math.round(width || 2), // Must be exact integer to eliminate subpixel blurring
      height: Math.round(height || 90),
      displayValue,
      fontSize: fontSize || 15,
      font: 'monospace',
      fontOptions: 'bold',
      textMargin: 8,
      margin: Math.max(20, DEFAULT_BARCODE_OPTIONS.margin ?? 24),
      background: '#ffffff',
      lineColor: '#000000',
    };

    if (renderMode === 'canvas' && canvasRef.current) {
      try {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
        }
        JsBarcode(canvasRef.current, value.trim(), barcodeConfig);
      } catch (canvasErr) {
        console.warn('Canvas barcode render failed, trying SVG fallback:', canvasErr);
        if (svgRef.current) {
          try {
            JsBarcode(svgRef.current, value.trim(), barcodeConfig);
          } catch (svgErr) {
            console.error('Barcode render error:', svgErr);
          }
        }
      }
    } else if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value.trim(), barcodeConfig);
      } catch (err) {
        console.error('Barcode SVG render error:', err);
      }
    }
  }, [value, width, height, displayValue, fontSize, renderMode]);

  if (!value) {
    return (
      <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-400 dark:text-slate-500">
        No Asset Number
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center justify-center bg-white p-3 rounded-lg shadow-2xs select-none',
        className
      )}
      style={{
        imageRendering: 'pixelated',
      }}
    >
      {renderMode === 'canvas' ? (
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto block"
          style={{
            imageRendering: 'pixelated',
          }}
        />
      ) : (
        <svg
          ref={svgRef}
          className="max-w-full h-auto block"
          shapeRendering="crispEdges"
          style={{
            shapeRendering: 'crispEdges',
          }}
        />
      )}
    </div>
  );
}
