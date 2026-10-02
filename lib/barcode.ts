export interface BarcodeOptions {
  format?: 'CODE128';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  textMargin?: number;
  background?: string;
  lineColor?: string;
  margin?: number;
}

export const DEFAULT_BARCODE_OPTIONS: BarcodeOptions = {
  format: 'CODE128',
  width: 2, // Integer 2px module width guarantees 100% sharp non-anti-aliased bar ratios
  height: 90, // Taller bars ensure horizontal scanlines cross code even at tilt or distance
  displayValue: true,
  fontSize: 15,
  textMargin: 8,
  background: '#ffffff',
  lineColor: '#000000',
  margin: 24, // ISO 15417 compliant quiet zone (>= 10X = 20px)
};

export function isValidCode128(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // Code 128 supports standard ASCII (0-127)
  return /^[\x00-\x7F]+$/.test(value.trim());
}

export function cleanBarcodeScan(rawValue: string): string {
  if (!rawValue || typeof rawValue !== 'string') return '';
  let cleaned = rawValue.trim();

  // Strip non-printable control characters, BOM, and null bytes
  cleaned = cleaned.replace(/[\x00-\x1F\x7F\uFEFF]/g, '');

  // Strip wrapping single or double quotes
  cleaned = cleaned.replace(/^["']|["']$/g, '');

  // If a URL or deep link was decoded (e.g. from a sticker fallback QR code or query parameter)
  if (cleaned.includes('/assets/')) {
    const parts = cleaned.split('/assets/');
    cleaned = parts[parts.length - 1].split('?')[0].split('#')[0];
  } else if (cleaned.includes('code=')) {
    const match = cleaned.match(/code=([^&]+)/);
    if (match) cleaned = match[1];
  } else if (cleaned.includes('assetNumber=')) {
    const match = cleaned.match(/assetNumber=([^&]+)/);
    if (match) cleaned = match[1];
  }

  // Final trim and return
  return cleaned.trim();
}

