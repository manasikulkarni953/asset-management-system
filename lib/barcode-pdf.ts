import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

export interface GenerateStickerPDFOptions {
  assetNumber: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  companyName?: string;
  copies?: number;
  showDetails?: boolean;
}

/**
 * Generates and downloads a print-ready vector/raster PDF specifically sized
 * for 55mm (Width) x 25mm (Height) thermal label printers.
 * Each copy requested creates a distinct 55mm x 25mm label page in the PDF.
 */
export async function downloadBarcodeStickerPDF({
  assetNumber,
  category,
  brand,
  model,
  serialNumber,
  companyName = 'TGS ASSET MANAGEMENT',
  copies = 1,
  showDetails = true,
}: GenerateStickerPDFOptions): Promise<void> {
  if (!assetNumber) {
    throw new Error('Asset number is required to generate barcode sticker PDF');
  }

  const cleanAssetNumber = assetNumber.trim();
  const totalCopies = Math.max(1, copies || 1);
  const modelText = [brand, model].filter(Boolean).join(' ') || category || 'Hardware';

  // Clean serial number: strip accidental leading dashes/spaces and guarantee clear prefix
  const rawSerial = serialNumber ? serialNumber.trim().replace(/^[-_\s]+/, '') : '';
  const displaySerial = rawSerial
    ? (rawSerial.toUpperCase().startsWith('SN:') || rawSerial.toUpperCase().startsWith('S/N:')
        ? rawSerial
        : `SN: ${rawSerial}`)
    : 'PROPERTY OF TGS';

  // 1. Render high-resolution monochrome Code 128 barcode to offscreen canvas
  // Module width 3 with quiet zones gives ultra-sharp 300+ DPI rasterization for vector-grade PDF
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  JsBarcode(canvas, cleanAssetNumber, {
    format: 'CODE128',
    width: 3,
    height: 100,
    displayValue: false,
    margin: 6,
    background: '#ffffff',
    lineColor: '#000000',
  });
  const barcodeDataUrl = canvas.toDataURL('image/png');

  // 2. Initialize jsPDF: exactly 55mm (Width) x 25mm (Height)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [25, 55],
  });

  for (let i = 0; i < totalCopies; i++) {
    if (i > 0) {
      doc.addPage([25, 55], 'landscape');
    }

    // Pure white label background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 55, 25, 'F');

    // Label boundary border with rounded corners matching sticker preview
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.roundedRect(0.5, 0.5, 54, 24, 1.5, 1.5, 'S');

    // --- TOP HEADER ---
    // Company Name (left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);
    const displayCompany = companyName.toUpperCase();
    doc.text(displayCompany, 1.5, 3.2);

    // Category Badge (right: clean framed pill with black text to prevent thermal bloom)
    const catBadge = (category || 'ASSET').toUpperCase();
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    const badgeTextWidth = doc.getTextWidth(catBadge);
    const badgeWidth = Math.max(badgeTextWidth + 2.6, 7.5);
    const badgeX = 53.5 - badgeWidth;
    
    // Draw white badge with 1px black outline
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.roundedRect(badgeX, 1.1, badgeWidth, 3.1, 0.8, 0.8, 'FD');
    // Draw black category text inside badge
    doc.setTextColor(0, 0, 0);
    doc.text(catBadge, badgeX + (badgeWidth - badgeTextWidth) / 2, 3.35);

    // Header divider line (black)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.line(1.5, 4.7, 53.5, 4.7);

    // --- CENTER BARCODE ---
    // Physical dimensions: width 48mm, height 9.5mm, centered horizontally at x = 3.5mm
    doc.addImage(barcodeDataUrl, 'PNG', 3.5, 5.0, 48, 9.5);

    // Asset Number text below barcode (bold high-legibility Helvetica)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(0, 0, 0);
    doc.text(cleanAssetNumber, 27.5, 17.6, { align: 'center' });

    // --- BOTTOM FOOTER ---
    if (showDetails) {
      // Divider line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.line(1.5, 19.3, 53.5, 19.3);

      // Model (left)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(0, 0, 0);
      const safeModel = modelText.length > 27 ? modelText.substring(0, 26) + '…' : modelText;
      doc.text(safeModel, 1.5, 22.8);

      // Serial Number (right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      const safeSN = displaySerial.length > 25 ? displaySerial.substring(0, 24) + '…' : displaySerial;
      doc.text(safeSN, 53.5, 22.8, { align: 'right' });
    }
  }

  // 3. Trigger download with clear, structured filename
  const safeAsset = cleanAssetNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `Asset_Sticker_${safeAsset}_${totalCopies}_labels.pdf`;
  doc.save(filename);
}
