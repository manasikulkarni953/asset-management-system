import { z } from 'zod';

export const createAssetSchema = z.object({
  category: z.string().trim().min(2, 'Category must be at least 2 characters'),
  brand: z.string().trim().min(1, 'Brand is required'),
  model: z.string().trim().min(1, 'Model is required'),
  serial_number: z.string().trim().min(1, 'Hardware serial number is required'),
  purchase_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid purchase date is required (YYYY-MM-DD)'),
  purchase_cost: z.coerce.number().min(0, 'Purchase cost must be a positive number'),
  vendor: z.string().trim().min(1, 'Vendor is required'),
  vendor_phone: z.string().trim().nullable().optional().or(z.literal('')),
  vendor_email: z.union([z.string().trim().email('Invalid vendor email format'), z.literal('')]).nullable().optional(),
  location: z.string().trim().nullable().optional().or(z.literal('')),
  warranty_expiry: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid warranty date required (YYYY-MM-DD)').nullable().optional().or(z.literal('')),
  status: z.enum(['in_stock', 'assigned', 'under_maintenance', 'retired']).default('in_stock'),
  current_employee_id: z.coerce.number().nullable().optional(),
});

export const updateAssetSchema = createAssetSchema.partial().extend({
  status: z.enum(['in_stock', 'assigned', 'under_maintenance', 'retired']).optional(),
});

export const insuranceSchema = z.object({
  asset_id: z.coerce.number().min(1, 'Asset is required'),
  provider: z.string().trim().min(1, 'Insurance provider is required'),
  policy_number: z.string().trim().min(1, 'Policy number is required'),
  start_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid start date required (YYYY-MM-DD)'),
  expiry_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid expiry date required (YYYY-MM-DD)'),
  coverage_amount: z.coerce.number().min(0, 'Coverage amount must be a positive number'),
  notes: z.string().trim().nullable().optional().or(z.literal('')),
  document_url: z.string().trim().nullable().optional().or(z.literal('')),
}).refine((data) => new Date(data.expiry_date) > new Date(data.start_date), {
  message: 'Expiry date must be after Start Date',
  path: ['expiry_date'],
});

export const networkSchema = z.object({
  asset_id: z.coerce.number().min(1, 'Asset is required'),
  assignment_type: z.enum(['DHCP', 'Static']).default('Static'),
  ip_address: z.string().trim().min(1, 'IP address is required').regex(
    /^(\d{1,3}\.){3}\d{1,3}$/,
    'Invalid IPv4 address format (e.g. 192.168.1.50)'
  ),
  subnet_mask: z.string().trim().nullable().optional().or(z.literal('')),
  default_gateway: z.string().trim().nullable().optional().or(z.literal('')),
  dns_server: z.string().trim().nullable().optional().or(z.literal('')),
  mac_address: z.string().trim().min(1, 'MAC address is required').regex(
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/,
    'Invalid MAC address format (e.g. A4:83:E7:22:9C:5F)'
  ),
  hostname: z.string().trim().min(1, 'Hostname is required'),
  network_name: z.string().trim().nullable().optional().or(z.literal('')),
  vlan: z.string().trim().nullable().optional().or(z.literal('')),
  notes: z.string().trim().nullable().optional().or(z.literal('')),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type InsuranceInput = z.infer<typeof insuranceSchema>;
export type NetworkInput = z.infer<typeof networkSchema>;
