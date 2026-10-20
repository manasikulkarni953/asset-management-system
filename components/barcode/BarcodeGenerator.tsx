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
  margin?: number;
  textMargin?: number;
  className?: string;
  renderMode?: 'canvas' | 'svg';
  background?: string;
  lineColor?: string;
}

export function BarcodeGenerator({
  value,
  width = DEFAULT_BARCODE_OPTIONS.width,
  height = DEFAULT_BARCODE_OPTIONS.height,
  displayValue = true,
  fontSize = DEFAULT_BARCODE_OPTIONS.fontSize,
  margin,
  textMargin,
  className,
  renderMode = 'canvas',
  background = '#ffffff',
  lineColor = '#000000',
}: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!value) return;

    const barcodeConfig: JsBarcode.BaseOptions = {
      format: 'CODE128',
      width: width || 2,
      height: Math.round(height || 90),
      displayValue,
      fontSize: fontSize || 15,
      font: 'Arial, sans-serif',
      fontOptions: 'bold',
      textMargin: textMargin !== undefined ? textMargin : 4,
      margin: margin !== undefined ? margin : Math.max(6, DEFAULT_BARCODE_OPTIONS.margin ?? 10),
      background: background || '#ffffff',
      lineColor: lineColor || '#000000',
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
        const svg = svgRef.current;
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.style.backgroundColor = background || '#ffffff';
        svg.style.shapeRendering = 'crispEdges';
        
        // Ensure every generated rect has crispEdges and correct monochrome fill
        const rects = svg.querySelectorAll('rect');
        rects.forEach((rect, idx) => {
          rect.setAttribute('shape-rendering', 'crispEdges');
          const fillAttr = rect.getAttribute('fill');
          if (fillAttr === '#ffffff' || fillAttr === 'white' || idx === 0) {
            rect.style.fill = background || '#ffffff';
          } else {
            rect.style.fill = lineColor || '#000000';
          }
        });
      } catch (err) {
        console.error('Barcode SVG render error:', err);
      }
    }
  }, [value, width, height, displayValue, fontSize, renderMode, margin, textMargin, background, lineColor]);

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
        'inline-flex flex-col items-center justify-center select-none',
        className !== undefined ? className : 'bg-white p-3 rounded-lg'
      )}
      style={{
        backgroundColor: background || '#ffffff',
        imageRendering: 'pixelated',
      }}
    >
      {renderMode === 'canvas' ? (
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto block"
          style={{
            imageRendering: 'pixelated',
            backgroundColor: background || '#ffffff',
          }}
        />
      ) : (
        <svg
          ref={svgRef}
          className="max-w-full h-auto block"
          shapeRendering="crispEdges"
          style={{
            shapeRendering: 'crispEdges',
            backgroundColor: background || '#ffffff',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}
