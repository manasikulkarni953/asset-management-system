export interface AssetSetItem {
  id?: number;
  set_id?: number;
  category: string;
  quantity: number;
  notes?: string | null;
  tag_format?: string;
}

export interface AssetSet {
  id: number;
  name: string;
  code: string;
  tag_number?: string;
  target_department: string;
  description: string | null;
  is_active: boolean;
  items: AssetSetItem[];
  total_items?: number;
  available_kits_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAssetSetInput {
  name: string;
  code: string;
  tag_number?: string;
  target_department?: string;
  description?: string;
  employee_id?: number;
  selected_asset_ids?: number[];
  items: Array<{
    category: string;
    quantity: number;
    notes?: string;
  }>;
}

export interface UpdateAssetSetInput {
  name?: string;
  code?: string;
  tag_number?: string;
  target_department?: string;
  description?: string;
  is_active?: boolean;
  items?: Array<{
    category: string;
    quantity: number;
    notes?: string;
  }>;
}

export interface DeployAssetSetInput {
  set_id: number;
  employee_id: number;
  selected_asset_ids: number[];
  notes?: string;
}

export interface AssetTagSpec {
  category: string;
  tagFormat: string;
  prefix: string;
  description: string;
}

export const ASSET_TAG_SPECS: AssetTagSpec[] = [
  { category: 'CPU', tagFormat: 'TG-CPU-001', prefix: 'CPU', description: 'Central Processing Unit / Desktop Tower' },
  { category: 'Monitor', tagFormat: 'TG-MON-001', prefix: 'MON', description: 'Display Monitor Screen' },
  { category: 'Laptop', tagFormat: 'TG-LAP-001', prefix: 'LAP', description: 'Portable Notebook Computer' },
  { category: 'Headset', tagFormat: 'TG-HST-001', prefix: 'HST', description: 'Audio / Voice Call Headset' },
  { category: 'Keyboard', tagFormat: 'TG-KBD-001', prefix: 'KBD', description: 'Input Keyboard' },
  { category: 'Mouse', tagFormat: 'TG-MSE-001', prefix: 'MSE', description: 'Optical / Ergonomic Mouse' },
  { category: 'HDMI', tagFormat: 'TG-HDMI-001', prefix: 'HDMI', description: 'HDMI Video Interface Cable' },
  { category: 'Power Cable', tagFormat: 'TG-PWR-001', prefix: 'PWR', description: 'AC Mains Power Cable' },
  { category: 'Power Adapter', tagFormat: 'TG-ADP-001', prefix: 'ADP', description: 'DC Power Charger Adapter' },
  { category: 'Router', tagFormat: 'TG-RTR-001', prefix: 'RTR', description: 'Network Gateway / Wi-Fi Router' },
  { category: 'Gigswitch', tagFormat: 'TG-GSWH-001', prefix: 'GSWH', description: 'Gigabit Managed Network Switch' },
  { category: 'Webcam', tagFormat: 'TG-WEB-001', prefix: 'WEB', description: 'HD USB Conference Webcam' },
  { category: 'CCTV', tagFormat: 'TG-CCTV-001', prefix: 'CCTV', description: 'Surveillance Security Camera' },
  { category: 'Chair', tagFormat: 'TG-CHR-001', prefix: 'CHR', description: 'Ergonomic Office Chair' },
  { category: 'Printer', tagFormat: 'TGS-PRN-001', prefix: 'PRN', description: 'Network Document Printer' },
];

export function getAssetTagFormat(category: string, tagNumber?: string | number): string {
  const cleanDigits = String(tagNumber ?? '001').replace(/\D/g, '');
  const padTag = cleanDigits ? cleanDigits.padStart(3, '0') : '001';

  if (!category) return `TG-GEN-${padTag}`;
  const norm = category.trim().toLowerCase();
  const match = ASSET_TAG_SPECS.find((s) => s.category.toLowerCase() === norm);
  if (match) return match.tagFormat.replace(/-001$/, `-${padTag}`);
  if (norm.includes('headphone') || norm.includes('headset')) return `TG-HST-${padTag}`;
  if (norm.includes('power cable')) return `TG-PWR-${padTag}`;
  if (norm.includes('adapter')) return `TG-ADP-${padTag}`;
  if (norm.includes('cable') || norm.includes('pwr')) return `TG-PWR-${padTag}`;
  if (norm.includes('hdmi')) return `TG-HDMI-${padTag}`;
  if (norm.includes('switch')) return `TG-GSWH-${padTag}`;
  if (norm.includes('webcam') || norm.includes('cam')) return `TG-WEB-${padTag}`;
  if (norm.includes('cctv')) return `TG-CCTV-${padTag}`;
  if (norm.includes('chair')) return `TG-CHR-${padTag}`;
  if (norm.includes('printer')) return `TGS-PRN-${padTag}`;
  if (norm.includes('desktop') || norm.includes('cpu')) return `TG-CPU-${padTag}`;
  if (norm.includes('laptop')) return `TG-LAP-${padTag}`;
  if (norm.includes('monitor')) return `TG-MON-${padTag}`;
  if (norm.includes('keyboard')) return `TG-KBD-${padTag}`;
  if (norm.includes('mouse')) return `TG-MSE-${padTag}`;
  if (norm.includes('router')) return `TG-RTR-${padTag}`;
  return `TG-${category.substring(0, 3).toUpperCase()}-${padTag}`;
}
